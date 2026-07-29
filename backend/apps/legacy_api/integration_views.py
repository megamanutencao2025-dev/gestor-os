import json
import re
import urllib.error
import urllib.request
import uuid
from urllib.parse import unquote, urlparse

from django.conf import settings
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import serializers, status
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.accounts.models import User, UserModulePermission
from apps.data_transfer.csv_codec import CsvImportError, parse_csv


class IntegrationPermission(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.role == User.Role.ADMIN:
            return True
        return UserModulePermission.objects.filter(
            user=user,
            module__key__in=view.required_module_keys,
            module__active=True,
            can_access=True,
        ).exists()


class ExtractSerializer(serializers.Serializer):
    file_url = serializers.CharField(max_length=2000)
    json_schema = serializers.JSONField(required=False)


def local_upload_path(file_url):
    parsed = urlparse(file_url)
    media_prefix = f"/{settings.MEDIA_URL.strip('/')}/"
    if not parsed.path.startswith(media_prefix):
        raise ValueError("O arquivo nao pertence ao storage da aplicacao.")
    relative_path = unquote(parsed.path.removeprefix(media_prefix))
    candidate = (settings.MEDIA_ROOT / relative_path).resolve()
    media_root = settings.MEDIA_ROOT.resolve()
    if candidate != media_root and media_root not in candidate.parents:
        raise ValueError("Caminho de arquivo invalido.")
    if not candidate.is_file():
        raise ValueError("Arquivo nao encontrado.")
    return candidate


def coerce_by_schema(row, schema):
    properties = (schema or {}).get("items", {}).get("properties", {})
    result = dict(row)
    for key, definition in properties.items():
        value = row.get(key, "")
        if definition.get("type") == "number":
            text = str(value or "").strip()
            if "," in text:
                text = text.replace(".", "").replace(",", ".")
            result[key] = float(text) if text else None
        elif definition.get("type") == "boolean":
            result[key] = str(value).strip().lower() in {
                "true",
                "1",
                "sim",
                "s",
                "yes",
            }
    return result


class ExtractUploadedFileView(GenericAPIView):
    serializer_class = ExtractSerializer
    permission_classes = [IntegrationPermission]
    required_module_keys = {"ordens_servico", "cadastros"}

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            path = local_upload_path(serializer.validated_data["file_url"])
            if path.suffix.lower() in {".xlsx", ".xls"}:
                return Response(
                    {
                        "status": "error",
                        "details": (
                            "Importacao de Excel ainda nao esta disponivel. Use CSV ou JSON."
                        ),
                    }
                )
            if path.suffix.lower() == ".json":
                content = json.loads(path.read_text(encoding="utf-8-sig"))
                rows = content if isinstance(content, list) else [content]
            else:
                rows = parse_csv(SimpleUploadedFile(path.name, path.read_bytes()))
            output = [
                coerce_by_schema(row, serializer.validated_data.get("json_schema")) for row in rows
            ]
            return Response({"status": "success", "output": output})
        except (CsvImportError, json.JSONDecodeError, OSError, ValueError) as exc:
            return Response({"status": "error", "details": str(exc)})


class LlmSerializer(serializers.Serializer):
    prompt = serializers.CharField()
    sessionId = serializers.CharField(required=False, allow_blank=True)
    provider = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    temperature = serializers.FloatField(required=False, min_value=0, max_value=2)
    max_tokens = serializers.IntegerField(required=False, min_value=1, max_value=8192)
    preserve_context = serializers.BooleanField(required=False)
    response_json_schema = serializers.JSONField(required=False)


def post_json(url, payload, headers):
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    try:
        with urllib.request.urlopen(
            request,
            timeout=settings.AI_REQUEST_TIMEOUT_SECONDS,
        ) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="replace")
        raise ValueError(f"Provedor de IA retornou HTTP {exc.code}: {details[:300]}") from exc
    except urllib.error.URLError as exc:
        raise ValueError(f"Nao foi possivel conectar ao provedor de IA: {exc.reason}") from exc


def select_provider(requested):
    candidates = [
        requested,
        settings.AI_DEFAULT_PROVIDER,
        "gemini",
        "deepseek",
        "chatgpt",
        "groq",
    ]
    for provider in candidates:
        if provider and settings.AI_PROVIDERS.get(provider, {}).get("api_key"):
            return provider
    raise ValueError("Nenhum provedor de IA esta configurado.")


def call_gemini(config, prompt, temperature, max_tokens):
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{config['model']}:generateContent"
    )
    result = post_json(
        url,
        {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            },
        },
        {"x-goog-api-key": config["api_key"]},
    )
    candidates = result.get("candidates") or []
    parts = candidates[0].get("content", {}).get("parts", []) if candidates else []
    text = "".join(part.get("text", "") for part in parts)
    usage = result.get("usageMetadata") or {}
    return text, int(usage.get("totalTokenCount") or 0)


def call_openai_compatible(provider, config, prompt, temperature, max_tokens):
    urls = {
        "deepseek": "https://api.deepseek.com/chat/completions",
        "chatgpt": "https://api.openai.com/v1/chat/completions",
        "groq": "https://api.groq.com/openai/v1/chat/completions",
    }
    result = post_json(
        urls[provider],
        {
            "model": config["model"],
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "max_tokens": max_tokens,
        },
        {"Authorization": f"Bearer {config['api_key']}"},
    )
    choices = result.get("choices") or []
    text = choices[0].get("message", {}).get("content", "") if choices else ""
    return text, int((result.get("usage") or {}).get("total_tokens") or 0)


def parse_structured_response(text):
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    return json.loads(cleaned)


class InvokeLlmView(GenericAPIView):
    serializer_class = LlmSerializer
    permission_classes = [IntegrationPermission]
    required_module_keys = {"assistente_ia", "cadastros"}
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "llm"

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            provider = select_provider(data.get("provider"))
            config = settings.AI_PROVIDERS[provider]
            prompt = data["prompt"]
            response_schema = data.get("response_json_schema")
            if response_schema:
                prompt = (
                    f"{prompt}\n\nResponda somente com JSON valido conforme este schema: "
                    f"{json.dumps(response_schema, ensure_ascii=False)}"
                )
            temperature = data.get("temperature", 0.3)
            max_tokens = data.get("max_tokens", 500)
            if provider == "gemini":
                text, tokens = call_gemini(
                    config,
                    prompt,
                    temperature,
                    max_tokens,
                )
            else:
                text, tokens = call_openai_compatible(
                    provider,
                    config,
                    prompt,
                    temperature,
                    max_tokens,
                )
            if response_schema:
                return Response(parse_structured_response(text))

            session_id = data.get("sessionId") or str(uuid.uuid4())
            cache_key = f"ai-session:{request.user.pk}:{session_id}"
            context = cache.get(
                cache_key,
                {"messageCount": 0, "providersUsed": []},
            )
            context["messageCount"] += 2
            if provider not in context["providersUsed"]:
                context["providersUsed"].append(provider)
            cache.set(cache_key, context, timeout=60 * 60 * 24)
            return Response(
                {
                    "response": text,
                    "provider": provider,
                    "model": config["model"],
                    "contextInfo": {
                        "sessionId": session_id,
                        **context,
                    },
                    "usage": {
                        "tokens": tokens,
                        "cost": 0,
                        "cached": False,
                    },
                }
            )
        except (json.JSONDecodeError, ValueError) as exc:
            return Response(
                {
                    "message": "Nao foi possivel processar a solicitacao de IA.",
                    "error": str(exc),
                    "code": "AI_PROVIDER_ERROR",
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
