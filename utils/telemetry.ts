// HAKO — Mesure d'usage : fonctions pures (noms d'écran, propriétés)
// Aucun contenu personnel ne part : seulement des nombres, des booléens et de
// courts libellés techniques. Aucun import local (node --test).

export const MAX_PROPS = 8;
const MAX_PROP_TEXT = 40;
const EVENT_NAME = /^[a-z][a-z0-9_]{1,48}$/;

export type PropValue = string | number | boolean | null;
export type EventProps = Record<string, PropValue>;

export function isValidEventName(name: string): boolean {
  return EVENT_NAME.test(name);
}

/** Garde au plus MAX_PROPS clés simples ; textes coupés, objets ignorés. */
export function sanitizeProps(props: Record<string, unknown> | undefined): EventProps {
  const out: EventProps = {};
  if (!props) return out;
  for (const [key, value] of Object.entries(props)) {
    if (Object.keys(out).length >= MAX_PROPS) break;
    if (!/^[a-z][a-z0-9_]{0,30}$/.test(key)) continue;
    if (value === null || typeof value === 'boolean') out[key] = value;
    else if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    else if (typeof value === 'string') out[key] = value.slice(0, MAX_PROP_TEXT);
  }
  return out;
}

/** Écran vu, sans identifiant : ['trip', '[id]', 'envies'] → '/trip/[id]/envies'. */
export function routeName(segments: readonly string[]): string {
  const parts = segments.filter(s => !/^\(.*\)$/.test(s)); // groupes « (tabs) », « (auth) »
  return parts.length === 0 ? '/' : `/${parts.join('/')}`;
}

/** Message d'erreur court et sans retour à la ligne superflu. */
export function errorSummary(error: unknown): { message: string; stack: string | null } {
  if (error instanceof Error) {
    return { message: `${error.name}: ${error.message}`.slice(0, 2000), stack: error.stack?.slice(0, 8000) ?? null };
  }
  return { message: String(error).slice(0, 2000), stack: null };
}
