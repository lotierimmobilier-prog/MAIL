import DOMPurify from 'dompurify';

/**
 * Fix common UTF-8 encoding issues
 */
function fixUtf8Encoding(text: string): string {
  if (!text) return '';

  // Common UTF-8 mojibake patterns (using array to handle duplicates)
  const replacements: Array<[string, string]> = [
    ['Ã©', 'é'],
    ['Ã¨', 'è'],
    ['Ãª', 'ê'],
    ['Ã§', 'ç'],
    ['Ã ', 'à'],
    ['Ã¢', 'â'],
    ['Ã´', 'ô'],
    ['Ã®', 'î'],
    ['Ã¯', 'ï'],
    ['Ã¹', 'ù'],
    ['Ã»', 'û'],
    ['Ã«', 'ë'],
    ['Å"', 'œ'],
    ['Ã', 'À'],
    ['Ã‰', 'É'],
    ['Ãˆ', 'È'],
    ['Ãš', 'Ê'],
    ['Ã‡', 'Ç'],
    ['â€™', "'"],
    ['â€˜', "'"],
    ['â€œ', '"'],
    ['â€', '"'],
    ['â€"', '—'],
    ['â€"', '–'],
    ['â€¦', '...'],
    ['Â©', '©'],
    ['Â®', '®'],
    ['Â°', '°'],
    ['Â', ''],
  ];

  let fixed = text;
  for (const [wrong, correct] of replacements) {
    fixed = fixed.replace(new RegExp(wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), correct);
  }

  return fixed;
}

/**
 * Clean and sanitize HTML email content, especially from Microsoft Office/Word
 */
export function cleanEmailHtml(html: string): string {
  if (!html) return '';

  let cleaned = html;

  // Remove DOCTYPE declaration completely
  cleaned = cleaned.replace(/<!DOCTYPE[^>]*>/gi, '');

  // Extract body content if full HTML document is present
  if (cleaned.includes('<html') && cleaned.includes('</html>')) {
    const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch && bodyMatch[1]) {
      cleaned = bodyMatch[1];
    } else {
      // If no body tag, try to extract content between html tags
      const htmlMatch = cleaned.match(/<html[^>]*>([\s\S]*)<\/html>/i);
      if (htmlMatch && htmlMatch[1]) {
        cleaned = htmlMatch[1];
      }
    }
  }

  // If it looks like raw Microsoft Office XML, extract text content
  if (cleaned.includes('xmlns:o=') || cleaned.includes('xmlns:w=') || cleaned.includes('schemas-microsoft')) {
    // Try to extract body content first
    const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch) {
      cleaned = bodyMatch[1];
    }

    // Remove all XML processing instructions
    cleaned = cleaned.replace(/<\?xml[^>]*\?>/gi, '');

    // Remove all Office namespace tags (o:, w:, m:, v:, st1:)
    cleaned = cleaned.replace(/<\/?(o|w|m|v|st1):[^>]*>/gi, '');

    // Remove all xmlns attributes and Office-specific attributes
    cleaned = cleaned.replace(/\s*xmlns:[^=]*="[^"]*"/gi, '');
    cleaned = cleaned.replace(/\s*xml:[^=]*="[^"]*"/gi, '');

    // Remove head, style, meta tags completely
    cleaned = cleaned.replace(/<head[\s\S]*?<\/head>/gi, '');
    cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    cleaned = cleaned.replace(/<meta[^>]*>/gi, '');
    cleaned = cleaned.replace(/<link[^>]*>/gi, '');

    // Remove all comments including Office conditional comments
    cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

    // Remove Office-specific classes
    cleaned = cleaned.replace(/\sclass="[^"]*Mso[^"]*"/gi, '');

    // Remove all inline styles that contain mso- or complex Office styles
    cleaned = cleaned.replace(/\sstyle="[^"]*"/gi, '');

    // Clean up the html tag
    cleaned = cleaned.replace(/<html[^>]*>/gi, '<html>');
    cleaned = cleaned.replace(/<\/html>/gi, '</html>');

    // Remove empty paragraphs with just nbsp
    cleaned = cleaned.replace(/<p[^>]*>\s*(&nbsp;|\s)*<\/p>/gi, '');

    // Convert =0A= and similar encoding to nothing
    cleaned = cleaned.replace(/=0A=/g, '');
    cleaned = cleaned.replace(/=\r?\n/g, '');

    // Remove spans that are just wrappers
    cleaned = cleaned.replace(/<span[^>]*>\s*<\/span>/gi, '');

    // Try to find actual content in divs or paragraphs
    const contentMatch = cleaned.match(/<div[^>]*class="[^"]*WordSection[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                        cleaned.match(/<div[^>]*>([\s\S]*?)<\/div>/i) ||
                        cleaned.match(/<p[^>]*>([\s\S]*?)<\/p>/i);

    if (contentMatch) {
      cleaned = contentMatch[1];
    }
  }

  // General cleanup for all HTML emails
  cleaned = cleaned.replace(/<head[\s\S]*?<\/head>/gi, '');
  cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  // Remove html and body wrapper tags if they still exist
  cleaned = cleaned.replace(/<\/?html[^>]*>/gi, '');
  cleaned = cleaned.replace(/<\/?body[^>]*>/gi, '');

  // Remove empty tags recursively
  let prevLength = 0;
  while (cleaned.length !== prevLength) {
    prevLength = cleaned.length;
    cleaned = cleaned.replace(/<(\w+)[^>]*>\s*<\/\1>/gi, '');
  }

  // Fix UTF-8 encoding issues before sanitization
  cleaned = fixUtf8Encoding(cleaned);

  // Final sanitization with DOMPurify
  const sanitized = DOMPurify.sanitize(cleaned, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 'b', 'i', 's', 'strike',
      'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'blockquote', 'pre', 'code', 'div', 'span', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr'
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'src', 'alt', 'title'
    ],
    ALLOW_DATA_ATTR: false
  });

  // If after all cleaning we still have junk or nothing readable, return empty
  if (!sanitized.trim() || sanitized.length < 10) {
    return '<p>Contenu non disponible</p>';
  }

  return sanitized;
}

/**
 * Extract plain text from HTML content as fallback
 */
export function extractTextFromHtml(html: string): string {
  if (!html) return '';

  // Remove script and style tags
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Replace br and p tags with newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');

  // Remove all other HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  text = textarea.value;

  // Fix UTF-8 encoding issues
  text = fixUtf8Encoding(text);

  // Clean up whitespace
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
  text = text.trim();

  return text;
}
