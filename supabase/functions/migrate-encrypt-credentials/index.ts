import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
      .single();

    if (profile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: mailboxes, error: fetchError } = await supabase
      .from('mailboxes')
      .select('id, encrypted_password, ovh_consumer_key, provider_type, encrypted_password_secure, ovh_consumer_key_secure')
      .is('encrypted_password_secure', null);

    if (fetchError) {
      throw fetchError;
    }

    if (!mailboxes || mailboxes.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No mailboxes to migrate',
          migrated: 0
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const cryptoUrl = `${supabaseUrl}/functions/v1/crypto-credentials`;
    let successCount = 0;
    let errorCount = 0;
    const errors: any[] = [];

    for (const mailbox of mailboxes) {
      try {
        const updates: any = {
          encryption_version: 1,
          encrypted_at: new Date().toISOString()
        };

        if (mailbox.encrypted_password) {
          const encryptRes = await fetch(cryptoUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              operation: 'encrypt',
              data: mailbox.encrypted_password,
              mailboxId: mailbox.id
            })
          });

          if (!encryptRes.ok) {
            throw new Error(`Encryption failed for mailbox ${mailbox.id}`);
          }

          const encryptData = await encryptRes.json();
          updates.encrypted_password_secure = encryptData.result;
        }

        if (mailbox.provider_type === 'ovh' && mailbox.ovh_consumer_key) {
          const encryptRes = await fetch(cryptoUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              operation: 'encrypt',
              data: mailbox.ovh_consumer_key,
              mailboxId: mailbox.id
            })
          });

          if (!encryptRes.ok) {
            throw new Error(`OVH key encryption failed for mailbox ${mailbox.id}`);
          }

          const encryptData = await encryptRes.json();
          updates.ovh_consumer_key_secure = encryptData.result;
        }

        const { error: updateError } = await supabase
          .from('mailboxes')
          .update(updates)
          .eq('id', mailbox.id);

        if (updateError) {
          throw updateError;
        }

        await supabase.from('audit_log').insert({
          user_id: user.id,
          action: 'credentials_migrated',
          resource_type: 'mailbox',
          resource_id: mailbox.id,
          details: {
            migrated_password: !!mailbox.encrypted_password,
            migrated_ovh_key: !!(mailbox.provider_type === 'ovh' && mailbox.ovh_consumer_key),
            migration_timestamp: new Date().toISOString()
          }
        });

        successCount++;
      } catch (err: any) {
        errorCount++;
        errors.push({
          mailbox_id: mailbox.id,
          error: err.message
        });
        console.error(`Failed to migrate mailbox ${mailbox.id}:`, err);
      }
    }

    return new Response(
      JSON.stringify({
        success: errorCount === 0,
        message: `Migration completed: ${successCount} successful, ${errorCount} failed`,
        migrated: successCount,
        failed: errorCount,
        errors: errors.length > 0 ? errors : undefined
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Migration error:', error);
    return new Response(
      JSON.stringify({
        error: 'Migration failed',
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
