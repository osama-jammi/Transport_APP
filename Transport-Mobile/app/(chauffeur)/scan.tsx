import { useState } from 'react';
import {
  View, Text, StyleSheet, Alert, ActivityIndicator,
  TouchableOpacity, StatusBar, Vibration, TextInput, Modal,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import type { RootState } from '@/store';
import {
  scanArticle, getArticlesByVoyage, getMatieresDuVoyageConteneur, getLivraisonsDuVoyage,
  enregistrerBLManuelLivraison, mpEstChargee, mpEstLivree,
  type ArticleScan, type MatiereMp,
} from '@/services/livraisonService';
import { addArticleScanned } from '@/store/livraisonSlice';
import { sendCurrentPosition } from '@/services/gpsService';
import { COLORS } from '@/constants/theme';

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
async function feedbackSucces(nom: string | undefined, livraison: boolean) {
  Vibration.vibrate(250);
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status === 'granted') {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: livraison ? 'Article livré' : 'Article scanné',
          body: nom
            ? `${nom} ${livraison ? 'validé à la livraison' : 'validé au chargement'}`
            : (livraison ? 'Article validé à la livraison' : 'Article validé au chargement'),
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
  const { articleNom, articleQr, destination, voyageId, phase: phaseParam, vcId, projetCode } =
    useLocalSearchParams<{
      articleId?: string;
      articleNom?: string;
      articleQr?: string;
      destination?: string;
      voyageId?: string;
      phase?: string;
      vcId?: string;
      projetCode?: string;
    }>();

  // Phase de scan : CHARGEMENT (depart) ou LIVRAISON (a destination)
  const phase = phaseParam === 'LIVRAISON' ? 'LIVRAISON' : 'CHARGEMENT';
  const livraison = phase === 'LIVRAISON';

  const camionId = useSelector((s: RootState) => s.auth.chauffeur?.camionId);

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned,  setScanned]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState(false);
  const [saisieManuelle, setSaisieManuelle] = useState(false);
  const [blManuel, setBlManuel] = useState('');

  // Article/MP attendu : on part de celui passé en paramètre puis on bascule en mode
  // libre (undefined) après chaque scan réussi, pour enchaîner les scans suivants
  // SANS quitter l'écran (le chauffeur reste sur la page de scan).
  const [expectedQr,  setExpectedQr]  = useState<string | undefined>(articleQr);
  const [expectedNom, setExpectedNom] = useState<string | undefined>(articleNom);

  // Retour sur : evite l'erreur "GO_BACK was not handled" si la pile est vide
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(chauffeur)');
  };

  // Rester sur l'écran de scan pour enchaîner l'article / la MP suivant(e) (mode libre).
  const resterPourScanSuivant = () => {
    setExpectedQr(undefined);
    setExpectedNom(undefined);
    setSuccess(false);
    setScanned(false);
  };

  const confirmerBLManuel = async () => {
    if (!blManuel.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir une référence BL');
      return;
    }
    setSaisieManuelle(false);
    setLoading(true);
    try {
      if (voyageId) {
        await enregistrerBLManuelLivraison(Number(voyageId), blManuel);
        feedbackSucces('BL enregistré manuellement', livraison);
        setTimeout(() => { apresScanReussi(); }, 1400);
      }
    } catch (e: any) {
      feedbackErreur();
      Alert.alert('Erreur', 'Impossible d\'enregistrer le BL. Veuillez réessayer.');
      setLoading(false);
    }
  };

  // Apres un scan reussi : on n'enchaîne vers navigation / BL que si TOUT le chantier
  // (articles ET matières premières) est au bon statut. Sinon retour à l'écran ligne.
  const apresScanReussi = async () => {
    if (!voyageId) { resterPourScanSuivant(); return; }
    try {
      let arts: ArticleScan[] = [];
      let mps:  MatiereMp[]   = [];
      if (vcId) {
        // Contexte chantier : agréger les articles de tous les OF + les MP du chantier.
        const livs = await getLivraisonsDuVoyage(Number(vcId));
        const ofs  = projetCode ? livs.filter(l => (l.projetCode ?? null) === projetCode) : livs;
        const ofsEff = ofs.length > 0 ? ofs : livs.filter(l => l.id === Number(voyageId));
        arts = (await Promise.all(ofsEff.map(o => getArticlesByVoyage(o.id)))).flat();
        // MP du chantier de cette ligne uniquement (comparaison normalisée).
        const allMp = await getMatieresDuVoyageConteneur(Number(vcId));
        const norm = (s?: string | null) => (s || '').trim();
        mps = projetCode ? allMp.filter(m => norm(m.projet) === norm(projetCode)) : allMp;
      } else {
        arts = await getArticlesByVoyage(Number(voyageId));
      }

      const articlesRestants = livraison
        ? arts.filter(a => a.statutScan !== 'SCANNE_LIVRAISON').length
        : arts.filter(a => a.statutScan === 'NON_SCANNE').length;
      const mpRestantes = livraison
        ? mps.filter(m => !mpEstLivree(m.statut)).length
        : mps.filter(m => !mpEstChargee(m.statut)).length;

      // Voyage MP seul (aucun article/OF rattaché à cette ligne) : pas de BL.
      const mpSeul = arts.length === 0 && mps.length > 0;

      // Tout est chargé/livré → étape suivante ; sinon on revient finir les scans.
      if (articlesRestants === 0 && mpRestantes === 0) {
        if (livraison) {
          // Phase LIVRAISON : tout livré.
          if (mpSeul) {
            // MP seules → pas de bon de livraison : retour à la ligne (qui passe « terminée »).
            goBack();
          } else {
            router.replace({ pathname: '/(chauffeur)/bl', params: { voyageId: String(voyageId) } });
          }
        } else {
          // Phase CHARGEMENT : tout chargé → confirmer l'arrivée (geofence ou code de forçage).
          router.replace({
            pathname: '/(chauffeur)/navigation',
            params: { voyageId: String(voyageId), vcId: vcId ?? '', projetCode: projetCode ?? '' },
          });
        }
        return;
      }
    } catch {
      // Erreur réseau pendant la vérification : on reste sur l'écran pour réessayer.
    }
    // Il reste des articles / MP à scanner → on RESTE sur la page pour enchaîner
    // (au lieu de revenir à la liste des voyages).
    resterPourScanSuivant();
  };

  const handleScan = async ({ data }: { data: string }) => {
    if (scanned || loading) return;

    // QR d'un voyage entier : accepte directement (le backend scanne toutes les lignes)
    const estQrVoyage = typeof data === 'string' && data.startsWith('VOYAGE:');
    // Si on attendait un article precis, verifier la correspondance (sauf QR voyage)
    if (!estQrVoyage && expectedQr && data !== expectedQr) {
      // Gele immediatement la camera pour eviter les scans/alertes en rafale
      setScanned(true);
      feedbackErreur();
      Alert.alert(
        'Mauvais article',
        `Le QR scanne ne correspond pas a "${expectedNom}".\nVeuillez scanner le bon code.`,
        [{ text: 'OK', onPress: () => setScanned(false) }],
      );
      return;
    }

    setScanned(true);
    setLoading(true);
    try {
      const article = await scanArticle(data, phase);
      dispatch(addArticleScanned(article));
      setSuccess(true);
      // Enregistre la position du chauffeur au moment du scan, liée au voyage
      sendCurrentPosition(camionId ?? undefined, voyageId ? Number(voyageId) : undefined)
        .catch(() => { /* non bloquant */ });
      await feedbackSucces(article?.nom ?? expectedNom, livraison);
      setTimeout(() => { apresScanReussi(); }, 1400);
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
        <ActivityIndicator color={COLORS.gold} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Ionicons name="camera-outline" size={56} color={COLORS.textFaint} />
        <Text style={styles.permTxt}>Acces camera requis</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnTxt}>Autoriser l'acces</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const accent = livraison ? COLORS.success : COLORS.gold;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.brownDeep} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.closeBtn} onPress={goBack}>
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{livraison ? 'Scanner la livraison' : 'Scanner le chargement'}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Badge de phase */}
      <View style={[styles.phaseBadge, { backgroundColor: accent + '26', borderColor: accent }]}>
        <Ionicons name={livraison ? 'checkmark-done-outline' : 'cube-outline'} size={14} color={accent} />
        <Text style={[styles.phaseBadgeTxt, { color: accent }]}>
          {livraison ? 'Phase livraison — à destination' : 'Phase chargement — au départ'}
        </Text>
      </View>

      {/* Article info chip */}
      {expectedNom ? (
        <View style={styles.articleChip}>
          <Ionicons name="cube-outline" size={16} color={COLORS.gold} />
          <View style={{ flex: 1 }}>
            <Text style={styles.chipNom} numberOfLines={1}>{expectedNom}</Text>
            {destination ? (
              <Text style={styles.chipDest} numberOfLines={1}>
                <Ionicons name="location-outline" size={11} color={COLORS.textFaint} /> {destination}
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
          <View style={[styles.corner, { borderColor: accent }]} />
          <View style={[styles.corner, styles.cornerTR, { borderColor: accent }]} />
          <View style={[styles.corner, styles.cornerBL, { borderColor: accent }]} />
          <View style={[styles.corner, styles.cornerBR, { borderColor: accent }]} />
        </View>

        {/* Loading / success overlay */}
        {loading && (
          <View style={styles.scanOverlay}>
            <ActivityIndicator size="large" color={accent} />
            <Text style={styles.scanOverlayTxt}>Verification...</Text>
          </View>
        )}
        {success && (
          <View style={[styles.scanOverlay, { backgroundColor: 'rgba(31,157,85,.88)' }]}>
            <Ionicons name="checkmark-circle" size={56} color="#fff" />
            <Text style={styles.scanOverlayTxt}>{livraison ? 'Article livré !' : 'Article validé !'}</Text>
          </View>
        )}
      </View>

      {/* Bottom hint */}
      <View style={styles.hint}>
        <Text style={styles.hintTxt}>
          {expectedNom
            ? `Pointez le QR code de "${expectedNom}"`
            : "Pointez le QR d'un article — ou le QR du voyage pour tout valider"}
        </Text>
        {scanned && !success && !loading && (
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: accent }]} onPress={() => setScanned(false)}>
            <Ionicons name="refresh-outline" size={16} color={livraison ? '#fff' : COLORS.brown} />
            <Text style={[styles.retryTxt, !livraison && { color: COLORS.brown }]}>Scanner a nouveau</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.manualBtn} onPress={() => setSaisieManuelle(true)}>
          <Ionicons name="document-text-outline" size={14} color={COLORS.brown} />
          <Text style={styles.manualBtnTxt}>QR illisible ? Saisir manuellement</Text>
        </TouchableOpacity>
      </View>

      {/* Modal saisie manuelle BL */}
      <Modal visible={saisieManuelle} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Saisir le BL manuellement</Text>
            <Text style={styles.modalSubtitle}>Référence du bon de livraison</Text>
            <TextInput
              style={styles.modalInput}
              value={blManuel}
              onChangeText={setBlManuel}
              placeholder="Ex: BL-2024-001"
              placeholderTextColor={COLORS.textFaint}
              autoCapitalize="characters"
              editable={!loading}
            />
            <View style={styles.modalBtnGroup}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => { setSaisieManuelle(false); setBlManuel(''); }}
                disabled={loading}>
                <Text style={styles.modalBtnTxtCancel}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnConfirm]}
                onPress={confirmerBLManuel}
                disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnTxtConfirm}>Confirmer</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.brownDeep },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: COLORS.brownDeep },

  topBar:         {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 50, paddingHorizontal: 16, paddingBottom: 12,
  },
  closeBtn:       {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  topTitle:       { color: '#fff', fontSize: 16, fontWeight: '700' },

  phaseBadge:     {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
    marginBottom: 12,
  },
  phaseBadgeTxt:  { fontSize: 12, fontWeight: '700' },

  articleChip:    {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,.1)',
    borderRadius: 12, padding: 12,
  },
  chipNom:        { color: '#fff', fontWeight: '700', fontSize: 14 },
  chipDest:       { color: COLORS.textFaint, fontSize: 12, marginTop: 2 },

  cameraWrap:     { flex: 1, marginHorizontal: 16, borderRadius: 20, overflow: 'hidden', position: 'relative' },

  overlay:        { ...StyleSheet.absoluteFillObject, pointerEvents: 'none' },
  corner:         {
    position: 'absolute', width: 36, height: 36,
    borderTopWidth: 3, borderLeftWidth: 3,
    top: 16, left: 16, borderRadius: 4,
  },
  cornerTR:       { left: undefined, right: 16, borderLeftWidth: 0, borderRightWidth: 3 },
  cornerBL:       { top: undefined, bottom: 16, borderTopWidth: 0, borderBottomWidth: 3 },
  cornerBR:       { top: undefined, bottom: 16, left: undefined, right: 16, borderTopWidth: 0, borderLeftWidth: 0, borderBottomWidth: 3, borderRightWidth: 3 },

  scanOverlay:    {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(42,24,14,.82)',
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  scanOverlayTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },

  hint:           {
    paddingVertical: 20, paddingHorizontal: 24,
    alignItems: 'center', gap: 12,
  },
  hintTxt:        { color: 'rgba(255,255,255,.6)', fontSize: 13, textAlign: 'center' },
  retryBtn:       {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20,
  },
  retryTxt:       { color: '#fff', fontWeight: '700', fontSize: 13 },

  permTxt:        { color: COLORS.textFaint, fontSize: 15, fontWeight: '600' },
  permBtn:        {
    backgroundColor: COLORS.gold, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24,
  },
  permBtnTxt:     { color: COLORS.brown, fontWeight: '700', fontSize: 15 },

  manualBtn:      {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,.12)',
  },
  manualBtnTxt:   { color: COLORS.gold, fontWeight: '600', fontSize: 12 },

  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,.7)', alignItems: 'center', justifyContent: 'center' },
  modalContent:   {
    backgroundColor: COLORS.card, borderRadius: 16, padding: 24, width: '85%',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  modalTitle:     { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  modalSubtitle:  { fontSize: 12, color: COLORS.textSub, marginBottom: 16 },
  modalInput:     {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: COLORS.text,
    marginBottom: 20, backgroundColor: 'rgba(255,255,255,.05)',
  },
  modalBtnGroup:  { flexDirection: 'row', gap: 10 },
  modalBtn:       { flex: 1, paddingVertical: 11, borderRadius: 8, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: COLORS.textFaint + '20' },
  modalBtnConfirm: { backgroundColor: COLORS.gold },
  modalBtnTxtCancel: { color: COLORS.text, fontWeight: '600', fontSize: 13 },
  modalBtnTxtConfirm: { color: COLORS.brown, fontWeight: '700', fontSize: 13 },
});
