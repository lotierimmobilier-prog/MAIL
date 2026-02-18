import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "sync_recent";

    if (mode === "upsert_single") {
      const { email, from_name, direction } = body;
      if (!email) {
        return new Response(
          JSON.stringify({ error: "email required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await upsertContact(supabase, email, from_name || "", direction || "inbound");
      return new Response(
        JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: recentEmails } = await supabase
      .from("emails")
      .select("from_address, from_name, to_addresses, direction, received_at")
      .order("received_at", { ascending: false })
      .limit(500);

    if (!recentEmails || recentEmails.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const addressMap = new Map<string, { name: string; count: number; lastSeen: string }>();

    for (const email of recentEmails) {
      const addr = email.from_address?.toLowerCase().trim();
      if (addr && addr.includes("@")) {
        const existing = addressMap.get(addr);
        if (existing) {
          existing.count++;
          if (email.from_name && email.from_name.trim() && !existing.name) {
            existing.name = email.from_name.trim();
          }
          if (email.received_at > existing.lastSeen) {
            existing.lastSeen = email.received_at;
          }
        } else {
          addressMap.set(addr, {
            name: email.from_name?.trim() || "",
            count: 1,
            lastSeen: email.received_at,
          });
        }
      }

      if (email.to_addresses && Array.isArray(email.to_addresses)) {
        for (const toAddr of email.to_addresses) {
          const ta = toAddr?.toLowerCase().trim();
          if (ta && ta.includes("@")) {
            const existing = addressMap.get(ta);
            if (existing) {
              existing.count++;
              if (email.received_at > existing.lastSeen) {
                existing.lastSeen = email.received_at;
              }
            } else {
              addressMap.set(ta, { name: "", count: 1, lastSeen: email.received_at });
            }
          }
        }
      }
    }

    const { data: mailboxes } = await supabase
      .from("mailboxes")
      .select("email_address")
      .eq("is_active", true);

    const mailboxEmails = new Set((mailboxes || []).map(m => m.email_address.toLowerCase()));

    let upserted = 0;
    const batchSize = 50;
    const entries = Array.from(addressMap.entries())
      .filter(([addr]) => !mailboxEmails.has(addr));

    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize).map(([addr, info]) => {
        const { firstName, lastName } = splitName(info.name);
        return {
          email: addr,
          first_name: firstName,
          last_name: lastName,
          source: "auto_sync",
          email_count: info.count,
          last_contacted_at: info.lastSeen,
        };
      });

      const { data } = await supabase
        .from("contacts")
        .upsert(batch, { onConflict: "email", ignoreDuplicates: false })
        .select("id");

      upserted += data?.length || 0;
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    let aiEnriched = 0;

    if (openaiKey) {
      const { data: unnamed } = await supabase
        .from("contacts")
        .select("id, email, first_name, last_name")
        .eq("first_name", "")
        .eq("last_name", "")
        .order("email_count", { ascending: false })
        .limit(20);

      if (unnamed && unnamed.length > 0) {
        const emailList = unnamed.map(c => c.email).join("\n");

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "Tu recois une liste d'adresses email. Pour chaque adresse, essaye de deviner le prenom et le nom a partir de l'adresse email elle-meme (ex: jean.dupont@... -> Jean Dupont, j.martin@... -> J. Martin). Retourne un JSON array avec les objets {email, first_name, last_name}. Si tu ne peux pas deviner, laisse les champs vides. Retourne UNIQUEMENT du JSON valide.",
              },
              { role: "user", content: emailList },
            ],
            temperature: 0.2,
            max_tokens: 2000,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content ?? "[]";
          const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

          try {
            const results = JSON.parse(cleaned);
            for (const r of results) {
              if (r.email && (r.first_name || r.last_name)) {
                await supabase
                  .from("contacts")
                  .update({
                    first_name: r.first_name || "",
                    last_name: r.last_name || "",
                    source: "ai_extracted",
                    updated_at: new Date().toISOString(),
                  })
                  .eq("email", r.email.toLowerCase())
                  .eq("first_name", "")
                  .eq("last_name", "");
                aiEnriched++;
              }
            }
          } catch {
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ upserted, ai_enriched: aiEnriched }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function splitName(fullName: string): { firstName: string; lastName: string } {
  if (!fullName) return { firstName: "", lastName: "" };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
  }
  return { firstName: parts[0] || "", lastName: "" };
}

async function upsertContact(
  supabase: any,
  email: string,
  fromName: string,
  direction: string
) {
  const addr = email.toLowerCase().trim();
  const { firstName, lastName } = splitName(fromName);

  const { data: existing } = await supabase
    .from("contacts")
    .select("id, email_count, first_name, last_name")
    .eq("email", addr)
    .maybeSingle();

  if (existing) {
    const updates: any = {
      email_count: (existing.email_count || 0) + 1,
      last_contacted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if ((!existing.first_name && firstName) || (!existing.last_name && lastName)) {
      if (firstName) updates.first_name = firstName;
      if (lastName) updates.last_name = lastName;
    }
    await supabase.from("contacts").update(updates).eq("id", existing.id);
    return { action: "updated", id: existing.id };
  }

  const { data: inserted } = await supabase
    .from("contacts")
    .insert({
      email: addr,
      first_name: firstName,
      last_name: lastName,
      source: "auto_sync",
      email_count: 1,
      last_contacted_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  return { action: "created", id: inserted?.id };
}
