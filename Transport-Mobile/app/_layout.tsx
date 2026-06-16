import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { Provider } from 'react-redux';
import { store } from '@/store';
import { getStoredChauffeur } from '@/services/authService';
import { setChauffeur } from '@/store/authSlice';
import { useRouter } from 'expo-router';

function RootNavigator() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const chauffeur = await getStoredChauffeur();
        if (chauffeur) {
          store.dispatch(setChauffeur(chauffeur));
          router.replace('/(chauffeur)');
        } else {
          router.replace('/(auth)');
        }
      } catch {
        router.replace('/(auth)');
      }
    })();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(chauffeur)" />
      <Stack.Screen name="(superviseur)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <Provider store={store}>
      <RootNavigator />
    </Provider>
  );
}
