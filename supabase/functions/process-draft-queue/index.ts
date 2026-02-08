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

    const { data: pendingItems } = await supabase
      .from("draft_generation_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(5);

    if (!pendingItems || pendingItems.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: "No pending items" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (const item of pendingItems) {
      await supabase
        .from("draft_generation_queue")
        .update({ status: "processing" })
        .eq("id", item.id);

      try {
        const generateRes = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/auto-generate-draft`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ticket_id: item.ticket_id }),
          }
        );

        if (!generateRes.ok) {
          throw new Error(`Generation failed: ${generateRes.status}`);
        }

        const result = await generateRes.json();

        await supabase
          .from("draft_generation_queue")
          .update({
            status: "completed",
            processed_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        results.push({
          ticket_id: item.ticket_id,
          status: "success",
          result: result,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        await supabase
          .from("draft_generation_queue")
          .update({
            status: "failed",
            error_message: errorMessage,
            processed_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        results.push({
          ticket_id: item.ticket_id,
          status: "failed",
          error: errorMessage,
        });
      }
    }

    return new Response(
      JSON.stringify({
        processed: results.length,
        results: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in process-draft-queue:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
