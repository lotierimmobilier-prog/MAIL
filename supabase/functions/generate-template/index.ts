import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();

    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) {
      const fallback = {
        name: "Generated Template",
        description: `Template based on: ${prompt}`,
        subject: "Regarding {{subject}}",
        body: `Dear {{client_name}},

Thank you for contacting us regarding {{subject}}.

We would like to inform you that {{details}}.

If you have any questions, please do not hesitate to contact us.

Best regards,
{{signature}}`,
      };

      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiPrompt = `Based on the following description, generate a professional email template.

Description: ${prompt}

Return a JSON object with:
- name (string): short template name
- description (string): brief description
- subject (string): email subject line with {{variables}} for dynamic content
- body (string): email body with {{variables}} for dynamic content like {{client_name}}, {{date}}, {{address}}, {{lot}}, {{signature}}

Use {{variable_name}} syntax for all dynamic parts. Return ONLY valid JSON.`;

    const openaiRes = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are a professional email template generator. Always return valid JSON.",
            },
            { role: "user", content: aiPrompt },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      }
    );

    const openaiData = await openaiRes.json();
    const content = openaiData.choices?.[0]?.message?.content ?? "{}";
    const template = JSON.parse(content);

    return new Response(JSON.stringify(template), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
