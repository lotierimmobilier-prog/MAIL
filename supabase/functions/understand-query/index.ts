import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  query: string;
}

interface QueryUnderstanding {
  intent: string;
  type?: string;
  sender?: string;
  recipient?: string;
  date_range?: {
    from?: string;
    to?: string;
  };
  keywords: string[];
  has_attachments?: boolean;
  priority?: string;
  suggested_filters: {
    sender?: string;
    date_from?: string;
    date_to?: string;
    has_attachments?: boolean;
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
    const { query }: RequestBody = await req.json();

    if (!query || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Query is required" }),
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

    const systemPrompt = `Tu es un assistant qui analyse les requêtes de recherche d'emails en français.
Extrais les informations structurées suivantes:
- intent: l'intention de la recherche (search_email, find_document, find_conversation, etc.)
- type: type de document si mentionné (facture, devis, contrat, compromis, attestation, etc.)
- sender: expéditeur potentiel (nom d'entreprise, nom de personne, email)
- recipient: destinataire potentiel
- date_range: période mentionnée (from/to en format ISO ou description comme "la semaine dernière")
- keywords: mots-clés importants extraits
- has_attachments: true si l'utilisateur cherche un email avec pièce jointe
- priority: urgence si mentionnée (urgent, important, normal)

Réponds UNIQUEMENT en JSON valide, sans texte supplémentaire.`;

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
          { role: "user", content: `Analyse cette requête: "${query}"` },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!chatResponse.ok) {
      console.error("OpenAI API error:", await chatResponse.text());
      return new Response(
        JSON.stringify({ error: "Failed to understand query" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const chatData = await chatResponse.json();
    const understanding: QueryUnderstanding = JSON.parse(
      chatData.choices[0].message.content
    );

    const suggestedFilters: any = {};

    if (understanding.sender) {
      suggestedFilters.sender = understanding.sender;
    }

    if (understanding.date_range?.from) {
      suggestedFilters.date_from = understanding.date_range.from;
    }

    if (understanding.date_range?.to) {
      suggestedFilters.date_to = understanding.date_range.to;
    }

    if (understanding.has_attachments !== undefined) {
      suggestedFilters.has_attachments = understanding.has_attachments;
    }

    understanding.suggested_filters = suggestedFilters;

    return new Response(
      JSON.stringify({
        success: true,
        query,
        understanding,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error in understand-query:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
