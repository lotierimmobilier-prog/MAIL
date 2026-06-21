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

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!anthropicKey) {
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

    const systemPrompt = `Tu es un assistant de redaction d'emails professionnel pour une agence immobiliere francaise. Tu rediges TOUJOURS en francais. Tes reponses sont claires, polies et professionnelles. Tu reponds UNIQUEMENT avec le corps de l'email, sans commentaire supplementaire.`;

    const userPrompt = `${toneInstruction}

Sujet du ticket : ${ticket_subject}
Contact : ${contact_name || "Inconnu"} <${contact_email || ""}>
${signature ? `Signature a utiliser : ${signature}` : "Signe avec 'Cordialement' suivi d'un retour a la ligne."}

${conversationContext ? `Historique de la conversation :\n\n${conversationContext}\n\n` : ""}${user_instruction ? `Instruction de l'utilisateur : ${user_instruction}\n\n` : ""}Redige une reponse professionnelle, claire et utile en francais. Commence par une salutation appropriee. Ne repete pas l'objet du mail. Sois concis mais complet. ${user_instruction ? "Respecte l'instruction de l'utilisateur pour le contenu du message." : ""} Si l'historique de conversation est fourni, reponds specifiquement au dernier message du client en tenant compte du contexte complet.`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!claudeRes.ok) {
      const errBody = await claudeRes.text();
      throw new Error(`Anthropic API error ${claudeRes.status}: ${errBody}`);
    }

    const claudeData = await claudeRes.json();
    const draft = claudeData.content?.[0]?.text ?? "Impossible de generer le brouillon.";

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
