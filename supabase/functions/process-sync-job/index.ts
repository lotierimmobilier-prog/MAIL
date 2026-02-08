import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const EXECUTION_TIMEOUT = 50000;
const MAX_BATCH_SIZE = 50;

function stripRe(s: string): string {
  return s.replace(/^(Re|Fwd|Fw|TR|AW|Ref):\s*/gi, "").trim();
}

function decHdr(raw: string): string {
  return raw.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, cs, enc, txt) => {
    try {
      if (enc.toUpperCase() === "B") {
        return new TextDecoder(cs).decode(Uint8Array.from(atob(txt), c => c.charCodeAt(0)));
      }
      if (enc.toUpperCase() === "Q") {
        const d = txt.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_: string, h: string) => String.fromCharCode(parseInt(h, 16)));
        return new TextDecoder(cs).decode(Uint8Array.from(d, c => c.charCodeAt(0)));
      }
    } catch {}
    return txt;
  });
}

function parseAddr(h: string): { address: string; name: string }[] {
  if (!h) return [];
  return h.split(",").map(p => {
    const t = p.trim();
    const m = t.match(/<([^>]+)>/);
    if (m) return { address: m[1].trim(), name: decHdr(t.substring(0, t.indexOf("<")).replace(/"/g, "").trim()) };
    if (t.includes("@")) return { address: t, name: "" };
    return null;
  }).filter(Boolean) as { address: string; name: string }[];
}

function parseHeaders(raw: string): Record<string, string> {
  const h: Record<string, string> = {};
  const lines = raw.replace(/\r\n([ \t])/g, " ").split("\r\n");
  for (const l of lines) {
    const i = l.indexOf(":");
    if (i > 0) h[l.substring(0, i).trim().toLowerCase()] = l.substring(i + 1).trim();
  }
  return h;
}

function extractBody(raw: string, depth = 0): { text: string; html: string } {
  if (depth > 10) return { text: "", html: "" };
  const bm = raw.match(/content-type:\s*multipart\/[^;]*;\s*boundary="?([^\s";]+)"?/i);
  if (bm) {
    let text = "", html = "";
    const parts = raw.split("--" + bm[1]);
    for (const part of parts) {
      const si = part.indexOf("\r\n\r\n");
      if (si === -1) continue;
      const ph = part.substring(0, si).toLowerCase();
      let pb = part.substring(si + 4);
      if (ph.match(/multipart\//i)) {
        const n = extractBody(part, depth + 1);
        if (n.text) text = text || n.text;
        if (n.html) html = html || n.html;
        continue;
      }
      const te = ph.match(/content-transfer-encoding:\s*(\S+)/);
      if (te) {
        if (te[1] === "base64") {
          try {
            pb = new TextDecoder().decode(Uint8Array.from(atob(pb.replace(/\s/g, "")), c => c.charCodeAt(0)));
          } catch {}
        } else if (te[1] === "quoted-printable") {
          pb = pb.replace(/=\r\n/g, "").replace(/=([0-9A-Fa-f]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
        }
      }
      if (ph.includes("text/html") && !html) html = pb.trim();
      else if (ph.includes("text/plain") && !text) text = pb.trim();
    }
    return { text, html };
  }
  const si = raw.indexOf("\r\n\r\n");
  return { text: si >= 0 ? raw.substring(si + 4).trim() : "", html: "" };
}

class Imap {
  private c: Deno.TlsConn | null = null;
  private t = 0;
  private buf = "";
  private enc = new TextEncoder();
  private dec = new TextDecoder();

  async open(host: string, port: number) {
    this.c = await Deno.connectTls({ hostname: host, port });
    const g = await this.line();
    if (!g.includes("OK") && !g.startsWith("*")) throw new Error("Bad greeting: " + g);
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

  async searchSeq(): Promise<number[]> {
    const r = await this.cmd(`SEARCH ALL`);
    const m = r.match(/\*\s+SEARCH\s+([\d\s]+)/);
    return m ? m[1].trim().split(/\s+/).filter(Boolean).map(Number) : [];
  }

  async fetch(seq: number): Promise<string> {
    const tag = `A${++this.t}`;
    await this.wr(`${tag} FETCH ${seq} RFC822\r\n`);
    while (true) {
      const has = this.buf.includes(`\r\n${tag} OK`) || this.buf.includes(`\r\n${tag} NO`) || this.buf.includes(`\r\n${tag} BAD`);
      if (has) break;
      await this.rd();
    }
    const lm = this.buf.match(/\{(\d+)\}\r\n/);
    if (!lm) { this.buf = ""; return ""; }
    const sz = parseInt(lm[1]);
    const st = this.buf.indexOf(lm[0]) + lm[0].length;
    const msg = this.buf.substring(st, st + sz);
    const ti = this.buf.indexOf(`\r\n${tag} `, st + sz);
    this.buf = ti >= 0 ? this.buf.substring(this.buf.indexOf("\r\n", ti + 2) + 2) : "";
    return msg;
  }

  close() { try { this.c?.close(); } catch {} }
}

async function processEmailBatch(job: any, mailbox: any, sb: any): Promise<{ synced: number; skipped: number; errors: number; completed: boolean }> {
  const startTime = Date.now();
  const batchSize = Math.min(job.batch_size || 20, MAX_BATCH_SIZE);

  const { data: state } = await sb
    .from("sync_state")
    .select("*")
    .eq("mailbox_id", mailbox.id)
    .single();

  if (!state) throw new Error("Sync state not found");

  const imap = new Imap();
  let synced = 0, skipped = 0, errors = 0;
  let completed = false;

  try {
    await imap.open(mailbox.imap_host, mailbox.imap_port);
    await imap.login(mailbox.username, mailbox.encrypted_password);
    await imap.select("INBOX");

    const allSeqs = await imap.searchSeq();
    const sortedSeqs = [...allSeqs].sort((a, b) => b - a);

    const processedCount = job.progress?.processed || 0;
    const remainingSeqs = sortedSeqs.slice(processedCount, processedCount + batchSize);

    if (remainingSeqs.length === 0) {
      completed = true;
      imap.close();
      return { synced, skipped, errors, completed };
    }

    console.log(`[${mailbox.name}] Processing batch: ${remainingSeqs.length} emails (offset: ${processedCount})`);

    for (const seq of remainingSeqs) {
      if (Date.now() - startTime > EXECUTION_TIMEOUT) {
        console.log(`[${mailbox.name}] Timeout approaching, stopping batch`);
        break;
      }

      try {
        const raw = await imap.fetch(seq);
        if (!raw) {
          errors++;
          continue;
        }

        const hi = raw.indexOf("\r\n\r\n");
        const hdr = parseHeaders(hi >= 0 ? raw.substring(0, hi) : raw);
        const mid = (hdr["message-id"] || "").replace(/[<>]/g, "").trim() || `seq-${seq}-${mailbox.id}`;

        const subj = decHdr(hdr["subject"] || "");
        const from = parseAddr(decHdr(hdr["from"] || ""));
        const to = parseAddr(decHdr(hdr["to"] || ""));
        const cc = parseAddr(decHdr(hdr["cc"] || ""));
        const irt = (hdr["in-reply-to"] || "").replace(/[<>]/g, "").trim();
        const refs = (hdr["references"] || "").split(/\s+/).map(r => r.replace(/[<>]/g, "").trim()).filter(Boolean);
        const dt = hdr["date"] ? new Date(hdr["date"]) : new Date();
        const vd = isNaN(dt.getTime()) ? new Date() : dt;
        const { text, html } = extractBody(raw);

        let tid: string | null = null;
        if (irt) {
          const { data: p } = await sb.from("emails").select("ticket_id").eq("message_id", irt).limit(1).maybeSingle();
          if (p) tid = p.ticket_id;
        }
        if (!tid && refs.length) {
          for (const r of refs) {
            const { data: re } = await sb.from("emails").select("ticket_id").eq("message_id", r).limit(1).maybeSingle();
            if (re) { tid = re.ticket_id; break; }
          }
        }
        if (!tid && subj) {
          const cs = stripRe(subj);
          if (cs) {
            const { data: m } = await sb.from("tickets").select("id").eq("mailbox_id", mailbox.id).eq("subject", cs).order("created_at", { ascending: false }).limit(1).maybeSingle();
            if (m) tid = m.id;
          }
        }

        if (!tid) {
          const fa = from[0]?.address || "unknown@unknown.com";
          const out = fa.toLowerCase() === mailbox.email_address.toLowerCase();
          const { data: tk } = await sb.from("tickets").insert({
            mailbox_id: mailbox.id,
            subject: stripRe(subj) || "(Sans objet)",
            contact_email: out ? (to[0]?.address || fa) : fa,
            contact_name: out ? "" : (from[0]?.name || ""),
            status: null,
            priority: null,
            last_message_at: vd.toISOString(),
          }).select("id").single();
          if (tk) tid = tk.id;
        }
        if (!tid) continue;

        const dir = (from[0]?.address || "").toLowerCase() === mailbox.email_address.toLowerCase() ? "outbound" : "inbound";

        const { error: insertError } = await sb.from("emails").insert({
          ticket_id: tid,
          mailbox_id: mailbox.id,
          message_id: mid,
          in_reply_to: irt || null,
          references_header: refs.length ? refs.join(" ") : null,
          from_address: from[0]?.address || "",
          from_name: from[0]?.name || "",
          to_addresses: to.map(a => a.address).filter(Boolean),
          cc_addresses: cc.map(a => a.address).filter(Boolean),
          subject: subj,
          body_text: text || null,
          body_html: html || null,
          direction: dir,
          received_at: vd.toISOString(),
        });

        if (insertError) {
          if (insertError.code === '23505') {
            skipped++;
            continue;
          }
          throw insertError;
        }

        await sb.from("tickets").update({
          last_message_at: vd.toISOString(),
          updated_at: new Date().toISOString()
        }).eq("id", tid).lt("last_message_at", vd.toISOString());

        synced++;
      } catch (e) {
        errors++;
        console.error(`[${mailbox.name}] Error processing seq ${seq}:`, e);
      }
    }

    completed = (processedCount + remainingSeqs.length) >= sortedSeqs.length;
    imap.close();

  } catch (err) {
    imap.close();
    throw err;
  }

  return { synced, skipped, errors, completed };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: cors });
  }

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const { job_id } = body;

    if (!job_id) {
      return new Response(
        JSON.stringify({ error: "job_id is required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const { data: job, error: jobError } = await sb
      .from("sync_jobs")
      .select("*")
      .eq("id", job_id)
      .maybeSingle();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: "Job not found" }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    if (job.status !== "pending" && job.status !== "processing") {
      return new Response(
        JSON.stringify({ error: "Job is not in processable state", status: job.status }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    await sb.from("sync_jobs").update({
      status: "processing",
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", job_id);

    await sb.from("sync_state").update({
      is_syncing: true,
      updated_at: new Date().toISOString(),
    }).eq("mailbox_id", job.mailbox_id);

    const { data: mailbox, error: mbError } = await sb
      .from("mailboxes")
      .select("*")
      .eq("id", job.mailbox_id)
      .maybeSingle();

    if (mbError || !mailbox) {
      await sb.from("sync_jobs").update({
        status: "failed",
        error_message: "Mailbox not found",
        completed_at: new Date().toISOString(),
      }).eq("id", job_id);

      await sb.from("sync_state").update({ is_syncing: false }).eq("mailbox_id", job.mailbox_id);

      return new Response(
        JSON.stringify({ error: "Mailbox not found" }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    if (!mailbox.encrypted_password || mailbox.encrypted_password === "encrypted_placeholder") {
      await sb.from("sync_jobs").update({
        status: "failed",
        error_message: "No password configured",
        completed_at: new Date().toISOString(),
      }).eq("id", job_id);

      await sb.from("sync_state").update({ is_syncing: false }).eq("mailbox_id", job.mailbox_id);

      return new Response(
        JSON.stringify({ error: "No password configured for mailbox" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const result = await processEmailBatch(job, mailbox, sb);

    const currentProgress = job.progress || { processed: 0, total: 0, synced: 0, skipped: 0, errors: 0 };
    const newProgress = {
      processed: currentProgress.processed + result.synced + result.skipped + result.errors,
      total: currentProgress.total,
      synced: currentProgress.synced + result.synced,
      skipped: currentProgress.skipped + result.skipped,
      errors: currentProgress.errors + result.errors,
    };

    if (result.completed) {
      await sb.from("sync_jobs").update({
        status: "completed",
        progress: newProgress,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", job_id);

      await sb.from("sync_state").update({
        is_syncing: false,
        last_synced_at: new Date().toISOString(),
        total_emails_synced: newProgress.synced,
        updated_at: new Date().toISOString(),
      }).eq("mailbox_id", job.mailbox_id);

      console.log(`[${mailbox.name}] Job completed: ${newProgress.synced} synced, ${newProgress.skipped} skipped, ${newProgress.errors} errors`);
    } else {
      await sb.from("sync_jobs").update({
        status: "pending",
        progress: newProgress,
        updated_at: new Date().toISOString(),
      }).eq("id", job_id);

      await sb.from("sync_state").update({
        is_syncing: false,
        updated_at: new Date().toISOString(),
      }).eq("mailbox_id", job.mailbox_id);

      console.log(`[${mailbox.name}] Batch processed: ${result.synced} synced, more remaining`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        job_id: job_id,
        completed: result.completed,
        progress: newProgress,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("Error processing sync job:", err);

    const body = await req.json().catch(() => ({}));
    const { job_id } = body;

    if (job_id) {
      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { data: job } = await sb.from("sync_jobs").select("*").eq("id", job_id).maybeSingle();

      if (job) {
        const retryCount = (job.retry_count || 0) + 1;
        const maxRetries = job.max_retries || 3;

        if (retryCount < maxRetries) {
          await sb.from("sync_jobs").update({
            status: "pending",
            retry_count: retryCount,
            error_message: err.message,
            updated_at: new Date().toISOString(),
          }).eq("id", job_id);
        } else {
          await sb.from("sync_jobs").update({
            status: "failed",
            retry_count: retryCount,
            error_message: err.message,
            completed_at: new Date().toISOString(),
          }).eq("id", job_id);
        }

        await sb.from("sync_state").update({
          is_syncing: false,
          last_error: err.message,
        }).eq("mailbox_id", job.mailbox_id);
      }
    }

    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
