import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Colors } from '@/constants/theme';
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
  const segments = useSegments();
  const router   = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      // Pas connecté → login
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      // Connecté mais sur la page login → accueil
      router.replace('/(tabs)');
    }
  }, [session, loading, segments]);

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
      <Stack.Screen name="trip/[id]/budget"    options={{ headerShown: false }} />
    </Stack>
  );
}

/* ─── Root layout ────────────────────────────────────────────── */
export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ThemeProvider value={hakoTheme}>
          <AuthGate />
          <StatusBar style="dark" backgroundColor={Colors.background} />
        </ThemeProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
