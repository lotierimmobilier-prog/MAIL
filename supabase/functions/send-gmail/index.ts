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

interface Attachment {
  filename: string;
  content_type: string;
  data: string; // base64
}

function buildRawEmail(params: {
  from: string;
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  messageId: string;
  inReplyTo?: string;
  attachments?: Attachment[];
}): string {
  const hasAttachments = params.attachments && params.attachments.length > 0;
  const outerBoundary = `outer_${crypto.randomUUID().replace(/-/g, "")}`;
  const innerBoundary = `inner_${crypto.randomUUID().replace(/-/g, "")}`;

  const lines = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    `Message-ID: ${params.messageId}`,
    `MIME-Version: 1.0`,
  ];
  if (params.inReplyTo) {
    lines.push(`In-Reply-To: ${params.inReplyTo}`);
    lines.push(`References: ${params.inReplyTo}`);
  }

  if (hasAttachments) {
    lines.push(`Content-Type: multipart/mixed; boundary="${outerBoundary}"`);
    lines.push("");
    lines.push(`--${outerBoundary}`);
    lines.push(`Content-Type: multipart/alternative; boundary="${innerBoundary}"`);
  } else {
    lines.push(`Content-Type: multipart/alternative; boundary="${innerBoundary}"`);
  }

  lines.push("");
  lines.push(`--${innerBoundary}`);
  lines.push(`Content-Type: text/plain; charset="UTF-8"`);
  lines.push(`Content-Transfer-Encoding: quoted-printable`);
  lines.push("");
  lines.push(params.textBody);
  lines.push(`--${innerBoundary}`);
  lines.push(`Content-Type: text/html; charset="UTF-8"`);
  lines.push(`Content-Transfer-Encoding: quoted-printable`);
  lines.push("");
  lines.push(`<!DOCTYPE html><html><body>${params.htmlBody}</body></html>`);
  lines.push(`--${innerBoundary}--`);

  if (hasAttachments) {
    for (const att of params.attachments!) {
      lines.push(`--${outerBoundary}`);
      lines.push(`Content-Type: ${att.content_type}; name="${att.filename}"`);
      lines.push(`Content-Disposition: attachment; filename="${att.filename}"`);
      lines.push(`Content-Transfer-Encoding: base64`);
      lines.push("");
      lines.push(att.data);
    }
    lines.push(`--${outerBoundary}--`);
  }

  const raw = lines.join("\r\n");
  return btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { mailboxId, to, subject, body: emailBody, ticketId, inReplyToMessageId, attachments: reqAttachments } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Enforce send permissions (same as send-email)
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "admin" && profile?.role !== "manager") {
      const { data: permission } = await supabaseClient
        .from("mailbox_permissions")
        .select("can_send")
        .eq("mailbox_id", mailboxId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!permission?.can_send) {
        return new Response(
          JSON.stringify({ error: "Vous n'avez pas la permission d'envoyer des emails depuis cette boîte mail" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { data: mailbox } = await supabaseAdmin
      .from("mailboxes")
      .select("*")
      .eq("id", mailboxId)
      .eq("provider_type", "gmail")
      .maybeSingle();

    if (!mailbox) {
      return new Response(JSON.stringify({ error: "Boîte Gmail introuvable" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

    let accessToken = mailbox.gmail_access_token;
    const tokenExpiry = mailbox.gmail_token_expiry ? new Date(mailbox.gmail_token_expiry) : null;

    if (!tokenExpiry || tokenExpiry.getTime() < Date.now() + 60_000) {
      const newTokens = await refreshAccessToken(clientId, clientSecret, mailbox.gmail_refresh_token);
      accessToken = newTokens.access_token;
      await supabaseAdmin.from("mailboxes").update({
        gmail_access_token: accessToken,
        gmail_token_expiry: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
      }).eq("id", mailboxId);
    }

    const isHtml = /<[a-z][\s\S]*>/i.test(emailBody);
    const textBody = isHtml
      ? emailBody.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]*>/g, "").trim()
      : emailBody;
    const htmlBody = isHtml ? emailBody : emailBody.replace(/\n/g, "<br>");

    const messageId = `<${crypto.randomUUID()}@${mailbox.email_address.split("@")[1]}>`;

    // Download attachments from storage and encode as base64
    const attachments: Attachment[] = [];
    if (reqAttachments && reqAttachments.length > 0) {
      for (const att of reqAttachments) {
        const { data: fileData, error: dlError } = await supabaseAdmin.storage
          .from("attachments")
          .download(att.storage_path);
        if (dlError || !fileData) {
          console.error(`Failed to download attachment ${att.filename}:`, dlError);
          continue;
        }
        const arrayBuffer = await fileData.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        attachments.push({ filename: att.filename, content_type: att.content_type, data: base64 });
      }
    }

    const rawEmail = buildRawEmail({
      from: `${mailbox.name} <${mailbox.email_address}>`,
      to,
      subject,
      htmlBody,
      textBody,
      messageId,
      inReplyTo: inReplyToMessageId,
      attachments,
    });

    const sendRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: rawEmail }),
      }
    );

    if (!sendRes.ok) {
      throw new Error(`Gmail send failed: ${await sendRes.text()}`);
    }

    const sentMsg = await sendRes.json();

    // Store outbound email in DB
    await supabaseAdmin.from("emails").insert({
      mailbox_id: mailboxId,
      ticket_id: ticketId || null,
      message_id: sentMsg.id || messageId,
      from_address: mailbox.email_address,
      from_name: mailbox.name,
      to_addresses: [to],
      subject,
      body_text: textBody,
      body_html: htmlBody,
      direction: "outbound",
      received_at: new Date().toISOString(),
      in_reply_to: inReplyToMessageId || null,
    });

    if (ticketId) {
      await supabaseAdmin.from("tickets").update({
        updated_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
        status: "replied",
      }).eq("id", ticketId);
    }

    return new Response(
      JSON.stringify({ success: true, messageId: sentMsg.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-gmail error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
