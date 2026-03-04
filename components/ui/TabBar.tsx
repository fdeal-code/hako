import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, interpolate } from 'react-native-reanimated';

import { NavButton } from './NavButton';
import { useHomeExpand } from '@/contexts/HomeExpandContext';

/* ─── Config des onglets ─────────────────────────────────────── */
const TABS = {
  index:   { icon: 'home'   as const, iconOutline: 'home-outline'   as const, label: 'Home'  },
  profile: { icon: 'person' as const, iconOutline: 'person-outline' as const, label: 'Profil' },
};

/* ─── Composant ─────────────────────────────────────────────── */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets      = useSafeAreaInsets();
  const activeRoute = state.routes[state.index].name;
  const isHome      = activeRoute === 'index';

  const { expandProgress } = useHomeExpand();

  /* ── Home nav se cache quand le Dashboard s'ouvre ── */
  const homeRowStyle = useAnimatedStyle(() => {
    'worklet';
    if (!isHome) return { opacity: 1 };
    return { opacity: interpolate(expandProgress.value, [0, 0.35], [1, 0], 'clamp') };
  });

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
      {/*
       * navContainer : auto-dimensionné par la nav Home (référence de taille).
       * La nav Dashboard est en absoluteFill pour occuper exactement le même espace,
       * ce qui garantit un alignement parfait des boutons gauche/droite.
       */}
      <View style={styles.navContainer}>

        {/* ── Nav Home : [Home pill] [Profil] [+] ── */}
        <Animated.View style={[styles.row, homeRowStyle]} pointerEvents="box-none">
          <NavButton
            icon={activeRoute === 'index' ? TABS.index.icon : TABS.index.iconOutline}
            label={activeRoute === 'index' ? TABS.index.label : undefined}
            onPress={() => navigate('index')}
          />
          <NavButton
            icon={activeRoute === 'profile' ? TABS.profile.icon : TABS.profile.iconOutline}
            label={activeRoute === 'profile' ? TABS.profile.label : undefined}
            onPress={() => navigate('profile')}
            style={{ marginLeft: 4 }}
          />
          <NavButton
            icon="add"
            iconSize={28}
            onPress={openCreate}
            style={{ marginLeft: 16 }}
          />
        </Animated.View>


      </View>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  /* Conteneur commun aux deux navs : auto-taille sur la nav Home */
  navContainer: {
    position: 'relative',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
