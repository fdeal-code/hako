import { takePendingInvite } from '@/utils/pendingInvite';
import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { ErrorBoundaryProps, Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useFonts,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from '@expo-google-fonts/bricolage-grotesque';

import Constants, { ExecutionEnvironment } from 'expo-constants';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';

import { Colors, Radii, Spacing, Typography } from '@/constants/theme';
import { installTelemetry, reportError, track } from '@/services/telemetryService';
import { routeName } from '@/utils/telemetry';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

const hakoTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: Colors.background,
    card:        Colors.white,
    text:        Colors.textPrimary,
    border:      Colors.border,
    primary:     Colors.primary,
  },
};

/* ─── AuthGate — redirige selon l'état de connexion ─────────── */
function AuthGate() {
  const { session, loading } = useAuth();
  const { hasShareIntent } = useShareIntentContext();
  const segments = useSegments();
  const router   = useRouter();

  // Mesure d'usage : une ouverture par lancement (une fois connecté), puis
  // chaque écran vu (sans identifiant : « /trip/[id]/envies »)
  const opened = useRef(false);
  const route = routeName(segments);
  useEffect(() => {
    if (!session) return;
    if (!opened.current) { opened.current = true; track('app_open'); }
    track('screen_view', { route });
  }, [session, route]);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    // Lien d'invitation : l'aperçu du voyage est visible sans compte
    const inJoinFlow  = segments[0] === 'join';
    // Lien « Mot de passe oublié » : la session s'ouvre sur cette page même
    const inPasswordReset = segments[0] === 'reset-password';

    if (!session && !inAuthGroup && !inJoinFlow && !inPasswordReset) {
      // Pas connecté → login
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      // Connecté : retour au partage ou à l'invitation en attente, sinon accueil
      if (hasShareIntent) { router.replace('/share'); return; }
      void takePendingInvite().then(token => {
        router.replace(token ? `/join/${token}` : '/(tabs)');
      });
    }
  }, [session, loading, segments, hasShareIntent]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)"          options={{ headerShown: false }} />
      <Stack.Screen name="(auth)/login"    options={{ headerShown: false }} />
      <Stack.Screen
        name="trip/create"
        options={{ presentation: 'modal', headerShown: false }}
      />
      <Stack.Screen name="trip/[id]/dashboard" options={{ headerShown: false }} />
      <Stack.Screen name="trip/[id]/envies"    options={{ headerShown: false }} />
      <Stack.Screen name="trip/[id]/planning"  options={{ headerShown: false }} />
      <Stack.Screen name="trip/[id]/map"       options={{ headerShown: false }} />
      <Stack.Screen name="trip/[id]/documents" options={{ headerShown: false }} />
      <Stack.Screen name="trip/[id]/budget"          options={{ headerShown: false }} />
      <Stack.Screen name="trip/[id]/planning-detail" options={{ headerShown: false }} />
      <Stack.Screen name="trip/[id]/help"            options={{ headerShown: false }} />
      <Stack.Screen name="trip/[id]/itinerary"       options={{ headerShown: false }} />
      <Stack.Screen name="trip/[id]/document/new"     options={{ headerShown: false }} />
      <Stack.Screen name="trip/[id]/wish/new"         options={{ headerShown: false }} />
      <Stack.Screen name="trip/[id]/recap"            options={{ headerShown: false }} />
      <Stack.Screen name="trip/[id]/plan-add"         options={{ headerShown: false }} />
      <Stack.Screen name="trip/[id]/expense/new"      options={{ headerShown: false }} />
      <Stack.Screen name="trip/[id]/invite"           options={{ headerShown: false }} />
      <Stack.Screen name="trip/[id]/envies-filters"   options={{ headerShown: false }} />
      <Stack.Screen name="trip/[id]/preparation"      options={{ headerShown: false }} />
      <Stack.Screen name="trip/[id]/import"           options={{ headerShown: false }} />
      <Stack.Screen name="trip/[id]/past-photos"      options={{ headerShown: false }} />
      <Stack.Screen name="trip/[id]/past-avis"        options={{ headerShown: false }} />
      <Stack.Screen name="trip/[id]/print-album"      options={{ headerShown: false }} />
      <Stack.Screen name="trip/[id]/balance"          options={{ headerShown: false }} />
      <Stack.Screen name="trip/[id]/settings"         options={{ headerShown: false }} />
      <Stack.Screen name="trip/[id]/add"              options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      <Stack.Screen name="trip/[id]/document/[docId]" options={{ headerShown: false }} />
      <Stack.Screen name="join/[token]"              options={{ headerShown: false }} />
      <Stack.Screen name="settings/notifications"    options={{ headerShown: false }} />
      <Stack.Screen name="account/edit"              options={{ headerShown: false }} />
      <Stack.Screen name="account/add-friend"        options={{ headerShown: false }} />
      <Stack.Screen name="notifications"             options={{ headerShown: false }} />
      <Stack.Screen name="reset-password"            options={{ headerShown: false }} />
      <Stack.Screen name="share"                     options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      <Stack.Screen
        name="match/create"
        options={{ presentation: 'modal', headerShown: false }}
      />
      <Stack.Screen name="match/[id]/questionnaire"  options={{ headerShown: false }} />
      <Stack.Screen name="match/[id]/waiting"        options={{ headerShown: false }} />
      <Stack.Screen name="match/[id]/reveal"         options={{ headerShown: false }} />
      <Stack.Screen name="match/[id]/proposals"      options={{ headerShown: false }} />
    </Stack>
  );
}

/* ─── Root layout ────────────────────────────────────────────── */
export const unstable_settings = {
  anchor: '(tabs)',
};

installTelemetry(); // erreurs non rattrapées + envoi des événements en arrière-plan

/* ─── Écran d'erreur (remplace l'écran rouge) : signale le plantage ───── */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => { void reportError(error, { fatal: true }); }, [error]);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl, backgroundColor: Colors.background }}>
      <Text style={{ ...Typography.displayTitle, color: Colors.textPrimary, textAlign: 'center' }}>Oups…</Text>
      <Text style={{ ...Typography.body, color: Colors.textMuted, textAlign: 'center' }}>
        Quelque chose s’est mal passé. On a prévenu l’équipe, tu peux réessayer.
      </Text>
      <TouchableOpacity
        onPress={() => { void retry(); }}
        style={{ paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: Radii.full, backgroundColor: Colors.accent }}
        accessibilityRole="button"
      >
        <Text style={{ ...Typography.button, color: Colors.white }}>Réessayer</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function RootLayout() {
  // Titres des maquettes V2 (Fonts.display / Fonts.displayBold dans constants/theme)
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
  });

  // En cas d'échec de chargement, on continue avec la police système
  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    // Partage depuis TikTok / Instagram : inactif dans Expo Go (module natif absent)
    <ShareIntentProvider options={{ disabled: Constants.executionEnvironment === ExecutionEnvironment.StoreClient }}>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ThemeProvider value={hakoTheme}>
          <AuthGate />
          <StatusBar style="dark" />
        </ThemeProvider>
      </AuthProvider>
    </GestureHandlerRootView>
    </ShareIntentProvider>
  );
}
