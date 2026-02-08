import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const WORKER_TIMEOUT = 50000;
const MAX_JOBS_PER_RUN = 5;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: cors });
  }

  const startTime = Date.now();

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log("Job worker started");

    await sb.rpc("reset_stale_sync_jobs");
    console.log("Reset stale jobs");

    const processedJobs: any[] = [];
    let jobsProcessed = 0;

    while (jobsProcessed < MAX_JOBS_PER_RUN && (Date.now() - startTime) < WORKER_TIMEOUT) {
      const { data: pendingJobs, error: jobsError } = await sb
        .from("sync_jobs")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(1);

      if (jobsError) {
        console.error("Error fetching pending jobs:", jobsError);
        break;
      }

      if (!pendingJobs || pendingJobs.length === 0) {
        console.log("No more pending jobs");
        break;
      }

      const job = pendingJobs[0];
      console.log(`Processing job ${job.id} for mailbox ${job.mailbox_id}`);

      try {
        const processSyncUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-sync-job`;
        const response = await fetch(processSyncUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ job_id: job.id }),
        });

        const result = await response.json();

        if (!response.ok) {
          console.error(`Job ${job.id} failed:`, result.error);
          processedJobs.push({
            job_id: job.id,
            status: "failed",
            error: result.error,
          });
        } else {
          console.log(`Job ${job.id} processed successfully. Completed: ${result.completed}`);
          processedJobs.push({
            job_id: job.id,
            status: result.completed ? "completed" : "pending",
            progress: result.progress,
          });
        }

        jobsProcessed++;

        if (!result.completed) {
          console.log(`Job ${job.id} has more work remaining, will be picked up in next run`);
        }

      } catch (err: any) {
        console.error(`Error processing job ${job.id}:`, err);
        processedJobs.push({
          job_id: job.id,
          status: "error",
          error: err.message,
        });
        jobsProcessed++;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const timeElapsed = Date.now() - startTime;
    console.log(`Job worker finished. Processed ${jobsProcessed} jobs in ${timeElapsed}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        jobs_processed: jobsProcessed,
        time_elapsed_ms: timeElapsed,
        jobs: processedJobs,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("Job worker error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
