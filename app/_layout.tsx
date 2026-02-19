import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { Colors } from '@/constants/theme';

const hakoTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: Colors.background,
    card: Colors.white,
    text: Colors.textPrimary,
    border: Colors.border,
    primary: Colors.primary,
  },
};

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <ThemeProvider value={hakoTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
        <Stack.Screen
          name="trip/create"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="trip/[id]/dashboard"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="trip/[id]/envies"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="trip/[id]/planning"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="trip/[id]/map"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="trip/[id]/documents"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="trip/[id]/budget"
          options={{ headerShown: false }}
        />
      </Stack>
      <StatusBar style="dark" backgroundColor={Colors.background} />
    </ThemeProvider>
  );
}
