// HAKO — « On t'aide » : suggestions de logements et d'activités par étape
// V1 : recherches pré-filtrées chez les partenaires (ville, dates de l'étape,
// nombre de voyageurs, budget). Le groupe ajoute ensuite ce qu'il a trouvé
// aux envies pour voter. Spec : docs/FEATURES.md → « Logements & activités ».

import { useMemo, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { FilterButton } from '@/components/ui/FilterButton';
import { NavButton } from '@/components/ui/NavButton';
import { useAuth } from '@/contexts/AuthContext';
import { useTripEvents } from '@/hooks/useTripEvents';
import { useTripOverview } from '@/hooks/useTripOverview';
import { addEventToWishes } from '@/services/eventsService';
import { openPartner } from '@/services/partnerService';
import { TripEvent } from '@/types/events';
import { useTripStops } from '@/hooks/useTripStops';
import { TRIP_VIBES } from '@/types/tripStyle';
import { PartnerKind, partnerLinks } from '@/utils/affiliateLinks';
import { lodgingPerNight } from '@/utils/tripBudget';
import { nightsBetween } from '@/utils/tripStops';

const TABS: { id: PartnerKind; label: string; icon: 'bed-outline' | 'ticket-outline' }[] = [
  { id: 'lodging',    label: 'Logements', icon: 'bed-outline' },
  { id: 'activities', label: 'Activités', icon: 'ticket-outline' },
];
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const ICON_TILE = 44;
const EVENT_THUMB = 64;
const WEEKDAYS_SHORT = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];

function eventWhen(event: TripEvent): string {
  const day = event.local_date;
  if (!day) return '';
  const [y, m, d] = day.split('-').map(Number);
  const weekday = WEEKDAYS_SHORT[new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay()] ?? '';
  const time = event.starts_at
    ? new Date(event.starts_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : null;
  return `${weekday} ${String(d ?? '').padStart(2, '0')}${time ? ` · ${time}` : ''}`;
}
const BOTTOM_NAV_SPACE = 110;

function shortDay(day: string): string {
  const [, m, d] = day.split('-').map(Number);
  return `${String(d ?? '').padStart(2, '0')} ${MONTHS_SHORT[(m ?? 1) - 1] ?? ''}`;
}

export default function HelpScreen() {
  // stop : ouvre directement l'étape concernée (ex. « pas encore de logement à Kyoto »)
  const { id, tab, stop: stopParam } = useLocalSearchParams<{ id: string; tab?: string; stop?: string }>();
  const insets = useSafeAreaInsets();
  const { overview } = useTripOverview(id);
  const { stops } = useTripStops(id);
  const { events } = useTripEvents(id);
  const { session } = useAuth();
  const [addedEventIds, setAddedEventIds] = useState<ReadonlySet<string>>(new Set());

  const [kind, setKind] = useState<PartnerKind>(tab === 'activities' ? 'activities' : 'lodging');
  const [stopIndex, setStopIndex] = useState(0);
  const wantedIndex = stopParam ? stops.findIndex(s => s.id === stopParam) : -1;
  const [appliedParam, setAppliedParam] = useState(false);
  if (!appliedParam && wantedIndex >= 0) { setAppliedParam(true); setStopIndex(wantedIndex); }

  const stop = stops[stopIndex] ?? stops[0] ?? null;
  const travelers = overview?.member_count ?? 1;
  const tripNights = overview?.start_date && overview.end_date
    ? nightsBetween(overview.start_date, overview.end_date)
    : 0;
  const maxPerNight = overview?.budget_per_person
    ? lodgingPerNight(overview.budget_per_person, tripNights)
    : null;

  const links = useMemo(() => {
    if (!stop) return [];
    return partnerLinks(kind, {
      city: stop.place_name,
      checkin: stop.start_date,
      checkout: stop.end_date,
      travelers,
      maxPerNightPerPerson: maxPerNight,
    });
  }, [kind, stop, travelers, maxPerNight]);

  const vibeLabels = (overview?.vibes ?? [])
    .map(v => TRIP_VIBES.find(o => o.id === v)?.label)
    .filter((l): l is string => l !== undefined);
  const filterSummary = [
    ...vibeLabels,
    ...(kind === 'lodging' && maxPerNight ? [`≤ ${maxPerNight} €/nuit/pers`] : []),
  ].join(' · ');

  const stopNights = stop ? nightsBetween(stop.start_date, stop.end_date) : 0;
  const stopEvents = stop ? events.filter(e => e.stop_id === stop.id) : [];

  const handleAddEvent = async (event: TripEvent) => {
    const userId = session?.user?.id;
    if (!userId || addedEventIds.has(event.id)) return;
    setAddedEventIds(prev => new Set(prev).add(event.id));
    const { error } = await addEventToWishes(event, userId);
    if (error !== null) {
      setAddedEventIds(prev => { const next = new Set(prev); next.delete(event.id); return next; });
      Alert.alert('Oups', error);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + BOTTOM_NAV_SPACE }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>On t’aide</Text>

        {/* Onglets */}
        <View style={styles.tabs}>
          {TABS.map(t => {
            const active = t.id === kind;
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setKind(t.id)}
                activeOpacity={0.85}
                accessibilityState={{ selected: active }}
              >
                <Ionicons name={t.icon} size={18} color={active ? Colors.textInverted : Colors.textPrimary} />
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Villes du voyage */}
        {stops.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {stops.map((s, i) => (
              <FilterButton key={s.id} label={s.place_name} active={i === stopIndex} onPress={() => setStopIndex(i)} />
            ))}
          </ScrollView>
        )}

        {/* Contexte + filtres */}
        {stop && (
          <View style={styles.context}>
            <Text style={styles.contextText}>
              {stop.place_name} · {shortDay(stop.start_date)} → {shortDay(stop.end_date)}
              {kind === 'lodging' ? ` · ${stopNights} nuit${stopNights > 1 ? 's' : ''}` : ''}
              {` · ${travelers} voyageur${travelers > 1 ? 's' : ''}`}
            </Text>
            {filterSummary.length > 0 && (
              <View style={styles.filterPill}>
                <Text style={styles.filterText}>{filterSummary}</Text>
                <Ionicons name="pencil" size={12} color={Colors.accent} />
              </View>
            )}
          </View>
        )}

        {!stop && (
          <Text style={styles.empty}>Ajoute une ville à ton voyage pour voir les suggestions.</Text>
        )}

        {/* Événements pendant le séjour (Ticketmaster, via Edge Function) */}
        {kind === 'activities' && stopEvents.length > 0 && (
          <View style={styles.eventsSection}>
            <Text style={styles.sectionLabel}>Pendant ton séjour · {stopEvents.length}</Text>
            {stopEvents.map(event => {
              const added = addedEventIds.has(event.id);
              return (
                <View key={event.id} style={styles.eventCard}>
                  {event.image_url
                    ? <Image source={{ uri: event.image_url }} style={styles.eventThumb} />
                    : <View style={[styles.eventThumb, styles.eventThumbEmpty]}><Ionicons name="ticket-outline" size={20} color={Colors.textSecondary} /></View>}
                  <View style={styles.cardText}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{event.title}</Text>
                    <Text style={styles.cardSub} numberOfLines={1}>
                      {eventWhen(event)}{event.venue_name ? ` · ${event.venue_name}` : ''}
                    </Text>
                    {event.price_min !== null && (
                      <Text style={styles.eventPrice}>dès {Math.round(event.price_min)} {event.currency === 'EUR' || !event.currency ? '€' : event.currency}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[styles.eventAdd, added && styles.eventAdded]}
                    onPress={() => { void handleAddEvent(event); }}
                    disabled={added}
                    accessibilityLabel={added ? 'Déjà dans vos envies' : `Ajouter ${event.title} aux envies`}
                  >
                    <Ionicons name={added ? 'checkmark' : 'add'} size={20} color={Colors.textInverted} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* Partenaires */}
        {links.map(link => (
          <TouchableOpacity
            key={link.id}
            style={styles.card}
            onPress={() => openPartner(link.url, link.id, 'help_page', id)}
            activeOpacity={0.85}
            accessibilityRole="link"
          >
            <View style={styles.iconTile}>
              <Ionicons name={link.icon} size={22} color={Colors.textPrimary} />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{link.name}</Text>
              <Text style={styles.cardSub}>{link.tagline}</Text>
              <View style={styles.cardCta}>
                <Text style={styles.cardCtaText}>
                  {kind === 'lodging' ? 'Voir les logements' : 'Voir les activités'} à {stop?.place_name}
                </Text>
                <Ionicons name="open-outline" size={13} color={Colors.accent} />
              </View>
            </View>
          </TouchableOpacity>
        ))}

        {/* Boucle avec les envies */}
        {stop && (
          <TouchableOpacity
            style={styles.loop}
            onPress={() => router.push(`/trip/${id}/envies`)}
            activeOpacity={0.85}
          >
            <Ionicons name="heart-outline" size={20} color={Colors.accent} />
            <Text style={styles.loopText}>
              Trouvé quelque chose ? Ajoute-le aux envies pour que le groupe vote.
            </Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textPrimary} />
          </TouchableOpacity>
        )}

        <Text style={styles.disclosure}>
          Liens partenaires : Hako peut toucher une petite commission, sans frais en plus pour toi.
        </Text>
      </ScrollView>

      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
        <NavButton icon="chevron-back" onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: Spacing.md2,
    gap: Spacing.md,
  },
  title: {
    ...Typography.displayTitle,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
  },
  tabs: {
    flexDirection: 'row',
    gap: Spacing.xs,
    padding: Spacing.xs,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm2,
    borderRadius: Radii.full,
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  tabTextActive: {
    color: Colors.textInverted,
  },
  chips: {
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  context: {
    gap: Spacing.sm,
  },
  contextText: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
  },
  filterPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm2,
    paddingVertical: 6,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.accent,
    backgroundColor: Colors.background,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.accent,
  },
  empty: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm2,
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.sm2,
    ...Shadows.card,
  },
  iconTile: {
    width: ICON_TILE,
    height: ICON_TILE,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    ...Typography.cardTitle,
    color: Colors.textInk,
  },
  cardSub: {
    ...Typography.bodySmall,
    color: Colors.textInk,
  },
  cardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  cardCtaText: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.accent,
  },
  loop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm2,
    padding: Spacing.md,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.accent,
    backgroundColor: Colors.background,
  },
  loopText: {
    flex: 1,
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  eventsSection: {
    gap: Spacing.sm,
  },
  sectionLabel: {
    ...Typography.displayLabel,
    color: Colors.textPrimary,
    textTransform: 'uppercase',
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm2,
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    paddingLeft: Spacing.sm2,
    paddingRight: Spacing.md,
    paddingVertical: Spacing.sm2,
    ...Shadows.card,
  },
  eventThumb: {
    width: EVENT_THUMB,
    height: EVENT_THUMB,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  eventThumbEmpty: {
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventPrice: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.accent,
  },
  eventAdd: {
    width: 40,
    height: 40,
    borderRadius: Radii.full,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  eventAdded: {
    backgroundColor: Colors.primary,
  },
  disclosure: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
  },
  bottomNav: {
    position: 'absolute',
    left: Spacing.md2,
    bottom: 0,
  },
});
