import { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Image,
  TextInput, StatusBar, ActivityIndicator, ScrollView, Vibration,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { ajouterBlFile } from '@/services/livraisonService';
import { COLORS } from '@/constants/theme';

type Mode = 'SCAN' | 'PHOTO';

interface PhotoBl {
  uri: string;
  ref: string;   // référence BL associée à cette photo (optionnel)
}

export default function BLScreen() {
  const router = useRouter();
  const { voyageId } = useLocalSearchParams<{ voyageId?: string }>();
  const id = Number(voyageId);

  const voyage = useSelector((s: RootState) => s.livraison.voyages.find(v => v.id === id));
  const dejaLivre = voyage?.etatDechargement === 'TERMINE';

  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [mode,     setMode]     = useState<Mode>('PHOTO');
  const [photos,   setPhotos]   = useState<PhotoBl[]>([]);   // photos prises
  const [preview,  setPreview]  = useState<string | null>(null); // photo en attente de validation
  const [refs,     setRefs]     = useState<string[]>([]);    // BL scannés (références)
  const [manuel,   setManuel]   = useState('');
  const [currentRef, setCurrentRef] = useState('');          // ref associée à la photo en préview
  const [busy,     setBusy]     = useState(false);
  const [scanLock, setScanLock] = useState(false);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(chauffeur)'));

  // Scan d'un BL (QR / code-barres)
  const onScanBL = ({ data }: { data: string }) => {
    if (scanLock || !data) return;
    setScanLock(true);
    setTimeout(() => setScanLock(false), 1200);
    setRefs(prev => {
      if (prev.includes(data)) return prev;
      Vibration.vibrate(120);
      return [...prev, data];
    });
  };

  const ajouterManuel = () => {
    const v = manuel.trim();
    if (!v) return;
    setRefs(prev => (prev.includes(v) ? prev : [...prev, v]));
    setManuel('');
  };

  const retirerRef = (r: string) => setRefs(prev => prev.filter(x => x !== r));

  // Prendre une photo
  const prendrePhoto = async () => {
    try {
      const shot = await cameraRef.current?.takePictureAsync({ quality: 0.65 });
      if (shot?.uri) setPreview(shot.uri);
    } catch {
      Alert.alert('Erreur', 'Impossible de prendre la photo.');
    }
  };

  // Confirmer et ajouter la photo à la liste
  const validerPhoto = () => {
    if (!preview) return;
    setPhotos(prev => [...prev, { uri: preview, ref: currentRef.trim() }]);
    setPreview(null);
    setCurrentRef('');
  };

  const annulerPhoto = () => { setPreview(null); setCurrentRef(''); };
  const retirerPhoto = (i: number) => setPhotos(prev => prev.filter((_, idx) => idx !== i));

  const terminer = async () => {
    if (dejaLivre) {
      Alert.alert('Deja livre', 'Le bon de livraison a deja ete enregistre pour ce voyage.', [{ text: 'OK', onPress: goBack }]);
      return;
    }
    if (photos.length === 0 && refs.length === 0) {
      Alert.alert('BL requis', 'Prenez au moins une photo du BL ou scannez une reference.');
      return;
    }
    setBusy(true);
    try {
      // Upload chaque photo comme BL séparé
      for (const p of photos) {
        await ajouterBlFile(id, p.uri, p.ref || undefined);
      }
      // Refs scannées sans photo → un appel sans fichier
      if (refs.length > 0 && photos.length === 0) {
        await ajouterBlFile(id, '', refs.join(', '));
      }
      Alert.alert(
        'Livraison terminée',
        `${photos.length} photo(s) BL envoyée(s).${refs.length ? `\nRéf : ${refs.join(', ')}` : ''}`,
        [{ text: 'OK', onPress: goBack }],
      );
    } catch {
      Alert.alert('Erreur', "Echec de l'envoi du bon de livraison. Verifiez la connexion.");
    } finally {
      setBusy(false);
    }
  };

  if (!permission) return <View style={styles.root}><ActivityIndicator color={COLORS.gold} style={{ marginTop: 60 }} /></View>;
  if (!permission.granted) {
    return (
      <View style={[styles.root, styles.center]}>
        <Ionicons name="camera-outline" size={56} color={COLORS.textFaint} />
        <Text style={styles.permTxt}>Accès caméra requis</Text>
        <TouchableOpacity style={[styles.btn, styles.btnGold]} onPress={requestPermission}>
          <Text style={[styles.btnTxt, { color: COLORS.brown }]}>Autoriser</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const peutTerminer = !dejaLivre && !busy && (photos.length > 0 || refs.length > 0);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.brownDeep} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.hBtn} onPress={goBack}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.hTitle}>Bon de livraison</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        {dejaLivre && (
          <View style={styles.livreBanner}>
            <Ionicons name="checkmark-done-circle" size={20} color={COLORS.success} />
            <Text style={styles.livreTxt}>Ce voyage est déjà livré.</Text>
          </View>
        )}

        <Text style={styles.hint}>
          Prenez autant de photos que nécessaire (un BL par photo) puis terminez la livraison.
        </Text>

        {/* Segmented control */}
        <View style={styles.seg}>
          {(['PHOTO', 'SCAN'] as Mode[]).map(m => {
            const active = mode === m;
            return (
              <TouchableOpacity key={m} style={[styles.segBtn, active && styles.segBtnActive]} onPress={() => { setMode(m); setPreview(null); }} activeOpacity={0.85}>
                <Ionicons name={m === 'PHOTO' ? 'camera-outline' : 'qr-code-outline'} size={16} color={active ? COLORS.brown : COLORS.textSub} />
                <Text style={[styles.segTxt, active && styles.segTxtActive]}>{m === 'PHOTO' ? 'Photo BL' : 'Scanner réf.'}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Mode PHOTO ── */}
        {mode === 'PHOTO' && (
          <>
            {/* Aperçu caméra OU préview de la photo prise */}
            <View style={styles.shot}>
              {preview ? (
                <Image source={{ uri: preview }} style={styles.preview} resizeMode="cover" />
              ) : (
                <CameraView ref={cameraRef} style={styles.preview} facing="back" />
              )}
            </View>

            {preview ? (
              /* Après prise de photo : ref optionnelle + valider */
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Référence BL (optionnel)"
                  placeholderTextColor={COLORS.textFaint}
                  value={currentRef}
                  onChangeText={setCurrentRef}
                  autoCapitalize="characters"
                />
                <View style={styles.row2}>
                  <TouchableOpacity style={[styles.btn, styles.btnOutline, { flex: 1 }]} onPress={annulerPhoto} activeOpacity={0.85}>
                    <Ionicons name="refresh-outline" size={17} color={COLORS.goldDark} />
                    <Text style={[styles.btnTxt, { color: COLORS.goldDark }]}>Reprendre</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, styles.btnBrown, { flex: 1 }]} onPress={validerPhoto} activeOpacity={0.85}>
                    <Ionicons name="checkmark" size={17} color="#fff" />
                    <Text style={styles.btnTxt}>Ajouter ce BL</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <TouchableOpacity style={[styles.btn, styles.btnBrown]} onPress={prendrePhoto} activeOpacity={0.85}>
                <Ionicons name="camera" size={18} color="#fff" />
                <Text style={styles.btnTxt}>Prendre la photo</Text>
              </TouchableOpacity>
            )}

            {/* Liste des photos validées */}
            {photos.length > 0 && (
              <>
                <Text style={styles.label}>Photos BL ajoutées ({photos.length})</Text>
                {photos.map((p, i) => (
                  <View key={i} style={styles.photoRow}>
                    <Image source={{ uri: p.uri }} style={styles.thumb} resizeMode="cover" />
                    <View style={styles.photoInfo}>
                      <Text style={styles.photoIdx}>BL {i + 1}</Text>
                      {p.ref ? <Text style={styles.photoRef}>{p.ref}</Text> : <Text style={styles.photoRefEmpty}>Aucune réf.</Text>}
                    </View>
                    <TouchableOpacity onPress={() => retirerPhoto(i)} hitSlop={8}>
                      <Ionicons name="close-circle" size={22} color={COLORS.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {/* ── Mode SCAN réf ── */}
        {mode === 'SCAN' && (
          <>
            <View style={styles.shot}>
              <CameraView
                style={styles.preview}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8'] }}
                onBarcodeScanned={onScanBL}
              />
              <View style={styles.scanFrame} pointerEvents="none">
                <Text style={styles.scanFrameTxt}>Visez le code du BL</Text>
              </View>
            </View>
            <Text style={styles.label}>Références scannées {refs.length ? `(${refs.length})` : ''}</Text>
            {refs.length === 0 ? (
              <Text style={styles.emptyRefs}>Aucune référence scannée.</Text>
            ) : (
              <View style={styles.refList}>
                {refs.map(r => (
                  <View key={r} style={styles.refChip}>
                    <Ionicons name="document-text-outline" size={14} color={COLORS.goldDark} />
                    <Text style={styles.refChipTxt} numberOfLines={1}>{r}</Text>
                    <TouchableOpacity onPress={() => retirerRef(r)} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color={COLORS.textFaint} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.manuelRow}>
              <TextInput
                style={styles.input}
                placeholder="Ajouter une réf. BL manuellement"
                placeholderTextColor={COLORS.textFaint}
                value={manuel}
                onChangeText={setManuel}
                autoCapitalize="characters"
                onSubmitEditing={ajouterManuel}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.addBtn} onPress={ajouterManuel}>
                <Ionicons name="add" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Résumé et bouton Terminer */}
        {(photos.length > 0 || refs.length > 0) && (
          <View style={styles.summaryBox}>
            {photos.length > 0 && <Text style={styles.summaryTxt}><Ionicons name="camera" size={13} /> {photos.length} photo(s) BL</Text>}
            {refs.length > 0  && <Text style={styles.summaryTxt}><Ionicons name="document-text" size={13} /> Réf : {refs.join(', ')}</Text>}
          </View>
        )}

        <TouchableOpacity
          style={[styles.btn, styles.btnGreen, !peutTerminer && { opacity: 0.5 }]}
          disabled={!peutTerminer}
          onPress={terminer}
        >
          {busy ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="checkmark-done-circle" size={19} color="#fff" />
              <Text style={styles.btnTxt}>Terminer la livraison</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: COLORS.bg },
  center:     { alignItems: 'center', justifyContent: 'center', gap: 14 },
  header:     { backgroundColor: COLORS.brown, paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  hBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,.14)', alignItems: 'center', justifyContent: 'center' },
  hTitle:     { flex: 1, textAlign: 'center', color: '#fff', fontSize: 16, fontWeight: '700' },
  container:  { padding: 16, gap: 14, paddingBottom: 36 },
  hint:       { fontSize: 13, color: COLORS.textSub, textAlign: 'center', lineHeight: 19 },
  livreBanner:{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.successBg, borderRadius: 10, padding: 12 },
  livreTxt:   { flex: 1, color: '#0F5132', fontSize: 12, fontWeight: '600', lineHeight: 17 },

  seg:        { flexDirection: 'row', backgroundColor: COLORS.goldTint, borderRadius: 12, padding: 4, gap: 4 },
  segBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 9 },
  segBtnActive:{ backgroundColor: COLORS.gold },
  segTxt:     { fontSize: 13, fontWeight: '700', color: COLORS.textSub },
  segTxtActive:{ color: COLORS.brown },

  shot:       { borderRadius: 16, overflow: 'hidden', backgroundColor: '#000', aspectRatio: 3 / 4, position: 'relative' },
  preview:    { width: '100%', height: '100%' },
  scanFrame:  { ...StyleSheet.absoluteFillObject, margin: 26, borderWidth: 2, borderColor: COLORS.gold, borderRadius: 14, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 12 },
  scanFrameTxt:{ color: '#fff', fontSize: 12, fontWeight: '700', backgroundColor: 'rgba(42,24,14,.6)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },

  label:      { fontSize: 12, color: COLORS.textSub, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  emptyRefs:  { fontSize: 13, color: COLORS.textFaint, fontStyle: 'italic' },
  refList:    { gap: 8 },
  refChip:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.border },
  refChipTxt: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.text },

  row2:       { flexDirection: 'row', gap: 8 },
  photoRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.card, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: COLORS.border },
  thumb:      { width: 64, height: 64, borderRadius: 8, backgroundColor: COLORS.bg },
  photoInfo:  { flex: 1, gap: 2 },
  photoIdx:   { fontSize: 13, fontWeight: '700', color: COLORS.text },
  photoRef:   { fontSize: 12, color: COLORS.goldDark, fontWeight: '600' },
  photoRefEmpty:{ fontSize: 12, color: COLORS.textFaint, fontStyle: 'italic' },

  summaryBox: { backgroundColor: COLORS.goldTint, borderRadius: 10, padding: 12, gap: 4 },
  summaryTxt: { fontSize: 13, color: COLORS.brown, fontWeight: '600' },

  manuelRow:  { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input:      { flex: 1, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 15, color: COLORS.text },
  addBtn:     { width: 46, height: 46, borderRadius: 10, backgroundColor: COLORS.brown, alignItems: 'center', justifyContent: 'center' },

  btn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 14 },
  btnBrown:   { backgroundColor: COLORS.brown },
  btnGold:    { backgroundColor: COLORS.gold },
  btnGreen:   { backgroundColor: COLORS.success, marginTop: 4 },
  btnOutline: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.gold },
  btnTxt:     { color: '#fff', fontWeight: '800', fontSize: 15 },
  permTxt:    { color: COLORS.textFaint, fontSize: 15, fontWeight: '600' },
});
