import { Stack } from 'expo-router';
import { COLORS } from '@/constants/theme';

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.brown },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700', fontSize: 16 },
        contentStyle: { backgroundColor: COLORS.bg },
      }}
    >
      <Stack.Screen name="index"      options={{ headerShown: false }} />
      <Stack.Screen name="chauffeurs" options={{ title: 'Suivi des chauffeurs' }} />
      <Stack.Screen name="voyages"    options={{ title: 'Voyages' }} />
      <Stack.Screen name="depots"     options={{ title: 'Dépôts' }} />
      <Stack.Screen name="analyses"   options={{ title: 'Analyses' }} />
    </Stack>
  );
}
