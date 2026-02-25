import {
  View,
  Text,
  TextInput,
  Image,
  Alert,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { Colors, Spacing, Radii } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import { tripEvents } from '@/utils/events';

/* ─── Config API ─────────────────────────────────────────────── */
const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

/* ─── Destinations populaires (fallback champ vide) ─────────── */
const POPULAR = [
  { name: 'Rome',      country: 'Italie',      emoji: '🇮🇹' },
  { name: 'Paris',     country: 'France',      emoji: '🇫🇷' },
  { name: 'Barcelone', country: 'Espagne',     emoji: '🇪🇸' },
  { name: 'Tokyo',     country: 'Japon',       emoji: '🇯🇵' },
  { name: 'New York',  country: 'USA',         emoji: '🇺🇸' },
  { name: 'Bali',      country: 'Indonésie',   emoji: '🇮🇩' },
  { name: 'Londres',   country: 'Angleterre',  emoji: '🇬🇧' },
  { name: 'Amsterdam', country: 'Pays-Bas',    emoji: '🇳🇱' },
  { name: 'Lisbonne',  country: 'Portugal',    emoji: '🇵🇹' },
  { name: 'Marrakech', country: 'Maroc',       emoji: '🇲🇦' },
];

const TOTAL_STEPS = 5;

/* ─── Suggestions de couverture ──────────────────────────────── */
const SUGGESTIONS = [
  { id: 1, uri: 'https://picsum.photos/seed/travel1/400/300' },
  { id: 2, uri: 'https://picsum.photos/seed/travel2/400/300' },
  { id: 3, uri: 'https://picsum.photos/seed/travel3/400/300' },
  { id: 4, uri: 'https://picsum.photos/seed/travel4/400/300' },
  { id: 5, uri: 'https://picsum.photos/seed/travel5/400/300' },
  { id: 6, uri: 'https://picsum.photos/seed/travel6/400/300' },
];

/* ─── Types ──────────────────────────────────────────────────── */
interface PlacesSuggestion {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

/* ─── API Google Places ──────────────────────────────────────── */
async function fetchPlacesSuggestions(query: string): Promise<PlacesSuggestion[]> {
  if (!GOOGLE_API_KEY || GOOGLE_API_KEY === 'YOUR_KEY_HERE') return [];
  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
      `?input=${encodeURIComponent(query)}` +
      `&types=(cities)` +
      `&language=fr` +
      `&key=${GOOGLE_API_KEY}`;
    const res  = await fetch(url);
    const json = await res.json();
    if (json.status === 'OK') return json.predictions as PlacesSuggestion[];
  } catch {
    // réseau indisponible — retour silencieux
  }
  return [];
}

/* ─── Calendrier — constantes et helpers ─────────────────────── */
const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const DAYS_FR   = ['L','M','M','J','V','S','D'];
const RANGE_BG  = '#E8E8F0';

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstOffset(y: number, m: number) { const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1; }
function sameDay(a: Date, b: Date) { return a.toDateString() === b.toDateString(); }
function toMidnight(y: number, m: number, d: number) { return new Date(y, m, d); }
function formatDateFR(d: Date): string {
  const s = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ─── Indicateur de progression ─────────────────────────────── */
function ProgressDots({ step }: { step: number }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View
          key={i}
          style={[styles.dot, i + 1 === step && styles.dotActive]}
        />
      ))}
    </View>
  );
}

/* ─── Écran principal ────────────────────────────────────────── */
export default function CreateTripScreen() {
  const insets    = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { session } = useAuth();

  /* ── État global du formulaire ── */
  const [step,             setStep]            = useState(1);
  const [destination,      setDestination]     = useState('');
  const [tripName,         setTripName]        = useState('');

  /* ── État étape 1 ── */
  const [query,            setQuery]           = useState('');
  const [suggestions,      setSuggestions]     = useState<PlacesSuggestion[]>([]);
  const [searching,        setSearching]       = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── État étape 2 — placeholder animé ── */
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const placeholderIdxSV = useSharedValue(0);

  /* ── État étape 3 — calendrier ── */
  const today = useRef((() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })()).current;
  const [startDate,    setStartDate]    = useState<Date | null>(null);
  const [endDate,      setEndDate]      = useState<Date | null>(null);
  const [displayYear,  setDisplayYear]  = useState(() => new Date().getFullYear());
  const [displayMonth, setDisplayMonth] = useState(() => new Date().getMonth());
  const placeholderOpacity  = useSharedValue(1);
  const placeholderAnimStyle = useAnimatedStyle(() => ({
    opacity: placeholderOpacity.value,
  }));

  /* ── Slide horizontal entre étapes ── */
  const offset = useSharedValue(0);
  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  const goToStep = (newStep: number) => {
    offset.value = withTiming(-(newStep - 1) * width, {
      duration: 340,
      easing: Easing.out(Easing.cubic),
    });
    setStep(newStep);
  };

  const handleBack = () => {
    if (step > 1) goToStep(step - 1);
    else          router.back();
  };

  /* ── Cycling du placeholder à l'étape 2 ── */
  const cityName = destination.split(',')[0].trim() || 'Rome';
  const PLACEHOLDERS = [
    'Road trip entre potes 2026',
    `Escapade romantique à ${cityName}`,
    'Aventure en famille',
    'Week-end surprise',
  ];

  useEffect(() => {
    if (step !== 2) return;
    placeholderIdxSV.value = 0;
    setPlaceholderIndex(0);
    placeholderOpacity.value = 1;

    const id = setInterval(() => {
      placeholderOpacity.value = withTiming(0, { duration: 300 });
      setTimeout(() => {
        const nextIdx = (placeholderIdxSV.value + 1) % 4;
        placeholderIdxSV.value = nextIdx;
        setPlaceholderIndex(nextIdx);
        placeholderOpacity.value = withTiming(1, { duration: 300 });
      }, 310);
    }, 3000);

    return () => clearInterval(id);
  }, [step]);

  /* ── Debounce + appel Google Places ── */
  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const results = await fetchPlacesSuggestions(text);
      setSuggestions(results);
      setSearching(false);
    }, 300);
  };

  /* ── Sélection depuis Google Places ── */
  const handleSelectSuggestion = (item: PlacesSuggestion) => {
    setDestination(item.description);
    setQuery(item.description);
    setSuggestions([]);
    goToStep(2);
  };

  /* ── Sélection depuis la liste populaire ── */
  const handleSelectPopular = (item: typeof POPULAR[0]) => {
    const fullName = `${item.name}, ${item.country}`;
    setDestination(fullName);
    setQuery(fullName);
    goToStep(2);
  };

  const showSuggestions = query.trim().length >= 2;
  const showPopular     = !showSuggestions;
  const canNext2 = tripName.trim().length > 0;

  /* ── Étape 3 : navigation mois ── */
  const canGoPrev = displayYear > today.getFullYear() ||
    (displayYear === today.getFullYear() && displayMonth > today.getMonth());

  const prevMonth = () => {
    if (!canGoPrev) return;
    if (displayMonth === 0) { setDisplayYear(y => y - 1); setDisplayMonth(11); }
    else setDisplayMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (displayMonth === 11) { setDisplayYear(y => y + 1); setDisplayMonth(0); }
    else setDisplayMonth(m => m + 1);
  };

  /* ── Étape 3 : sélection de jours ── */
  const handleDayTap = (dayNum: number) => {
    const tapped = toMidnight(displayYear, displayMonth, dayNum);
    if (tapped < today) return;
    if (!startDate || endDate) {
      setStartDate(tapped);
      setEndDate(null);
    } else {
      if (tapped > startDate) setEndDate(tapped);
      else setStartDate(tapped);
    }
  };

  const duration = startDate && endDate
    ? Math.round((endDate.getTime() - startDate.getTime()) / 86400000)
    : null;
  const canNext3 = startDate !== null && endDate !== null;

  /* ── État étape 4 ── */
  const [coverUri,           setCoverUri]           = useState<string | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<number | null>(null);
  const [creating,           setCreating]           = useState(false);

  /* ── État étape 5 ── */
  const [travelMode,   setTravelMode]   = useState<'solo' | 'friends'>('solo');
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [emailInput,   setEmailInput]   = useState('');

  const coverPreviewUrl = coverUri ??
    (selectedSuggestion !== null ? SUGGESTIONS.find(s => s.id === selectedSuggestion)?.uri ?? null : null);

  const handlePickCover = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "Autorise l'accès à ta galerie.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled) {
      setCoverUri(result.assets[0].uri);
      setSelectedSuggestion(null);
    }
  };

  const handleSelectPhotoSuggestion = (index: number) => {
    setSelectedSuggestion(index);
    setCoverUri(null);
  };

  const handleAddEmail = () => {
    const email = emailInput.trim().toLowerCase();
    if (!email || !email.includes('@')) return;
    if (inviteEmails.includes(email)) return;
    setInviteEmails(prev => [...prev, email]);
    setEmailInput('');
  };

  const handleCreate = async () => {
    if (creating || !session?.user?.id) return;
    setCreating(true);
    try {
      const userId = session.user.id;
      let coverImageUrl: string | null = null;

      if (coverUri) {
        const ext      = coverUri.split('.').pop() ?? 'jpg';
        const filePath = `${userId}/${Date.now()}.${ext}`;
        const formData = new FormData();
        formData.append('file', { uri: coverUri, name: `cover.${ext}`, type: `image/${ext}` } as any);
        const { error: uploadError } = await supabase.storage
          .from('covers')
          .upload(filePath, formData, { upsert: true, contentType: `image/${ext}` });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('covers').getPublicUrl(filePath);
        coverImageUrl = publicUrl;
      } else if (selectedSuggestion !== null) {
        coverImageUrl = SUGGESTIONS.find(s => s.id === selectedSuggestion)?.uri ?? null;
      }

      const startIso = startDate?.toISOString().split('T')[0] ?? null;
      const endIso   = endDate?.toISOString().split('T')[0]   ?? null;

      const { data: tripData, error: tripError } = await supabase
        .from('trips')
        .insert({
          name:            tripName.trim(),
          destination:     destination.trim(),
          start_date:      startIso,
          end_date:        endIso,
          cover_image_url: coverImageUrl,
          owner_id:        userId,
        })
        .select()
        .single();

      if (tripError) throw tripError;

      const { error: memberError } = await supabase
        .from('trip_members')
        .insert({ trip_id: tripData.id, user_id: userId, role: 'owner' });

      if (memberError) throw memberError;

      /* Invitations — table trip_invites (silent fail si pas encore créée) */
      if (inviteEmails.length > 0) {
        try {
          await supabase.from('trip_invites').insert(
            inviteEmails.map(email => ({
              trip_id:    tripData.id,
              email,
              invited_by: userId,
              status:     'pending',
            }))
          );
        } catch { /* table pas encore créée — on ignore */ }
      }

      tripEvents.emit();
      router.back();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erreur lors de la création.';
      Alert.alert('Erreur', message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* ── Header fixe ── */}
      <View style={styles.header}>
        <ProgressDots step={step} />
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ── Slides ── */}
      <Animated.View style={[styles.stepsRow, containerStyle, { width: width * TOTAL_STEPS }]}>

        {/* ═══ ÉTAPE 1 — Destination ═══ */}
        <View style={[styles.step, { width }]}>
          <Text style={styles.stepTitle}>Où part-on ?</Text>

          <View style={styles.searchBox}>
            {searching
              ? <ActivityIndicator size="small" color={Colors.textTertiary} style={styles.searchIcon} />
              : <Ionicons name="search-outline" size={18} color={Colors.textTertiary} style={styles.searchIcon} />
            }
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher une destination"
              placeholderTextColor={Colors.textTertiary}
              value={query}
              onChangeText={handleQueryChange}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>

          {/* Résultats Google Places */}
          {showSuggestions && (
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.listContent}
            >
              {suggestions.length === 0 && !searching ? (
                <Text style={styles.noResult}>Aucune destination trouvée</Text>
              ) : (
                suggestions.map((item) => (
                  <TouchableOpacity
                    key={item.place_id}
                    style={styles.suggestionRow}
                    onPress={() => handleSelectSuggestion(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.placeIconWrap}>
                      <Ionicons name="location-outline" size={18} color={Colors.textSecondary} />
                    </View>
                    <View style={styles.suggestionText}>
                      <Text style={styles.suggestionName}>
                        {item.structured_formatting.main_text}
                      </Text>
                      <Text style={styles.suggestionCountry}>
                        {item.structured_formatting.secondary_text}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          )}

          {/* Destinations populaires */}
          {showPopular && (
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.listContent}
            >
              <Text style={styles.sectionLabel}>Destinations populaires</Text>
              {POPULAR.map((dest) => (
                <TouchableOpacity
                  key={dest.name}
                  style={styles.suggestionRow}
                  onPress={() => handleSelectPopular(dest)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.suggestionEmoji}>{dest.emoji}</Text>
                  <View style={styles.suggestionText}>
                    <Text style={styles.suggestionName}>{dest.name}</Text>
                    <Text style={styles.suggestionCountry}>{dest.country}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* ═══ ÉTAPE 2 — Nom du voyage ═══ */}
        <View style={[styles.step, { width }]}>
          <Text style={styles.stepTitle}>Comment s'appelle{'\n'}ce voyage ?</Text>

          {/* Champ nom avec placeholder animé */}
          <View style={styles.nameInputWrap}>
            {tripName.length === 0 && (
              <Animated.Text
                style={[styles.namePlaceholder, placeholderAnimStyle]}
                pointerEvents="none"
              >
                {PLACEHOLDERS[placeholderIndex]}
              </Animated.Text>
            )}
            <TextInput
              style={styles.nameInput}
              value={tripName}
              onChangeText={(t) => setTripName(t.slice(0, 50))}
              maxLength={50}
              selectionColor={Colors.primary}
              returnKeyType="done"
            />
          </View>

          {/* Compteur de caractères */}
          <Text style={styles.charCounter}>{tripName.length}/50</Text>

          {/* Pousse les actions vers le bas */}
          <View style={{ flex: 1 }} />

          {/* Actions bas de page */}
          <View style={[styles.step2Actions, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backCircleBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.nextBtn, !canNext2 && styles.nextBtnDisabled]}
              onPress={() => { if (canNext2) goToStep(3); }}
              activeOpacity={canNext2 ? 0.85 : 1}
            >
              <Text style={[styles.nextBtnText, !canNext2 && styles.nextBtnTextDisabled]}>
                Suivant
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ═══ ÉTAPE 3 — Dates ═══ */}
        <View style={[styles.step, { width }]}>

          {/* Contenu scrollable */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.step3Scroll}
          >
          <Text style={styles.stepTitle}>Quand décolle-t-on ? ✈️</Text>

          {/* ── Calendrier ── */}
          <View style={styles.calendar}>

            {/* Navigation mois */}
            <View style={styles.calMonthRow}>
              <TouchableOpacity
                onPress={prevMonth}
                disabled={!canGoPrev}
                activeOpacity={0.7}
                style={[styles.calNavBtn, !canGoPrev && styles.calNavBtnDisabled]}
              >
                <Ionicons
                  name="chevron-back"
                  size={20}
                  color={canGoPrev ? Colors.textPrimary : Colors.textTertiary}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={nextMonth} activeOpacity={0.7}>
                <Text style={styles.calMonthTitle}>
                  {MONTHS_FR[displayMonth]} {displayYear} ›
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={nextMonth}
                activeOpacity={0.7}
                style={styles.calNavBtn}
              >
                <Ionicons name="chevron-forward" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Noms des jours */}
            <View style={styles.calDayNames}>
              {DAYS_FR.map((d, i) => (
                <Text key={i} style={[styles.calDayName, { width: (width - 2 * Spacing.md) / 7 }]}>
                  {d}
                </Text>
              ))}
            </View>

            {/* Grille des jours */}
            {(() => {
              const cellW      = (width - 2 * Spacing.md) / 7;
              const circleSize = Math.min(cellW - 8, 36);
              const daysCount  = getDaysInMonth(displayYear, displayMonth);
              const offset     = getFirstOffset(displayYear, displayMonth);
              const totalCells = Math.ceil((offset + daysCount) / 7) * 7;

              return (
                <View style={styles.calGrid}>
                  {Array.from({ length: totalCells }).map((_, i) => {
                    const dayNum = i - offset + 1;

                    if (dayNum < 1 || dayNum > daysCount) {
                      return <View key={i} style={{ width: cellW, height: cellW }} />;
                    }

                    const cellDate = toMidnight(displayYear, displayMonth, dayNum);
                    const isPast   = cellDate < today;
                    const isStart  = !!startDate && sameDay(cellDate, startDate);
                    const isEnd    = !!endDate   && sameDay(cellDate, endDate);
                    const isRange  = !!startDate && !!endDate &&
                                     cellDate > startDate && cellDate < endDate;
                    const showBar  = isRange || (isStart && !!endDate) || (isEnd && !!startDate);

                    return (
                      <TouchableOpacity
                        key={i}
                        style={{ width: cellW, height: cellW, alignItems: 'center', justifyContent: 'center' }}
                        onPress={() => handleDayTap(dayNum)}
                        activeOpacity={isPast ? 1 : 0.7}
                        disabled={isPast}
                      >
                        {/* Barre de plage */}
                        {showBar && (
                          <View
                            style={[
                              styles.calRangeBar,
                              {
                                left:  (isStart && !isEnd) ? '50%' : 0,
                                right: (isEnd   && !isStart) ? '50%' : 0,
                              },
                            ]}
                          />
                        )}

                        {/* Cercle du jour */}
                        <View
                          style={[
                            styles.calCircle,
                            { width: circleSize, height: circleSize, borderRadius: circleSize / 2 },
                            (isStart || isEnd) && styles.calCircleSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.calDayText,
                              isPast  && styles.calDayTextPast,
                              isRange && styles.calDayTextRange,
                              (isStart || isEnd) && styles.calDayTextSelected,
                            ]}
                          >
                            {dayNum}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })()}
          </View>

          {/* ── Résumé des dates ── */}
          {startDate && (
            <View style={styles.dateSummary}>
              <View style={styles.dateSummaryRow}>
                <Text style={styles.dateSummaryLabel}>Départ</Text>
                <Text style={styles.dateSummaryValue}>{formatDateFR(startDate)}</Text>
              </View>
              {endDate && (
                <>
                  <View style={styles.dateSummarySep} />
                  <View style={styles.dateSummaryRow}>
                    <Text style={styles.dateSummaryLabel}>Retour</Text>
                    <Text style={styles.dateSummaryValue}>{formatDateFR(endDate)}</Text>
                  </View>
                  <View style={styles.dateSummarySep} />
                  <View style={styles.dateSummaryRow}>
                    <Text style={styles.dateSummaryLabel}>Durée</Text>
                    <Text style={[styles.dateSummaryValue, styles.dateSummaryDuration]}>
                      {duration} {duration === 1 ? 'jour' : 'jours'}
                    </Text>
                  </View>
                </>
              )}
            </View>
          )}
          </ScrollView>

          {/* ── Barre bas — même layout que l'étape 2 ── */}
          <View style={[styles.step2Actions, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
            <TouchableOpacity onPress={handleBack} style={styles.backCircleBtn} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.nextBtn, !canNext3 && styles.nextBtnDisabled]}
              onPress={() => { if (canNext3) goToStep(4); }}
              activeOpacity={canNext3 ? 0.85 : 1}
            >
              <Text style={[styles.nextBtnText, !canNext3 && styles.nextBtnTextDisabled]}>
                Suivant
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ═══ ÉTAPE 4 — Style ═══ */}
        <View style={[styles.step, { width }]}>

          {/* Contenu scrollable */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.step3Scroll}>
            <Text style={styles.stepTitle}>Donne-lui un style</Text>

            {/* Section 1 : Photo personnalisée */}
            <Text style={styles.sectionLabel}>Choisir une photo</Text>
            <TouchableOpacity onPress={handlePickCover} style={styles.photoPickerBtn} activeOpacity={0.7}>
              <Ionicons name="camera-outline" size={22} color={Colors.textSecondary} />
              <Text style={styles.photoPickerText}>
                {coverUri ? 'Changer la photo' : 'Depuis ma galerie'}
              </Text>
            </TouchableOpacity>

            {/* Section 2 : Suggestions */}
            <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>Suggestions</Text>
            {(() => {
              const thumbW = Math.floor((width - 2 * Spacing.md - 2 * Spacing.sm) / 3);
              const thumbH = Math.floor(thumbW * 0.75);
              return (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.suggestionsRow}
                  contentContainerStyle={{ gap: Spacing.sm }}
                >
                  {SUGGESTIONS.map((item) => {
                    const isSelected = selectedSuggestion === item.id && !coverUri;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.suggestionThumb,
                          { width: thumbW, height: thumbH },
                          isSelected && styles.suggestionThumbSelected,
                        ]}
                        onPress={() => handleSelectPhotoSuggestion(item.id)}
                        activeOpacity={0.8}
                      >
                        <Image
                          source={{ uri: item.uri }}
                          style={{ width: thumbW, height: thumbH }}
                          resizeMode="cover"
                          onError={(e) => console.log('IMG ERROR:', item.uri, e.nativeEvent.error)}
                        />
                        {isSelected && (
                          <View style={styles.suggestionCheck}>
                            <Ionicons name="checkmark" size={16} color={Colors.white} />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              );
            })()}

            {/* Aperçu de la card */}
            <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>Aperçu</Text>
            <View style={styles.previewCard}>
              {coverPreviewUrl ? (
                <Image
                  source={{ uri: coverPreviewUrl }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.surface }]} />
              )}
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.28)' }]} />
              <View style={styles.previewContent}>
                <View style={{ alignSelf: 'flex-end' }}>
                  <View style={styles.previewBadge}>
                    <Text style={styles.previewBadgeText}>
                      {startDate
                        ? startDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
                        : 'Date de départ'}
                    </Text>
                  </View>
                </View>
                <View style={{ flex: 1 }} />
                <Text style={styles.previewName} numberOfLines={1}>
                  {tripName || 'Nom du voyage'}
                </Text>
                <Text style={styles.previewDest} numberOfLines={1}>
                  {destination || 'Destination'}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Barre bas */}
          <View style={[styles.step2Actions, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
            <TouchableOpacity onPress={handleBack} style={styles.backCircleBtn} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.nextBtn}
              onPress={() => goToStep(5)}
              activeOpacity={0.85}
            >
              <Text style={styles.nextBtnText}>Suivant</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ═══ ÉTAPE 5 — Qui vient avec toi ? ═══ */}
        <View style={[styles.step, { width }]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.step3Scroll}>
            <Text style={styles.stepTitle}>Qui vient{'\n'}avec toi ?</Text>

            {/* Boutons solo / amis */}
            <View style={styles.travelModeRow}>
              <TouchableOpacity
                style={[styles.travelModeBtn, travelMode === 'solo' && styles.travelModeBtnActive]}
                onPress={() => setTravelMode('solo')}
                activeOpacity={0.8}
              >
                <Ionicons name="person-outline" size={22} color={travelMode === 'solo' ? Colors.primary : Colors.textSecondary} />
                <Text style={[styles.travelModeBtnText, travelMode === 'solo' && styles.travelModeBtnTextActive]}>
                  Je pars seul
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.travelModeBtn, travelMode === 'friends' && styles.travelModeBtnActive]}
                onPress={() => setTravelMode('friends')}
                activeOpacity={0.8}
              >
                <Ionicons name="people-outline" size={22} color={travelMode === 'friends' ? Colors.primary : Colors.textSecondary} />
                <Text style={[styles.travelModeBtnText, travelMode === 'friends' && styles.travelModeBtnTextActive]}>
                  Avec des amis
                </Text>
              </TouchableOpacity>
            </View>

            {/* Section invitation */}
            {travelMode === 'friends' && (
              <View style={styles.inviteSection}>
                <View style={styles.emailRow}>
                  <TextInput
                    style={styles.emailInput}
                    placeholder="Entrer l'email d'un ami"
                    placeholderTextColor={Colors.textTertiary}
                    value={emailInput}
                    onChangeText={setEmailInput}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    returnKeyType="done"
                    onSubmitEditing={handleAddEmail}
                  />
                  <TouchableOpacity style={styles.addEmailBtn} onPress={handleAddEmail} activeOpacity={0.8}>
                    <Ionicons name="add" size={22} color={Colors.white} />
                  </TouchableOpacity>
                </View>

                {inviteEmails.map((email, i) => (
                  <View key={i} style={styles.emailChip}>
                    <Text style={styles.emailChipText} numberOfLines={1}>{email}</Text>
                    <TouchableOpacity
                      onPress={() => setInviteEmails(prev => prev.filter((_, j) => j !== i))}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close" size={16} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}

                {inviteEmails.length > 0 && (
                  <View style={styles.inviteInfo}>
                    <Ionicons name="mail-outline" size={13} color={Colors.textTertiary} />
                    <Text style={styles.inviteInfoText}>Tes amis recevront une invitation par email</Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          {/* Barre bas */}
          <View style={[styles.step2Actions, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
            <TouchableOpacity onPress={handleBack} style={styles.backCircleBtn} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.nextBtn, creating && styles.nextBtnDisabled]}
              onPress={handleCreate}
              activeOpacity={creating ? 1 : 0.85}
              disabled={creating}
            >
              {creating
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={styles.nextBtnText}>Créer le voyage ✈️</Text>
              }
            </TouchableOpacity>
          </View>
        </View>

      </Animated.View>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    position: 'relative',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
  },
  dotActive: {
    width: 20,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  closeBtn: {
    position: 'absolute',
    right: Spacing.md,
    padding: Spacing.xs,
  },
  stepsRow: {
    flex: 1,
    flexDirection: 'row',
  },
  step: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
  },
  stepTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
    letterSpacing: -0.5,
  },
  backBtn: {
    marginBottom: Spacing.md,
    alignSelf: 'flex-start',
    padding: Spacing.xs,
  },

  /* ── Étape 1 ── */
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    marginBottom: Spacing.md,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  listContent: {
    paddingBottom: Spacing.xxl,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  noResult: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.xl,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.md,
  },
  placeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionEmoji: {
    fontSize: 28,
    width: 36,
    textAlign: 'center',
  },
  suggestionText: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  suggestionCountry: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 1,
  },

  /* ── Étape 2 ── */
  nameInputWrap: {
    position: 'relative',
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.xs,
    minHeight: 40,
    justifyContent: 'center',
  },
  namePlaceholder: {
    position: 'absolute',
    left: 0,
    right: 0,
    fontSize: 20,
    fontWeight: '500',
    color: Colors.textTertiary,
  },
  nameInput: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
    padding: 0,
  },
  charCounter: {
    fontSize: 12,
    color: Colors.textTertiary,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
  step2Actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.md,
  },
  backCircleBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: Radii.full,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  nextBtnDisabled: {
    backgroundColor: Colors.border,
  },
  nextBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  nextBtnTextDisabled: {
    color: Colors.textTertiary,
  },

  /* ── Étape 3 — Calendrier ── */
  calendar: {
    marginTop: Spacing.xs,
  },
  calMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  calMonthTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  calDayNames: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  calDayName: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calRangeBar: {
    position: 'absolute',
    top: '18%',
    bottom: '18%',
    backgroundColor: RANGE_BG,
  },
  calCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  calCircleSelected: {
    backgroundColor: Colors.primary,
  },
  calDayText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  calDayTextPast: {
    color: Colors.border,
  },
  calDayTextRange: {
    color: Colors.primary,
    fontWeight: '600',
  },
  calDayTextSelected: {
    color: Colors.white,
    fontWeight: '700',
  },

  /* ── Étape 3 — Résumé dates ── */
  dateSummary: {
    marginTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  dateSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  dateSummarySep: {
    height: 1,
    backgroundColor: Colors.border,
  },
  dateSummaryLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  dateSummaryValue: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  dateSummaryDuration: {
    color: Colors.primary,
    fontWeight: '700',
  },

  /* ── Étape 3 — Navigation mois ── */
  calNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calNavBtnDisabled: {
    opacity: 0.4,
  },

  step3Scroll: {
    paddingBottom: Spacing.md,
  },

  /* ── Étape 4 — Photo picker ── */
  photoPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },
  photoPickerText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  /* ── Étape 4 — Grille suggestions ── */
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  suggestionsRow: {
    marginBottom: Spacing.sm,
  },
  suggestionThumb: {
    width: '31.5%',
    aspectRatio: 4 / 3,
    borderRadius: Radii.md,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  suggestionThumbSelected: {
    borderColor: Colors.primary,
  },
  suggestionImgWrap: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.surface,
  },
  suggestionImg: {
    width: '100%',
    height: '100%',
  },
  suggestionCheck: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Étape 4 — Aperçu card ── */
  previewCard: {
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },
  previewContent: {
    flex: 1,
    padding: Spacing.md,
  },
  previewBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
  },
  previewBadgeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  previewName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.3,
  },
  previewDest: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
    marginTop: 2,
  },

  /* ── Étape 5 — Mode de voyage ── */
  travelModeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  travelModeBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.lg,
    borderRadius: Radii.lg,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  travelModeBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(99,102,241,0.06)',
  },
  travelModeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  travelModeBtnTextActive: {
    color: Colors.primary,
  },

  /* ── Étape 5 — Invitations ── */
  inviteSection: {
    gap: Spacing.sm,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emailInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  addEmailBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  emailChipText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  inviteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  inviteInfoText: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
});
