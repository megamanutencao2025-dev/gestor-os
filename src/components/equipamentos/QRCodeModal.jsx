import React, { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, QrCode } from "lucide-react";

export default function QRCodeModal({ equipamento, isOpen, onClose }) {
  const qrRef = useRef(null);
  
  if (!equipamento) return null;

  const qrData = JSON.stringify({
    codigo: equipamento.codigo,
    nome: equipamento.descricao,
    id: equipamento.id
  });

  const generateQRCode = () => {
    // Usando uma API pública para gerar QR code
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;
    return qrUrl;
  };

  const handleDownload = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Configurar canvas para etiqueta 104x60mm (aproximadamente 295x170 pixels a 72 DPI)
    canvas.width = 295;
    canvas.height = 170;
    
    // Fundo branco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Carregar a imagem do QR code
    const qrImage = new Image();
    qrImage.onload = () => {
      // Desenhar QR code (lado esquerdo)
      ctx.drawImage(qrImage, 10, 10, 150, 150);
      
      // Configurar texto
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 16px Arial';
      
      // Código do equipamento
      ctx.fillText(equipamento.codigo, 170, 30);
      
      // Nome do equipamento (quebrar em linhas se necessário)
      ctx.font = '12px Arial';
      const maxWidth = 115;
      const lineHeight = 15;
      let y = 50;
      
      const words = equipamento.descricao.split(' ');
      let line = '';
      
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        
        if (testWidth > maxWidth && n > 0) {
          ctx.fillText(line, 170, y);
          line = words[n] + ' ';
          y += lineHeight;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, 170, y);
      
      // Download
      const link = document.createElement('a');
      link.download = `qr-${equipamento.codigo}.png`;
      link.href = canvas.toDataURL();
      link.click();
    };
    qrImage.src = generateQRCode();
  };

  const handlePrint = () => {
    const printWindow = window.open('', '', 'width=400,height=300');
    printWindow.document.write(`
      <html>
        <head>
          <title>QR Code - ${equipamento.codigo}</title>
          <style>
            body {
              margin: 0;
              padding: 10px;
              font-family: Arial, sans-serif;
            }
            .label {
              width: 104mm;
              height: 60mm;
              border: 1px solid #ccc;
              display: flex;
              align-items: center;
              padding: 5mm;
              box-sizing: border-box;
            }
            .qr-section {
              width: 40mm;
              height: 40mm;
              margin-right: 5mm;
            }
            .qr-section img {
              width: 100%;
              height: 100%;
            }
            .info-section {
              flex: 1;
            }
            .codigo {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .nome {
              font-size: 12px;
              line-height: 1.3;
            }
            @media print {
              .label { border: none; }
            }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="qr-section">
              <img src="${generateQRCode()}" alt="QR Code" />
            </div>
            <div class="info-section">
              <div class="codigo">${equipamento.codigo}</div>
              <div class="nome">${equipamento.descricao}</div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            QR Code - {equipamento.codigo}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="border rounded-lg p-4 bg-white">
            <div className="flex items-center gap-4">
              <img 
                src={generateQRCode()} 
                alt="QR Code"
                className="w-32 h-32 border rounded"
              />
              <div className="flex-1">
                <div className="font-bold text-lg">{equipamento.codigo}</div>
                <div className="text-sm text-slate-600 mt-1">{equipamento.descricao}</div>
                <div className="text-xs text-slate-500 mt-2">
                  Etiqueta: 104x60mm
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={handleDownload} className="flex-1 bg-blue-600 hover:bg-blue-700">
              <Download className="w-4 h-4 mr-2" />
              Download PNG
            </Button>
            <Button onClick={handlePrint} variant="outline" className="flex-1">
              <Printer className="w-4 h-4 mr-2" />
              Imprimir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}