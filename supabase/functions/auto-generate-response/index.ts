import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  ticket_id: string;
  email_id: string;
  email_content: string;
  tone?: string;
}

async function generateWithClaude(
  anthropicKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { ticket_id, email_id, email_content, tone = "neutral" }: RequestBody = await req.json();

    const { data: knowledgeItems } = await supabase
      .from("knowledge_base_items")
      .select("*")
      .eq("is_active", true);

    let context = "";
    const sourcesUsed: any[] = [];

    if (knowledgeItems && knowledgeItems.length > 0) {
      context = "\n\nContexte et informations disponibles:\n";
      knowledgeItems.forEach((item) => {
        context += `\n[${item.category}] ${item.title}:\n${item.content}\n`;
        sourcesUsed.push({ id: item.id, title: item.title, category: item.category });
      });
    }

    const tones = ["neutral", "formal", "friendly"];
    const suggestions = [];

    const toneLabel: Record<string, string> = {
      formal: "formel et professionnel",
      friendly: "amical et chaleureux",
      neutral: "neutre et courtois",
    };

    for (const t of tones) {
      let response = "";
      let confidence = 0.65;

      if (anthropicKey) {
        const systemPrompt = `Tu es un assistant intelligent qui génère des réponses professionnelles aux emails en français. Ton ton doit être ${toneLabel[t] || toneLabel.neutral}. Utilise le contexte fourni pour personnaliser ta réponse. Réponds UNIQUEMENT avec le corps de l'email.${context}`;
        response = await generateWithClaude(
          anthropicKey,
          systemPrompt,
          `Génère une réponse appropriée à cet email:\n\n${email_content}`
        );
        confidence = 0.85;
      } else {
        const greetings: Record<string, string> = {
          formal: "Madame, Monsieur,",
          friendly: "Bonjour,",
          neutral: "Bonjour,",
        };
        const closings: Record<string, string> = {
          formal: "Cordialement,",
          friendly: "Bien à vous,",
          neutral: "Cordialement,",
        };
        response = `${greetings[t]}\n\nNous avons bien reçu votre message et nous vous en remercions.\n\n${closings[t]}`;
      }

      suggestions.push({ tone: t, response, confidence });
    }

    const insertPromises = suggestions.map((suggestion) =>
      supabase.from("ai_response_suggestions").insert({
        ticket_id,
        email_id,
        suggested_response: suggestion.response,
        tone: suggestion.tone,
        confidence_score: suggestion.confidence,
        sources_used: sourcesUsed,
        status: "pending",
      })
    );

    await Promise.all(insertPromises);

    const { data: ticket } = await supabase
      .from("tickets")
      .select("assignee_id")
      .eq("id", ticket_id)
      .single();

    if (ticket?.assignee_id) {
      await supabase.from("notifications").insert({
        user_id: ticket.assignee_id,
        type: "response_generated",
        title: "Réponses IA générées",
        message: `${suggestions.length} réponses suggérées sont disponibles pour ce ticket`,
        link: `/inbox/${ticket_id}`,
      });
    }

    return new Response(
      JSON.stringify({ success: true, suggestions_count: suggestions.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error generating response:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Une erreur est survenue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
