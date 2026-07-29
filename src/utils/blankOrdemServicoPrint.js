const blankCell = "&nbsp;";

const serviceRows = Array.from({ length: 3 }, (_, index) => `
  <tr>
    <td>${index + 1}</td>
    <td>${blankCell}</td>
    <td>${blankCell}</td>
    <td>${blankCell}</td>
    <td>${blankCell}</td>
    <td>${blankCell}</td>
  </tr>
  <tr>
    <td colspan="6" class="description-cell">
      <strong>Servi&ccedil;o realizado:</strong>
    </td>
  </tr>
`).join("");

const materialRows = Array.from({ length: 4 }, () => `
  <tr>
    <td>${blankCell}</td>
    <td>${blankCell}</td>
    <td>${blankCell}</td>
    <td>${blankCell}</td>
    <td>${blankCell}</td>
  </tr>
`).join("");

const outrosRows = Array.from({ length: 2 }, () => `
  <tr>
    <td>${blankCell}</td>
    <td>${blankCell}</td>
    <td>${blankCell}</td>
    <td>${blankCell}</td>
    <td>${blankCell}</td>
  </tr>
`).join("");

const getTodayLabel = () => {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export const generateBlankOrdemServicoPrintHTML = () => `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ordem de Servi&ccedil;o em Branco</title>
    <style>
      @page {
        size: A4;
        margin: 8mm;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        width: 210mm;
        min-height: 297mm;
        background: #ffffff;
      }

      body {
        color: #222222;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 8.5px;
        line-height: 1.2;
      }

      .sheet {
        position: relative;
        width: 194mm;
        height: 281mm;
        margin: 0 auto;
        overflow: hidden;
        background: #ffffff;
      }

      table {
        width: 100%;
        table-layout: fixed;
        border-collapse: collapse;
      }

      td,
      th {
        border: 1px solid #333333;
        padding: 2.4px 3px;
        vertical-align: top;
      }

      th {
        background: #e9ecef;
        font-weight: 700;
        text-align: center;
      }

      .header-table {
        border: 2px solid #333333;
      }

      .logo-cell {
        width: 31mm;
        text-align: center;
        vertical-align: middle;
        background: #f8f9fa;
      }

      .brand {
        color: #ff6b35;
        font-size: 15px;
        font-weight: 700;
      }

      .title-cell {
        text-align: center;
        vertical-align: middle;
        background: #f8f9fa;
        font-size: 15px;
        font-weight: 700;
        letter-spacing: 0;
      }

      .os-info-cell {
        width: 34mm;
        background: #f8f9fa;
        line-height: 1.35;
      }

      .os-number {
        color: #d63384;
        font-size: 12px;
        font-weight: 700;
        margin-bottom: 2px;
      }

      .section-table,
      .services-table {
        border: 2px solid #333333;
        margin-top: -1px;
      }

      .section-header {
        height: 5.2mm;
        background: #e9ecef;
        border: 1px solid #333333;
        font-weight: 700;
        text-align: center;
        vertical-align: middle;
      }

      .field-label {
        height: 5mm;
        background: #f8f9fa;
        font-weight: 700;
      }

      .blank-cell {
        height: 8mm;
      }

      .medium-cell {
        height: 12mm;
      }

      .large-cell {
        height: 18mm;
      }

      .description-cell {
        height: 12mm;
        background: #ffffff;
        text-align: left;
      }

      .services-table th,
      .services-table td {
        font-size: 8px;
        text-align: center;
      }

      .services-table td:first-child {
        width: 8mm;
      }

      .signature-table {
        position: absolute;
        right: 0;
        bottom: 8mm;
        left: 0;
      }

      .signature-cell {
        height: 17mm;
        text-align: center;
        vertical-align: bottom;
      }

      .footer {
        position: absolute;
        right: 0;
        bottom: 0;
        left: 0;
        border-top: 1px solid #333333;
        padding-top: 2mm;
        color: #555555;
        font-size: 7.5px;
        text-align: center;
      }

      @media print {
        body {
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }

        .sheet {
          page-break-after: avoid;
        }
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      <table class="header-table">
        <tr>
          <td class="logo-cell">
            <div class="brand">MaintenancePro</div>
          </td>
          <td class="title-cell">ORDEM DE SERVI&Ccedil;O</td>
          <td class="os-info-cell">
            <div class="os-number">N&ordm; OS:<br />__________</div>
            <div><strong>Status OS:</strong><br />________________</div>
            <div><strong>Data final:</strong><br />____/____/______</div>
          </td>
        </tr>
      </table>

      <table class="section-table">
        <tr><td colspan="5" class="section-header">DESCRI&Ccedil;&Atilde;O DA SOLICITA&Ccedil;&Atilde;O</td></tr>
        <tr>
          <td class="field-label">Nome do solicitante</td>
          <td class="field-label">Tipo de manuten&ccedil;&atilde;o</td>
          <td class="field-label">Prioridade</td>
          <td class="field-label">&Aacute;rea de manuten&ccedil;&atilde;o</td>
          <td class="field-label">Data e hora prog.</td>
        </tr>
        <tr>
          <td class="blank-cell">${blankCell}</td>
          <td class="blank-cell">${blankCell}</td>
          <td class="blank-cell">${blankCell}</td>
          <td class="blank-cell">${blankCell}</td>
          <td class="blank-cell">____/____/______ ____:____</td>
        </tr>
      </table>

      <table class="section-table">
        <tr><td colspan="4" class="section-header">DESCRI&Ccedil;&Atilde;O DO(S) EQUIPAMENTO(S)</td></tr>
        <tr>
          <td class="field-label">Equipamento(s)</td>
          <td colspan="2" class="field-label">Localiza&ccedil;&atilde;o / setor</td>
          <td class="field-label">Marca / modelo</td>
        </tr>
        <tr>
          <td class="medium-cell">${blankCell}</td>
          <td colspan="2" class="medium-cell">${blankCell}</td>
          <td class="medium-cell">${blankCell}</td>
        </tr>
      </table>

      <table class="section-table">
        <tr><td class="section-header">DESCRI&Ccedil;&Atilde;O DA MANUTEN&Ccedil;&Atilde;O</td></tr>
        <tr><td class="field-label">Descri&ccedil;&atilde;o do defeito</td></tr>
        <tr><td class="large-cell">${blankCell}</td></tr>
        <tr><td class="field-label">Observa&ccedil;&otilde;es</td></tr>
        <tr><td class="medium-cell">${blankCell}</td></tr>
      </table>

      <table class="services-table">
        <tr><td colspan="6" class="section-header">DESCRI&Ccedil;&Atilde;O DOS SERVI&Ccedil;OS</td></tr>
        <tr>
          <th style="width: 8mm;">Item</th>
          <th>Mantenedor(es)</th>
          <th>Data</th>
          <th>Hora inicial</th>
          <th>Hora final</th>
          <th>Tempo total</th>
        </tr>
        ${serviceRows}
      </table>

      <table class="services-table">
        <tr><td colspan="5" class="section-header">MATERIAIS</td></tr>
        <tr>
          <th style="width: 42%;">Descri&ccedil;&atilde;o do material</th>
          <th>Unid. medida</th>
          <th>Quantidade</th>
          <th>Pre&ccedil;o unit.</th>
          <th>Valor total</th>
        </tr>
        ${materialRows}
      </table>

      <table class="services-table">
        <tr><td colspan="5" class="section-header">OUTROS CUSTOS</td></tr>
        <tr>
          <th style="width: 42%;">Descri&ccedil;&atilde;o</th>
          <th>Unid. medida</th>
          <th>Quantidade</th>
          <th>Pre&ccedil;o unit.</th>
          <th>Valor total</th>
        </tr>
        ${outrosRows}
        <tr>
          <td colspan="4" style="text-align: right;"><strong>Total geral</strong></td>
          <td>${blankCell}</td>
        </tr>
      </table>

      <table class="signature-table">
        <tr>
          <td class="signature-cell">____________________________________<br />Solicitante</td>
          <td class="signature-cell">____________________________________<br />Mantenedor</td>
          <td class="signature-cell">____________________________________<br />Aprova&ccedil;&atilde;o</td>
        </tr>
      </table>

      <div class="footer">
        ${getTodayLabel()} &nbsp;&nbsp;&nbsp;&nbsp; P&aacute;gina 1 de 1
      </div>
    </div>
  </body>
  </html>
`;

export const openBlankOrdemServicoPrint = () => {
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    alert("Nao foi possivel abrir a janela de impressao.");
    return;
  }

  printWindow.document.write(generateBlankOrdemServicoPrintHTML());
  printWindow.document.close();

  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };
};
