import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import nodemailer from "npm:nodemailer@6.9.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AttachmentInfo {
  filename: string;
  content_type: string;
  storage_path: string;
}

interface SendEmailRequest {
  mailboxId: string;
  to: string;
  subject: string;
  body: string;
  ticketId?: string;
  inReplyToMessageId?: string;
  idempotencyKey?: string;
  attachments?: AttachmentInfo[];
}

async function sendViaSMTP(
  smtpHost: string,
  smtpPort: number,
  username: string,
  password: string,
  smtpSecurity: string,
  from: string,
  to: string,
  subject: string,
  htmlBody: string,
  textBody: string,
  messageId: string,
  inReplyTo?: string,
  mailAttachments?: { filename: string; content: Uint8Array; contentType: string }[]
) {
  let secure = false;
  let requireTLS = false;

  if (smtpSecurity === 'SSL') {
    secure = true;
  } else if (smtpSecurity === 'STARTTLS') {
    requireTLS = true;
  }

  const transportConfig: any = {
    host: smtpHost,
    port: smtpPort,
    secure: secure,
    requireTLS: requireTLS,
    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
    auth: {
      user: username,
      pass: password,
    },
    tls: {
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2'
    },
  };

  const transporter = nodemailer.createTransport(transportConfig);

  const wrappedHtmlBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  ${htmlBody}
</body>
</html>`;

  const mailOptions: any = {
    from: from,
    to: to,
    subject: subject,
    text: textBody,
    html: wrappedHtmlBody,
    messageId: messageId,
    textEncoding: 'quoted-printable',
    encoding: 'utf8'
  };

  if (inReplyTo) {
    mailOptions.inReplyTo = inReplyTo;
    mailOptions.references = inReplyTo;
  }

  if (mailAttachments && mailAttachments.length > 0) {
    mailOptions.attachments = mailAttachments.map(att => ({
      filename: att.filename,
      content: att.content,
      contentType: att.contentType,
    }));
  }

  const result = await transporter.sendMail(mailOptions);
  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Non autorisé" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } }
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Non autorisé" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: SendEmailRequest = await req.json();
    const { mailboxId, to, subject, body: emailBody, ticketId, inReplyToMessageId, idempotencyKey, attachments: reqAttachments } = body;

    if (!mailboxId || !to || !subject || !emailBody) {
      return new Response(
        JSON.stringify({ error: "Tous les champs sont obligatoires" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    if (idempotencyKey) {
      const { data: existing } = await supabaseAdmin
        .from("emails")
        .select("id, message_id")
        .eq("message_id", idempotencyKey)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({
            success: true,
            message: "Email déjà envoyé (doublon détecté)",
            messageId: existing.message_id,
            deduplicated: true
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { data: mailbox } = await supabaseAdmin
      .from("mailboxes")
      .select("*")
      .eq("id", mailboxId)
      .maybeSingle();

    if (!mailbox) {
      return new Response(
        JSON.stringify({ error: "Boîte mail non trouvée" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let password = mailbox.encrypted_password;

    if (mailbox.encrypted_password_secure) {
      const cryptoUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/crypto-credentials`;
      const decryptRes = await fetch(cryptoUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'decrypt',
          data: mailbox.encrypted_password_secure,
          mailboxId: mailbox.id
        })
      });

      if (decryptRes.ok) {
        const decryptData = await decryptRes.json();
        password = decryptData.result;
      } else {
        throw new Error('Failed to decrypt mailbox credentials');
      }
    }

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== 'admin' && profile?.role !== 'manager') {
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

    const messageId = idempotencyKey || `<${crypto.randomUUID()}@${mailbox.email_address.split('@')[1]}>`;

    const isHtml = emailBody.includes('<p>') || emailBody.includes('<br') || emailBody.includes('<div>') ||
      emailBody.includes('<table') || emailBody.includes('<span') || emailBody.includes('<strong') ||
      emailBody.includes('<ul') || emailBody.includes('<ol') || emailBody.includes('<h1') ||
      emailBody.includes('<h2') || emailBody.includes('<h3');

    let textBody: string;
    let htmlBody: string;

    if (isHtml) {
      textBody = emailBody
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n\n+/g, '\n\n')
        .trim();
      htmlBody = emailBody;
    } else {
      textBody = emailBody;
      htmlBody = emailBody.replace(/\n/g, '<br>');
    }

    const { error: insertError, data: insertedEmail } = await supabaseAdmin
      .from("emails")
      .insert({
        mailbox_id: mailboxId,
        ticket_id: ticketId || null,
        message_id: messageId,
        from_address: mailbox.email_address,
        from_name: mailbox.name,
        to_addresses: [to],
        subject: subject,
        body_text: textBody,
        body_html: htmlBody,
        direction: 'outbound',
        received_at: new Date().toISOString(),
        in_reply_to: inReplyToMessageId || null
      })
      .select("id")
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return new Response(
          JSON.stringify({
            success: true,
            message: "Email déjà envoyé (doublon détecté)",
            messageId: messageId,
            deduplicated: true
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Erreur lors de la sauvegarde de l'email: ${insertError.message}`);
    }

    const mailAttachments: { filename: string; content: Uint8Array; contentType: string }[] = [];
    if (reqAttachments && reqAttachments.length > 0) {
      for (const att of reqAttachments) {
        const { data: fileData, error: dlError } = await supabaseAdmin.storage
          .from('attachments')
          .download(att.storage_path);

        if (dlError || !fileData) {
          console.error(`Failed to download attachment ${att.filename}:`, dlError);
          continue;
        }

        const arrayBuffer = await fileData.arrayBuffer();
        mailAttachments.push({
          filename: att.filename,
          content: new Uint8Array(arrayBuffer),
          contentType: att.content_type,
        });
      }
    }

    try {
      await sendViaSMTP(
        mailbox.smtp_host,
        mailbox.smtp_port,
        mailbox.username,
        password,
        (mailbox as any).smtp_security || 'SSL',
        mailbox.email_address,
        to,
        subject,
        htmlBody,
        textBody,
        messageId,
        inReplyToMessageId,
        mailAttachments
      );
    } catch (smtpError) {
      if (insertedEmail?.id) {
        await supabaseAdmin.from("emails").delete().eq("id", insertedEmail.id);
      }
      throw new Error(`Erreur lors de l'envoi SMTP: ${smtpError instanceof Error ? smtpError.message : "Erreur inconnue"}`);
    }

    if (ticketId) {
      await supabaseAdmin
        .from("tickets")
        .update({
          updated_at: new Date().toISOString(),
          last_message_at: new Date().toISOString()
        })
        .eq("id", ticketId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email envoyé avec succès",
        messageId: messageId
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Send email error:", error instanceof Error ? error.message : "Unknown");
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }),
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
