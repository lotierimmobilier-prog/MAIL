import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RateLimitRequest {
  identifier: string;
  action: string;
  metadata?: Record<string, any>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { identifier, action, metadata = {} }: RateLimitRequest = await req.json();

    if (!identifier || !action) {
      return new Response(
        JSON.stringify({ error: 'identifier and action are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const ip = req.headers.get('x-forwarded-for') ||
                req.headers.get('x-real-ip') ||
                'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    const enrichedMetadata = {
      ...metadata,
      ip_address: ip,
      user_agent: userAgent,
      timestamp: new Date().toISOString()
    };

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_identifier: identifier,
      p_action: action,
      p_metadata: enrichedMetadata
    });

    if (error) {
      console.error('Rate limit check error:', error);
      throw error;
    }

    const result = data as any;

    if (!result.allowed) {
      return new Response(
        JSON.stringify({
          allowed: false,
          error: 'Rate limit exceeded',
          ...result
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': result.retry_after?.toString() || '60',
            'X-RateLimit-Limit': result.max_attempts?.toString() || '0',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': result.blocked_until || new Date(Date.now() + 60000).toISOString()
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        allowed: true,
        ...result
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': result.max_attempts?.toString() || '100',
          'X-RateLimit-Remaining': result.remaining?.toString() || '99',
          'X-RateLimit-Reset': result.reset_at || new Date(Date.now() + 60000).toISOString()
        },
      }
    );

  } catch (error: any) {
    console.error('Rate limit service error:', error);

    return new Response(
      JSON.stringify({
        allowed: true,
        warning: 'Rate limit check failed, allowing by default',
        error: error.message
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
