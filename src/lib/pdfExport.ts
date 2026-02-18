import { cleanEmailHtml, fixUtf8Encoding } from './emailUtils';
import type { Email } from './types';
import { formatFileSize } from './constants';
import { format } from 'date-fns';

export function exportEmailToPdf(email: Email) {
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

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const printWindow = window.open(url, '_blank', 'width=800,height=600');
  if (printWindow) {
    printWindow.onload = function() {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    @media print {
      body { margin: 0; padding: 20mm; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #1e293b;
      line-height: 1.6;
      padding: 40px;
      max-width: 900px;
      margin: 0 auto;
    }
    .header {
      border-bottom: 3px solid #0891b2;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .subject {
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 16px;
      word-break: break-word;
    }
    .meta {
      display: grid;
      grid-template-columns: 80px 1fr;
      gap: 8px 12px;
      font-size: 13px;
    }
    .meta-label {
      color: #64748b;
      font-weight: 600;
    }
    .meta-value {
      color: #334155;
      word-break: break-word;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 12px;
      font-weight: 600;
      background: ${isInbound ? '#f1f5f9' : '#ecfeff'};
      color: ${isInbound ? '#64748b' : '#0891b2'};
    }
    .body {
      margin: 24px 0;
      font-size: 14px;
      line-height: 1.7;
      color: #334155;
    }
    .body img {
      max-width: 100%;
      height: auto;
    }
    .body table {
      border-collapse: collapse;
      width: 100%;
      margin: 12px 0;
    }
    .body td, .body th {
      padding: 6px 8px;
      border: 1px solid #e2e8f0;
    }
    .attachments {
      margin-top: 24px;
      padding-top: 16px;
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
      line-height: 1.6;
    }
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #94a3b8;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="subject">${escapeHtml(subject)}</div>
    <div class="meta">
      <div class="meta-label">Statut</div>
      <div class="meta-value"><span class="badge">${status}</span></div>

      <div class="meta-label">De</div>
      <div class="meta-value">${escapeHtml(fromName)}<br/>&lt;${escapeHtml(fromEmail)}&gt;</div>

      <div class="meta-label">A</div>
      <div class="meta-value">${escapeHtml(toAddresses) || '-'}</div>

      ${ccAddresses ? `<div class="meta-label">CC</div><div class="meta-value">${escapeHtml(ccAddresses)}</div>` : ''}
      ${bccAddresses ? `<div class="meta-label">CCI</div><div class="meta-value">${escapeHtml(bccAddresses)}</div>` : ''}

      <div class="meta-label">Date</div>
      <div class="meta-value">${dateStr}</div>
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
    Génré automatiquement par LotierM@il
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
