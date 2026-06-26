import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { setVoyages } from '@/store/livraisonSlice';
import {
  getLivraisonsDuVoyage, getMatieresDuVoyageConteneur,
  type Voyage, type MatiereMp,
} from '@/services/livraisonService';
import { COLORS } from '@/constants/theme';

const statutLivraison = (v: Voyage): { label: string; color: string; icon: string; action: string } => {
  if (v.etatDechargement === 'TERMINE') return { label: 'Livré ✓',   color: COLORS.success,  icon: 'checkmark-done-circle', action: 'Voir' };
  if (v.etatChargement === 'TERMINE')   return { label: 'Chargé ✓',  color: COLORS.goldDark, icon: 'checkmark-circle',      action: 'Confirmer arrivée' };
  return                                       { label: 'À charger',  color: COLORS.warn,     icon: 'radio-button-off-outline', action: 'Scanner chargement' };
};

interface Groupe {
  livraison?: Voyage;           // peut être absent si ligne MP-only
  chantierCode: string;
  chantierLabel: string;
  matieres: MatiereMp[];
}

/** Construit les groupes : une livraison + ses MP (même projetCode), puis MP orphelines. */
function construireGroupes(livraisons: Voyage[], matieres: MatiereMp[]): Groupe[] {
  const groupes: Groupe[] = [];
  const mpUtilisees = new Set<number>();

  for (const liv of livraisons) {
    const code = liv.projetCode ?? null;
    // Correspondance : même code OU si code null → on cherche les MP sans projet
    const mps = code
      ? matieres.filter(m => (m.projet ?? null) === code)
      : matieres.filter(m => !m.projet);
    mps.forEach(m => mpUtilisees.add(m.id));
    groupes.push({
      livraison: liv,
      chantierCode: code ?? '',
      chantierLabel: liv.client || `Livraison #${liv.id}`,
      matieres: mps,
    });
  }

  // MP non rattachées à une livraison → groupées par chantier
  const orphelines = matieres.filter(m => !mpUtilisees.has(m.id));

  // Si pas de livraison du tout, attacher TOUTES les MP au premier groupe (MP seules)
  if (livraisons.length === 0 && orphelines.length === 0 && matieres.length > 0) {
    // Toutes les MP sont déjà orphelines
  }

  const parChantier = new Map<string, MatiereMp[]>();
  for (const m of orphelines) {
    const k = m.projet || '—';
    if (!parChantier.has(k)) parChantier.set(k, []);
    parChantier.get(k)!.push(m);
  }
  parChantier.forEach((mps, k) => {
    groupes.push({ chantierCode: k, chantierLabel: k, matieres: mps });
  });

  // Si aucun groupe n'a de MP alors qu'il y en a dans le voyage,
  // les rattacher à leur livraison (les codes ne correspondent pas → fallback)
  if (matieres.length > 0 && groupes.every(g => g.matieres.length === 0)) {
    if (groupes.length > 0) {
      groupes[0].matieres = matieres;
    } else {
      groupes.push({ chantierCode: '', chantierLabel: 'Matières premières', matieres });
    }
  }

  return groupes;
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

  const scannerMp = (m: MatiereMp) => {
    router.push({
      pathname: '/(chauffeur)/scan',
      params: { articleNom: m.designation ?? m.reference, articleQr: `DETAIL_MP:${m.id}`, phase: 'LIVRAISON' },
    });
  };

  const scannerVoyage = () => {
    router.push({ pathname: '/(chauffeur)/scan', params: { voyageId: String(voyageId), phase: 'LIVRAISON' } });
  };

  const ouvrirLivraison = (liv: Voyage) => {
    const params = { id: String(liv.id), vcId: String(voyageId), projetCode: liv.projetCode ?? '' };

    if (liv.etatDechargement === 'TERMINE') {
      // Tout terminé → lecture seule
      router.push({ pathname: '/(chauffeur)/livraison/[id]', params });
    } else if (liv.etatChargement === 'TERMINE') {
      // Chargement fait, livraison pas encore → navigation + arrivée
      router.push({
        pathname: '/(chauffeur)/navigation',
        params: { voyageId: String(liv.id), vcId: String(voyageId), projetCode: liv.projetCode ?? '' },
      });
    } else {
      // Pas encore chargé → scan chargement (articles + MP) directement
      router.push({ pathname: '/(chauffeur)/livraison/[id]', params });
    }
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

          {/* Groupes : livraison + ses MP / ou MP seules */}
          {groupes.map((g, idx) => (
            <View key={idx} style={styles.groupCard}>

              {/* ── Livraison (si présente) ── */}
              {g.livraison && (() => {
                const s = statutLivraison(g.livraison);
                return (
                  <TouchableOpacity style={styles.livRow} onPress={() => ouvrirLivraison(g.livraison!)} activeOpacity={0.85}>
                    <View style={[styles.statusIcon, { backgroundColor: s.color + '1F' }]}>
                      <Ionicons name={s.icon as any} size={22} color={s.color} />
                    </View>
                    <View style={styles.livBody}>
                      <Text style={styles.livTitle} numberOfLines={1}>{g.livraison.client || `Livraison #${g.livraison.id}`}</Text>
                      <Text style={styles.livMeta}>
                        {g.livraison.nbArticles ?? g.livraison.nbColis} article(s)
                        {g.livraison.bl ? `  ·  BL ${g.livraison.bl}` : ''}
                      </Text>
                      <Text style={[styles.livAction, { color: s.color }]}>{s.action} →</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: s.color + '1F' }]}>
                      <Text style={[styles.statusTxt, { color: s.color }]}>{s.label}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.textFaint} />
                  </TouchableOpacity>
                );
              })()}

              {/* ── Titre chantier (si pas de livraison = MP seules) ── */}
              {!g.livraison && g.matieres.length > 0 && (
                <View style={styles.chantierHeader}>
                  <Ionicons name="business-outline" size={15} color={COLORS.goldDark} />
                  <Text style={styles.chantierTxt} numberOfLines={1}>{g.chantierLabel}</Text>
                </View>
              )}

              {/* ── Matières premières inline seulement si PAS de livraison (MP orphelines) ── */}
              {!g.livraison && g.matieres.length > 0 && (
                <View style={styles.mpZone}>
                  <Text style={styles.mpZoneTitle}>
                    {g.matieres.filter(m => (m.statut||'').toUpperCase()==='LIVRE').length}/{g.matieres.length} matière(s) livrée(s)
                  </Text>
                  {g.matieres.map(m => {
                    const livre = (m.statut || '').toUpperCase() === 'LIVRE';
                    return (
                      <View key={String(m.id)} style={[styles.mpRow, livre && { opacity: 0.65 }]}>
                        <View style={styles.mpInfo}>
                          <Text style={styles.mpDesig} numberOfLines={2}>{m.designation || m.reference || '—'}</Text>
                          {m.reference ? <Text style={styles.mpMeta}>Réf {m.reference}</Text> : null}
                          <Text style={styles.mpMeta}>Qté : {m.quantite ?? '—'}{m.unite ? ` ${m.unite}` : ''}</Text>
                        </View>
                        <View style={styles.mpRight}>
                          <View style={[styles.statusPill, { backgroundColor: livre ? COLORS.success + '22' : COLORS.warn + '22' }]}>
                            <Text style={[styles.statusTxt, { color: livre ? COLORS.success : COLORS.warn }]}>
                              {livre ? 'Livrée ✓' : 'En attente'}
                            </Text>
                          </View>
                          {!livre && (
                            <TouchableOpacity style={styles.mpScanBtn} onPress={() => scannerMp(m)} activeOpacity={0.75}>
                              <Ionicons name="qr-code-outline" size={14} color={COLORS.brown} />
                              <Text style={styles.mpScanTxt}>Scanner</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Indicateur MP dans la livraison (visible sur la card, pas inline) */}
              {g.livraison && g.matieres.length > 0 && (
                <View style={styles.mpBadgeRow}>
                  <Ionicons name="layers-outline" size={12} color={COLORS.textSub} />
                  <Text style={styles.mpBadgeTxt}>
                    {g.matieres.length} matière(s) première(s) — voir dans le détail
                  </Text>
                </View>
              )}
            </View>
          ))}
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
  livTitle:     { fontSize: 14, fontWeight: '700', color: COLORS.text },
  livMeta:      { fontSize: 12, color: COLORS.textSub },
  livAction:    { fontSize: 11, fontWeight: '700', marginTop: 2 },
  statusPill:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusTxt:    { fontSize: 10, fontWeight: '700' },

  chantierHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.goldTint, paddingHorizontal: 14, paddingVertical: 10,
  },
  chantierTxt:  { fontSize: 13, fontWeight: '700', color: COLORS.brown, flex: 1 },

  mpZone:       { paddingHorizontal: 14, paddingBottom: 10 },
  mpZoneBorder: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8 },
  mpZoneTitle:  { fontSize: 11, fontWeight: '600', color: COLORS.textSub, marginBottom: 6 },

  mpRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderTopWidth: 1, borderTopColor: COLORS.border + '80' },
  mpInfo:       { flex: 1, gap: 1 },
  mpDesig:      { fontSize: 13, fontWeight: '600', color: COLORS.text },
  mpMeta:       { fontSize: 11, color: COLORS.textSub },
  mpRight:      { alignItems: 'flex-end', gap: 5 },
  mpScanBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.gold, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7 },
  mpScanTxt:    { fontSize: 11, fontWeight: '700', color: COLORS.brown },
  mpBadgeRow:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderTopWidth: 1, borderTopColor: COLORS.border + '60' },
  mpBadgeTxt:   { fontSize: 11, color: COLORS.textSub, fontStyle: 'italic' },

  empty:        { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTxt:     { fontSize: 15, color: COLORS.textSub, fontWeight: '600', textAlign: 'center' },
  retryBtn:     { backgroundColor: COLORS.gold, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
  retryTxt:     { color: COLORS.brown, fontWeight: '700' },
});
