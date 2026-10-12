// HAKO — Mesure d'usage et suivi des plantages (tables app_events / app_errors)
// Sans service tiers. Les événements partent par paquets (toutes les 15 s, à
// 10 événements, ou quand l'app passe en arrière-plan) ; une erreur part tout
// de suite. Rien ne bloque l'app : un envoi raté est simplement oublié.
// Jamais de contenu personnel : voir sanitizeProps (utils/telemetry).

import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';

import { supabase } from '@/services/supabase';
import { errorSummary, EventProps, isValidEventName, sanitizeProps } from '@/utils/telemetry';

const FLUSH_EVERY_MS = 15_000;
const FLUSH_AT = 10;
const MAX_QUEUE = 200;

type EventName =
  | 'app_open' | 'screen_view' | 'signup_completed' | 'login'
  | 'trip_created' | 'trip_joined'
  | 'invite_link_shared' | 'invite_email_sent'
  | 'wish_added' | 'wish_voted' | 'planning_added' | 'expense_added' | 'document_added'
  | 'prep_task_added' | 'booking_import_parsed' | 'booking_import_saved' | 'booking_import_failed'
  | 'share_received' | 'match_created' | 'partner_opened';

interface QueuedEvent {
  name: string;
  trip_id: string | null;
  props: EventProps;
  created_at: string;
}

const sessionId = Crypto.randomUUID();
const platform = Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web' ? Platform.OS : null;
const appVersion = Constants.expoConfig?.version ?? null;
const isDev = __DEV__;

let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let installed = false;

async function flush(): Promise<void> {
  if (timer) { clearTimeout(timer); timer = null; }
  if (queue.length === 0) return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) { queue = []; return; } // pas connecté : rien à rattacher
  const batch = queue;
  queue = [];
  await supabase.from('app_events').insert(batch.map(e => ({
    ...e, session_id: sessionId, platform, app_version: appVersion, is_dev: isDev,
  })));
}

/** Note une étape clé. `props` : nombres, booléens, courts libellés seulement. */
export function track(name: EventName, props?: Record<string, unknown>, tripId?: string | null): void {
  if (!isValidEventName(name)) return;
  queue.push({ name, trip_id: tripId ?? null, props: sanitizeProps(props), created_at: new Date().toISOString() });
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
  if (queue.length >= FLUSH_AT) void flush();
  else if (!timer) timer = setTimeout(() => { void flush(); }, FLUSH_EVERY_MS);
}

/** Envoie une erreur tout de suite (plantage, écran d'erreur). */
export async function reportError(error: unknown, context: { fatal?: boolean; screen?: string } = {}): Promise<void> {
  const { message, stack } = errorSummary(error);
  try {
    await supabase.from('app_errors').insert({
      session_id: sessionId,
      message,
      stack,
      screen: context.screen?.slice(0, 200) ?? null,
      fatal: context.fatal ?? false,
      platform,
      app_version: appVersion,
      is_dev: isDev,
    });
  } catch {
    // pas de réseau : tant pis
  }
}

interface GlobalErrorUtils {
  getGlobalHandler: () => (error: unknown, isFatal?: boolean) => void;
  setGlobalHandler: (handler: (error: unknown, isFatal?: boolean) => void) => void;
}

/** À appeler une fois au démarrage : erreurs JS non rattrapées + envoi en arrière-plan. */
export function installTelemetry(): void {
  if (installed) return;
  installed = true;
  const errorUtils = (globalThis as { ErrorUtils?: GlobalErrorUtils }).ErrorUtils;
  if (errorUtils) {
    const previous = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error, isFatal) => {
      void reportError(error, { fatal: !!isFatal });
      previous(error, isFatal);
    });
  }
  AppState.addEventListener('change', state => {
    if (state !== 'active') void flush();
  });
}
