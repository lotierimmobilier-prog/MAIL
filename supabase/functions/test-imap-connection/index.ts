import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function decryptCredential(encryptedData: string, mailboxId: string): Promise<string> {
  const cryptoUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/crypto-credentials`;
  const response = await fetch(cryptoUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      operation: 'decrypt',
      data: encryptedData,
      mailboxId
    })
  });

  if (!response.ok) {
    throw new Error('Failed to decrypt credential');
  }

  const data = await response.json();
  return data.result;
}

class Imap {
  private c: Deno.TlsConn | null = null;
  private t = 0;
  private buf = "";
  private enc = new TextEncoder();
  private dec = new TextDecoder();

  async open(host: string, port: number, timeoutMs: number = 10000) {
    const connectPromise = Deno.connectTls({ hostname: host, port });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Connection timeout after ${timeoutMs}ms`)), timeoutMs)
    );

    this.c = await Promise.race([connectPromise, timeoutPromise]);
    const greeting = await this.line();
    if (!greeting.includes("OK") && !greeting.startsWith("*")) {
      throw new Error("Invalid IMAP greeting: " + greeting);
    }
  }

  private async rd() {
    const b = new Uint8Array(32768);
    const n = await this.c!.read(b);
    if (n === null) throw new Error("Connection closed");
    this.buf += this.dec.decode(b.subarray(0, n));
  }

  private async line(): Promise<string> {
    while (!this.buf.includes("\r\n")) await this.rd();
    const i = this.buf.indexOf("\r\n");
    const l = this.buf.substring(0, i);
    this.buf = this.buf.substring(i + 2);
    return l;
  }

  private async cmd(c: string): Promise<string> {
    const tag = `A${++this.t}`;
    await this.wr(`${tag} ${c}\r\n`);
    let r = "";
    while (true) {
      const l = await this.line();
      r += l + "\r\n";
      if (l.startsWith(`${tag} `)) {
        if (l.includes("NO") || l.includes("BAD")) throw new Error(l);
        return r;
      }
    }
  }

  private async wr(s: string) {
    const d = this.enc.encode(s);
    let w = 0;
    while (w < d.length) w += await this.c!.write(d.subarray(w));
  }

  async login(u: string, p: string) {
    await this.cmd(`LOGIN "${u}" "${p.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
  }

  async select(mb: string): Promise<number> {
    const r = await this.cmd(`SELECT "${mb}"`);
    const m = r.match(/\*\s+(\d+)\s+EXISTS/);
    return m ? parseInt(m[1]) : 0;
  }

  close() {
    try {
      this.c?.close();
    } catch {}
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
    const body = await req.json();
    const { mailbox_id, imap_host, imap_port, username, password } = body;

    if (!imap_host || !imap_port || !username) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Paramètres manquants (host, port, username requis)"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let finalPassword = password;

    if (mailbox_id && !password) {
      const { data: mailbox } = await sb
        .from("mailboxes")
        .select("encrypted_password, encrypted_password_secure")
        .eq("id", mailbox_id)
        .single();

      if (mailbox?.encrypted_password_secure) {
        finalPassword = await decryptCredential(mailbox.encrypted_password_secure, mailbox_id);
      } else if (mailbox?.encrypted_password) {
        finalPassword = mailbox.encrypted_password;
      }
    }

    if (!finalPassword || finalPassword === "encrypted_placeholder") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Mot de passe manquant ou invalide"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const imap = new Imap();
    const startTime = Date.now();

    try {
      await imap.open(imap_host, imap_port, 10000);
      const connectTime = Date.now() - startTime;

      await imap.login(username, finalPassword);
      const loginTime = Date.now() - startTime - connectTime;

      const emailCount = await imap.select("INBOX");
      const selectTime = Date.now() - startTime - connectTime - loginTime;

      imap.close();

      return new Response(
        JSON.stringify({
          success: true,
          message: "Connexion IMAP réussie",
          details: {
            server: `${imap_host}:${imap_port}`,
            username,
            email_count: emailCount,
            timings: {
              connection_ms: connectTime,
              login_ms: loginTime,
              select_ms: selectTime,
              total_ms: Date.now() - startTime
            }
          }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );

    } catch (err: any) {
      imap.close();

      let errorMessage = err.message || "Erreur inconnue";
      let errorType = "unknown";

      if (errorMessage.includes("timeout") || errorMessage.includes("Connection timeout")) {
        errorType = "timeout";
        errorMessage = "Délai de connexion dépassé. Vérifiez le serveur et le port.";
      } else if (errorMessage.includes("NO") || errorMessage.includes("BAD")) {
        errorType = "authentication";
        errorMessage = "Authentification échouée. Vérifiez le nom d'utilisateur et le mot de passe.";
      } else if (errorMessage.includes("Connection closed") || errorMessage.includes("connection")) {
        errorType = "connection";
        errorMessage = "Impossible de se connecter au serveur. Vérifiez l'adresse et le port.";
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          error_type: errorType,
          raw_error: err.message
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || "Erreur interne"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
