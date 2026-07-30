import React, { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
import { AlertCircle, Camera, Loader2, RotateCcw, SwitchCamera } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function cameraErrorMessage(error) {
  if (!window.isSecureContext) {
    return "A câmera requer uma conexão HTTPS.";
  }

  const messages = {
    NotAllowedError: "Permissão da câmera negada. Libere o acesso nas configurações do navegador.",
    NotFoundError: "Nenhuma câmera foi encontrada neste dispositivo.",
    NotReadableError: "A câmera não forneceu imagem. Feche outros aplicativos ou troque a câmera.",
    AbortError: "A câmera foi interrompida pelo navegador. Tente novamente.",
    OverconstrainedError: "A câmera disponível não atende aos requisitos de captura.",
    SecurityError: "O navegador bloqueou o acesso à câmera.",
  };

  return messages[error?.name] || "Não foi possível iniciar a câmera.";
}

function waitForVideoReady(video, timeout = 8000) {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const finish = () => {
      window.clearTimeout(timer);
      video.removeEventListener("loadeddata", handleReady);
      video.removeEventListener("playing", handleReady);
      resolve();
    };
    const handleReady = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        finish();
      }
    };
    const timer = window.setTimeout(() => {
      video.removeEventListener("loadeddata", handleReady);
      video.removeEventListener("playing", handleReady);
      reject(new DOMException("A câmera não produziu imagem.", "NotReadableError"));
    }, timeout);

    video.addEventListener("loadeddata", handleReady);
    video.addEventListener("playing", handleReady);
  });
}

export default function QrScannerDialog({ open, onOpenChange, onDetected }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const onDetectedRef = useRef(onDetected);
  const onOpenChangeRef = useRef(onOpenChange);
  const handledRef = useRef(false);
  const [status, setStatus] = useState("starting");
  const [error, setError] = useState("");
  const [restartKey, setRestartKey] = useState(0);
  const [videoDevices, setVideoDevices] = useState([]);
  const [activeDeviceId, setActiveDeviceId] = useState("");
  const [preferredDeviceId, setPreferredDeviceId] = useState("");

  useEffect(() => {
    onDetectedRef.current = onDetected;
    onOpenChangeRef.current = onOpenChange;
  }, [onDetected, onOpenChange]);

  useEffect(() => {
    if (!open) return undefined;

    let disposed = false;
    handledRef.current = false;
    setStatus("starting");
    setError("");

    const stopScanner = () => {
      controlsRef.current?.stop();
      controlsRef.current = null;

      const stream = videoRef.current?.srcObject;
      if (stream instanceof MediaStream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };

    const startScanner = async () => {
      let stream = null;
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new DOMException("Camera indisponível", "NotFoundError");
        }

        const video = videoRef.current;
        if (!video) {
          throw new DOMException("Visualização indisponível", "NotReadableError");
        }

        const videoConstraints = preferredDeviceId
          ? { deviceId: { exact: preferredDeviceId } }
          : { facingMode: { ideal: "environment" } };

        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: videoConstraints,
        });

        if (disposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        video.srcObject = stream;
        video.muted = true;
        video.setAttribute("playsinline", "");

        const [track] = stream.getVideoTracks();
        const currentDeviceId = track?.getSettings?.().deviceId || "";
        setActiveDeviceId(currentDeviceId);

        navigator.mediaDevices.enumerateDevices()
          .then((devices) => devices.filter((device) => device.kind === "videoinput"))
          .then((devices) => {
            if (!disposed) setVideoDevices(devices);
          })
          .catch(() => {});

        await video.play();
        await waitForVideoReady(video);

        const reader = new BrowserQRCodeReader();
        const controls = await reader.decodeFromStream(
          stream,
          video,
          (result, scanError, scannerControls) => {
            if (result && !handledRef.current) {
              handledRef.current = true;
              scannerControls.stop();
              onDetectedRef.current?.(result.getText());
              onOpenChangeRef.current?.(false);
              return;
            }

            if (
              scanError
              && !["NotFoundException", "ChecksumException", "FormatException"].includes(
                scanError.name
              )
            ) {
              console.error("Erro durante a leitura do QR Code:", scanError);
            }
          }
        );

        if (disposed) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
        setStatus("scanning");
      } catch (cameraError) {
        stream?.getTracks().forEach((track) => track.stop());
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        if (!disposed) {
          setStatus("error");
          setError(cameraErrorMessage(cameraError));
        }
      }
    };

    startScanner();

    return () => {
      disposed = true;
      stopScanner();
    };
  }, [open, preferredDeviceId, restartKey]);

  const switchCamera = () => {
    if (videoDevices.length < 2) return;
    const currentIndex = videoDevices.findIndex(
      (device) => device.deviceId === activeDeviceId
    );
    const nextIndex = currentIndex >= 0
      ? (currentIndex + 1) % videoDevices.length
      : 0;
    controlsRef.current?.stop();
    setPreferredDeviceId(videoDevices[nextIndex].deviceId);
  };

  const handleOpenChange = (nextOpen) => {
    if (!nextOpen) {
      controlsRef.current?.stop();
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-xl overflow-hidden p-0">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-blue-600" />
            Escanear QR Code
          </DialogTitle>
          <DialogDescription className="sr-only">
            Leitura do QR Code do equipamento pela câmera.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-5">
          <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-slate-700 bg-black">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              aria-label="Visualização da câmera para leitura do QR Code"
              className="h-full w-full object-cover"
            />

            {status === "scanning" && (
              <>
                <div className="pointer-events-none absolute inset-[12%] rounded-md border-2 border-white shadow-[0_0_0_999px_rgba(0,0,0,0.16)]" />
                <div className="pointer-events-none absolute left-[12%] right-[12%] top-1/2 h-0.5 animate-pulse bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.9)]" />
                <div className="absolute left-3 top-3 flex items-center gap-2 rounded bg-black/70 px-2.5 py-1.5 text-xs font-medium text-white">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Câmera ativa
                </div>
                <div
                  className="absolute bottom-3 left-1/2 w-max max-w-[85%] -translate-x-1/2 rounded bg-black/75 px-3 py-1.5 text-center text-sm text-white"
                  aria-live="polite"
                >
                  Aponte a câmera para o QR Code
                </div>
                {videoDevices.length > 1 && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute right-3 top-3 bg-black/70 text-white hover:bg-black/90"
                    onClick={switchCamera}
                    title="Trocar câmera"
                    aria-label="Trocar câmera"
                  >
                    <SwitchCamera className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}

            {status === "starting" && (
              <div className="absolute inset-0 flex items-center justify-center text-white">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Iniciando câmera...
              </div>
            )}

            {status === "error" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center text-white">
                <AlertCircle className="mb-3 h-8 w-8 text-red-400" />
                <span className="font-medium">A câmera não exibiu imagem</span>
                <span className="mt-1 text-sm text-slate-300">
                  Use as opções abaixo para tentar novamente.
                </span>
              </div>
            )}
          </div>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between gap-3">
                <span>{error}</span>
                <div className="flex shrink-0 gap-2">
                  {videoDevices.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={switchCamera}
                      title="Trocar câmera"
                      aria-label="Trocar câmera"
                    >
                      <SwitchCamera className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setRestartKey((value) => value + 1)}
                    title="Tentar novamente"
                    aria-label="Tentar novamente"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
