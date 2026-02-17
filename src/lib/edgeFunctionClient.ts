import { supabase } from './supabase';

interface EdgeFunctionOptions {
  functionName: string;
  body?: any;
  useServiceRole?: boolean;
  useUserToken?: boolean;
  timeout?: number;
}

interface EdgeFunctionResult<T> {
  data?: T;
  error?: string;
  status?: number;
}

export async function callEdgeFunction<T = any>(
  options: EdgeFunctionOptions
): Promise<EdgeFunctionResult<T>> {
  const {
    functionName,
    body,
    useServiceRole = false,
    useUserToken = false,
    timeout = 30000
  } = options;

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`;

  let authToken: string;

  if (useUserToken) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('[EdgeFunction] No user session found');
      return {
        error: 'Session expirée. Veuillez vous reconnecter.',
        status: 401
      };
    }
    authToken = session.access_token;
    console.log('[EdgeFunction] Using user session token');
  } else {
    const apiKey = useServiceRole
      ? import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
      : import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!apiKey || apiKey.includes('undefined')) {
      console.error('[EdgeFunction] API key not configured');
      return {
        error: 'Configuration manquante : clé API Supabase'
      };
    }
    authToken = apiKey;
  }

  if (!apiUrl || apiUrl.includes('undefined')) {
    console.error('[EdgeFunction] VITE_SUPABASE_URL not configured');
    return {
      error: 'Configuration manquante : VITE_SUPABASE_URL'
    };
  }

  console.log(`[EdgeFunction] Calling ${functionName}`, {
    url: apiUrl,
    hasBody: !!body,
    useServiceRole,
    useUserToken,
    timeout
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn(`[EdgeFunction] ${functionName} timeout after ${timeout}ms`);
    controller.abort();
  }, timeout);

  try {
    const startTime = Date.now();

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const duration = Date.now() - startTime;
    console.log(`[EdgeFunction] ${functionName} responded in ${duration}ms with status ${response.status}`);

    if (response.status === 546) {
      console.error(`[EdgeFunction] HTTP 546 - Runtime error in ${functionName}`);
      console.error('[EdgeFunction] This usually means an unhandled exception in the Edge Function');
      console.error('[EdgeFunction] Check Supabase Dashboard > Edge Functions > Logs for details');

      let errorDetails = 'Erreur d\'exécution dans la fonction Edge.';
      try {
        const errorText = await response.text();
        if (errorText) {
          console.error('[EdgeFunction] Error response:', errorText);
          errorDetails += ` Détails: ${errorText}`;
        }
      } catch (e) {
        console.error('[EdgeFunction] Could not parse error response');
      }

      return {
        error: errorDetails,
        status: 546
      };
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[EdgeFunction] ${functionName} error (${response.status}):`, errorText);

      return {
        error: `Erreur HTTP ${response.status}: ${errorText || 'Réponse vide'}`,
        status: response.status
      };
    }

    let data: T;
    const responseText = await response.text();

    if (!responseText) {
      console.warn(`[EdgeFunction] ${functionName} returned empty response`);
      return { data: undefined };
    }

    try {
      data = JSON.parse(responseText);
      console.log(`[EdgeFunction] ${functionName} success`);
      return { data, status: response.status };
    } catch (parseError) {
      console.error(`[EdgeFunction] ${functionName} returned invalid JSON:`, responseText);
      return {
        error: 'Réponse invalide du serveur (JSON attendu)',
        status: response.status
      };
    }

  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      console.error(`[EdgeFunction] ${functionName} timeout after ${timeout}ms`);
      return {
        error: `La requête a dépassé le délai de ${timeout / 1000}s`,
        status: 408
      };
    }

    if (err.message?.includes('Failed to fetch')) {
      console.error(`[EdgeFunction] ${functionName} network error - cannot reach server`);
      return {
        error: 'Impossible de contacter le serveur. Vérifiez votre connexion.',
        status: 0
      };
    }

    console.error(`[EdgeFunction] ${functionName} unexpected error:`, err);
    return {
      error: `Erreur réseau: ${err.message}`,
      status: 0
    };
  }
}

export async function callEdgeFunctionWithRetry<T = any>(
  options: EdgeFunctionOptions,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<EdgeFunctionResult<T>> {
  let lastError: EdgeFunctionResult<T> | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[EdgeFunction] Attempt ${attempt}/${maxRetries} for ${options.functionName}`);

    const result = await callEdgeFunction<T>(options);

    if (!result.error || result.status === 400 || result.status === 404) {
      return result;
    }

    lastError = result;
    console.warn(`[EdgeFunction] Attempt ${attempt} failed:`, result.error);

    if (attempt < maxRetries) {
      const delay = retryDelay * attempt;
      console.log(`[EdgeFunction] Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  console.error(`[EdgeFunction] All ${maxRetries} attempts failed for ${options.functionName}`);
  return lastError!;
}
