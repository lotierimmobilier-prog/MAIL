import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EncryptRequest {
  operation: 'encrypt' | 'decrypt';
  data: string;
  mailboxId?: string;
}

interface EncryptResponse {
  result: string;
  version: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { operation, data, mailboxId }: EncryptRequest = await req.json();

    if (!operation || !data) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: operation, data' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let encryptionKey = Deno.env.get("ENCRYPTION_KEY");
    if (!encryptionKey) {
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!serviceKey) {
        console.error("No encryption key available");
        return new Response(
          JSON.stringify({ error: 'Server configuration error' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      const encoder = new TextEncoder();
      const keyData = encoder.encode(serviceKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);
      const hashArray = new Uint8Array(hashBuffer);
      encryptionKey = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    let result: string;
    const version = 1;

    if (operation === 'encrypt') {
      result = await encryptData(data, encryptionKey);
    } else if (operation === 'decrypt') {
      result = await decryptData(data, encryptionKey);
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid operation. Use "encrypt" or "decrypt"' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    let userId = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id;
    }

    await supabase.from('audit_log').insert({
      user_id: userId,
      action: operation === 'encrypt' ? 'credential_encrypted' : 'credential_decrypted',
      resource_type: 'mailbox',
      resource_id: mailboxId || null,
      details: {
        operation,
        timestamp: new Date().toISOString(),
        via: 'crypto-credentials-function'
      }
    });

    const response: EncryptResponse = {
      result,
      version
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Crypto operation failed:', error);
    return new Response(
      JSON.stringify({
        error: 'Cryptographic operation failed',
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function encryptData(plaintext: string, keyString: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  const keyData = encoder.encode(keyString.padEnd(32, '0').substring(0, 32));
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    data
  );

  const encryptedArray = new Uint8Array(encryptedData);
  const combined = new Uint8Array(iv.length + encryptedArray.length);
  combined.set(iv);
  combined.set(encryptedArray, iv.length);

  return btoa(String.fromCharCode(...combined));
}

async function decryptData(encryptedBase64: string, keyString: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));

  const iv = combined.slice(0, 12);
  const encryptedData = combined.slice(12);

  const keyData = encoder.encode(keyString.padEnd(32, '0').substring(0, 32));
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decryptedData = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    encryptedData
  );

  return decoder.decode(decryptedData);
}
