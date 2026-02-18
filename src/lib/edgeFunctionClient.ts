import { supabase } from './supabase';

interface EdgeFunctionOptions {
  functionName: string;
  body?: any;
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
    useUserToken = false,
    timeout = 30000
  } = options;

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`;

  let authToken: string;

  if (useUserToken) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return {
        error: 'Session expirée. Veuillez vous reconnecter.',
        status: 401
      };
    }
    authToken = session.access_token;
  } else {
    const apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!apiKey || apiKey.includes('undefined')) {
      return {
        error: 'Configuration manquante : clé API Supabase'
      };
    }
    authToken = apiKey;
  }

  if (!apiUrl || apiUrl.includes('undefined')) {
    return {
      error: 'Configuration manquante : VITE_SUPABASE_URL'
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
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

    if (response.status === 546) {
      let errorDetails = 'Erreur d\'exécution dans la fonction Edge.';
      try {
        const errorText = await response.text();
        if (errorText) {
          errorDetails += ` Détails: ${errorText}`;
        }
      } catch {}

      return {
        error: errorDetails,
        status: 546
      };
    }

    if (!response.ok) {
      const errorText = await response.text();
      return {
        error: `Erreur HTTP ${response.status}: ${errorText || 'Réponse vide'}`,
        status: response.status
      };
    }

    let data: T;
    const responseText = await response.text();

    if (!responseText) {
      return { data: undefined };
    }

    try {
      data = JSON.parse(responseText);
      return { data, status: response.status };
    } catch {
      return {
        error: 'Réponse invalide du serveur (JSON attendu)',
        status: response.status
      };
    }

  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      return {
        error: `La requête a dépassé le délai de ${timeout / 1000}s`,
        status: 408
      };
    }

    if (err.message?.includes('Failed to fetch')) {
      return {
        error: 'Impossible de contacter le serveur. Vérifiez votre connexion.',
        status: 0
      };
    }

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
    const result = await callEdgeFunction<T>(options);

    if (!result.error || result.status === 400 || result.status === 404) {
      return result;
    }

    lastError = result;

    if (attempt < maxRetries) {
      const delay = retryDelay * attempt;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return lastError!;
}
