import os

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Cria ou promove o administrador inicial sem usar credenciais fixas."

    def add_arguments(self, parser):
        parser.add_argument(
            "--username",
            default=os.getenv("DJANGO_ADMIN_USERNAME", "admin"),
        )
        parser.add_argument(
            "--email",
            default=os.getenv("DJANGO_ADMIN_EMAIL", "admin@localhost"),
        )
        parser.add_argument("--reset-password", action="store_true")

    def handle(self, *args, **options):
        user_model = get_user_model()
        username = options["username"].strip()
        email = options["email"].strip() or None
        password = os.getenv("DJANGO_ADMIN_PASSWORD")

        if not username:
            raise CommandError("DJANGO_ADMIN_USERNAME nao pode ser vazio.")

        user = user_model.objects.filter(username__iexact=username).first()
        if user is None or options["reset_password"]:
            if not password:
                raise CommandError(
                    "Defina DJANGO_ADMIN_PASSWORD para criar ou redefinir o administrador."
                )
            try:
                validate_password(password, user)
            except ValidationError as exc:
                raise CommandError("Senha invalida: " + " ".join(exc.messages)) from exc

        created = user is None
        if created:
            user = user_model(username=username)

        user.email = email
        user.full_name = user.full_name or "Administrador"
        user.role = user_model.Role.ADMIN
        user.is_active = True
        user.is_superuser = True
        if created or options["reset_password"]:
            user.set_password(password)
        user.save()

        action = "criado" if created else "promovido/atualizado"
        self.stdout.write(self.style.SUCCESS(f"Administrador '{username}' {action}."))
