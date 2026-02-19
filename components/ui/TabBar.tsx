import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { NavButton } from './NavButton';

/* ─── Config des onglets ─────────────────────────────────────── */
const TABS = {
  index: {
    icon:         'home'         as const,
    iconOutline:  'home-outline' as const,
    label:        'Home',
  },
  profile: {
    icon:         'person'         as const,
    iconOutline:  'person-outline' as const,
    label:        'Profil',
  },
};

/* ─── Composant ─────────────────────────────────────────────── */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets     = useSafeAreaInsets();
  const activeRoute = state.routes[state.index].name;

  const navigate = (routeName: string) => {
    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (activeRoute !== routeName) navigation.navigate(routeName);
  };

  const openCreate = () => {
    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/trip/create');
  };

  return (
    <View
      style={[styles.wrapper, { bottom: Math.max(insets.bottom, 10) + 16 }]}
      pointerEvents="box-none"
    >
      <View style={styles.row}>

        {/* ── Home ── */}
        <NavButton
          icon={activeRoute === 'index' ? TABS.index.icon : TABS.index.iconOutline}
          label={activeRoute === 'index' ? TABS.index.label : undefined}
          onPress={() => navigate('index')}
        />

        {/* ── Profil (4px après Home) ── */}
        <NavButton
          icon={activeRoute === 'profile' ? TABS.profile.icon : TABS.profile.iconOutline}
          label={activeRoute === 'profile' ? TABS.profile.label : undefined}
          onPress={() => navigate('profile')}
          style={{ marginLeft: 4 }}
        />

        {/* ── Créer un voyage (16px après Profil) ── */}
        <NavButton
          icon="add"
          iconSize={28}
          onPress={openCreate}
          style={{ marginLeft: 16 }}
        />

      </View>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  /* Flottant : ne prend aucun espace dans le layout */
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
