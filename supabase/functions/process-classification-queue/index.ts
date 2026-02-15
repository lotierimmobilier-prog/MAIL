import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

    const { data: queueItems } = await supabase
      .from("classification_queue")
      .select(`
        id,
        email_id,
        ticket_id,
        retry_count,
        max_retries,
        emails!inner (
          subject,
          body_text,
          body_html,
          from_address,
          from_name
        )
      `)
      .eq("status", "pending")
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(10);

    if (!queueItems || queueItems.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: "No items in queue" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];
    const classifyUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/classify-email`;

    for (const item of queueItems) {
      await supabase
        .from("classification_queue")
        .update({ status: "processing", started_at: new Date().toISOString() })
        .eq("id", item.id);

      try {
        const email = Array.isArray(item.emails) ? item.emails[0] : item.emails;

        const response = await fetch(classifyUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email_id: item.email_id,
            ticket_id: item.ticket_id,
            subject: email?.subject || "",
            body: email?.body_text || email?.body_html || "",
            from_address: email?.from_address || "",
            from_name: email?.from_name || "",
          }),
        });

        if (response.ok) {
          await supabase
            .from("classification_queue")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
            })
            .eq("id", item.id);

          results.push({ id: item.id, status: "success" });
        } else {
          const errorText = await response.text();
          throw new Error(`Classification failed: ${errorText}`);
        }
      } catch (error) {
        const errorMessage = (error as Error).message;
        const newRetryCount = item.retry_count + 1;

        if (newRetryCount >= item.max_retries) {
          await supabase
            .from("classification_queue")
            .update({
              status: "failed",
              error_message: errorMessage,
              completed_at: new Date().toISOString(),
              retry_count: newRetryCount,
            })
            .eq("id", item.id);

          results.push({ id: item.id, status: "failed", error: errorMessage });
        } else {
          await supabase
            .from("classification_queue")
            .update({
              status: "pending",
              error_message: errorMessage,
              retry_count: newRetryCount,
            })
            .eq("id", item.id);

          results.push({ id: item.id, status: "retry", retry_count: newRetryCount });
        }
      }
    }

    return new Response(
      JSON.stringify({
        processed: queueItems.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
