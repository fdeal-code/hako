import { Tabs } from 'expo-router';

import { TabBar } from '@/components/ui/TabBar';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // La pill flotte en absolute — on supprime la réservation d'espace
        tabBarStyle: { position: 'absolute', height: 0, borderTopWidth: 0 },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
