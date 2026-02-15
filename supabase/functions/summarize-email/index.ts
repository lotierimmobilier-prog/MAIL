import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  email_id: string;
  force?: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { email_id, force = false }: RequestBody = await req.json();

    if (!email_id) {
      return new Response(
        JSON.stringify({ error: "email_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: existingSummary } = await supabaseAdmin
      .from("email_summaries")
      .select("*")
      .eq("email_id", email_id)
      .maybeSingle();

    if (existingSummary && !force) {
      return new Response(
        JSON.stringify({
          success: true,
          summary: existingSummary.summary,
          key_points: existingSummary.key_points,
          action_items: existingSummary.action_items,
          cached: true,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: email, error: emailError } = await supabaseAdmin
      .from("emails")
      .select("id, subject, sender_name, sender_email, body_text, body_html, created_at")
      .eq("id", email_id)
      .maybeSingle();

    if (emailError || !email) {
      return new Response(
        JSON.stringify({ error: "Email not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const bodyText = email.body_text || email.body_html?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ") || "";

    if (!bodyText || bodyText.trim().length < 50) {
      return new Response(
        JSON.stringify({ error: "Email content too short to summarize" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const systemPrompt = `Tu es un assistant qui résume des emails professionnels en français.
Crée un résumé structuré avec:
1. summary: résumé en 2-3 phrases maximum
2. key_points: liste des points clés (array de strings)
3. action_items: liste des actions à faire si mentionnées (array de strings)

Réponds UNIQUEMENT en JSON valide, sans texte supplémentaire.
Format exact: {"summary": "...", "key_points": ["...", "..."], "action_items": ["...", "..."]}`;

    const emailContent = `
Sujet: ${email.subject || "Sans objet"}
De: ${email.sender_name || email.sender_email}
Date: ${new Date(email.created_at).toLocaleDateString("fr-FR")}

${bodyText.substring(0, 3000)}
`.trim();

    const chatResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: emailContent },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!chatResponse.ok) {
      console.error("OpenAI API error:", await chatResponse.text());
      return new Response(
        JSON.stringify({ error: "Failed to generate summary" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const chatData = await chatResponse.json();
    const result = JSON.parse(chatData.choices[0].message.content);

    const { error: saveError } = await supabaseAdmin
      .from("email_summaries")
      .upsert({
        email_id: email.id,
        summary: result.summary,
        key_points: result.key_points || [],
        action_items: result.action_items || [],
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "email_id"
      });

    if (saveError) {
      console.error("Error saving summary:", saveError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: result.summary,
        key_points: result.key_points || [],
        action_items: result.action_items || [],
        cached: false,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error in summarize-email:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
