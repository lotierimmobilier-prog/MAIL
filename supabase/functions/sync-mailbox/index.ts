import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const OVH_ENDPOINTS: Record<string, string> = {
  "ovh-eu": "https://eu.api.ovh.com/1.0",
  "ovh-ca": "https://ca.api.ovh.com/1.0",
  "ovh-us": "https://api.us.ovhcloud.com/1.0",
};

async function ovhRequest(method: string, path: string, body: any = null) {
  const appKey = Deno.env.get("OVH_APP_KEY");
  const appSecret = Deno.env.get("OVH_APP_SECRET");
  const endpoint = Deno.env.get("OVH_ENDPOINT") || "ovh-eu";
  const baseUrl = OVH_ENDPOINTS[endpoint];

  if (!appKey || !appSecret) throw new Error("OVH credentials not configured");

  const url = `${baseUrl}${path}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const bodyStr = body ? JSON.stringify(body) : "";

  const signature = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(`${appSecret}+${appKey}+${method}+${url}+${bodyStr}+${timestamp}`)
  );
  const sigHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Ovh-Application": appKey,
    "X-Ovh-Timestamp": timestamp.toString(),
    "X-Ovh-Signature": `$1$${sigHex}`,
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? bodyStr : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OVH API error: ${error}`);
  }

  return response.json();
}

async function ovhRequestWithConsumer(method: string, path: string, consumerKey: string, body: any = null) {
  const appKey = Deno.env.get("OVH_APP_KEY");
  const appSecret = Deno.env.get("OVH_APP_SECRET");
  const endpoint = Deno.env.get("OVH_ENDPOINT") || "ovh-eu";
  const baseUrl = OVH_ENDPOINTS[endpoint];

  if (!appKey || !appSecret) throw new Error("OVH credentials not configured");

  const url = `${baseUrl}${path}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const bodyStr = body ? JSON.stringify(body) : "";

  const signature = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(`${appSecret}+${consumerKey}+${method}+${url}+${bodyStr}+${timestamp}`)
  );
  const sigHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Ovh-Application": appKey,
    "X-Ovh-Consumer": consumerKey,
    "X-Ovh-Timestamp": timestamp.toString(),
    "X-Ovh-Signature": `$1$${sigHex}`,
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? bodyStr : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OVH API error: ${error}`);
  }

  return response.json();
}

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

async function syncOvhMailbox(mb: any, sb: any) {
  let consumerKey = mb.ovh_consumer_key;

  if (mb.ovh_consumer_key_secure) {
    consumerKey = await decryptCredential(mb.ovh_consumer_key_secure, mb.id);
  }

  if (!consumerKey || !mb.ovh_domain || !mb.ovh_account) {
    return { mailbox: mb.name, status: "skipped", reason: "Missing OVH configuration" };
  }

  try {
    const emailIds = await ovhRequestWithConsumer(
      "GET",
      `/email/domain/${mb.ovh_domain}/account/${mb.ovh_account}/email`,
      consumerKey
    );

    let synced = 0;
    const total = Array.isArray(emailIds) ? emailIds.length : 0;

    for (const emailId of (Array.isArray(emailIds) ? emailIds : [])) {
      try {
        const emailData = await ovhRequestWithConsumer(
          "GET",
          `/email/domain/${mb.ovh_domain}/account/${mb.ovh_account}/email/${emailId}`,
          consumerKey
        );

        const mid = emailData.id || `ovh-${emailId}-${mb.id}`;
        const { data: ex } = await sb.from("emails").select("id").eq("message_id", mid).maybeSingle();
        if (ex) continue;

        const subj = emailData.subject || "(Sans objet)";
        const fromAddr = emailData.from || "unknown@unknown.com";
        const toAddr = emailData.to || mb.email_address;
        const dt = emailData.date ? new Date(emailData.date) : new Date();
        const vd = isNaN(dt.getTime()) ? new Date() : dt;

        let tid: string | null = null;
        const cs = stripRe(subj);
        if (cs) {
          const { data: m } = await sb.from("tickets").select("id")
            .eq("mailbox_id", mb.id)
            .eq("subject", cs)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (m) tid = m.id;
        }

        if (!tid) {
          const out = fromAddr.toLowerCase() === mb.email_address.toLowerCase();
          const { data: tk } = await sb.from("tickets").insert({
            mailbox_id: mb.id,
            subject: cs || "(Sans objet)",
            contact_email: out ? toAddr : fromAddr,
            contact_name: "",
            status: null,
            priority: null,
            last_message_at: vd.toISOString(),
          }).select("id").single();
          if (tk) tid = tk.id;
        }
        if (!tid) continue;

        const dir = fromAddr.toLowerCase() === mb.email_address.toLowerCase() ? "outbound" : "inbound";
        await sb.from("emails").insert({
          ticket_id: tid,
          mailbox_id: mb.id,
          message_id: mid,
          from_address: fromAddr,
          from_name: emailData.fromName || "",
          to_addresses: [toAddr],
          subject: subj,
          body_text: emailData.body || null,
          body_html: emailData.bodyHtml || null,
          direction: dir,
          received_at: vd.toISOString(),
        });

        await sb.from("tickets").update({
          last_message_at: vd.toISOString(),
          updated_at: new Date().toISOString()
        }).eq("id", tid).lt("last_message_at", vd.toISOString());

        synced++;
      } catch {
        continue;
      }
    }

    return { mailbox: mb.name, status: "ok", synced, total };
  } catch (err: any) {
    return { mailbox: mb.name, status: "error", error: err.message };
  }
}

function imapDate(d: Date): string {
  const m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d.getDate()}-${m[d.getMonth()]}-${d.getFullYear()}`;
}

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

interface ParsedAttachment {
  filename: string;
  content_type: string;
  size_bytes: number;
  data: Uint8Array;
}

function extractBodyAndAttachments(raw: string, depth = 0): { text: string; html: string; attachments: ParsedAttachment[] } {
  if (depth > 10) return { text: "", html: "", attachments: [] };
  const bm = raw.match(/content-type:\s*multipart\/[^;]*;\s*boundary="?([^\s";]+)"?/i);
  if (bm) {
    let text = "", html = "";
    const attachments: ParsedAttachment[] = [];
    const parts = raw.split("--" + bm[1]);
    for (const part of parts) {
      const si = part.indexOf("\r\n\r\n");
      if (si === -1) continue;
      const ph = part.substring(0, si).toLowerCase();
      let pb = part.substring(si + 4);

      if (ph.match(/multipart\//i)) {
        const n = extractBodyAndAttachments(part, depth + 1);
        if (n.text) text = text || n.text;
        if (n.html) html = html || n.html;
        attachments.push(...n.attachments);
        continue;
      }

      const cd = ph.match(/content-disposition:\s*attachment[^;]*(?:;\s*filename="?([^";\r\n]+)"?)?/i);
      const fn = ph.match(/name="?([^";\r\n]+)"?/i);
      const ct = ph.match(/content-type:\s*([^;\r\n]+)/i);

      if (cd || (fn && !ph.includes("text/html") && !ph.includes("text/plain"))) {
        const filename = (cd && cd[1]) || (fn && fn[1]) || "attachment";
        const contentType = (ct && ct[1].trim()) || "application/octet-stream";

        const te = ph.match(/content-transfer-encoding:\s*(\S+)/);
        let data: Uint8Array;

        try {
          if (te && te[1] === "base64") {
            const b64 = pb.replace(/\s/g, "");
            data = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
          } else if (te && te[1] === "quoted-printable") {
            const decoded = pb.replace(/=\r\n/g, "").replace(/=([0-9A-Fa-f]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
            data = new TextEncoder().encode(decoded);
          } else {
            data = new TextEncoder().encode(pb);
          }

          attachments.push({
            filename: decHdr(filename).trim(),
            content_type: contentType,
            size_bytes: data.length,
            data
          });
        } catch (e) {
          console.error('Error parsing attachment:', e);
        }
        continue;
      }

      const te = ph.match(/content-transfer-encoding:\s*(\S+)/);
      if (te) {
        if (te[1] === "base64") { try { pb = new TextDecoder().decode(Uint8Array.from(atob(pb.replace(/\s/g, "")), c => c.charCodeAt(0))); } catch {} }
        else if (te[1] === "quoted-printable") { pb = pb.replace(/=\r\n/g, "").replace(/=([0-9A-Fa-f]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16))); }
      }
      if (ph.includes("text/html") && !html) html = pb.trim();
      else if (ph.includes("text/plain") && !text) text = pb.trim();
    }
    return { text, html, attachments };
  }
  const si = raw.indexOf("\r\n\r\n");
  return { text: si >= 0 ? raw.substring(si + 4).trim() : "", html: "", attachments: [] };
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

  async search(since?: Date): Promise<number[]> {
    const searchCmd = since ? `UID SEARCH SINCE ${imapDate(since)}` : `UID SEARCH ALL`;
    const r = await this.cmd(searchCmd);
    const m = r.match(/\*\s+SEARCH\s+([\d\s]+)/);
    return m ? m[1].trim().split(/\s+/).filter(Boolean).map(Number) : [];
  }

  async searchSeq(since?: Date): Promise<number[]> {
    const searchCmd = since ? `SEARCH SINCE ${imapDate(since)}` : `SEARCH ALL`;
    const r = await this.cmd(searchCmd);
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const maxEmailsPerMailbox = 100;
    let q = sb.from("mailboxes").select("*").eq("is_active", true);
    if (body.mailbox_id) q = q.eq("id", body.mailbox_id);
    const { data: mbs, error: e } = await q;
    if (e) throw new Error(e.message);
    if (!mbs?.length) return new Response(JSON.stringify({ error: "No mailboxes" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });

    console.log(`Starting sync - searching all emails, keeping ${maxEmailsPerMailbox} most recent per mailbox`);

    const archiveDate = new Date();
    archiveDate.setDate(archiveDate.getDate() - 30);
    await sb.from("tickets").update({
      archived: true,
      archived_at: new Date().toISOString()
    }).lt("created_at", archiveDate.toISOString()).eq("archived", false);

    const results: any[] = [];

    for (const mb of mbs) {
      const { count: emailCount } = await sb
        .from("emails")
        .select("*", { count: "exact", head: true })
        .eq("mailbox_id", mb.id);

      console.log(`[${mb.name}] Current email count: ${emailCount || 0}`);

      if (emailCount && emailCount > maxEmailsPerMailbox) {
        const toArchive = emailCount - maxEmailsPerMailbox;
        console.log(`[${mb.name}] Archiving ${toArchive} oldest emails`);

        const { data: oldEmails } = await sb
          .from("emails")
          .select("ticket_id")
          .eq("mailbox_id", mb.id)
          .order("received_at", { ascending: true })
          .limit(toArchive);

        if (oldEmails && oldEmails.length > 0) {
          const ticketIds = [...new Set(oldEmails.map(e => e.ticket_id).filter(Boolean))];

          if (ticketIds.length > 0) {
            await sb
              .from("tickets")
              .update({
                archived: true,
                archived_at: new Date().toISOString()
              })
              .in("id", ticketIds);
          }
        }
      }

      if (mb.provider_type === "ovh") {
        const result = await syncOvhMailbox(mb, sb);
        results.push(result);
        continue;
      }

      let password = mb.encrypted_password;

      if (mb.encrypted_password_secure) {
        try {
          password = await decryptCredential(mb.encrypted_password_secure, mb.id);
        } catch (err) {
          console.error(`Failed to decrypt password for mailbox ${mb.id}:`, err);
          results.push({ mailbox: mb.name, status: "error", error: "Failed to decrypt password" });
          continue;
        }
      }

      if (!password || password === "encrypted_placeholder") {
        results.push({ mailbox: mb.name, status: "skipped", reason: "No password" });
        continue;
      }

      const imap = new Imap();
      try {
        await imap.open(mb.imap_host, mb.imap_port);
        await imap.login(mb.username, password);
        const tot = await imap.select("INBOX");

        const allSeqs = await imap.searchSeq();
        let synced = 0;
        let skipped = 0;
        let errors = 0;

        const sortedSeqs = [...allSeqs].sort((a, b) => b - a).slice(0, maxEmailsPerMailbox);
        console.log(`[${mb.name}] Total emails on server: ${tot}, processing ${sortedSeqs.length} most recent emails`);

        for (const seq of sortedSeqs) {
          try {
            const raw = await imap.fetch(seq);
            if (!raw) {
              errors++;
              continue;
            }
            const hi = raw.indexOf("\r\n\r\n");
            const hdr = parseHeaders(hi >= 0 ? raw.substring(0, hi) : raw);
            const mid = (hdr["message-id"] || "").replace(/[<>]/g, "").trim() || `seq-${seq}-${mb.id}`;

            const { data: ex } = await sb.from("emails").select("id").eq("message_id", mid).maybeSingle();
            if (ex) {
              skipped++;
              continue;
            }

            const subj = decHdr(hdr["subject"] || "");
            const from = parseAddr(decHdr(hdr["from"] || ""));
            const to = parseAddr(decHdr(hdr["to"] || ""));
            const cc = parseAddr(decHdr(hdr["cc"] || ""));
            const irt = (hdr["in-reply-to"] || "").replace(/[<>]/g, "").trim();
            const refs = (hdr["references"] || "").split(/\s+/).map(r => r.replace(/[<>]/g, "").trim()).filter(Boolean);
            const dt = hdr["date"] ? new Date(hdr["date"]) : new Date();
            const vd = isNaN(dt.getTime()) ? new Date() : dt;
            const { text, html, attachments: parsedAttachments } = extractBodyAndAttachments(raw);

            let tid: string | null = null;
            if (irt) { const { data: p } = await sb.from("emails").select("ticket_id").eq("message_id", irt).maybeSingle(); if (p) tid = p.ticket_id; }
            if (!tid && refs.length) { for (const r of refs) { const { data: re } = await sb.from("emails").select("ticket_id").eq("message_id", r).maybeSingle(); if (re) { tid = re.ticket_id; break; } } }
            if (!tid && subj) { const cs = stripRe(subj); if (cs) { const { data: m } = await sb.from("tickets").select("id").eq("mailbox_id", mb.id).eq("subject", cs).order("created_at", { ascending: false }).limit(1).maybeSingle(); if (m) tid = m.id; } }

            if (!tid) {
              const fa = from[0]?.address || "unknown@unknown.com";
              const out = fa.toLowerCase() === mb.email_address.toLowerCase();
              const { data: tk } = await sb.from("tickets").insert({
                mailbox_id: mb.id,
                subject: stripRe(subj) || "(Sans objet)",
                contact_email: out ? (to[0]?.address || fa) : fa,
                contact_name: out ? "" : (from[0]?.name || ""),
                status: null, priority: null,
                last_message_at: vd.toISOString(),
              }).select("id").single();
              if (tk) tid = tk.id;
            }
            if (!tid) continue;

            const dir = (from[0]?.address || "").toLowerCase() === mb.email_address.toLowerCase() ? "outbound" : "inbound";
            const { data: insertedEmail } = await sb.from("emails").insert({
              ticket_id: tid, mailbox_id: mb.id, message_id: mid,
              in_reply_to: irt || null, references_header: refs.length ? refs.join(" ") : null,
              from_address: from[0]?.address || "", from_name: from[0]?.name || "",
              to_addresses: to.map(a => a.address).filter(Boolean),
              cc_addresses: cc.map(a => a.address).filter(Boolean),
              subject: subj, body_text: text || null, body_html: html || null,
              direction: dir, received_at: vd.toISOString(),
            }).select("id").single();

            if (insertedEmail && parsedAttachments.length > 0) {
              for (const att of parsedAttachments) {
                try {
                  const storagePath = `${mb.id}/${insertedEmail.id}/${crypto.randomUUID()}-${att.filename}`;

                  const { error: uploadError } = await sb.storage
                    .from('attachments')
                    .upload(storagePath, att.data, {
                      contentType: att.content_type,
                      upsert: false
                    });

                  if (uploadError) {
                    console.error(`Failed to upload attachment ${att.filename}:`, uploadError);
                    continue;
                  }

                  await sb.from("attachments").insert({
                    email_id: insertedEmail.id,
                    filename: att.filename,
                    content_type: att.content_type,
                    size_bytes: att.size_bytes,
                    storage_path: storagePath
                  });
                } catch (attError) {
                  console.error(`Error processing attachment ${att.filename}:`, attError);
                }
              }
            }

            await sb.from("tickets").update({ last_message_at: vd.toISOString(), updated_at: new Date().toISOString() }).eq("id", tid).lt("last_message_at", vd.toISOString());
            synced++;
          } catch (e) {
            errors++;
            console.error(`[${mb.name}] Error processing seq ${seq}:`, e);
            continue;
          }
        }
        imap.close();
        console.log(`[${mb.name}] Sync complete: ${synced} synced, ${skipped} skipped, ${errors} errors`);
        results.push({ mailbox: mb.name, status: "ok", synced, skipped, errors, total: tot });
      } catch (err: any) {
        imap.close();
        console.error(`[${mb.name}] Mailbox sync error:`, err);
        results.push({ mailbox: mb.name, status: "error", error: err.message });
      }
    }

    return new Response(JSON.stringify({ results }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
