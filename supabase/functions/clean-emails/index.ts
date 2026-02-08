import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function cleanEmailHtml(html: string): string {
  if (!html) return '';

  let cleaned = html;

  if (cleaned.includes('xmlns:o=') || cleaned.includes('xmlns:w=') || cleaned.includes('schemas-microsoft')) {
    const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch) {
      cleaned = bodyMatch[1];
    }

    cleaned = cleaned.replace(/<\?xml[^>]*\?>/gi, '');
    cleaned = cleaned.replace(/<\/?(o|w|m|v|st1):[^>]*>/gi, '');
    cleaned = cleaned.replace(/\s*xmlns:[^=]*="[^"]*"/gi, '');
    cleaned = cleaned.replace(/\s*xml:[^=]*="[^"]*"/gi, '');
    cleaned = cleaned.replace(/<head[\s\S]*?<\/head>/gi, '');
    cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    cleaned = cleaned.replace(/<meta[^>]*>/gi, '');
    cleaned = cleaned.replace(/<link[^>]*>/gi, '');
    cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
    cleaned = cleaned.replace(/\sclass="[^"]*Mso[^"]*"/gi, '');
    cleaned = cleaned.replace(/\sstyle="[^"]*"/gi, '');
    cleaned = cleaned.replace(/<html[^>]*>/gi, '<html>');
    cleaned = cleaned.replace(/<\/html>/gi, '</html>');
    cleaned = cleaned.replace(/<p[^>]*>\s*(&nbsp;|\s)*<\/p>/gi, '');
    cleaned = cleaned.replace(/=0A=/g, '');
    cleaned = cleaned.replace(/=\r?\n/g, '');
    cleaned = cleaned.replace(/<span[^>]*>\s*<\/span>/gi, '');

    const contentMatch = cleaned.match(/<div[^>]*class="[^"]*WordSection[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                        cleaned.match(/<div[^>]*>([\s\S]*?)<\/div>/i) ||
                        cleaned.match(/<p[^>]*>([\s\S]*?)<\/p>/i);

    if (contentMatch) {
      cleaned = contentMatch[1];
    }
  }

  cleaned = cleaned.replace(/<head[\s\S]*?<\/head>/gi, '');
  cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  let prevLength = 0;
  while (cleaned.length !== prevLength) {
    prevLength = cleaned.length;
    cleaned = cleaned.replace(/<(\w+)[^>]*>\s*<\/\1>/gi, '');
  }

  if (!cleaned.trim() || cleaned.length < 10) {
    return '';
  }

  return cleaned;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: emails, error } = await supabase
      .from("emails")
      .select("id, body_html")
      .not("body_html", "is", null)
      .limit(1000);

    if (error) {
      throw error;
    }

    let cleaned = 0;
    let skipped = 0;

    for (const email of emails || []) {
      if (!email.body_html) {
        skipped++;
        continue;
      }

      const needsCleaning = email.body_html.includes('xmlns:o=') ||
                           email.body_html.includes('xmlns:w=') ||
                           email.body_html.includes('schemas-microsoft');

      if (!needsCleaning) {
        skipped++;
        continue;
      }

      const cleanedHtml = cleanEmailHtml(email.body_html);

      if (cleanedHtml && cleanedHtml !== email.body_html) {
        const { error: updateError } = await supabase
          .from("emails")
          .update({ body_html: cleanedHtml })
          .eq("id", email.id);

        if (!updateError) {
          cleaned++;
        }
      } else {
        skipped++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: emails?.length || 0,
        cleaned,
        skipped,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
