import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
    const { mailbox_id, batch_size = 20, job_type = "incremental_sync" } = body;

    let mailboxes: any[] = [];

    if (mailbox_id) {
      const { data, error } = await sb
        .from("mailboxes")
        .select("*")
        .eq("id", mailbox_id)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) {
        return new Response(
          JSON.stringify({ error: "Mailbox not found or inactive" }),
          { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }
      mailboxes = [data];
    } else {
      const { data, error } = await sb
        .from("mailboxes")
        .select("*")
        .eq("is_active", true);

      if (error) throw new Error(error.message);
      mailboxes = data || [];
    }

    if (mailboxes.length === 0) {
      return new Response(
        JSON.stringify({ error: "No active mailboxes found" }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const createdJobs: any[] = [];

    for (const mb of mailboxes) {
      const { data: state } = await sb
        .from("sync_state")
        .select("*")
        .eq("mailbox_id", mb.id)
        .maybeSingle();

      if (state?.is_syncing) {
        console.log(`[${mb.name}] Already syncing, skipping job creation`);
        continue;
      }

      const { data: existingJob } = await sb
        .from("sync_jobs")
        .select("id, status")
        .eq("mailbox_id", mb.id)
        .in("status", ["pending", "processing"])
        .maybeSingle();

      if (existingJob) {
        console.log(`[${mb.name}] Job already exists: ${existingJob.status}`);
        createdJobs.push(existingJob);
        continue;
      }

      if (!state) {
        await sb.from("sync_state").insert({
          mailbox_id: mb.id,
          last_sequence_number: 0,
          last_uid: 0,
          total_emails_synced: 0,
          is_syncing: false,
        });
      }

      const { data: job, error: jobError } = await sb
        .from("sync_jobs")
        .insert({
          mailbox_id: mb.id,
          status: "pending",
          job_type,
          batch_size,
          progress: {
            processed: 0,
            total: 0,
            synced: 0,
            skipped: 0,
            errors: 0,
          },
        })
        .select()
        .single();

      if (jobError) {
        console.error(`[${mb.name}] Failed to create job:`, jobError);
        continue;
      }

      createdJobs.push(job);
      console.log(`[${mb.name}] Created sync job: ${job.id}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        jobs: createdJobs,
        message: `Created ${createdJobs.length} sync job(s)`,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Error creating sync jobs:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      }
    );
  }
});
