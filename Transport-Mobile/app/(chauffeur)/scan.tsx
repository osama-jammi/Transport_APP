import { useState } from 'react';
import {
  View, Text, StyleSheet, Alert, ActivityIndicator,
  TouchableOpacity, StatusBar, Vibration,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import type { RootState } from '@/store';
import { scanArticle, getArticlesByVoyage } from '@/services/livraisonService';
import { addArticleScanned } from '@/store/livraisonSlice';
import { sendCurrentPosition } from '@/services/gpsService';

// Affiche la notification meme lorsque l'app est au premier plan
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Vibration + notification locale a la fin d'un scan reussi
async function feedbackSucces(nom?: string) {
  Vibration.vibrate(250);
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status === 'granted') {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Article scanne',
          body: nom ? `${nom} valide au chargement` : 'Article valide au chargement',
          sound: true,
        },
        trigger: null,
      });
    }
  } catch {
    // notifications indisponibles (ex. Expo Go) : la vibration suffit
  }
}

// Vibration d'echec (double buzz)
function feedbackErreur() {
  Vibration.vibrate([0, 120, 90, 120]);
}

export default function ScanArticleScreen() {
  const router   = useRouter();
  const dispatch = useDispatch();
  const { articleNom, articleQr, destination, voyageId } =
    useLocalSearchParams<{
      articleId?: string;
      articleNom?: string;
      articleQr?: string;
      destination?: string;
      voyageId?: string;
    }>();

  const camionId = useSelector((s: RootState) => s.auth.chauffeur?.camionId);

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned,  setScanned]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState(false);

  // Retour sur : evite l'erreur "GO_BACK was not handled" si la pile est vide
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(chauffeur)');
  };

  // Apres un scan reussi : s'il reste des articles a scanner, on revient a la liste
  // (qui se rafraichit) ; si c'etait le dernier, on passe a la navigation (direction
  // vers la localisation du chantier).
  const apresScanReussi = async () => {
    if (!voyageId) { goBack(); return; }
    try {
      const arts = await getArticlesByVoyage(Number(voyageId));
      const reste = arts.filter(a => a.statutScan === 'NON_SCANNE').length;
      if (reste === 0) {
        router.replace({ pathname: '/(chauffeur)/navigation', params: { voyageId: String(voyageId) } });
        return;
      }
    } catch {
      // en cas d'echec de verification, on retombe sur le retour liste
    }
    goBack();
  };

  const handleScan = async ({ data }: { data: string }) => {
    if (scanned || loading) return;

    // QR d'un voyage entier : accepte directement (le backend scanne toutes les lignes)
    const estQrVoyage = typeof data === 'string' && data.startsWith('VOYAGE:');
    // Si on attendait un article precis, verifier la correspondance (sauf QR voyage)
    if (!estQrVoyage && articleQr && data !== articleQr) {
      feedbackErreur();
      Alert.alert(
        'Mauvais article',
        `Le QR scanne ne correspond pas a "${articleNom}".\nVeuillez scanner le bon code.`,
        [{ text: 'OK', onPress: () => setScanned(false) }],
      );
      return;
    }

    setScanned(true);
    setLoading(true);
    try {
      const article = await scanArticle(data, 'CHARGEMENT');
      dispatch(addArticleScanned(article));
      setSuccess(true);
      // Enregistre la position du chauffeur au moment du scan, liée au voyage
      sendCurrentPosition(camionId ?? undefined, voyageId ? Number(voyageId) : undefined)
        .catch(() => { /* non bloquant */ });
      await feedbackSucces(article?.nom ?? articleNom);
      setTimeout(() => { apresScanReussi(); }, 1500);
    } catch (e: any) {
      feedbackErreur();
      const status = e?.response?.status;
      const serveur = e?.response?.data?.message || e?.response?.data?.error;
      let msg: string;
      if (status === 404 || /introuvable/i.test(serveur || '')) {
        msg = `Ce QR ne correspond a aucun article enregistre.\n\nQR lu : ${data}`;
      } else if (!e?.response) {
        msg = 'Backend injoignable. Verifiez la connexion au serveur.';
      } else {
        msg = serveur ? `Erreur serveur : ${serveur}` : `Erreur (${status ?? '?'}).`;
      }
      Alert.alert('Scan refuse', msg, [
        { text: 'Reessayer', onPress: () => { setScanned(false); } },
        { text: 'Retour',    onPress: goBack },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#8b7bff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Ionicons name="camera-outline" size={56} color="#CBD5E1" />
        <Text style={styles.permTxt}>Acces camera requis</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnTxt}>Autoriser l'acces</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F1B2D" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.closeBtn} onPress={goBack}>
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Scanner l'article</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Article info chip */}
      {articleNom ? (
        <View style={styles.articleChip}>
          <Ionicons name="cube-outline" size={16} color="#8b7bff" />
          <View style={{ flex: 1 }}>
            <Text style={styles.chipNom} numberOfLines={1}>{articleNom}</Text>
            {destination ? (
              <Text style={styles.chipDest} numberOfLines={1}>
                <Ionicons name="location-outline" size={11} color="#64748B" /> {destination}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Camera viewfinder */}
      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleScan}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        />

        {/* Overlay corners */}
        <View style={styles.overlay}>
          <View style={styles.corner} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>

        {/* Loading / success overlay */}
        {loading && (
          <View style={styles.scanOverlay}>
            <ActivityIndicator size="large" color="#8b7bff" />
            <Text style={styles.scanOverlayTxt}>Verification...</Text>
          </View>
        )}
        {success && (
          <View style={[styles.scanOverlay, { backgroundColor: 'rgba(16,185,129,.85)' }]}>
            <Ionicons name="checkmark-circle" size={56} color="#fff" />
            <Text style={styles.scanOverlayTxt}>Article valide !</Text>
          </View>
        )}
      </View>

      {/* Bottom hint */}
      <View style={styles.hint}>
        <Text style={styles.hintTxt}>
          {articleNom
            ? `Pointez le QR code de "${articleNom}"`
            : "Pointez le QR code de l'article"}
        </Text>
        {scanned && !success && !loading && (
          <TouchableOpacity style={styles.retryBtn} onPress={() => setScanned(false)}>
            <Ionicons name="refresh-outline" size={16} color="#fff" />
            <Text style={styles.retryTxt}>Scanner a nouveau</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#0F1B2D' },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: '#0F1B2D' },

  topBar:         {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12,
  },
  closeBtn:       {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  topTitle:       { color: '#fff', fontSize: 16, fontWeight: '700' },

  articleChip:    {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,.08)',
    borderRadius: 12, padding: 12,
  },
  chipNom:        { color: '#fff', fontWeight: '700', fontSize: 14 },
  chipDest:       { color: '#94A3B8', fontSize: 12, marginTop: 2 },

  cameraWrap:     { flex: 1, marginHorizontal: 16, borderRadius: 20, overflow: 'hidden', position: 'relative' },

  overlay:        { ...StyleSheet.absoluteFillObject, pointerEvents: 'none' },
  corner:         {
    position: 'absolute', width: 36, height: 36,
    borderColor: '#8b7bff', borderTopWidth: 3, borderLeftWidth: 3,
    top: 16, left: 16, borderRadius: 4,
  },
  cornerTR:       { left: undefined, right: 16, borderLeftWidth: 0, borderRightWidth: 3 },
  cornerBL:       { top: undefined, bottom: 16, borderTopWidth: 0, borderBottomWidth: 3 },
  cornerBR:       { top: undefined, bottom: 16, left: undefined, right: 16, borderTopWidth: 0, borderLeftWidth: 0, borderBottomWidth: 3, borderRightWidth: 3 },

  scanOverlay:    {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,27,45,.8)',
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  scanOverlayTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },

  hint:           {
    paddingVertical: 20, paddingHorizontal: 24,
    alignItems: 'center', gap: 12,
  },
  hintTxt:        { color: 'rgba(255,255,255,.55)', fontSize: 13, textAlign: 'center' },
  retryBtn:       {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#8b7bff', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
  },
  retryTxt:       { color: '#fff', fontWeight: '700', fontSize: 13 },

  permTxt:        { color: '#94A3B8', fontSize: 15, fontWeight: '600' },
  permBtn:        {
    backgroundColor: '#8b7bff', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24,
  },
  permBtnTxt:     { color: '#fff', fontWeight: '700', fontSize: 15 },
});
