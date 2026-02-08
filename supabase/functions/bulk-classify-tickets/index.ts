import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Category {
  id: string;
  name: string;
  keywords: string[];
}

interface Ticket {
  id: string;
  subject: string;
  category_id: string | null;
}

interface Email {
  subject: string;
  body_text: string;
  body_html: string;
}

function extractTextFromHtml(html: string): string {
  if (!html) return '';
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  return text.trim();
}

function classifyTicket(ticket: Ticket, emails: Email[], categories: Category[]): string | null {
  const allText = [
    ticket.subject || '',
    ...emails.map(e => e.subject || ''),
    ...emails.map(e => e.body_text || extractTextFromHtml(e.body_html || ''))
  ].filter(Boolean).join(' ').toLowerCase();

  let bestCategory: string | null = null;
  let bestScore = 0;

  for (const category of categories) {
    if (!category.keywords || !Array.isArray(category.keywords) || category.keywords.length === 0) {
      continue;
    }

    let score = 0;

    for (const keyword of category.keywords) {
      if (!keyword || typeof keyword !== 'string') continue;

      const keywordLower = keyword.toLowerCase();
      const regex = new RegExp(`\\b${keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      const matches = allText.match(regex);
      if (matches) {
        score += matches.length * 10;
      } else if (allText.includes(keywordLower)) {
        score += 5;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestCategory = category.id;
    }
  }

  return bestScore > 0 ? bestCategory : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Non autorisé" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } }
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Non autorisé" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== 'admin' && profile?.role !== 'manager') {
      return new Response(
        JSON.stringify({ error: "Vous n'avez pas la permission d'effectuer cette action" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {
      console.log('No body provided, using defaults');
    }
    const { forceAll = false, mailboxId = null } = body;

    let query = supabaseClient.from("tickets").select("id, subject, category_id");

    if (!forceAll) {
      query = query.is("category_id", null);
    }

    if (mailboxId) {
      query = query.eq("mailbox_id", mailboxId);
    }

    const { data: tickets, error: ticketsError } = await query;

    if (ticketsError) {
      throw new Error(`Erreur lors de la récupération des tickets: ${ticketsError.message}`);
    }

    const { data: categories, error: categoriesError } = await supabaseClient
      .from("categories")
      .select("id, name, keywords")
      .eq("is_active", true);

    if (categoriesError) {
      throw new Error(`Erreur lors de la récupération des catégories: ${categoriesError.message}`);
    }

    if (!categories || categories.length === 0) {
      return new Response(
        JSON.stringify({ error: "Aucune catégorie active trouvée" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let classified = 0;
    let total = tickets?.length || 0;

    for (const ticket of tickets || []) {
      const { data: emails } = await supabaseClient
        .from("emails")
        .select("subject, body_text, body_html")
        .eq("ticket_id", ticket.id)
        .eq("direction", "inbound")
        .order("received_at", { ascending: false })
        .limit(5);

      const categoryId = classifyTicket(ticket, emails || [], categories);

      if (categoryId) {
        const { error: updateError } = await supabaseClient
          .from("tickets")
          .update({ category_id: categoryId })
          .eq("id", ticket.id);

        if (!updateError) {
          classified++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total,
        classified,
        message: `${classified} tickets classifiés sur ${total} tickets analysés`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Erreur:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
