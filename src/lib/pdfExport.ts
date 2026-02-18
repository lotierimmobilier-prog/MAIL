import { cleanEmailHtml, extractTextFromHtml, fixUtf8Encoding } from './emailUtils';
import type { Email } from './types';
import { formatFileSize } from './constants';
import { format } from 'date-fns';

export function exportEmailToPdf(email: Email) {
  const isInbound = email.direction === 'inbound';
  const dirLabel = isInbound ? 'Recu' : 'Envoye';
  const dateStr = format(new Date(email.received_at), 'dd/MM/yyyy HH:mm');

  const bodyContent = email.body_html
    ? cleanEmailHtml(email.body_html)
    : `<pre style="white-space:pre-wrap;font-family:sans-serif;">${fixUtf8Encoding(email.body_text || 'Aucun contenu')}</pre>`;

  const attachmentsHtml = email.attachments && email.attachments.length > 0
    ? `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;">
        <p style="font-size:12px;color:#64748b;margin-bottom:8px;">Pieces jointes (${email.attachments.length}):</p>
        <ul style="list-style:none;padding:0;margin:0;">
          ${email.attachments.map(att => `
            <li style="padding:4px 0;font-size:12px;color:#475569;">
              ${att.filename} (${formatFileSize(att.size_bytes)})
            </li>
          `).join('')}
        </ul>
      </div>`
    : '';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${email.subject}</title>
  <style>
    @media print {
      body { margin: 0; }
      .no-print { display: none; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 24px;
      color: #1e293b;
      line-height: 1.6;
    }
    .header {
      border-bottom: 2px solid #0891b2;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .subject {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 16px 0;
    }
    .meta {
      display: grid;
      grid-template-columns: 80px 1fr;
      gap: 6px 12px;
      font-size: 13px;
    }
    .meta-label {
      color: #64748b;
      font-weight: 600;
    }
    .meta-value {
      color: #334155;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      background: ${isInbound ? '#f1f5f9' : '#ecfeff'};
      color: ${isInbound ? '#64748b' : '#0891b2'};
    }
    .body {
      margin-top: 24px;
      font-size: 14px;
    }
    .body img { max-width: 100%; height: auto; }
    .body table { border-collapse: collapse; }
    .body td, .body th { padding: 4px 8px; }
  </style>
</head>
<body>
  <div class="header">
    <h1 class="subject">${escapeHtml(email.subject)}</h1>
    <div class="meta">
      <span class="meta-label">Direction</span>
      <span class="meta-value"><span class="badge">${dirLabel}</span></span>
      <span class="meta-label">De</span>
      <span class="meta-value">${escapeHtml(email.from_name || '')} &lt;${escapeHtml(email.from_address)}&gt;</span>
      <span class="meta-label">A</span>
      <span class="meta-value">${escapeHtml((email.to_addresses || []).join(', '))}</span>
      ${email.cc_addresses?.length ? `
        <span class="meta-label">CC</span>
        <span class="meta-value">${escapeHtml(email.cc_addresses.join(', '))}</span>
      ` : ''}
      <span class="meta-label">Date</span>
      <span class="meta-value">${dateStr}</span>
    </div>
  </div>
  <div class="body">
    ${bodyContent}
  </div>
  ${attachmentsHtml}
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.print();
  };
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
