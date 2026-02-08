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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { ticket_id, email_id, email_content, tone = "neutral" }: RequestBody = await req.json();

    // Load knowledge base items
    const { data: knowledgeItems } = await supabase
      .from("knowledge_base_items")
      .select("*")
      .eq("is_active", true);

    // Build context from knowledge base
    let context = "";
    const sourcesUsed: any[] = [];

    if (knowledgeItems && knowledgeItems.length > 0) {
      context = "\n\nContexte et informations disponibles:\n";
      knowledgeItems.forEach((item) => {
        context += `\n[${item.category}] ${item.title}:\n${item.content}\n`;
        sourcesUsed.push({
          id: item.id,
          title: item.title,
          category: item.category,
        });
      });
    }

    // Generate response using OpenAI (or fallback to simple template)
    let suggestedResponse = "";
    let confidenceScore = 0.75;

    if (openaiKey) {
      // Use OpenAI API
      const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: `Tu es un assistant intelligent qui génère des réponses professionnelles aux emails. Ton ton doit être ${tone === "formal" ? "formel et professionnel" : tone === "friendly" ? "amical et chaleureux" : "neutre et courtois"}. Utilise le contexte fourni pour personnaliser ta réponse.${context}`,
            },
            {
              role: "user",
              content: `Génère une réponse appropriée à cet email:\n\n${email_content}`,
            },
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      const openaiData = await openaiResponse.json();
      suggestedResponse = openaiData.choices[0].message.content;
      confidenceScore = 0.85;
    } else {
      // Fallback template-based response
      const toneGreetings: Record<string, string> = {
        formal: "Madame, Monsieur,",
        friendly: "Bonjour,",
        neutral: "Bonjour,",
      };

      const toneClosings: Record<string, string> = {
        formal: "Cordialement,",
        friendly: "Bien à vous,",
        neutral: "Cordialement,",
      };

      suggestedResponse = `${toneGreetings[tone] || toneGreetings.neutral}

Nous avons bien reçu votre message et nous vous en remercions.

Notre équipe a pris en compte votre demande et nous nous engageons à vous répondre dans les meilleurs délais. Si votre demande nécessite des informations complémentaires, nous vous recontacterons prochainement.

Nous restons à votre disposition pour toute question.

${toneClosings[tone] || toneClosings.neutral}`;
      confidenceScore = 0.65;
    }

    // Generate multiple variants with different tones
    const suggestions = [];
    const tones = ["neutral", "formal", "friendly"];

    for (const t of tones) {
      if (openaiKey) {
        const variantResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4",
            messages: [
              {
                role: "system",
                content: `Tu es un assistant intelligent qui génère des réponses professionnelles aux emails. Ton ton doit être ${t === "formal" ? "formel et professionnel" : t === "friendly" ? "amical et chaleureux" : "neutre et courtois"}. Utilise le contexte fourni pour personnaliser ta réponse.${context}`,
              },
              {
                role: "user",
                content: `Génère une réponse appropriée à cet email:\n\n${email_content}`,
              },
            ],
            temperature: 0.7,
            max_tokens: 500,
          }),
        });

        const variantData = await variantResponse.json();
        suggestions.push({
          tone: t,
          response: variantData.choices[0].message.content,
          confidence: 0.85,
        });
      } else {
        // Simple fallback for each tone
        suggestions.push({
          tone: t,
          response: suggestedResponse,
          confidence: 0.65,
        });
      }
    }

    // Store suggestions in database
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

    // Get assigned user to send notification
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
      JSON.stringify({
        success: true,
        suggestions_count: suggestions.length,
        message: "Réponses générées avec succès",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("Error generating response:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Une erreur est survenue",
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
