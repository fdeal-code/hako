/**
 * NavButton — bouton de navigation flottant (tab bar & dashboard)
 *
 * Specs :
 *  - 64×64 px (round) | même hauteur + largeur auto (pill actif)
 *  - border-radius 99px, padding H:24 V:16, gap 10
 *  - Fill  : LinearGradient 100% opacité
 *  - Stroke : 1px inside LinearGradient
 *  - Blur  : 20px en arrière-plan
 *  - Shadow: y:10, blur:30, spread:0, rgba(0,0,0,0.25)
 *  - Couleur icône/texte : #424242
 */

import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

/* ─── Tokens ──────────────────────────────────────────────────── */
const ICON_TEXT_COLOR = '#424242';
const SIZE            = 64;   // diamètre du bouton rond
const BORDER_W        = 1;    // épaisseur du stroke

// Gradient du FILL (fond du bouton) — top-left → bottom-right
const FILL_COLORS: [string, string] = [
  'rgba(255,255,255,0.70)',
  'rgba(255,255,255,0.30)',
];
// Gradient du STROKE (bordure 1px)
const STROKE_COLORS: [string, string] = [
  'rgba(255,255,255,0.95)',
  'rgba(180,202,222,0.60)',
];

/* ─── Props ───────────────────────────────────────────────────── */
export interface NavButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label?: string;          // si fourni → pill active (icône + texte)
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  iconSize?: number;
}

/* ─── Composant ───────────────────────────────────────────────── */
export function NavButton({
  icon,
  label,
  onPress,
  style,
  iconSize = 24,
}: NavButtonProps) {
  const isPill = !!label;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={style}>
      {/* ─ Ombre portée ─ */}
      <View style={[styles.shadow, isPill ? styles.pillShadow : styles.circleShadow]}>

        {/* ─ Gradient STROKE (1px border) ─ */}
        <LinearGradient
          colors={STROKE_COLORS}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.strokeGradient]}
        />

        {/* ─ Contenu intérieur (blur + fill gradient + éléments) ─ */}
        <View
          style={[
            styles.inner,
            isPill ? styles.pillInner : styles.circleInner,
          ]}
        >
          {/* Blur de fond 20px */}
          <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />

          {/* Fill gradient */}
          <LinearGradient
            colors={FILL_COLORS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          {/* Icône + label */}
          <View style={styles.content}>
            <Ionicons name={icon} size={iconSize} color={ICON_TEXT_COLOR} />
            {isPill && (
              <Text style={styles.label}>{label}</Text>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/* ─── Styles ──────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  /* Ombre portée (y:10, blur:30, black 25%) */
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,   // ≈ blur/2 en React Native
    elevation: 12,
  },
  circleShadow: {
    width: SIZE,
    height: SIZE,
    borderRadius: 99,
  },
  pillShadow: {
    height: SIZE,
    borderRadius: 99,
  },

  /* Gradient de bordure (wraps l'inner avec 1px de marge) */
  strokeGradient: {
    borderRadius: 99,
  },

  /* Zone intérieure (décalée de BORDER_W pour laisser apparaître le stroke) */
  inner: {
    margin: BORDER_W,
    overflow: 'hidden',
    borderRadius: 99,
  },
  circleInner: {
    width: SIZE - BORDER_W * 2,
    height: SIZE - BORDER_W * 2,
  },
  pillInner: {
    height: SIZE - BORDER_W * 2,
    paddingHorizontal: 24 - BORDER_W,
    paddingVertical: 16,
  },

  /* Contenu (icône ± label) */
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    // Centrage dans le cercle
    flex: 1,
    justifyContent: 'center',
  },

  label: {
    fontSize: 16,
    fontWeight: '700',
    color: ICON_TEXT_COLOR,
    letterSpacing: 0.2,
  },
});
