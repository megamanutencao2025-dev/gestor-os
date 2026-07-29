import React, { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
import { AlertCircle, Camera, Loader2, RotateCcw } from "lucide-react";
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
    NotReadableError: "A câmera está sendo usada por outro aplicativo.",
    OverconstrainedError: "A câmera disponível não atende aos requisitos de captura.",
    SecurityError: "O navegador bloqueou o acesso à câmera.",
  };

  return messages[error?.name] || "Não foi possível iniciar a câmera.";
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
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new DOMException("Camera indisponível", "NotFoundError");
        }

        const reader = new BrowserQRCodeReader();
        const controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          videoRef.current,
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
  }, [open, restartKey]);

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
          <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-black">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
            />

            {status === "scanning" && (
              <>
                <div className="pointer-events-none absolute inset-[14%] rounded-md border-2 border-white shadow-[0_0_0_999px_rgba(0,0,0,0.28)]" />
                <div
                  className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded bg-black/70 px-3 py-1.5 text-sm text-white"
                  aria-live="polite"
                >
                  Procurando QR Code...
                </div>
              </>
            )}

            {status === "starting" && (
              <div className="absolute inset-0 flex items-center justify-center text-white">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Iniciando câmera...
              </div>
            )}
          </div>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between gap-3">
                <span>{error}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => setRestartKey((value) => value + 1)}
                  title="Tentar novamente"
                  aria-label="Tentar novamente"
                >
                  <RotateCcw />
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
