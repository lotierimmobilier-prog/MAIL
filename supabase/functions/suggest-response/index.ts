import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

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
    const {
      ticket_id,
      ticket_subject,
      ticket_body,
      contact_email,
      contact_name,
      category_id,
      mailbox_id,
    } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) {
      return new Response(
        JSON.stringify({
          suggested_response: "Bonjour,\n\nMerci pour votre message. Nous avons bien recu votre demande et nous reviendrons vers vous dans les plus brefs delais.\n\nCordialement",
          confidence: 0.5,
          reasoning: "Pas de cle OpenAI disponible - reponse generique",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: currentTicket } = await supabase
      .from("tickets")
      .select(`
        *,
        emails!inner(
          id,
          subject,
          body_text,
          from_address,
          from_name,
          received_at
        )
      `)
      .eq("id", ticket_id)
      .order("received_at", { foreignTable: "emails", ascending: true })
      .maybeSingle();

    const { data: historicalTickets } = await supabase
      .from("tickets")
      .select(`
        id,
        subject,
        status,
        priority,
        created_at,
        emails!inner(
          id,
          subject,
          body_text,
          direction,
          received_at
        )
      `)
      .eq("contact_email", contact_email)
      .neq("id", ticket_id)
      .eq("status", "closed")
      .order("created_at", { ascending: false })
      .limit(3);

    const { data: similarTickets } = await supabase
      .from("tickets")
      .select(`
        id,
        subject,
        status,
        created_at,
        emails!inner(
          id,
          subject,
          body_text,
          direction,
          received_at
        )
      `)
      .eq("mailbox_id", mailbox_id)
      .eq("status", "closed")
      .neq("id", ticket_id)
      .order("created_at", { ascending: false })
      .limit(10);

    let categoryTemplates: any[] = [];
    if (category_id) {
      const { data } = await supabase
        .from("email_templates")
        .select("name, subject, body, description")
        .eq("category_id", category_id)
        .eq("is_active", true)
        .limit(3);
      categoryTemplates = data || [];
    }

    const { data: mailbox } = await supabase
      .from("mailboxes")
      .select("tone, signature")
      .eq("id", mailbox_id)
      .maybeSingle();

    let conversationContext = "";
    if (currentTicket?.emails && Array.isArray(currentTicket.emails)) {
      conversationContext = currentTicket.emails
        .map((email: any) =>
          `[${email.from_name || email.from_address}] (${email.received_at}):\n${(email.body_text || "").substring(0, 1000)}`
        )
        .join("\n\n---\n\n");
    }

    let historicalContext = "";
    if (historicalTickets && historicalTickets.length > 0) {
      historicalContext = "\n\nHistorique des echanges precedents avec ce contact :\n" +
        historicalTickets.map((ticket: any) => {
          const replies = ticket.emails?.filter((e: any) => e.direction === "outbound") || [];
          const lastReply = replies[replies.length - 1];
          return `- Sujet: ${ticket.subject}\n  Statut: ${ticket.status}\n  Reponses: ${replies.length}\n  ${lastReply ? `Derniere reponse: ${(lastReply.body_text || "").substring(0, 300)}...` : ""}`;
        }).join("\n\n");
    }

    let similarContext = "";
    if (similarTickets && similarTickets.length > 0) {
      similarContext = "\n\nExemples de tickets similaires resolus dans cette boite mail :\n" +
        similarTickets.slice(0, 5).map((ticket: any) => {
          const replies = ticket.emails?.filter((e: any) => e.direction === "outbound") || [];
          const firstReply = replies[0];
          return `- Sujet: ${ticket.subject}\n  ${firstReply ? `Premiere reponse: ${(firstReply.body_text || "").substring(0, 250)}...` : ""}`;
        }).join("\n\n");
    }

    let templatesContext = "";
    if (categoryTemplates.length > 0) {
      templatesContext = "\n\nModeles disponibles pour cette categorie :\n" +
        categoryTemplates.map(tpl =>
          `- ${tpl.name}: ${tpl.description || ""}\n  Exemple: ${(tpl.body || "").substring(0, 200)}...`
        ).join("\n\n");
    }

    const toneInstruction = mailbox?.tone === "formal"
      ? "Utilise un ton tres formel et soutenu."
      : mailbox?.tone === "friendly"
        ? "Utilise un ton chaleureux et amical tout en restant professionnel."
        : "Utilise un ton professionnel et courtois.";

    const prompt = `Tu es un assistant qui suggere des reponses intelligentes pour une agence immobiliere.

${toneInstruction}

CONTEXTE DU TICKET ACTUEL:
Sujet: ${ticket_subject}
De: ${contact_name} <${contact_email}>

Conversation actuelle:
${conversationContext}
${historicalContext}
${similarContext}
${templatesContext}

TACHE:
Analyse cette conversation, l'historique du contact ET les exemples de tickets similaires de la boite mail pour suggerer une reponse appropriee.
Utilise les exemples de reponses passees pour t'inspirer du style et de l'approche utilisee dans cette boite mail.

Reponds au format JSON avec ces champs:
{
  "suggested_response": "La reponse suggeree au format HTML avec des balises <p> et <br> pour la mise en forme",
  "confidence": 0.8,
  "reasoning": "Explication de pourquoi cette reponse est appropriee",
  "key_points": ["Point cle 1", "Point cle 2"],
  "alternative_approaches": ["Approche alternative 1", "Approche alternative 2"]
}

IMPORTANT:
- La reponse doit etre en HTML pour une belle presentation
- Prends en compte l'historique des echanges avec ce contact
- Adapte le ton selon la situation
- Sois specifique et personnalise la reponse
- ${mailbox?.signature ? `Utilise cette signature: ${mailbox.signature}` : "Termine avec 'Cordialement'"}`;

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
              content: "Tu es un assistant expert en relation client pour une agence immobiliere. Tu generes des reponses professionnelles et contextualisees en francais. Tes reponses sont toujours au format JSON.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 1500,
          response_format: { type: "json_object" },
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

    const suggestion = JSON.parse(content);

    return new Response(
      JSON.stringify(suggestion),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in suggest-response:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erreur inconnue",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
