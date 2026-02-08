import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import nodemailer from "npm:nodemailer@6.9.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SendEmailRequest {
  mailboxId: string;
  to: string;
  subject: string;
  body: string;
  ticketId?: string;
  inReplyToMessageId?: string;
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
  inReplyTo?: string
) {
  console.log(`Tentative d'envoi via SMTP: ${smtpHost}:${smtpPort} (${smtpSecurity})`);

  console.log('=== ENCODING DEBUG ===');
  console.log('Subject (first 50 chars):', subject.substring(0, 50));
  console.log('Subject codepoints:', [...subject.substring(0, 20)].map(c => `${c}:U+${c.charCodeAt(0).toString(16).toUpperCase()}`).join(' '));
  console.log('TextBody (first 100 chars):', textBody.substring(0, 100));
  console.log('TextBody sample codepoints:', [...textBody.substring(0, 30)].map(c => `${c}:U+${c.charCodeAt(0).toString(16).toUpperCase()}`).join(' '));

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
      rejectUnauthorized: false
    },
    debug: true,
    logger: true
  };

  console.log('Configuration SMTP:', JSON.stringify({
    host: smtpHost,
    port: smtpPort,
    secure,
    requireTLS,
    user: username
  }));

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

  try {
    console.log('Envoi de l\'email...');
    console.log('MailOptions encoding:', mailOptions.encoding, mailOptions.textEncoding);
    const result = await transporter.sendMail(mailOptions);
    console.log('Email envoyé avec succès:', result);
    console.log('=== END ENCODING DEBUG ===');
    return result;
  } catch (error) {
    console.error('Erreur détaillée SMTP:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: (error as any).code,
      command: (error as any).command,
      response: (error as any).response,
      responseCode: (error as any).responseCode
    });
    throw error;
  }
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
    const { mailboxId, to, subject, body: emailBody, ticketId, inReplyToMessageId } = body;

    if (!mailboxId || !to || !subject || !emailBody) {
      return new Response(
        JSON.stringify({ error: "Tous les champs sont obligatoires" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: mailbox } = await supabaseClient
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

    const messageId = `<${crypto.randomUUID()}@${mailbox.email_address.split('@')[1]}>`;

    const isHtml = emailBody.includes('<p>') || emailBody.includes('<br>') || emailBody.includes('<div>');

    let textBody: string;
    let htmlBody: string;

    if (isHtml) {
      textBody = emailBody
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]*>/g, '')
        .replace(/\n\n+/g, '\n\n')
        .trim();
      htmlBody = emailBody;
    } else {
      textBody = emailBody;
      htmlBody = emailBody.replace(/\n/g, '<br>');
    }

    // Envoyer via SMTP en utilisant les paramètres de la mailbox
    try {
      await sendViaSMTP(
        mailbox.smtp_host,
        mailbox.smtp_port,
        mailbox.username,
        mailbox.encrypted_password, // Note: dans une vraie production, il faudrait déchiffrer
        (mailbox as any).smtp_security || 'SSL',
        mailbox.email_address,
        to,
        subject,
        htmlBody,
        textBody,
        messageId,
        inReplyToMessageId
      );
    } catch (smtpError) {
      console.error("Erreur SMTP:", smtpError);
      throw new Error(`Erreur lors de l'envoi SMTP: ${smtpError instanceof Error ? smtpError.message : "Erreur inconnue"}`);
    }

    const { error: insertError } = await supabaseClient
      .from("emails")
      .insert({
        mailbox_id: mailboxId,
        ticket_id: ticketId,
        message_id: messageId,
        from_address: mailbox.email_address,
        from_name: mailbox.name,
        to_addresses: [to],
        subject: subject,
        body_text: emailBody,
        body_html: emailBody.replace(/\n/g, '<br>'),
        direction: 'outbound',
        received_at: new Date().toISOString(),
        in_reply_to: inReplyToMessageId
      });

    if (insertError) {
      console.error("Erreur insertion email:", insertError);
      throw new Error(`Erreur lors de la sauvegarde de l'email: ${insertError.message}`);
    }

    if (ticketId) {
      await supabaseClient
        .from("tickets")
        .update({
          updated_at: new Date().toISOString(),
          last_response_at: new Date().toISOString()
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
    console.error("Erreur:", error);
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
