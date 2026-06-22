import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView,
  Linking, Platform, Modal, TextInput, StatusBar, ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import { useSelector } from 'react-redux';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { RootState } from '@/store';
import { confirmerArrivee } from '@/services/livraisonService';
import { COLORS } from '@/constants/theme';

function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) * Math.cos((b.latitude * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export default function NavigationScreen() {
  const router = useRouter();
  const { voyageId } = useLocalSearchParams<{ voyageId?: string }>();
  const voyages = useSelector((s: RootState) => s.livraison.voyages);
  const voyage = voyages.find(v => v.id === Number(voyageId)) ?? voyages[0] ?? null;

  const dest = voyage && voyage.destinationLat != null && voyage.destinationLng != null
    ? { latitude: voyage.destinationLat, longitude: voyage.destinationLng }
    : null;
  const rayon = voyage?.destinationRayon ?? 100;

  const [pos, setPos] = useState<{ latitude: number; longitude: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [forceOpen, setForceOpen] = useState(false);
  const [forceCode, setForceCode] = useState('');

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 4000, distanceInterval: 5 },
        (loc) => {
          const p = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setPos(p);
          if (dest) setDistance(Math.round(distanceMeters(p, dest)));
        },
      );
    })();
    return () => { sub?.remove(); };
  }, [voyage?.id]);

  const dansZone = distance != null && distance <= rayon;
  // Voyage deja livre : on n'autorise plus une nouvelle confirmation / BL.
  const dejaLivre = voyage?.etatDechargement === 'TERMINE';

  const ouvrirItineraire = () => {
    if (!dest) { Alert.alert('Destination inconnue', 'Ce voyage n a pas de chantier geolocalise.'); return; }
    const url = Platform.select({
      ios: `http://maps.apple.com/?daddr=${dest.latitude},${dest.longitude}&dirflg=d`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${dest.latitude},${dest.longitude}&travelmode=driving`,
    })!;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest.latitude},${dest.longitude}`));
  };

  const confirmer = async (force = false, code?: string) => {
    if (!voyage) return;
    if (dejaLivre) {
      Alert.alert('Voyage deja livre', 'Ce voyage est deja livre : le bon de livraison a deja ete enregistre.');
      return;
    }
    setBusy(true);
    try {
      const res = await confirmerArrivee(voyage.id, {
        latitude: pos?.latitude,
        longitude: pos?.longitude,
        force,
        forceCode: code,
      });
      if (res.confirmed) {
        setForceOpen(false);
        Alert.alert('Arrivee confirmee', res.message + '\n\nScannez maintenant les articles livres.', [
          {
            text: 'Scanner la livraison',
            onPress: () => router.replace({ pathname: '/(chauffeur)/livraison/[id]', params: { id: String(voyage.id) } }),
          },
        ]);
      } else if (res.forcageRequis) {
        setForceOpen(true);
      } else {
        Alert.alert('Arrivee refusee', res.message);
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de confirmer l arrivee (serveur injoignable ?).');
    } finally {
      setBusy(false);
    }
  };

  const validerForce = () => {
    if (!forceCode.trim()) { Alert.alert('Code requis', 'Saisissez le code de forcage.'); return; }
    confirmer(true, forceCode.trim());
  };

  const fmt = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.brownDeep} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.hBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(chauffeur)'))}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.hTitle}>Navigation & arrivee</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* Destination */}
        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="location" size={26} color="#ef4444" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.label}>Destination</Text>
              <Text style={styles.destName}>{voyage?.destinationNom || voyage?.client || 'Chantier'}</Text>
              {dest ? (
                <Text style={styles.coords}>{dest.latitude.toFixed(5)}, {dest.longitude.toFixed(5)} - zone {rayon} m</Text>
              ) : (
                <Text style={styles.warn}>Chantier non geolocalise</Text>
              )}
            </View>
          </View>
          <TouchableOpacity style={styles.dirBtn} onPress={ouvrirItineraire}>
            <Ionicons name="navigate" size={18} color="#fff" />
            <Text style={styles.dirTxt}>Ouvrir l'itineraire</Text>
          </TouchableOpacity>
        </View>

        {/* Distance */}
        <View style={[styles.card, dansZone ? styles.cardGreen : styles.cardDark]}>
          <Text style={[styles.label, { color: 'rgba(255,255,255,.75)' }]}>Distance au chantier</Text>
          <Text style={styles.distVal}>{distance != null ? fmt(distance) : '—'}</Text>
          <Text style={styles.distSub}>
            {!pos ? 'Acquisition GPS...' : dansZone ? 'Vous etes dans la zone' : 'Hors de la zone'}
          </Text>
        </View>

        {dejaLivre ? (
          /* Voyage deja livre : aucune action de confirmation possible */
          <View style={[styles.card, styles.cardGreen]}>
            <View style={styles.row}>
              <Ionicons name="checkmark-done-circle" size={26} color="#fff" />
              <Text style={[styles.bigBtnTxt, { marginLeft: 10 }]}>Voyage deja livre</Text>
            </View>
            <Text style={[styles.distSub, { marginTop: 6 }]}>
              Le bon de livraison a deja ete enregistre. Aucune nouvelle confirmation n'est necessaire.
            </Text>
          </View>
        ) : (
          <>
            {/* Bouton je suis sur place */}
            <TouchableOpacity
              style={[styles.bigBtn, dansZone ? styles.btnGreen : styles.btnViolet, busy && { opacity: 0.6 }]}
              disabled={busy}
              onPress={() => confirmer(false)}
            >
              {busy ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.bigBtnTxt}>Je suis sur place</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.forceLink} onPress={() => setForceOpen(true)}>
              <Ionicons name="key-outline" size={15} color={COLORS.goldDark} />
              <Text style={styles.forceLinkTxt}>Forcer avec un code administration</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Modal code de forcage */}
      <Modal visible={forceOpen} transparent animationType="fade" onRequestClose={() => setForceOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Code de forcage</Text>
            <Text style={styles.modalSub}>
              Vous etes hors de la zone. Saisissez le code fourni par l'administration pour confirmer l'arrivee.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Code administration"
              autoCapitalize="characters"
              value={forceCode}
              onChangeText={setForceCode}
            />
            <View style={styles.modalRow}>
              <TouchableOpacity style={[styles.mBtn, styles.mGray]} onPress={() => setForceOpen(false)}>
                <Text style={styles.mBtnTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.mBtn, styles.mViolet]} onPress={validerForce} disabled={busy}>
                <Text style={[styles.mBtnTxt, { color: '#fff' }]}>Valider</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    backgroundColor: COLORS.brown, paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center',
  },
  hBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,.14)', alignItems: 'center', justifyContent: 'center' },
  hTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 16, fontWeight: '700' },
  container: { padding: 16, gap: 14 },

  card: { backgroundColor: COLORS.card, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardDark: { backgroundColor: COLORS.brownSoft },
  cardGreen: { backgroundColor: COLORS.success },
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { fontSize: 11, color: COLORS.textSub, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  destName: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginTop: 2 },
  coords: { fontSize: 12, color: COLORS.textFaint, marginTop: 2 },
  warn: { fontSize: 12, color: COLORS.warn, marginTop: 2, fontWeight: '600' },

  dirBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.brown, borderRadius: 10, paddingVertical: 12, marginTop: 14,
  },
  dirTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },

  distVal: { fontSize: 34, fontWeight: '800', color: '#fff', marginTop: 4 },
  distSub: { fontSize: 13, color: 'rgba(255,255,255,.85)', marginTop: 2, fontWeight: '600' },

  bigBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderRadius: 14, paddingVertical: 16, marginTop: 4,
  },
  btnGreen: { backgroundColor: COLORS.success },
  btnViolet: { backgroundColor: COLORS.brown },
  bigBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },

  forceLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  forceLinkTxt: { color: COLORS.goldDark, fontWeight: '600', fontSize: 13 },

  backdrop: { flex: 1, backgroundColor: 'rgba(42,24,14,.55)', justifyContent: 'center', padding: 26 },
  modal: { backgroundColor: COLORS.card, borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  modalSub: { fontSize: 13, color: COLORS.textSub, marginTop: 6, lineHeight: 19 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 16, marginTop: 14, letterSpacing: 1 },
  modalRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  mBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  mGray: { backgroundColor: COLORS.border },
  mViolet: { backgroundColor: COLORS.brown },
  mBtnTxt: { fontWeight: '700', fontSize: 15, color: COLORS.text },
});
