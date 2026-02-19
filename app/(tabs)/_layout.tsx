import { Tabs } from 'expo-router';

import { TabBar } from '@/components/ui/TabBar';
import { HomeExpandProvider } from '@/contexts/HomeExpandContext';

export default function TabLayout() {
  return (
    <HomeExpandProvider>
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarStyle: { position: 'absolute', height: 0, borderTopWidth: 0 },
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="profile" />
      </Tabs>
    </HomeExpandProvider>
  );
}
