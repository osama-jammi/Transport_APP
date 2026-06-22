import { Stack } from 'expo-router';
import { COLORS } from '@/constants/theme';

export default function ChauffeurLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.brown },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700', fontSize: 16 },
        contentStyle: { backgroundColor: COLORS.bg },
      }}
    >
      <Stack.Screen name="index"    options={{ title: 'Mes voyages', headerShown: false }} />
      <Stack.Screen name="voyage/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="livraison/[id]" options={{ title: 'Livraison', headerBackTitle: 'Retour' }} />
      <Stack.Screen name="scan"     options={{ title: 'Scanner article', presentation: 'modal' }} />
      <Stack.Screen name="navigation" options={{ headerShown: false }} />
      <Stack.Screen name="bl"       options={{ headerShown: false }} />
    </Stack>
  );
}
