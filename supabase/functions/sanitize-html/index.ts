import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { DOMPurify } from "npm:isomorphic-dompurify@2.14.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SanitizeRequest {
  html: string;
  options?: {
    allowedTags?: string[];
    allowedAttributes?: string[];
    strictMode?: boolean;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { html, options }: SanitizeRequest = await req.json();

    if (!html) {
      return new Response(
        JSON.stringify({ error: 'HTML content is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const config = {
      ALLOWED_TAGS: options?.allowedTags || [
        'p', 'br', 'strong', 'em', 'u', 'b', 'i', 's', 'strike',
        'a', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'div', 'span', 'hr'
      ],
      ALLOWED_ATTR: options?.allowedAttributes || [
        'href', 'title', 'target', 'rel', 'class'
      ],
      FORBID_TAGS: [
        'script', 'iframe', 'object', 'embed', 'form', 'input',
        'button', 'textarea', 'select', 'option', 'meta', 'link',
        'style', 'base', 'frame', 'frameset', 'applet', 'bgsound',
        'keygen', 'marquee', 'blink'
      ],
      FORBID_ATTR: [
        'onclick', 'onerror', 'onload', 'onmouseover', 'onmouseout',
        'onmousemove', 'onmouseenter', 'onmouseleave', 'onfocus',
        'onblur', 'onchange', 'onsubmit', 'onkeydown', 'onkeyup',
        'onkeypress', 'ondblclick', 'oncontextmenu', 'oninput',
        'onpaste', 'oncopy', 'oncut', 'ondrag', 'ondrop',
        'formaction', 'action', 'data'
      ],
      ALLOW_DATA_ATTR: false,
      ALLOW_UNKNOWN_PROTOCOLS: false,
      SAFE_FOR_TEMPLATES: true,
      KEEP_CONTENT: true,
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
      RETURN_DOM_IMPORT: false,
      RETURN_TRUSTED_TYPE: false,
      SANITIZE_DOM: true,
      FORCE_BODY: false,
      IN_PLACE: false
    };

    if (options?.strictMode) {
      config.ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li'];
      config.ALLOWED_ATTR = ['href', 'title', 'target', 'rel'];
    }

    const sanitized = DOMPurify.sanitize(html, config);

    const linkSanitized = sanitized.replace(
      /<a\s+([^>]*?)href=["']([^"']*)["']([^>]*?)>/gi,
      (match, before, href, after) => {
        if (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('mailto:')) {
          return `<a ${before}${after}>`;
        }
        return `<a ${before}href="${href}" target="_blank" rel="noopener noreferrer"${after}>`;
      }
    );

    return new Response(
      JSON.stringify({
        sanitized: linkSanitized,
        originalLength: html.length,
        sanitizedLength: linkSanitized.length,
        removed: html.length - linkSanitized.length
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Sanitization error:', error);
    return new Response(
      JSON.stringify({
        error: 'HTML sanitization failed',
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
