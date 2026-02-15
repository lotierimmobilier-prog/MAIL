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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

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

    const { data: existingEmbedding } = await supabaseClient
      .from("email_embeddings")
      .select("id")
      .eq("email_id", email_id)
      .maybeSingle();

    if (existingEmbedding && !force) {
      return new Response(
        JSON.stringify({
          message: "Embedding already exists",
          embedding_id: existingEmbedding.id,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: email, error: emailError } = await supabaseClient
      .from("emails")
      .select("id, subject, sender_name, sender_email, recipient_email, body_text, body_html, created_at")
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

    const { data: attachments } = await supabaseClient
      .from("attachments")
      .select("filename")
      .eq("email_id", email_id);

    const attachmentNames = attachments?.map(a => a.filename).join(", ") || "";

    const bodyText = email.body_text || email.body_html?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ") || "";

    const content = `
Sujet: ${email.subject || ""}
De: ${email.sender_name || email.sender_email}
À: ${email.recipient_email || ""}
${attachmentNames ? `Pièces jointes: ${attachmentNames}` : ""}

${bodyText}
`.trim();

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: content.substring(0, 8000),
      }),
    });

    if (!embeddingResponse.ok) {
      const errorText = await embeddingResponse.text();
      console.error("OpenAI API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to generate embedding" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData.data[0].embedding;

    const metadata = {
      sender: email.sender_email,
      recipient: email.recipient_email,
      has_attachments: (attachments?.length || 0) > 0,
      subject: email.subject,
      date: email.created_at,
    };

    const { data: savedEmbedding, error: saveError } = await supabaseClient
      .from("email_embeddings")
      .upsert({
        email_id: email.id,
        content,
        embedding,
        metadata,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "email_id"
      })
      .select()
      .single();

    if (saveError) {
      console.error("Error saving embedding:", saveError);
      return new Response(
        JSON.stringify({ error: "Failed to save embedding" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        embedding_id: savedEmbedding.id,
        email_id: email.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error in generate-email-embedding:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
