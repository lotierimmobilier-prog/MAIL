import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { idea, tone, signature } = await req.json();

    if (!idea) {
      return new Response(
        JSON.stringify({ error: "L'idée est obligatoire" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) {
      const fallbackSubject = "Demande d'information";
      const fallbackBody = `Bonjour,

${idea}

Merci de votre attention.

Cordialement`;

      return new Response(
        JSON.stringify({ subject: fallbackSubject, body: fallbackBody }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const toneInstruction = tone === "formal"
      ? "Utilise un ton tres formel et soutenu."
      : tone === "friendly"
        ? "Utilise un ton chaleureux et amical tout en restant professionnel."
        : tone === "casual"
          ? "Utilise un ton decontracte et accessible."
          : "Utilise un ton professionnel et courtois.";

    const prompt = `Tu es un assistant professionnel qui redige des emails en francais pour une agence immobiliere.

${toneInstruction}

L'utilisateur souhaite envoyer un email avec l'idee suivante :
"${idea}"

${signature ? `Signature a utiliser : ${signature}` : "Signe avec 'Cordialement' suivi d'un retour a la ligne."}

Redige un email complet et professionnel en francais base sur cette idee. L'email doit contenir :
1. Un objet clair et concis
2. Un corps de message bien structure avec salutation, contenu et signature

IMPORTANT : Ta reponse doit etre au format JSON avec deux champs :
{
  "subject": "L'objet de l'email",
  "body": "Le corps complet de l'email au format HTML avec des balises <p>, <br>, etc. pour une belle presentation"
}

Le corps du message (body) doit utiliser des balises HTML pour une mise en forme professionnelle :
- Utilise des balises <p> pour les paragraphes
- Utilise <br> pour les sauts de ligne
- Structure le contenu de maniere claire et aeree
- Assure-toi que tous les caracteres speciaux et accents sont correctement encodes en UTF-8

Ne genere QUE le JSON, sans texte supplementaire avant ou apres.`;

    const openaiRes = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "Tu es un assistant de redaction d'emails professionnel pour une agence immobiliere francaise. Tu rediges TOUJOURS en francais. Tes reponses sont au format JSON uniquement.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 1000,
          response_format: { type: "json_object" }
        }),
      }
    );

    if (!openaiRes.ok) {
      const errBody = await openaiRes.text();
      console.error("OpenAI API error:", errBody);
      throw new Error(`OpenAI API error ${openaiRes.status}: ${errBody}`);
    }

    const openaiData = await openaiRes.json();
    const content = openaiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Aucune reponse generee par l'IA");
    }

    let result;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", content);
      throw new Error("Format de reponse invalide de l'IA");
    }

    if (!result.subject || !result.body) {
      throw new Error("Reponse incomplete de l'IA");
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-email-from-idea:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
