import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatarData } from "@/components/utils/dateUtils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function VisualizacaoParadasModal({ isOpen, onClose, equipamento, paradas }) {
  if (!equipamento || !paradas) return null;

  const formatTempo = (minutos) => {
    if (minutos === 0) return "0min";
    const horas = Math.floor(minutos / 60);
    const mins = Math.round(minutos % 60);
    let result = '';
    if (horas > 0) {
      result += `${horas}h `;
    }
    result += `${mins}min`;
    return result.trim();
  };

  const totalMinutos = paradas.reduce((sum, p) => sum + (p.tempo_parado || 0), 0);
  const totalParadas = paradas.length;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const printContent = generatePrintHTML();

    printWindow.document.write(printContent);
    printWindow.document.close();

    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  };

  const generatePrintHTML = () => {
    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Relatório de Paradas - ${equipamento.nome}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: A4; margin: 18mm; }
          body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; line-height: 1.4; color: #000; background: #fff; }
          .container { max-width: 100%; }
          
          .header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; page-break-inside: avoid; }
          .header h1 { font-size: 18pt; font-weight: bold; margin-bottom: 8px; color: #000; }
          .header .info { font-size: 9pt; color: #333; margin-top: 4px; line-height: 1.6; }
          
          .resumo { background: #f5f5f5; padding: 12px; margin-bottom: 20px; border: 1px solid #000; border-radius: 4px; }
          .resumo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
          .resumo-item { text-align: center; }
          .resumo-item .label { font-size: 8pt; color: #666; text-transform: uppercase; font-weight: 600; margin-bottom: 4px; }
          .resumo-item .value { font-size: 16pt; font-weight: bold; color: #000; }
          .resumo-item.destaque .value { color: #c62828; }
          
          table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-top: 10px; }
          thead { background: #e0e0e0; }
          th { padding: 8px 10px; text-align: left; font-weight: 700; border: 1px solid #000; }
          td { padding: 7px 10px; border: 1px solid #666; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .font-bold { font-weight: 700; }
          tbody tr:nth-child(even) { background: #f9f9f9; }
          
          .footer { margin-top: 25px; padding-top: 10px; border-top: 1px solid #666; text-align: center; font-size: 8pt; color: #666; }
          
          .tempo-destaque { color: #c62828; font-weight: 700; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Relatório de Tempo de Máquina Parada</h1>
            <div class="info">
              <strong>Equipamento:</strong> ${equipamento.nome}<br>
              <strong>Data do Relatório:</strong> ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </div>
          </div>

          <div class="resumo">
            <div class="resumo-grid">
              <div class="resumo-item">
                <div class="label">Total de Paradas</div>
                <div class="value">${totalParadas}</div>
              </div>
              <div class="resumo-item destaque">
                <div class="label">Tempo Total Parado</div>
                <div class="value">${formatTempo(totalMinutos)}</div>
              </div>
              <div class="resumo-item">
                <div class="label">Tempo Médio por Parada</div>
                <div class="value">${formatTempo(totalParadas > 0 ? totalMinutos / totalParadas : 0)}</div>
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 12%">Número OS</th>
                <th style="width: 15%">Data Início</th>
                <th style="width: 12%">Hora Início</th>
                <th style="width: 15%">Data Fim</th>
                <th style="width: 12%">Hora Fim</th>
                <th style="width: 17%" class="text-center">Tempo Parado</th>
                <th style="width: 17%">Tipo Manutenção</th>
              </tr>
            </thead>
            <tbody>
              ${paradas.map(parada => `
                <tr>
                  <td class="font-bold">#${parada.numero}</td>
                  <td>${formatarData(parada.data_programada)}</td>
                  <td>${parada.hora_programada || '-'}</td>
                  <td>${formatarData(parada.data_finalizada)}</td>
                  <td>${parada.hora_finalizada || '-'}</td>
                  <td class="text-center tempo-destaque">${formatTempo(parada.tempo_parado)}</td>
                  <td>${parada.tipo_nome || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">
            <p>MaintenancePro - Sistema de Gerenciamento de Manutenção</p>
            <p>Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex justify-between items-center">
            <div>
              <DialogTitle className="text-2xl">Paradas do Equipamento</DialogTitle>
              <p className="text-sm text-slate-600 mt-1">{equipamento.nome}</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 gap-2">
                <Printer className="w-4 h-4" />
                Imprimir
              </Button>
              <Button onClick={onClose} variant="outline" size="icon">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(95vh-120px)] p-6">
          <div className="space-y-6">
            {/* Cards de Resumo */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-xs text-blue-700 font-semibold uppercase tracking-wide mb-1">Total de Paradas</p>
                <p className="text-3xl font-bold text-blue-900">{totalParadas}</p>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-xs text-red-700 font-semibold uppercase tracking-wide mb-1">Tempo Total Parado</p>
                <p className="text-3xl font-bold text-red-700">{formatTempo(totalMinutos)}</p>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-xs text-orange-700 font-semibold uppercase tracking-wide mb-1">Tempo Médio por Parada</p>
                <p className="text-3xl font-bold text-orange-700">
                  {formatTempo(totalParadas > 0 ? totalMinutos / totalParadas : 0)}
                </p>
              </div>
            </div>

            {/* Tabela de Paradas */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-100 sticky top-0">
                  <TableRow>
                    <TableHead className="font-semibold">Número OS</TableHead>
                    <TableHead className="font-semibold">Data Início</TableHead>
                    <TableHead className="font-semibold">Hora Início</TableHead>
                    <TableHead className="font-semibold">Data Fim</TableHead>
                    <TableHead className="font-semibold">Hora Fim</TableHead>
                    <TableHead className="font-semibold text-center">Tempo Parado</TableHead>
                    <TableHead className="font-semibold">Tipo Manutenção</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paradas.map((parada, idx) => (
                    <TableRow key={idx} className="hover:bg-slate-50">
                      <TableCell className="font-bold text-blue-600">#{parada.numero}</TableCell>
                      <TableCell>{formatarData(parada.data_programada)}</TableCell>
                      <TableCell>{parada.hora_programada || '-'}</TableCell>
                      <TableCell>{formatarData(parada.data_finalizada)}</TableCell>
                      <TableCell>{parada.hora_finalizada || '-'}</TableCell>
                      <TableCell className="text-center font-bold text-red-600 text-lg">
                        {formatTempo(parada.tempo_parado)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{parada.tipo_nome || '-'}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}