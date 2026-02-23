import React, { useEffect } from 'react';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

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

/* ─── Garde de navigation ────────────────────────────────────── */
function AuthGate() {
  const { user, loading } = useAuth();
  const segments          = useSegments();
  const router            = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuth = segments[0] === '(auth)';

    if (!user && !inAuth) {
      router.replace('/(auth)/login');
    } else if (user && inAuth) {
      router.replace('/(tabs)');
    }
  }, [user, loading]);

  return null;
}

/* ─── Root layout ────────────────────────────────────────────── */
export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProvider value={hakoTheme}>
        <AuthGate />
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
        <StatusBar style="dark" backgroundColor={Colors.background} />
      </ThemeProvider>
    </AuthProvider>
  );
}
