import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { cleanEmailHtml, fixUtf8Encoding } from './emailUtils';
import type { Email } from './types';
import { formatFileSize } from './constants';
import { format } from 'date-fns';

export async function exportEmailToPdf(email: Email) {
  try {
    const isInbound = email.direction === 'inbound';
    const dirLabel = isInbound ? 'Reçu' : 'Envoyé';
    const dateStr = format(new Date(email.received_at), 'dd/MM/yyyy HH:mm');

    const bodyContent = email.body_html
      ? cleanEmailHtml(email.body_html)
      : `<pre style="white-space:pre-wrap;font-family:sans-serif;margin:0;">${fixUtf8Encoding(email.body_text || 'Aucun contenu')}</pre>`;

    const attachmentsList = email.attachments && email.attachments.length > 0
      ? email.attachments.map(att => `• ${escapeHtml(att.filename)} (${formatFileSize(att.size_bytes)})`).join('<br/>')
      : '';

    const htmlContent = buildHtmlDocument(
      email.subject,
      dirLabel,
      email.from_name || email.from_address,
      email.from_address,
      (email.to_addresses || []).join(', '),
      email.cc_addresses?.join(', '),
      email.bcc_addresses?.join(', '),
      dateStr,
      bodyContent,
      attachmentsList,
      email.attachments?.length || 0,
      isInbound
    );

    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.width = '210mm';
    container.style.background = 'white';
    container.innerHTML = htmlContent;
    document.body.appendChild(container);

    await new Promise(resolve => setTimeout(resolve, 500));

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 10;

    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight - 20;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight - 20;
    }

    const filename = `${email.subject.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    pdf.save(filename);

    document.body.removeChild(container);
  } catch (error) {
    console.error('Erreur lors de la génération du PDF:', error);
    alert('Erreur lors de la génération du PDF');
  }
}

function buildHtmlDocument(
  subject: string,
  status: string,
  fromName: string,
  fromEmail: string,
  toAddresses: string,
  ccAddresses?: string,
  bccAddresses?: string,
  dateStr?: string,
  bodyContent?: string,
  attachmentsList?: string,
  attachmentCount?: number,
  isInbound?: boolean
): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: 100%;
      height: 100%;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      color: #1e293b;
      background: white;
      padding: 20px;
      line-height: 1.6;
    }
    .container {
      width: 100%;
      max-width: 210mm;
      margin: 0 auto;
      background: white;
    }
    .header {
      border-bottom: 3px solid #0891b2;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .subject {
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 16px;
      word-break: break-word;
      line-height: 1.3;
    }
    .meta-grid {
      display: table;
      width: 100%;
      font-size: 12px;
    }
    .meta-row {
      display: table-row;
    }
    .meta-label {
      display: table-cell;
      color: #64748b;
      font-weight: 600;
      width: 70px;
      padding: 6px 12px 6px 0;
      vertical-align: top;
      border-bottom: 1px solid #f1f5f9;
    }
    .meta-value {
      display: table-cell;
      color: #334155;
      padding: 6px 0 6px 12px;
      vertical-align: top;
      border-bottom: 1px solid #f1f5f9;
      word-break: break-word;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: 600;
      background: ${isInbound ? '#f1f5f9' : '#ecfeff'};
      color: ${isInbound ? '#64748b' : '#0891b2'};
    }
    .body {
      margin: 24px 0;
      font-size: 13px;
      line-height: 1.7;
      color: #334155;
    }
    .body img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 12px 0;
    }
    .body table {
      border-collapse: collapse;
      width: 100%;
      margin: 12px 0;
      font-size: 12px;
    }
    .body td, .body th {
      padding: 6px 8px;
      border: 1px solid #e2e8f0;
      text-align: left;
    }
    .body th {
      background: #f8fafc;
      font-weight: 600;
    }
    .body pre {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 3px;
      padding: 10px;
      overflow-x: auto;
      font-size: 11px;
      font-family: 'Courier New', monospace;
    }
    .body blockquote {
      margin: 12px 0;
      padding-left: 12px;
      border-left: 3px solid #0891b2;
      color: #475569;
    }
    .body a {
      color: #0891b2;
      text-decoration: none;
    }
    .body a:hover {
      text-decoration: underline;
    }
    .attachments {
      margin-top: 20px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      font-size: 12px;
    }
    .attachments-title {
      color: #64748b;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .attachments-list {
      color: #475569;
      line-height: 1.7;
    }
    .footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      font-size: 10px;
      color: #94a3b8;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="subject">${escapeHtml(subject)}</div>
      <div class="meta-grid">
        <div class="meta-row">
          <div class="meta-label">Statut</div>
          <div class="meta-value"><span class="badge">${status}</span></div>
        </div>
        <div class="meta-row">
          <div class="meta-label">De</div>
          <div class="meta-value">${escapeHtml(fromName)}<br/>&lt;${escapeHtml(fromEmail)}&gt;</div>
        </div>
        <div class="meta-row">
          <div class="meta-label">A</div>
          <div class="meta-value">${escapeHtml(toAddresses) || '-'}</div>
        </div>
        ${ccAddresses ? `
        <div class="meta-row">
          <div class="meta-label">CC</div>
          <div class="meta-value">${escapeHtml(ccAddresses)}</div>
        </div>
        ` : ''}
        ${bccAddresses ? `
        <div class="meta-row">
          <div class="meta-label">CCI</div>
          <div class="meta-value">${escapeHtml(bccAddresses)}</div>
        </div>
        ` : ''}
        <div class="meta-row">
          <div class="meta-label">Date</div>
          <div class="meta-value">${dateStr}</div>
        </div>
      </div>
    </div>

    <div class="body">${bodyContent}</div>

    ${attachmentsList ? `
    <div class="attachments">
      <div class="attachments-title">Pieces jointes (${attachmentCount}):</div>
      <div class="attachments-list">${attachmentsList}</div>
    </div>
    ` : ''}

    <div class="footer">
      Généré automatiquement par LotierM@il
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
