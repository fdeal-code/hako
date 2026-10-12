// HAKO — Service partenaires : ouvrir un lien affilié et le compter
// Placement = où le lien a été proposé (dashboard, planning, envie…), pour
// savoir quels emplacements servent vraiment.

import * as WebBrowser from 'expo-web-browser';

import { track } from '@/services/telemetryService';

export type PartnerPlacement = 'help_page' | 'dashboard_tile' | 'planning_day' | 'wish_tickets' | 'wish_lodging' | 'preparation' | 'esim_reminder';

export function openPartner(url: string, partner: string, placement: PartnerPlacement, tripId?: string | null): void {
  track('partner_opened', { partner, placement }, tripId ?? null);
  void WebBrowser.openBrowserAsync(url);
}
