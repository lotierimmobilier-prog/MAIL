import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function refreshAccessToken(clientId: string, clientSecret: string, refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  return res.json();
}

async function gmailFetch(accessToken: string, path: string) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail API error ${res.status}: ${await res.text()}`);
  return res.json();
}

function extractHeader(headers: { name: string; value: string }[], name: string): string {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

function decodeBase64Url(str: string): string {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return decodeURIComponent(
      atob(base64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")
    );
  } catch {
    return atob(base64);
  }
}

function extractBody(payload: any): { text: string; html: string } {
  let text = "";
  let html = "";

  function traverse(part: any) {
    if (!part) return;
    const mime = part.mimeType || "";
    const data = part.body?.data;

    if (mime === "text/plain" && data) {
      text += decodeBase64Url(data);
    } else if (mime === "text/html" && data) {
      html += decodeBase64Url(data);
    } else if (part.parts) {
      part.parts.forEach(traverse);
    }
  }

  traverse(payload);
  return { text, html };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { mailbox_id, max_messages = 50 } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: mailbox } = await supabaseAdmin
      .from("mailboxes")
      .select("*")
      .eq("id", mailbox_id)
      .eq("provider_type", "gmail")
      .maybeSingle();

    if (!mailbox) {
      return new Response(JSON.stringify({ error: "Mailbox Gmail introuvable" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

    let accessToken = mailbox.gmail_access_token;
    const tokenExpiry = mailbox.gmail_token_expiry ? new Date(mailbox.gmail_token_expiry) : null;

    // Refresh token if expired or about to expire
    if (!tokenExpiry || tokenExpiry.getTime() < Date.now() + 60_000) {
      const newTokens = await refreshAccessToken(clientId, clientSecret, mailbox.gmail_refresh_token);
      accessToken = newTokens.access_token;
      await supabaseAdmin.from("mailboxes").update({
        gmail_access_token: accessToken,
        gmail_token_expiry: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
      }).eq("id", mailbox_id);
    }

    // List recent INBOX messages
    const query = mailbox.gmail_history_id
      ? `q=in:inbox&maxResults=${max_messages}`
      : `q=in:inbox&maxResults=${max_messages}`;

    const listData = await gmailFetch(accessToken, `/users/me/messages?${query}`);
    const messageIds: string[] = (listData.messages || []).map((m: any) => m.id);

    let imported = 0;
    let skipped = 0;

    for (const gmailMsgId of messageIds) {
      const msg = await gmailFetch(accessToken, `/users/me/messages/${gmailMsgId}?format=full`);
      const headers = msg.payload?.headers || [];

      const subject = extractHeader(headers, "Subject") || "(Sans objet)";
      const fromRaw = extractHeader(headers, "From");
      const toRaw = extractHeader(headers, "To");
      const dateRaw = extractHeader(headers, "Date");
      // Use RFC Message-ID for threading; fall back to Gmail API id
      const rfcMessageId = extractHeader(headers, "Message-ID") || gmailMsgId;
      const inReplyTo = extractHeader(headers, "In-Reply-To") || null;

      // Dedup by RFC Message-ID (primary) or Gmail API id
      const { data: existing } = await supabaseAdmin
        .from("emails")
        .select("id")
        .eq("mailbox_id", mailbox_id)
        .or(`message_id.eq.${rfcMessageId},message_id.eq.${gmailMsgId}`)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      // Parse "Name <email>" format
      const fromMatch = fromRaw.match(/^(?:"?([^"<]*)"?\s*)?<?([^>]+)>?$/);
      const fromName = fromMatch?.[1]?.trim() || "";
      const fromAddress = fromMatch?.[2]?.trim() || fromRaw;

      const { text: bodyText, html: bodyHtml } = extractBody(msg.payload);

      const receivedAt = dateRaw ? new Date(dateRaw).toISOString() : new Date().toISOString();

      // Check if this is a reply to an existing ticket
      let ticketId: string | null = null;

      if (inReplyTo) {
        const { data: parentEmail } = await supabaseAdmin
          .from("emails")
          .select("ticket_id")
          .eq("message_id", inReplyTo)
          .maybeSingle();
        if (parentEmail?.ticket_id) ticketId = parentEmail.ticket_id;
      }

      if (!ticketId) {
        // Create new ticket
        const { data: newTicket } = await supabaseAdmin
          .from("tickets")
          .insert({
            mailbox_id,
            subject,
            contact_email: fromAddress,
            contact_name: fromName,
            status: "new",
            priority: "medium",
            last_message_at: receivedAt,
          })
          .select("id")
          .single();
        ticketId = newTicket?.id;
      }

      await supabaseAdmin.from("emails").insert({
        mailbox_id,
        ticket_id: ticketId,
        message_id: rfcMessageId,
        from_address: fromAddress,
        from_name: fromName,
        to_addresses: [toRaw],
        subject,
        body_text: bodyText,
        body_html: bodyHtml,
        direction: "inbound",
        received_at: receivedAt,
        in_reply_to: inReplyTo,
      });

      imported++;
    }

    // Trigger auto-draft generation for new tickets
    if (imported > 0) {
      const { data: newTickets } = await supabaseAdmin
        .from("tickets")
        .select("id")
        .eq("mailbox_id", mailbox_id)
        .eq("status", "new")
        .order("created_at", { ascending: false })
        .limit(imported);

      const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (anthropicKey && newTickets) {
        const autoGenUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/auto-generate-draft`;
        for (const t of newTickets) {
          fetch(autoGenUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ticket_id: t.id }),
          }).catch(console.error);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, imported, skipped }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("sync-gmail error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
