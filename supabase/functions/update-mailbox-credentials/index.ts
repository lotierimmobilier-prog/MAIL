import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface UpdateMailboxRequest {
  mailboxId?: string;
  name: string;
  email_address: string;
  provider_type: 'imap' | 'ovh';
  imap_host?: string;
  imap_port?: number;
  smtp_host?: string;
  smtp_port?: number;
  smtp_security?: string;
  username?: string;
  password?: string;
  use_tls?: boolean;
  polling_interval_seconds?: number;
  signature?: string;
  style_prompt?: string;
  tone?: string;
  ovh_consumer_key?: string;
  ovh_domain?: string;
  ovh_account?: string;
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
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: UpdateMailboxRequest = await req.json();

    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const payload: any = {
      name: body.name,
      email_address: body.email_address,
      provider_type: body.provider_type,
      signature: body.signature || '',
      style_prompt: body.style_prompt || '',
      tone: body.tone || 'professional',
      updated_at: new Date().toISOString(),
    };

    if (body.provider_type === 'ovh') {
      payload.ovh_domain = body.ovh_domain;
      payload.ovh_account = body.ovh_account;
      payload.imap_host = 'ssl0.ovh.net';
      payload.imap_port = 993;
      payload.smtp_host = 'ssl0.ovh.net';
      payload.smtp_port = 465;
      payload.smtp_security = 'SSL';
      payload.username = body.email_address;
      payload.use_tls = true;
      payload.polling_interval_seconds = 60;

      if (body.ovh_consumer_key && body.ovh_consumer_key.trim() !== '') {
        try {
          const cryptoUrl = `${supabaseUrl}/functions/v1/crypto-credentials`;
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          const encryptRes = await fetch(cryptoUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
              'apikey': Deno.env.get("SUPABASE_ANON_KEY")!,
            },
            body: JSON.stringify({
              operation: 'encrypt',
              data: body.ovh_consumer_key,
              mailboxId: body.mailboxId || 'new'
            })
          });

          if (!encryptRes.ok) {
            const errText = await encryptRes.text();
            console.error('OVH key encryption failed:', errText);
            throw new Error('Failed to encrypt OVH consumer key');
          }

          const encryptData = await encryptRes.json();
          payload.ovh_consumer_key_secure = encryptData.result;
          payload.encryption_version = encryptData.version;
          payload.encrypted_at = new Date().toISOString();
        } catch (encryptError: any) {
          console.error('OVH encryption error:', encryptError);
          throw new Error(`OVH encryption failed: ${encryptError.message}`);
        }
      }
    } else {
      payload.imap_host = body.imap_host;
      payload.imap_port = body.imap_port;
      payload.smtp_host = body.smtp_host;
      payload.smtp_port = body.smtp_port;
      payload.smtp_security = body.smtp_security || 'SSL';
      payload.username = body.username;
      payload.use_tls = body.use_tls !== undefined ? body.use_tls : true;
      payload.polling_interval_seconds = body.polling_interval_seconds || 60;

      if (body.password && body.password.trim() !== '') {
        try {
          const cryptoUrl = `${supabaseUrl}/functions/v1/crypto-credentials`;
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          const encryptRes = await fetch(cryptoUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
              'apikey': Deno.env.get("SUPABASE_ANON_KEY")!,
            },
            body: JSON.stringify({
              operation: 'encrypt',
              data: body.password,
              mailboxId: body.mailboxId || 'new'
            })
          });

          if (!encryptRes.ok) {
            const errText = await encryptRes.text();
            console.error('Encryption failed:', errText);
            throw new Error('Failed to encrypt password');
          }

          const encryptData = await encryptRes.json();
          payload.encrypted_password_secure = encryptData.result;
          payload.encryption_version = encryptData.version;
          payload.encrypted_at = new Date().toISOString();
        } catch (encryptError: any) {
          console.error('Encryption error:', encryptError);
          throw new Error(`Encryption failed: ${encryptError.message}`);
        }
      }
    }

    let result;
    if (body.mailboxId) {
      const { data, error } = await supabaseAdmin
        .from('mailboxes')
        .update(payload)
        .eq('id', body.mailboxId)
        .select()
        .maybeSingle();

      if (error) {
        console.error('Database update error:', error);
        throw new Error(`Database error: ${error.message}`);
      }
      if (!data) {
        throw new Error('Mailbox not found');
      }
      result = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from('mailboxes')
        .insert(payload)
        .select()
        .maybeSingle();

      if (error) {
        console.error('Database insert error:', error);
        throw new Error(`Database error: ${error.message}`);
      }
      if (!data) {
        throw new Error('Failed to create mailbox');
      }
      result = data;
    }

    await supabaseAdmin.from('audit_log').insert({
      user_id: user.id,
      action: body.mailboxId ? 'mailbox_updated' : 'mailbox_created',
      resource_type: 'mailbox',
      resource_id: result.id,
      details: {
        name: body.name,
        email_address: body.email_address,
        provider_type: body.provider_type,
        credentials_updated: !!(body.password || body.ovh_consumer_key)
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        mailbox: {
          id: result.id,
          name: result.name,
          email_address: result.email_address
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Update mailbox error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to update mailbox',
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
