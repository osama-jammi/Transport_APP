import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  StyleSheet, ActivityIndicator, RefreshControl, StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { setVoyages } from '@/store/livraisonSlice';
import {
  getLivraisonsDuVoyage, getMatieresDuVoyageConteneur, annulerVoyage as annulerVoyageApi,
  mpEstChargee, mpEstLivree,
  type Voyage, type MatiereMp,
} from '@/services/livraisonService';
import { COLORS } from '@/constants/theme';

interface Groupe {
  livraisons: Voyage[];      // toutes les livraisons du même chantier
  chantierCode: string;
  chantierLabel: string;
  matieres: MatiereMp[];     // MP affichées UNE SEULE FOIS par groupe
}

const norm = (s?: string | null) => (s || '').trim();

/** Groupe les livraisons par chantier ; associe les MP une seule fois par groupe. */
function construireGroupes(livraisons: Voyage[], matieres: MatiereMp[]): Groupe[] {
  // 1. Regrouper livraisons par chantier (projetCode normalisé)
  const parChantier = new Map<string, Voyage[]>();
  for (const liv of livraisons) {
    const k = norm(liv.projetCode);
    if (!parChantier.has(k)) parChantier.set(k, []);
    parChantier.get(k)!.push(liv);
  }

  const groupes: Groupe[] = [];
  const mpUtilisees = new Set<number>();

  parChantier.forEach((livs, key) => {
    // MP correspondant au chantier de ce groupe
    const mps = key
      ? matieres.filter(m => norm(m.projet) === key)
      : matieres.filter(m => !m.projet);
    mps.forEach(m => mpUtilisees.add(m.id));
    groupes.push({
      livraisons: livs,
      chantierCode: key,
      chantierLabel: livs[0].client || `#${livs[0].id}`,
      matieres: mps,
    });
  });

  // 2. MP orphelines (pas de livraison avec le même chantier)
  const orphelines = matieres.filter(m => !mpUtilisees.has(m.id));
  if (orphelines.length) {
    // Grouper les orphelines par chantier
    const parChantierOrph = new Map<string, MatiereMp[]>();
    for (const m of orphelines) {
      const k = norm(m.projet) || '—';
      if (!parChantierOrph.has(k)) parChantierOrph.set(k, []);
      parChantierOrph.get(k)!.push(m);
    }
    parChantierOrph.forEach((mps, k) => {
      groupes.push({ livraisons: [], chantierCode: k, chantierLabel: k, matieres: mps });
    });
  }

  // 3. Fallback : si aucun groupe n'a de MP mais le voyage en a → rattacher au 1er groupe
  if (matieres.length > 0 && groupes.every(g => g.matieres.length === 0)) {
    if (groupes.length > 0) groupes[0].matieres = matieres;
    else groupes.push({ livraisons: [], chantierCode: '', chantierLabel: 'Matières premières', matieres });
  }

  return groupes;
}

/** Statut agrégé d'une ligne (chantier) : À charger → En cours → Chargé → Livré. */
function statutGroupe(g: Groupe): { label: string; color: string; icon: string } {
  const ofs = g.livraisons, mps = g.matieres;
  const ofsLivres   = ofs.every(o => o.etatDechargement === 'TERMINE');
  const ofsCharges  = ofs.every(o => o.etatChargement === 'TERMINE');
  const ofsVierges  = ofs.every(o => o.etatChargement !== 'TERMINE');
  const mpsLivrees  = mps.every(m => mpEstLivree(m.statut));
  const mpsChargees = mps.every(m => mpEstChargee(m.statut));
  const mpsVierges  = mps.every(m => !mpEstChargee(m.statut));

  if (ofsLivres && mpsLivrees)   return { label: 'Livré ✓',  color: COLORS.success,  icon: 'checkmark-done-circle' };
  if (ofsCharges && mpsChargees) return { label: 'Chargé ✓', color: COLORS.goldDark, icon: 'checkmark-circle' };
  if (ofsVierges && mpsVierges)  return { label: 'À charger', color: COLORS.warn,    icon: 'radio-button-off-outline' };
  return { label: 'En cours', color: COLORS.teal, icon: 'time-outline' };
}

export default function VoyageLivraisonsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router   = useRouter();
  const dispatch = useDispatch();
  const voyageId = Number(id);

  const [livraisons, setLivraisons] = useState<Voyage[]>([]);
  const [matieres,   setMatieres]   = useState<MatiereMp[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [livs, mps] = await Promise.all([
        getLivraisonsDuVoyage(voyageId),
        getMatieresDuVoyageConteneur(voyageId),
      ]);
      setLivraisons(livs);
      setMatieres(mps);
      dispatch(setVoyages(livs));
    } catch {
      setError('Impossible de charger le contenu du voyage.');
    } finally {
      setLoading(false);
    }
  }, [voyageId, dispatch]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const scannerVoyage = () => {
    // Phase : CHARGEMENT si des livraisons ne sont pas encore chargées, sinon LIVRAISON
    const toutCharge = livraisons.length > 0 && livraisons.every(v => v.etatChargement === 'TERMINE');
    const phase = toutCharge ? 'LIVRAISON' : 'CHARGEMENT';
    // En livraison, le scan global « tout valider » est interdit tant que l'arrivée n'a pas
    // été confirmée sur toutes les lignes restantes : il faut livrer ligne par ligne pour
    // confirmer l'arrivée à chaque chantier (« Je suis sur place » ou code de forçage).
    if (phase === 'LIVRAISON') {
      const nonArrivees = livraisons.filter(v => v.etatDechargement !== 'TERMINE' && !v.arriveeConfirmee);
      if (nonArrivees.length > 0) {
        Alert.alert(
          'Arrivée non confirmée',
          "Pour livrer, ouvrez chaque ligne et confirmez votre arrivée au chantier avant de scanner la livraison.",
        );
        return;
      }
    }
    router.push({ pathname: '/(chauffeur)/scan', params: { voyageId: String(voyageId), phase } });
  };

  const annulerVoyageHandler = async () => {
    try {
      await annulerVoyageApi(voyageId);
      Alert.alert('Succès', 'Voyage annulé');
      load();
    } catch (e) {
      Alert.alert('Erreur', 'Impossible d\'annuler le voyage');
    }
  };

  // 1 ligne = 1 chantier : ouvre l'écran dédié (agrège tous les OF du chantier + ses MP).
  const ouvrirLigne = (g: Groupe) => {
    const firstOf = g.livraisons[0];
    router.push({
      pathname: '/(chauffeur)/livraison/[id]',
      params: {
        id: String(firstOf ? firstOf.id : voyageId),
        vcId: String(voyageId),
        projetCode: g.chantierCode ?? '',
      },
    });
  };

  const total  = livraisons.length;
  const livres = livraisons.filter(v => v.etatDechargement === 'TERMINE').length;
  const pct    = total ? Math.round((livres / total) * 100) : 0;

  const mpTotal  = matieres.length;
  const mpLivres = matieres.filter(m => (m.statut || '').toUpperCase() === 'LIVRE').length;

  const groupes = construireGroupes(livraisons, matieres);
  const vide    = !loading && groupes.length === 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.brownDeep} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(chauffeur)'))}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerSub}>Voyage #{voyageId}</Text>
          <Text style={styles.headerTitle}>Contenu du voyage</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={load}>
          <Ionicons name="refresh-outline" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn}
          onPress={() => Alert.alert('Annuler le voyage', 'Cette action annule tout le voyage. Confirmer ?', [
            { text: 'Non', style: 'cancel' },
            { text: 'Oui', style: 'destructive', onPress: annulerVoyageHandler },
          ])}>
          <Ionicons name="close-circle-outline" size={20} color="#ff6b6b" />
        </TouchableOpacity>
      </View>

      {/* Barres de progression */}
      <View style={styles.progressZone}>
        {total > 0 && (
          <View style={{ marginBottom: mpTotal > 0 ? 8 : 0 }}>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
            </View>
            <Text style={styles.progressTxt}>{livres}/{total} livraison(s) livrée(s)</Text>
          </View>
        )}
        {mpTotal > 0 && (
          <View>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, {
                width: `${Math.round((mpLivres / mpTotal) * 100)}%` as any,
                backgroundColor: COLORS.teal,
              }]} />
            </View>
            <Text style={styles.progressTxt}>{mpLivres}/{mpTotal} matière(s) livrée(s)</Text>
          </View>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.gold} style={{ marginTop: 32 }} />
      ) : error ? (
        <View style={styles.empty}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.danger} />
          <Text style={styles.emptyTxt}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryTxt}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : vide ? (
        <View style={styles.empty}>
          <Ionicons name="cube-outline" size={48} color={COLORS.textFaint} />
          <Text style={styles.emptyTxt}>Aucun contenu dans ce voyage</Text>
        </View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[COLORS.gold]} tintColor={COLORS.gold} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 50, gap: 12 }}
        >
          {/* Bouton Scanner QR du voyage (toujours visible) */}
          <TouchableOpacity style={styles.scanVoyageBtn} onPress={scannerVoyage} activeOpacity={0.85}>
            <Ionicons name="qr-code" size={20} color={COLORS.brown} />
            <Text style={styles.scanVoyageTxt}>Scanner le QR du voyage (tout valider)</Text>
          </TouchableOpacity>

          {/* Lignes du voyage (1 ligne = 1 chantier). Pas de détail inline : un clic ouvre l'écran ligne. */}
          {groupes.map((g, idx) => {
            const s = statutGroupe(g);
            const dateCreation = g.livraisons.length > 0 ? g.livraisons[0].dateCreation : null;
            return (
              <TouchableOpacity key={idx} style={styles.lineRow} onPress={() => ouvrirLigne(g)} activeOpacity={0.85}>
                <View style={[styles.statusIcon, { backgroundColor: s.color + '1F' }]}>
                  <Ionicons name={s.icon as any} size={20} color={s.color} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.chantierTxt} numberOfLines={1}>{g.chantierLabel}</Text>
                  <View style={styles.lineMetaRow}>
                    {g.livraisons.length > 0 && <Text style={styles.lineMeta}>{g.livraisons.length} OF</Text>}
                    {g.matieres.filter(m => (m.source || 'MATIERE') !== 'STOCK').length > 0 &&
                      <Text style={styles.lineMeta}>{g.matieres.filter(m => (m.source || 'MATIERE') !== 'STOCK').length} MP</Text>}
                    {g.matieres.filter(m => m.source === 'STOCK').length > 0 &&
                      <Text style={styles.lineMeta}>{g.matieres.filter(m => m.source === 'STOCK').length} Stock</Text>}
                    {dateCreation && <Text style={styles.lineMeta}>{new Date(dateCreation).toLocaleDateString()}</Text>}
                  </View>
                </View>
                <View style={[styles.statusPill, { backgroundColor: s.color + '1F' }]}>
                  <Text style={[styles.statusTxt, { color: s.color }]}>{s.label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textFaint} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.bg },

  header:       {
    backgroundColor: COLORS.brown,
    paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  backBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,.14)', alignItems: 'center', justifyContent: 'center' },
  iconBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,.14)', alignItems: 'center', justifyContent: 'center' },
  headerSub:    { color: 'rgba(255,255,255,.55)', fontSize: 11 },
  headerTitle:  { color: '#fff', fontSize: 17, fontWeight: '700' },

  progressZone: { backgroundColor: COLORS.brown, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14 },
  progressBg:   { height: 5, backgroundColor: 'rgba(255,255,255,.18)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.gold, borderRadius: 3 },
  progressTxt:  { color: 'rgba(255,255,255,.65)', fontSize: 11, marginTop: 4, textAlign: 'right' },

  scanVoyageBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.gold, borderRadius: 12, paddingVertical: 13,
  },
  scanVoyageTxt: { fontSize: 13, fontWeight: '700', color: COLORS.brown },

  groupCard:    {
    backgroundColor: COLORS.card, borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },

  livRow:       {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14,
  },
  statusIcon:   { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  livBody:      { flex: 1, gap: 2 },
  livMeta:      { fontSize: 12, color: COLORS.textSub },
  livAction:    { fontSize: 11, fontWeight: '700', marginTop: 2 },
  statusPill:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusTxt:    { fontSize: 10, fontWeight: '700' },

  // Ligne du voyage (1 chantier) — carte cliquable, pas de dépliage
  lineRow:      {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: COLORS.card, borderRadius: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  lineMetaRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  lineMeta:     { fontSize: 11, color: COLORS.textSub, fontWeight: '600' },

  chantierHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.goldTint, paddingHorizontal: 14, paddingVertical: 10,
  },
  chantierTxt:   { fontSize: 13, fontWeight: '700', color: COLORS.brown },
  chantierDate:  { fontSize: 11, color: COLORS.textSub },
  chantierBadge: { fontSize: 10, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10,
                   backgroundColor: COLORS.goldDark + '22', color: COLORS.goldDark },

  actionBar:     { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border + '50' },
  actionBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: COLORS.gold + '22', borderRadius: 8 },
  actionBtnDanger: { backgroundColor: '#ff6b6b22' },
  actionBtnTxt:  { fontSize: 11, fontWeight: '600', color: COLORS.brown },

  mpZone:        { paddingHorizontal: 14, paddingBottom: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
  mpZoneTitle:   { fontSize: 11, fontWeight: '600', color: COLORS.textSub, marginBottom: 6 },

  mpRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderTopWidth: 1, borderTopColor: COLORS.border + '60' },
  mpInfo:       { flex: 1, gap: 1 },
  mpDesig:      { fontSize: 13, fontWeight: '600', color: COLORS.text },
  mpMeta:       { fontSize: 11, color: COLORS.textSub },

  empty:        { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTxt:     { fontSize: 15, color: COLORS.textSub, fontWeight: '600', textAlign: 'center' },
  retryBtn:     { backgroundColor: COLORS.gold, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
  retryTxt:     { color: COLORS.brown, fontWeight: '700' },
});
