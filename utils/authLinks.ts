// HAKO — Liens d'authentification reçus par e-mail (fonction pure)
// Le lien « Mot de passe oublié » rouvre l'app sur hako://reset-password avec
// les jetons de session dans le fragment (#access_token=…&refresh_token=…
// &type=recovery), ou un code (?code=…) selon le mode de Supabase, ou une
// erreur (#error_description=…) si le lien a expiré.
// Aucun import local : testable avec node --test.

export interface AuthRedirect {
  accessToken: string | null;
  refreshToken: string | null;
  code: string | null;
  type: string | null;
  error: string | null;
}

function params(part: string): URLSearchParams {
  return new URLSearchParams(part.replace(/^[?#]/, ''));
}

export function parseAuthRedirect(url: string): AuthRedirect {
  const hashAt = url.indexOf('#');
  const queryAt = url.indexOf('?');
  const fragment = hashAt >= 0 ? params(url.slice(hashAt)) : new URLSearchParams();
  const query = queryAt >= 0 ? params(url.slice(queryAt, hashAt >= 0 && hashAt > queryAt ? hashAt : undefined)) : new URLSearchParams();
  const get = (key: string) => fragment.get(key) ?? query.get(key);
  const error = get('error_description') ?? get('error');
  return {
    accessToken: get('access_token'),
    refreshToken: get('refresh_token'),
    code: get('code'),
    type: get('type'),
    error: error ? error.replace(/\+/g, ' ') : null,
  };
}
