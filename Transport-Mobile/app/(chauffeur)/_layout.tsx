import { Stack } from 'expo-router';

export default function ChauffeurLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#1e1b34' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700', fontSize: 16 },
        contentStyle: { backgroundColor: '#F0F4F8' },
      }}
    >
      <Stack.Screen name="index"    options={{ title: 'Mes livraisons', headerShown: false }} />
      <Stack.Screen name="livraison/[id]" options={{ title: 'Livraison', headerBackTitle: 'Retour' }} />
      <Stack.Screen name="scan"     options={{ title: 'Scanner article', presentation: 'modal' }} />
      <Stack.Screen name="navigation" options={{ headerShown: false }} />
      <Stack.Screen name="bl"       options={{ headerShown: false }} />
    </Stack>
  );
}
