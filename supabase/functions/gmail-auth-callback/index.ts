import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { code, state, redirect_uri, mailbox_name } = await req.json();

    if (!code || !state) {
      return new Response(JSON.stringify({ error: "code et state sont requis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: "Google OAuth non configuré" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify CSRF state
    const { data: stateRow } = await supabaseAdmin
      .from("gmail_oauth_states")
      .select("*")
      .eq("state", state)
      .maybeSingle();

    if (!stateRow) {
      return new Response(JSON.stringify({ error: "State invalide ou expiré" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirect_uri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error(`Token exchange failed: ${err}`);
    }

    const tokens = await tokenRes.json();
    const { access_token, refresh_token, expires_in } = tokens;

    // Get Gmail user info to confirm email
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const userInfo = await userRes.json();
    const gmailEmail = userInfo.email;

    const tokenExpiry = new Date(Date.now() + expires_in * 1000).toISOString();

    let mailboxId = stateRow.mailbox_id;

    if (mailboxId) {
      // Update existing mailbox
      await supabaseAdmin
        .from("mailboxes")
        .update({
          provider_type: "gmail",
          email_address: gmailEmail,
          gmail_access_token: access_token,
          gmail_refresh_token: refresh_token,
          gmail_token_expiry: tokenExpiry,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", mailboxId);
    } else {
      // Create new mailbox
      const { data: newMailbox } = await supabaseAdmin
        .from("mailboxes")
        .insert({
          name: mailbox_name || `Gmail - ${gmailEmail}`,
          email_address: gmailEmail,
          provider_type: "gmail",
          gmail_access_token: access_token,
          gmail_refresh_token: refresh_token,
          gmail_token_expiry: tokenExpiry,
          is_active: true,
          polling_interval_seconds: 60,
          tone: "professional",
        })
        .select("id")
        .single();
      mailboxId = newMailbox?.id;
    }

    // Cleanup state
    await supabaseAdmin.from("gmail_oauth_states").delete().eq("state", state);

    return new Response(
      JSON.stringify({ success: true, mailbox_id: mailboxId, email: gmailEmail }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
