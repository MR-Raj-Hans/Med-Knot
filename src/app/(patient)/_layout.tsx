import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { useSessionStore } from '@/store/sessionStore';
import { colors } from '@/theme/tokens';

export default function PatientTabsLayout() {
  const authReady = useSessionStore((state) => state.authReady);

  if (!authReady) return <View style={{ flex: 1, backgroundColor: colors.canvas }} />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          height: 78,
          paddingTop: 8,
          paddingBottom: 9,
          borderTopColor: colors.line,
          backgroundColor: '#FFFFFF',
          elevation: 12,
        },
        tabBarLabelStyle: { fontSize: 10, lineHeight: 14, fontWeight: '600' },
        tabBarItemStyle: { paddingTop: 1 },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Feather name="home" size={size} color={String(color)} /> }} />
      <Tabs.Screen name="appointments" options={{ title: 'Bookings', tabBarIcon: ({ color, size }) => <Feather name="calendar" size={size} color={String(color)} /> }} />
      <Tabs.Screen name="ai-health" options={{ title: 'AI Health', tabBarIcon: ({ color, size }) => <Feather name="activity" size={size} color={String(color)} /> }} />
      <Tabs.Screen name="health" options={{ title: 'My Health', tabBarIcon: ({ color, size }) => <Feather name="heart" size={size} color={String(color)} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={String(color)} /> }} />
      <Tabs.Screen name="hospitals" options={{ href: null }} />
    </Tabs>
  );
}
