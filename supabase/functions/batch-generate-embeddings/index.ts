import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  limit?: number;
  offset?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { limit = 50, offset = 0 }: RequestBody = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: emailsWithoutEmbeddings, error: fetchError } = await supabaseAdmin
      .from("emails")
      .select("id")
      .not("id", "in",
        supabaseAdmin
          .from("email_embeddings")
          .select("email_id")
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (fetchError) {
      console.error("Error fetching emails:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch emails" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const emailIds = emailsWithoutEmbeddings?.map(e => e.id) || [];

    if (emailIds.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No emails to process",
          processed: 0,
          errors: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const results = {
      processed: 0,
      errors: 0,
      errorDetails: [] as string[],
    };

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    for (const emailId of emailIds) {
      try {
        const response = await fetch(
          `${supabaseUrl}/functions/v1/generate-email-embedding`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${anonKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email_id: emailId }),
          }
        );

        if (response.ok) {
          results.processed++;
        } else {
          results.errors++;
          const errorText = await response.text();
          results.errorDetails.push(`Email ${emailId}: ${errorText}`);
        }
      } catch (error) {
        results.errors++;
        results.errorDetails.push(`Email ${emailId}: ${error.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_emails: emailIds.length,
        processed: results.processed,
        errors: results.errors,
        error_details: results.errorDetails.slice(0, 5),
        message: `Processed ${results.processed}/${emailIds.length} emails successfully`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error in batch-generate-embeddings:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
