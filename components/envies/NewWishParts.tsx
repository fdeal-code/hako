// HAKO — Briques de l'écran « Nouvelle envie » (maquettes 711:2841 / 711:2962)
// Bandeau « Lien copié », champ lien, ligne d'option, aperçu vidéo,
// carte « Lieu trouvé », recherche de lieu, pastilles d'ambiance.

import { ComponentProps } from 'react';
import {
  ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Colors, Fonts, Radii, Shadows, Spacing, Typography } from '@/constants/theme';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  FoundPlace, LINK_SOURCE_META, LinkPreview, PlaceSuggestion, WISH_VIBES, WishVibe,
} from '@/types/wishDraft';
import { detectLinkSource, shortUrl } from '@/utils/wishLinks';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const ICON_CIRCLE = 40;
const PLAY_SIZE = 64;
const VIDEO_HEIGHT = 300;
const CAPTION_WIDTH = 260;
const GRADIENT_START = 0.45;

// ─── Bandeau « Lien TikTok copié → Coller » ─────────────────────────────────
export function ClipboardBanner({ url, onPaste }: { url: string | null; onPaste: () => void }) {
  const meta = url ? LINK_SOURCE_META[detectLinkSource(url)] : LINK_SOURCE_META.other;
  return (
    <View style={styles.banner}>
      <View style={[styles.iconCircle, styles.iconAccent]}>
        <Ionicons name={meta.icon} size={20} color={Colors.white} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.bannerTitle} numberOfLines={1}>
          {url ? `Lien ${meta.label} copié` : 'Lien copié'}
        </Text>
        <Text style={styles.bannerSub} numberOfLines={1}>
          {url ? shortUrl(url) : 'Touche Coller pour voir l’aperçu'}
        </Text>
      </View>
      <TouchableOpacity style={styles.pasteBtn} onPress={onPaste} activeOpacity={0.85} accessibilityRole="button">
        <Text style={styles.pasteText}>Coller</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Champ « Ou colle un lien… » ─────────────────────────────────────────────
export function LinkField({ value, onChange, onSubmit }: {
  value: string; onChange: (text: string) => void; onSubmit: () => void;
}) {
  return (
    <View style={styles.field}>
      <Ionicons name="link" size={20} color={Colors.textInk} />
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        placeholder="Ou colle un lien TikTok, Reel, YouTube…"
        placeholderTextColor={Colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        returnKeyType="go"
      />
      {value.trim().length > 0 && (
        <TouchableOpacity onPress={onSubmit} accessibilityLabel="Voir l’aperçu" hitSlop={8}>
          <Ionicons name="arrow-forward-circle" size={26} color={Colors.accent} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Ligne d'option (« Un lieu », « Les idées Hako ») ───────────────────────
export function OptionRow({ icon, title, subtitle, onPress }: {
  icon: IoniconName; title: string; subtitle: string; onPress: () => void;
}) {
  return (
    <AnimatedPressable style={styles.option} onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
      <View style={[styles.iconCircle, styles.iconCream]}>
        <Ionicons name={icon} size={20} color={Colors.textInk} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textInk} />
    </AnimatedPressable>
  );
}

// ─── Aperçu vidéo (miniature, compte, lecture, légende) ──────────────────────
export function VideoPreview({ preview, loading, onPlay }: {
  preview: LinkPreview | null; loading: boolean; onPlay: () => void;
}) {
  const meta = LINK_SOURCE_META[preview?.source ?? 'other'];
  return (
    <View style={styles.video}>
      {preview?.thumbnail ? (
        <Image source={{ uri: preview.thumbnail }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.videoEmpty]}>
          {!loading && <Ionicons name={meta.icon} size={48} color={Colors.textOnDark} />}
        </View>
      )}
      <LinearGradient
        colors={[Colors.scrimClear, Colors.scrimStrong]}
        locations={[GRADIENT_START, 1]}
        style={StyleSheet.absoluteFill}
      />
      {loading ? (
        <ActivityIndicator style={styles.videoLoader} color={Colors.white} />
      ) : (
        <>
          <View style={styles.videoBadge}>
            <Ionicons name={meta.icon} size={14} color={Colors.white} />
            <Text style={styles.videoBadgeText} numberOfLines={1}>
              {preview?.author ? `${meta.label} · @${preview.author}` : meta.label}
            </Text>
          </View>
          <TouchableOpacity style={styles.play} onPress={onPlay} activeOpacity={0.85} accessibilityLabel="Lire la vidéo">
            <Ionicons name="play" size={26} color={Colors.textPrimary} />
          </TouchableOpacity>
          {preview?.title ? (
            <Text style={styles.caption} numberOfLines={2}>{preview.title}</Text>
          ) : null}
        </>
      )}
    </View>
  );
}

// ─── Carte « Lieu trouvé » / « Ajouter un lieu » ─────────────────────────────
export function PlaceCard({ place, detected, finding, stopLabel, onEdit }: {
  place: FoundPlace | null; detected: boolean; finding: boolean; stopLabel: string | null; onEdit: () => void;
}) {
  if (finding) {
    return (
      <View style={styles.option}>
        <View style={[styles.iconCircle, styles.iconCream]}>
          <ActivityIndicator size="small" color={Colors.accent} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>On cherche le lieu…</Text>
          <Text style={styles.rowSub}>D’après la légende de la vidéo</Text>
        </View>
      </View>
    );
  }
  if (!place) {
    return (
      <TouchableOpacity style={styles.option} onPress={onEdit} activeOpacity={0.85} accessibilityRole="button">
        <View style={[styles.iconCircle, styles.iconCream]}>
          <Ionicons name="location-outline" size={20} color={Colors.textInk} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>Ajouter un lieu</Text>
          <Text style={styles.rowSub} numberOfLines={1}>Pour la ranger dans la bonne étape</Text>
        </View>
        <Text style={styles.editLink}>Choisir</Text>
      </TouchableOpacity>
    );
  }
  return (
    <View style={styles.option}>
      <View style={[styles.iconCircle, styles.iconAccent]}>
        <Ionicons name="location-outline" size={20} color={Colors.white} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>{detected ? `Lieu trouvé : ${place.name}` : place.name}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>{stopLabel ?? place.address}</Text>
      </View>
      <TouchableOpacity onPress={onEdit} hitSlop={8} accessibilityRole="button">
        <Text style={styles.editLink}>Modifier</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Recherche de lieu (champ + suggestions) ─────────────────────────────────
export function PlaceSearch({ query, onChange, suggestions, onSelect, autoFocus = true }: {
  query: string;
  onChange: (text: string) => void;
  suggestions: readonly PlaceSuggestion[];
  onSelect: (suggestion: PlaceSuggestion) => void;
  autoFocus?: boolean;
}) {
  return (
    <View style={styles.searchWrap}>
      <View style={styles.field}>
        <Ionicons name="search" size={20} color={Colors.textInk} />
        <TextInput
          style={styles.fieldInput}
          value={query}
          onChangeText={onChange}
          placeholder="Resto, bar, plage, musée…"
          placeholderTextColor={Colors.textMuted}
          autoCorrect={false}
          autoFocus={autoFocus}
          returnKeyType="search"
        />
      </View>
      {suggestions.length > 0 && (
        <View style={styles.suggestions}>
          {suggestions.slice(0, 5).map((s, i) => (
            <TouchableOpacity
              key={s.place_id}
              style={[styles.suggestion, i > 0 && styles.suggestionBorder]}
              onPress={() => onSelect(s)}
              activeOpacity={0.7}
            >
              <Ionicons name="location-outline" size={16} color={Colors.textMuted} />
              <Text style={styles.suggestionText} numberOfLines={1}>{s.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Photo du lieu choisi (écran « Un lieu ») ────────────────────────────────
export function PlacePhoto({ place }: { place: FoundPlace }) {
  if (!place.photoUrl) return null;
  return (
    <View style={styles.photo}>
      <Image source={{ uri: place.photoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      {place.rating !== null && (
        <View style={styles.videoBadge}>
          <Ionicons name="star" size={12} color={Colors.white} />
          <Text style={styles.videoBadgeText}>{place.rating.toFixed(1)}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Ambiances ───────────────────────────────────────────────────────────────
export function VibeChips({ selected, onToggle }: { selected: readonly WishVibe[]; onToggle: (vibe: WishVibe) => void }) {
  return (
    <View style={styles.vibes}>
      <Text style={styles.sectionLabel}>AMBIANCE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vibeRow}>
        {WISH_VIBES.map(v => {
          const active = selected.includes(v.id);
          return (
            <TouchableOpacity
              key={v.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onToggle(v.id)}
              activeOpacity={0.8}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{v.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Astuce : partager depuis TikTok / Instagram (maquette « Astuce partage ») ─
export function ShareTip() {
  return (
    <View style={styles.tip}>
      <Ionicons name="share-outline" size={16} color={Colors.accent} />
      <Text style={styles.tipText}>Depuis TikTok ou Insta : Partager → Hako</Text>
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

const styles = StyleSheet.create({
  tip: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.sm2 + 2, paddingVertical: Spacing.sm + 2,
    borderRadius: Radii.full, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.accent,
  },
  tipText: { ...Typography.chip, color: Colors.accent },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2,
    padding: Spacing.sm2 + 2, borderRadius: Radii.lg,
    backgroundColor: Colors.primary, ...Shadows.card,
  },
  bannerTitle: { ...Typography.rowTitle, color: Colors.white },
  bannerSub: { ...Typography.bodySmall, color: Colors.textOnDark },
  pasteBtn: {
    paddingHorizontal: Spacing.sm2, paddingVertical: Spacing.sm,
    borderRadius: Radii.full, backgroundColor: Colors.accent,
  },
  pasteText: { ...Typography.chip, color: Colors.white },
  iconCircle: {
    width: ICON_CIRCLE, height: ICON_CIRCLE, borderRadius: Radii.full,
    alignItems: 'center', justifyContent: 'center',
  },
  iconAccent: { backgroundColor: Colors.accent },
  iconCream: { backgroundColor: Colors.background },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...Typography.rowTitle, color: Colors.textInk },
  rowSub: { ...Typography.bodySmall, color: Colors.textMuted },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2,
    padding: Spacing.md2, borderRadius: Radii.lg,
    backgroundColor: Colors.surface, ...Shadows.card,
  },
  fieldInput: { flex: 1, padding: 0, ...Typography.rowTitle, fontWeight: '500', color: Colors.textInk },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm2,
    paddingLeft: Spacing.sm2, paddingRight: Spacing.md, paddingVertical: Spacing.sm2,
    borderRadius: Radii.lg, backgroundColor: Colors.surface, ...Shadows.card,
  },
  editLink: { ...Typography.chip, fontSize: 12, color: Colors.accent },
  video: {
    height: VIDEO_HEIGHT, borderRadius: Radii.pill, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.primary,
  },
  videoEmpty: { alignItems: 'center', justifyContent: 'center' },
  videoLoader: { flex: 1 },
  videoBadge: {
    position: 'absolute', top: Spacing.md - 1, left: Spacing.md - 1,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.sm2, paddingVertical: 6,
    borderRadius: Radii.full, backgroundColor: Colors.primary, maxWidth: '85%',
  },
  videoBadgeText: { ...Typography.bodySmall, fontWeight: '600', color: Colors.white },
  play: {
    position: 'absolute', alignSelf: 'center', top: (VIDEO_HEIGHT - PLAY_SIZE) / 2 - Spacing.sm,
    width: PLAY_SIZE, height: PLAY_SIZE, borderRadius: Radii.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.glassLight, ...Shadows.card,
  },
  caption: {
    position: 'absolute', left: Spacing.md - 1, bottom: Spacing.md2, width: CAPTION_WIDTH,
    ...Typography.rowTitle, color: Colors.white,
  },
  searchWrap: { gap: Spacing.sm },
  suggestions: { borderRadius: Radii.lg, backgroundColor: Colors.surface, ...Shadows.card, overflow: 'hidden' },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm2 + 2 },
  suggestionBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.line },
  suggestionText: { flex: 1, ...Typography.body, color: Colors.textInk },
  photo: { height: VIDEO_HEIGHT * 0.6, borderRadius: Radii.pill, overflow: 'hidden', backgroundColor: Colors.line },
  vibes: { gap: Spacing.sm + 2 },
  sectionLabel: { ...Typography.displayLabel, fontFamily: Fonts.displayBold, color: Colors.textPrimary },
  vibeRow: { gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2,
    borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.background,
  },
  chipActive: { backgroundColor: Colors.primary },
  chipText: { ...Typography.chip, color: Colors.textPrimary },
  chipTextActive: { color: Colors.white },
});
