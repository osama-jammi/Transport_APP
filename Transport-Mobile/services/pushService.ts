import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { registerPushToken } from './authService';

/**
 * Enregistre le téléphone du chauffeur pour les notifications push distantes.
 * NB : les push distants ne fonctionnent PAS dans Expo Go (SDK 53+).
 * Il faut un "development build" / build standalone pour les recevoir.
 */
export async function enregistrerPush(chauffeurId: number): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Voyages',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 400, 200, 400],
        sound: 'default',
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;

    const projectId =
      (Constants as any)?.expoConfig?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId;

    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    if (tokenResp?.data) {
      await registerPushToken(chauffeurId, tokenResp.data);
    }
  } catch (e) {
    // Expo Go ou projectId manquant : on ignore (le polling foreground prend le relais)
    console.warn('[Push] Enregistrement du jeton impossible :', (e as Error)?.message);
  }
}
