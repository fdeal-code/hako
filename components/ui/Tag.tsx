import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Radii, Spacing } from '@/constants/theme';

export type TagColor = 'blue' | 'red' | 'green' | 'orange' | 'gray' | 'olive';

export type TagProps = {
  label:  string;
  emoji?: string;
  color:  TagColor;
  /** Mode solide (fond opaque + texte blanc) pour overlay sur image */
  solid?: boolean;
};

const COLOR_MAP: Record<TagColor, { bg: string; solidBg: string; text: string }> = {
  blue:   { bg: 'rgba(59,130,246,0.12)',  solidBg: 'rgba(59,130,246,0.90)',  text: '#3B82F6' },
  red:    { bg: 'rgba(220,80,60,0.12)',   solidBg: 'rgba(220,80,60,0.90)',   text: '#DC503C' },
  green:  { bg: 'rgba(34,197,94,0.12)',   solidBg: 'rgba(34,197,94,0.90)',   text: '#22C55E' },
  orange: { bg: 'rgba(249,115,22,0.12)',  solidBg: 'rgba(249,115,22,0.90)',  text: '#F97316' },
  gray:   { bg: 'rgba(156,163,175,0.12)', solidBg: 'rgba(156,163,175,0.90)', text: '#9CA3AF' },
  olive:  { bg: 'rgba(120,140,90,0.12)',  solidBg: 'rgba(120,140,90,0.90)',  text: '#788C5A' },
};

export function Tag({ label, emoji, color, solid = false }: TagProps) {
  const c = COLOR_MAP[color];
  return (
    <View style={[s.tag, { backgroundColor: solid ? c.solidBg : c.bg }]}>
      <Text style={[s.label, { color: solid ? '#fff' : c.text }]}>
        {emoji ? `${emoji} ` : ''}{label}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  tag: {
    borderRadius:      Radii.pill,
    paddingHorizontal: Spacing.sm2,
    paddingVertical:   6,
    alignSelf:         'flex-start',
  },
  label: {
    fontSize:   12,
    fontWeight: '600',
  },
});
