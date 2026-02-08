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
    const { ticket_id } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) {
      console.log("No OpenAI API key - skipping auto-draft generation");
      return new Response(
        JSON.stringify({ success: false, reason: "No OpenAI API key" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: ticket } = await supabase
      .from("tickets")
      .select(`
        *,
        emails!inner(
          id,
          subject,
          body_text,
          from_address,
          from_name,
          direction,
          received_at
        )
      `)
      .eq("id", ticket_id)
      .order("received_at", { foreignTable: "emails", ascending: true })
      .maybeSingle();

    if (!ticket) {
      throw new Error("Ticket introuvable");
    }

    const inboundEmails = ticket.emails?.filter((e: any) => e.direction === "inbound") || [];
    if (inboundEmails.length === 0) {
      return new Response(
        JSON.stringify({ success: false, reason: "No inbound emails" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: historicalTickets } = await supabase
      .from("tickets")
      .select(`
        id,
        subject,
        status,
        emails!inner(
          id,
          body_text,
          direction,
          received_at
        )
      `)
      .eq("contact_email", ticket.contact_email)
      .neq("id", ticket_id)
      .eq("status", "closed")
      .order("created_at", { ascending: false })
      .limit(3);

    const { data: similarTickets } = await supabase
      .from("tickets")
      .select(`
        id,
        subject,
        emails!inner(
          id,
          body_text,
          direction,
          received_at
        )
      `)
      .eq("mailbox_id", ticket.mailbox_id)
      .eq("status", "closed")
      .neq("id", ticket_id)
      .order("created_at", { ascending: false })
      .limit(10);

    let categoryTemplates: any[] = [];
    if (ticket.category_id) {
      const { data } = await supabase
        .from("email_templates")
        .select("name, subject, body, description")
        .eq("category_id", ticket.category_id)
        .eq("is_active", true)
        .limit(3);
      categoryTemplates = data || [];
    }

    const { data: mailbox } = await supabase
      .from("mailboxes")
      .select("tone, signature")
      .eq("id", ticket.mailbox_id)
      .maybeSingle();

    let conversationContext = "";
    if (ticket.emails && Array.isArray(ticket.emails)) {
      conversationContext = ticket.emails
        .map((email: any) =>
          `[${email.direction === "inbound" ? "Client" : "Agent"}] (${email.received_at}):\n${(email.body_text || "").substring(0, 1000)}`
        )
        .join("\n\n---\n\n");
    }

    let historicalContext = "";
    if (historicalTickets && historicalTickets.length > 0) {
      historicalContext = "\n\nHistorique des echanges precedents avec ce contact :\n" +
        historicalTickets.map((t: any) => {
          const replies = t.emails?.filter((e: any) => e.direction === "outbound") || [];
          const lastReply = replies[replies.length - 1];
          return `- Sujet: ${t.subject}\n  ${lastReply ? `Derniere reponse: ${(lastReply.body_text || "").substring(0, 300)}...` : ""}`;
        }).join("\n\n");
    }

    let similarContext = "";
    if (similarTickets && similarTickets.length > 0) {
      similarContext = "\n\nExemples de reponses similaires dans cette boite mail :\n" +
        similarTickets.slice(0, 5).map((t: any) => {
          const replies = t.emails?.filter((e: any) => e.direction === "outbound") || [];
          const firstReply = replies[0];
          return `- Sujet: ${t.subject}\n  ${firstReply ? `Reponse: ${(firstReply.body_text || "").substring(0, 250)}...` : ""}`;
        }).join("\n\n");
    }

    let templatesContext = "";
    if (categoryTemplates.length > 0) {
      templatesContext = "\n\nModeles disponibles :\n" +
        categoryTemplates.map(tpl =>
          `- ${tpl.name}: ${tpl.description || ""}\n  ${(tpl.body || "").substring(0, 200)}...`
        ).join("\n\n");
    }

    const toneInstruction = mailbox?.tone === "formal"
      ? "Utilise un ton tres formel et soutenu."
      : mailbox?.tone === "friendly"
        ? "Utilise un ton chaleureux et amical tout en restant professionnel."
        : "Utilise un ton professionnel et courtois.";

    const prompt = `Tu es un assistant qui genere automatiquement des brouillons de reponse pour une agence immobiliere.

${toneInstruction}

CONTEXTE:
Sujet: ${ticket.subject}
De: ${ticket.contact_name} <${ticket.contact_email}>

Conversation:
${conversationContext}
${historicalContext}
${similarContext}
${templatesContext}

TACHE:
Genere un brouillon de reponse professionnel et contextualise en t'inspirant des exemples precedents.

Reponds au format JSON:
{
  "subject": "Re: ${ticket.subject}",
  "body": "La reponse au format HTML avec <p> et <br>",
  "confidence": 0.8,
  "notes": "Notes pour l'agent (points importants a verifier)"
}

IMPORTANT:
- Genere du HTML pour une belle presentation
- Inspire-toi des reponses passees de cette boite mail
- Prends en compte l'historique avec ce contact
- ${mailbox?.signature ? `Utilise cette signature: ${mailbox.signature}` : "Termine avec 'Cordialement'"}
- Sois specifique et personnalise`;

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
              content: "Tu es un assistant expert en relation client. Tu generes des brouillons de reponse professionnels en francais. Format JSON uniquement.",
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
      throw new Error(`OpenAI API error ${openaiRes.status}`);
    }

    const openaiData = await openaiRes.json();
    const content = openaiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Aucune reponse generee");
    }

    const draft = JSON.parse(content);

    const { data: existingDraft } = await supabase
      .from("drafts")
      .select("id")
      .eq("ticket_id", ticket_id)
      .maybeSingle();

    if (existingDraft) {
      await supabase
        .from("drafts")
        .update({
          subject: draft.subject,
          body: draft.body,
          notes: draft.notes || "",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingDraft.id);
    } else {
      await supabase
        .from("drafts")
        .insert({
          ticket_id: ticket_id,
          subject: draft.subject,
          body: draft.body,
          notes: draft.notes || "",
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        draft: draft,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in auto-generate-draft:", error);
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
