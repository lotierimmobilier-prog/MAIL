import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

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
    const { email_id, ticket_id, subject, body, from_address, from_name } =
      await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: categories } = await supabase
      .from("categories")
      .select("id, name, keywords, description")
      .order("name");

    const searchText = `${subject || ""} ${body || ""}`.toLowerCase();
    let matchedCategory: any = null;
    let maxMatches = 0;

    if (categories && categories.length > 0) {
      for (const cat of categories) {
        if (cat.keywords && cat.keywords.length > 0) {
          const matches = cat.keywords.filter((kw: string) =>
            searchText.includes(kw.toLowerCase())
          ).length;

          if (matches > maxMatches) {
            maxMatches = matches;
            matchedCategory = cat;
          }
        }
      }
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) {
      const fallbackCategoryName = matchedCategory?.name || "Demande generale";
      const fallback = {
        category: fallbackCategoryName,
        subcategory: "Demande d'information",
        priority: "medium",
        intent: "demande_information",
        sentiment: "neutral",
        entities: {
          name: from_name || "",
          email: from_address || "",
        },
        recommended_actions: [
          "Examiner le contenu de l'email",
          "Assigner au membre de l'equipe concerne",
          "Envoyer un accuse de reception",
        ],
        suggested_assignee: null,
        confidence: matchedCategory ? 0.7 : 0.3,
      };

      await supabase.from("ai_classifications").insert({
        email_id,
        ticket_id,
        ...fallback,
        raw_response: { source: "keyword_fallback", reason: "no_openai_key", matched_keywords: maxMatches },
      });

      if (matchedCategory && ticket_id) {
        await supabase.from("tickets").update({
          category_id: matchedCategory.id,
          priority: "medium",
        }).eq("id", ticket_id);
      }

      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let categoriesContext = "";
    if (categories && categories.length > 0) {
      categoriesContext = "\n\nCategories disponibles (tu DOIS choisir parmi cette liste EXACTE) :\n" +
        categories.map(cat =>
          `- "${cat.name}": ${cat.description || ""} | Mots-cles: ${(cat.keywords || []).join(", ")}`
        ).join("\n");
    }

    const prompt = `Analyse l'email suivant et retourne une reponse JSON STRICTE avec ces champs :
- category (string) : categorie principale - OBLIGATOIREMENT une des categories de la liste ci-dessous, utilise le nom EXACT
- subcategory (string) : sous-categorie en francais
- priority (string) : "low", "medium", "high" ou "urgent"
- intent (string) : l'intention de l'expediteur en francais
- sentiment (string) : "positive", "neutral", "negative" ou "mixed"
- entities (object) : { name, email, phone, address, property } - extrais ceux trouves
- recommended_actions (array de strings) : prochaines etapes suggerees EN FRANCAIS
- suggested_assignee (string ou null) : departement suggere en francais
- confidence (number 0-1) : ton score de confiance
${categoriesContext}

Objet de l'email : ${subject}
De : ${from_name} <${from_address}>
Corps :
${(body || "").substring(0, 3000)}

IMPORTANT : Tu DOIS choisir la categorie parmi la liste fournie ci-dessus. Utilise le nom EXACT de la categorie (respecte la casse). Analyse les mots-cles et le contexte pour determiner la meilleure categorie.

Retourne UNIQUEMENT du JSON valide, aucun autre texte.`;

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
                "Tu es un assistant de classification d'emails pour une agence immobiliere francaise. Tu reponds TOUJOURS en francais. Retourne toujours du JSON valide.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 1000,
        }),
      }
    );

    if (!openaiRes.ok) {
      const errBody = await openaiRes.text();
      throw new Error(`OpenAI API error ${openaiRes.status}: ${errBody}`);
    }

    const openaiData = await openaiRes.json();
    const content = openaiData.choices?.[0]?.message?.content ?? "{}";
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const classification = JSON.parse(cleaned);

    await supabase.from("ai_classifications").insert({
      email_id,
      ticket_id,
      category: classification.category ?? "",
      subcategory: classification.subcategory ?? "",
      priority: classification.priority ?? "medium",
      intent: classification.intent ?? "",
      sentiment: classification.sentiment ?? "neutral",
      entities: classification.entities ?? {},
      recommended_actions: classification.recommended_actions ?? [],
      suggested_assignee: classification.suggested_assignee ?? null,
      confidence: classification.confidence ?? 0.5,
      raw_response: openaiData,
    });

    let resolvedCategory = matchedCategory;

    if (!resolvedCategory && classification.category && categories) {
      const aiCatName = classification.category.toLowerCase().trim();
      resolvedCategory = categories.find(
        (c: any) => c.name.toLowerCase().trim() === aiCatName
      );
    }

    if (resolvedCategory && ticket_id) {
      await supabase.from("tickets").update({
        category_id: resolvedCategory.id,
        priority: classification.priority ?? "medium",
      }).eq("id", ticket_id);
    } else if (ticket_id && classification.priority) {
      await supabase.from("tickets").update({
        priority: classification.priority,
      }).eq("id", ticket_id);
    }

    return new Response(JSON.stringify(classification), {
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
