import { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Image,
  TextInput, StatusBar, ActivityIndicator, ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { enregistrerBL } from '@/services/livraisonService';

export default function BLScreen() {
  const router = useRouter();
  const { voyageId } = useLocalSearchParams<{ voyageId?: string }>();
  const id = Number(voyageId);

  // Voyage deja livre : on bloque un nouvel envoi de BL.
  const voyage = useSelector((s: RootState) => s.livraison.voyages.find(v => v.id === id));
  const dejaLivre = voyage?.etatDechargement === 'TERMINE';

  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(chauffeur)'));

  const prendrePhoto = async () => {
    try {
      const shot = await cameraRef.current?.takePictureAsync({ quality: 0.6 });
      if (shot?.uri) setPhoto(shot.uri);
    } catch {
      Alert.alert('Erreur', 'Impossible de prendre la photo.');
    }
  };

  const valider = async () => {
    if (dejaLivre) {
      Alert.alert('Voyage deja livre', 'Le bon de livraison a deja ete enregistre pour ce voyage.', [
        { text: 'OK', onPress: goBack },
      ]);
      return;
    }
    if (!photo) { Alert.alert('Photo requise', 'Photographiez le bon de livraison.'); return; }
    setBusy(true);
    try {
      await enregistrerBL(id, photo, reference.trim() || undefined);
      Alert.alert('Livraison validee', 'Le bon de livraison a ete enregistre. Voyage livre.', [
        { text: 'OK', onPress: goBack },
      ]);
    } catch {
      Alert.alert('Erreur', 'Echec de l envoi du bon de livraison.');
    } finally {
      setBusy(false);
    }
  };

  if (!permission) return <View style={styles.root}><ActivityIndicator color="#6d4aff" style={{ marginTop: 60 }} /></View>;
  if (!permission.granted) {
    return (
      <View style={[styles.root, styles.center]}>
        <Ionicons name="camera-outline" size={56} color="#CBD5E1" />
        <Text style={styles.permTxt}>Acces camera requis</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnTxt}>Autoriser</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1e1b34" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.hBtn} onPress={goBack}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.hTitle}>Bon de livraison</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {dejaLivre ? (
          <View style={styles.livreBanner}>
            <Ionicons name="checkmark-done-circle" size={20} color="#16b364" />
            <Text style={styles.livreTxt}>Ce voyage est deja livre. Le bon de livraison a deja ete enregistre.</Text>
          </View>
        ) : null}
        <Text style={styles.hint}>Photographiez le bon de livraison signe pour valider la livraison.</Text>

        <View style={styles.shot}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.preview} resizeMode="cover" />
          ) : (
            <CameraView ref={cameraRef} style={styles.preview} facing="back" />
          )}
        </View>

        {photo ? (
          <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={() => setPhoto(null)}>
            <Ionicons name="refresh-outline" size={18} color="#6d4aff" />
            <Text style={[styles.btnTxt, { color: '#6d4aff' }]}>Reprendre la photo</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.btn, styles.btnViolet]} onPress={prendrePhoto}>
            <Ionicons name="camera" size={18} color="#fff" />
            <Text style={styles.btnTxt}>Prendre la photo</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.label}>Reference du BL (optionnel)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex : BL-2026-0042"
          value={reference}
          onChangeText={setReference}
          autoCapitalize="characters"
        />

        <TouchableOpacity
          style={[styles.btn, styles.btnGreen, (!photo || busy || dejaLivre) && { opacity: 0.6 }]}
          disabled={!photo || busy || dejaLivre}
          onPress={valider}
        >
          {busy ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.btnTxt}>Valider la livraison</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F4F8' },
  center: { alignItems: 'center', justifyContent: 'center', gap: 14 },
  header: {
    backgroundColor: '#1e1b34', paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center',
  },
  hBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,.12)', alignItems: 'center', justifyContent: 'center' },
  hTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 16, fontWeight: '700' },
  container: { padding: 16, gap: 14 },
  hint: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 19 },
  livreBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#D1FAE5', borderRadius: 10, padding: 12 },
  livreTxt: { flex: 1, color: '#065F46', fontSize: 12, fontWeight: '600', lineHeight: 17 },
  shot: { borderRadius: 16, overflow: 'hidden', backgroundColor: '#000', aspectRatio: 3 / 4 },
  preview: { width: '100%', height: '100%' },
  label: { fontSize: 12, color: '#64748B', fontWeight: '700', marginTop: 4 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, fontSize: 16 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 14 },
  btnViolet: { backgroundColor: '#6d4aff' },
  btnGreen: { backgroundColor: '#16b364' },
  btnOutline: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#6d4aff' },
  btnTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  permTxt: { color: '#94A3B8', fontSize: 15, fontWeight: '600' },
});
