// HAKO — Étapes d'un voyage sur une carte : tracé en pointillés + repères numérotés
// À placer À L'INTÉRIEUR d'un <MapView>. Utilisé par les mini-cartes des dashboards
// et par la carte plein écran app/trip/[id]/map.tsx.

import { StyleSheet, Text, View } from 'react-native';
import { Marker, Polyline } from 'react-native-maps';

import { Colors, Radii, Shadows, Typography } from '@/constants/theme';
import { TripStop } from '@/types/tripStops';
import { stopColor } from '@/utils/tripStops';

interface StopMarkersProps {
  stops: readonly TripStop[];
  /** Étiquette « Rome · 3 nuits » sous le repère (cartes plein écran). */
  showLabels?: boolean;
  onStopPress?: (stop: TripStop) => void;
}

const PIN_SIZE = 30;
const ROUTE_WIDTH = 2.5;
const ROUTE_DASH = [8, 6];
const MS_PER_DAY = 86_400_000;

function nights(stop: TripStop): number {
  return Math.round((Date.parse(stop.end_date) - Date.parse(stop.start_date)) / MS_PER_DAY);
}

export function StopMarkers({ stops, showLabels = false, onStopPress }: StopMarkersProps) {
  const located = stops.filter(
    (s): s is TripStop & { lat: number; lng: number } => s.lat !== null && s.lng !== null,
  );
  if (located.length === 0) return null;

  return (
    <>
      {located.length > 1 && (
        <Polyline
          coordinates={located.map(s => ({ latitude: s.lat, longitude: s.lng }))}
          strokeColor={Colors.primary}
          strokeWidth={ROUTE_WIDTH}
          lineDashPattern={ROUTE_DASH}
        />
      )}
      {located.map(stop => {
        const n = nights(stop);
        return (
          <Marker
            key={stop.id}
            coordinate={{ latitude: stop.lat, longitude: stop.lng }}
            onPress={() => onStopPress?.(stop)}
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.wrap}>
              <View style={[styles.pin, { backgroundColor: stopColor(stop.position, Colors.stopPalette) }]}>
                <Text style={styles.pinText}>{stop.position + 1}</Text>
              </View>
              {showLabels && (
                <View style={styles.label}>
                  <Text style={styles.labelText} numberOfLines={1}>
                    {stop.place_name} · {n} nuit{n > 1 ? 's' : ''}
                  </Text>
                </View>
              )}
            </View>
          </Marker>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  pin: {
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: Radii.full,
    borderWidth: 2,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  pinText: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.textInverted,
  },
  label: {
    marginTop: 4,
    backgroundColor: Colors.surface,
    borderRadius: Radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    ...Shadows.sm,
  },
  labelText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});
