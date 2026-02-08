import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const {
      ticket_subject,
      contact_name,
      contact_email,
      conversation,
      tone,
      signature,
      user_instruction,
    } = await req.json();

    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) {
      const name = contact_name || contact_email?.split("@")[0] || "";
      const fallbackDraft = `Bonjour${name ? ` ${name}` : ""},

Merci pour votre message concernant "${ticket_subject}".

Nous avons bien pris note de votre demande et notre equipe l'examine actuellement. Nous reviendrons vers vous avec une reponse detaillee dans les meilleurs delais.

N'hesitez pas a repondre a cet email si vous avez des informations complementaires a nous communiquer.

Cordialement,
L'equipe support`;

      return new Response(JSON.stringify({ draft: fallbackDraft }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let conversationContext = "";
    if (conversation && Array.isArray(conversation) && conversation.length > 0) {
      conversationContext = conversation
        .map(
          (msg: { direction: string; from_name: string; body_text: string; received_at: string }) =>
            `[${msg.direction === "inbound" ? "Client" : "Agent"}${msg.from_name ? ` - ${msg.from_name}` : ""}] :\n${(msg.body_text || "").substring(0, 1500)}`
        )
        .join("\n\n---\n\n");
    }

    const toneInstruction = tone === "formal"
      ? "Utilise un ton tres formel et soutenu."
      : tone === "friendly"
        ? "Utilise un ton chaleureux et amical tout en restant professionnel."
        : "Utilise un ton professionnel et courtois.";

    const prompt = `Tu es un assistant professionnel qui redige des reponses par email en francais pour une agence immobiliere.

${toneInstruction}

Sujet du ticket : ${ticket_subject}
Contact : ${contact_name || "Inconnu"} <${contact_email || ""}>
${signature ? `Signature a utiliser : ${signature}` : "Signe avec 'Cordialement' suivi d'un retour a la ligne."}

${conversationContext ? `Historique de la conversation :\n\n${conversationContext}\n\n` : ""}${user_instruction ? `Instruction de l'utilisateur : ${user_instruction}\n\n` : ""}Redige une reponse professionnelle, claire et utile en francais. Commence par une salutation appropriee. Ne repete pas l'objet du mail. Sois concis mais complet. ${user_instruction ? "Respecte l'instruction de l'utilisateur pour le contenu du message." : ""} Si l'historique de conversation est fourni, reponds specifiquement au dernier message du client en tenant compte du contexte complet.`;

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
              content:
                "Tu es un assistant de redaction d'emails professionnel pour une agence immobiliere francaise. Tu rediges TOUJOURS en francais. Tes reponses sont claires, polies et professionnelles.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      }
    );

    if (!openaiRes.ok) {
      const errBody = await openaiRes.text();
      throw new Error(`OpenAI API error ${openaiRes.status}: ${errBody}`);
    }

    const openaiData = await openaiRes.json();
    const draft =
      openaiData.choices?.[0]?.message?.content ?? "Impossible de generer le brouillon.";

    return new Response(JSON.stringify({ draft }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
