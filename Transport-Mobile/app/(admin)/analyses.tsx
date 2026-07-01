import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator,
  TouchableOpacity, Modal, TextInput, FlatList, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getDashboardStats, getChantiersGap, getChauffeursGap, downloadRapportComplet,
  type DashboardStats, type ChantierLite, type ChauffeurLite,
} from '@/services/adminService';
import { COLORS } from '@/constants/theme';

const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const fmtDuree = (m: number | null) => {
  if (m == null) return '—';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h${String(r).padStart(2, '0')}` : `${h}h`;
};
const labelJour = (iso: string) => {
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d.getTime()) ? iso.slice(5) : JOURS[d.getDay()];
};

// ── Période (préréglages, calculés côté client en yyyy-MM-dd) ──
type PeriodeKey = 'J' | '7' | '30' | '90';
const PERIODES: { key: PeriodeKey; label: string; days: number }[] = [
  { key: 'J',  label: "Aujourd'hui", days: 0 },
  { key: '7',  label: '7 jours',     days: 6 },
  { key: '30', label: '30 jours',    days: 29 },
  { key: '90', label: '90 jours',    days: 89 },
];
const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const periodRange = (key: PeriodeKey) => {
  const days = PERIODES.find(p => p.key === key)?.days ?? 6;
  const fin = new Date();
  const debut = new Date();
  debut.setDate(debut.getDate() - days);
  return { debut: toISO(debut), fin: toISO(fin) };
};

// ── Sélecteur modal réutilisable (chantier / chauffeur) ──
function PickerModal({
  visible, title, items, onSelect, onClose,
}: {
  visible: boolean;
  title: string;
  items: { id: number; label: string; sub?: string }[];
  onSelect: (id: number | null) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const t = q.toLowerCase().trim();
    return t ? items.filter(i => `${i.label} ${i.sub ?? ''}`.toLowerCase().includes(t)) : items;
  }, [q, items]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={COLORS.textSub} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher…"
              placeholderTextColor={COLORS.textFaint}
              value={q}
              onChangeText={setQ}
            />
          </View>
          <TouchableOpacity style={styles.optAll} onPress={() => { onSelect(null); onClose(); }}>
            <Ionicons name="layers-outline" size={18} color={COLORS.goldDark} />
            <Text style={styles.optAllTxt}>Tous</Text>
          </TouchableOpacity>
          <FlatList
            data={filtered}
            keyExtractor={i => String(i.id)}
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 360 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.opt} onPress={() => { onSelect(item.id); onClose(); }}>
                <Text style={styles.optTxt} numberOfLines={1}>{item.label}</Text>
                {item.sub ? <Text style={styles.optSub} numberOfLines={1}>{item.sub}</Text> : null}
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.emptyTxt}>Aucun résultat.</Text>}
          />
        </View>
      </View>
    </Modal>
  );
}

export default function AdminAnalyses() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Filtres
  const [period, setPeriod] = useState<PeriodeKey>('7');
  const [selChantier, setSelChantier] = useState<ChantierLite | null>(null);
  const [selChauffeur, setSelChauffeur] = useState<ChauffeurLite | null>(null);

  // Listes pour les sélecteurs
  const [chantiers, setChantiers] = useState<ChantierLite[]>([]);
  const [chauffeurs, setChauffeurs] = useState<ChauffeurLite[]>([]);
  const [pick, setPick] = useState<'chantier' | 'chauffeur' | null>(null);

  // Téléchargement du rapport Excel
  const [downloading, setDownloading] = useState(false);

  const onDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const { debut, fin } = periodRange(period);
      const ok = await downloadRapportComplet({
        debut, fin,
        chantierId: selChantier?.id ?? null,
        chauffeurId: selChauffeur?.id ?? null,
      });
      if (!ok) Alert.alert('Rapport prêt', "Le partage n'est pas disponible sur cet appareil.");
    } catch {
      Alert.alert('Échec', "Le rapport n'a pas pu être téléchargé. Vérifiez la connexion au serveur.");
    } finally {
      setDownloading(false);
    }
  }, [period, selChantier?.id, selChauffeur?.id]);

  useEffect(() => {
    getChantiersGap().then(setChantiers).catch(() => {});
    getChauffeursGap().then(setChauffeurs).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { debut, fin } = periodRange(period);
      setStats(await getDashboardStats({
        chantierId: selChantier?.id ?? null,
        chauffeurId: selChauffeur?.id ?? null,
        debut, fin,
      }));
    } catch {
      // garde l'existant
    } finally {
      setLoading(false);
    }
  }, [period, selChantier?.id, selChauffeur?.id]);

  useEffect(() => { load(); }, [load]);

  const maxJour = Math.max(1, ...(stats?.parJour ?? []).map(j => j.total));

  const kpis: { val: string | number; lbl: string }[] = [
    { val: stats?.voyagesAujourdhui ?? 0, lbl: 'Voyages' },
    { val: stats?.livresAujourdhui ?? 0,  lbl: 'Livrés' },
    { val: stats?.enCoursAujourdhui ?? 0, lbl: 'En cours' },
    { val: stats?.enAttenteAujourdhui ?? 0, lbl: 'En attente' },
    { val: stats?.articlesAujourdhui ?? 0, lbl: 'Articles' },
    { val: fmtDuree(stats?.dureeMoyenneMinutes ?? null), lbl: 'Durée moy.' },
    { val: stats?.voyagesTotal ?? 0, lbl: 'Total (filtre)' },
    { val: stats?.chantiersActifs ?? 0, lbl: 'Chantiers' },
    { val: stats?.chauffeursActifs ?? 0, lbl: 'Chauffeurs' },
  ];

  const chantierLabel = selChantier ? selChantier.designation : 'Tous les chantiers';
  const chauffeurLabel = selChauffeur ? `${selChauffeur.prenom} ${selChauffeur.nom}`.trim() : 'Tous les chauffeurs';

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[COLORS.gold]} tintColor={COLORS.gold} />}
      >
        {/* ── Filtres ── */}
        <View style={styles.filterCard}>
          <View style={styles.periodRow}>
            {PERIODES.map(p => {
              const active = period === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.periodChip, active && styles.periodChipActive]}
                  onPress={() => setPeriod(p.key)}
                >
                  <Text style={[styles.periodTxt, active && styles.periodTxtActive]}>{p.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.selectBtn} onPress={() => setPick('chantier')}>
            <Ionicons name="business-outline" size={16} color={COLORS.goldDark} />
            <Text style={[styles.selectTxt, !selChantier && styles.selectTxtMuted]} numberOfLines={1}>{chantierLabel}</Text>
            {selChantier
              ? <TouchableOpacity onPress={() => setSelChantier(null)} hitSlop={8}><Ionicons name="close-circle" size={18} color={COLORS.textFaint} /></TouchableOpacity>
              : <Ionicons name="chevron-down" size={16} color={COLORS.textFaint} />}
          </TouchableOpacity>

          <TouchableOpacity style={styles.selectBtn} onPress={() => setPick('chauffeur')}>
            <Ionicons name="person-outline" size={16} color={COLORS.goldDark} />
            <Text style={[styles.selectTxt, !selChauffeur && styles.selectTxtMuted]} numberOfLines={1}>{chauffeurLabel}</Text>
            {selChauffeur
              ? <TouchableOpacity onPress={() => setSelChauffeur(null)} hitSlop={8}><Ionicons name="close-circle" size={18} color={COLORS.textFaint} /></TouchableOpacity>
              : <Ionicons name="chevron-down" size={16} color={COLORS.textFaint} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.downloadBtn, downloading && styles.downloadBtnDisabled]}
            onPress={onDownload}
            disabled={downloading}
            activeOpacity={0.85}
          >
            {downloading
              ? <ActivityIndicator size="small" color={COLORS.brown} />
              : <Ionicons name="download-outline" size={18} color={COLORS.brown} />}
            <Text style={styles.downloadTxt}>
              {downloading ? 'Préparation…' : 'Télécharger le rapport Excel'}
            </Text>
          </TouchableOpacity>
        </View>

        {loading && !stats ? (
          <ActivityIndicator color={COLORS.gold} style={{ marginTop: 32 }} />
        ) : (
          <>
            {/* KPIs */}
            <View style={styles.kpiGrid}>
              {kpis.map((k, i) => (
                <View key={i} style={styles.kpi}>
                  <Text style={styles.kpiVal}>{k.val}</Text>
                  <Text style={styles.kpiLbl}>{k.lbl}</Text>
                </View>
              ))}
            </View>

            {/* Voyages par jour */}
            <Text style={styles.title}>Voyages — période</Text>
            <View style={styles.card}>
              {(stats?.parJour ?? []).length === 0 ? (
                <Text style={styles.emptyTxt}>Aucune donnée sur la période.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={[styles.chart, { minWidth: '100%' }]}>
                    {stats!.parJour.map((j, i) => {
                      const h = Math.round((j.total / maxJour) * 110) + 4;
                      const hL = j.total ? Math.round((j.livres / j.total) * h) : 0;
                      return (
                        <View key={i} style={styles.barCol}>
                          <Text style={styles.barVal}>{j.total}</Text>
                          <View style={[styles.bar, { height: h }]}>
                            <View style={[styles.barLivre, { height: hL }]} />
                          </View>
                          <Text style={styles.barLbl}>{labelJour(j.jour)}</Text>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              )}
              <View style={styles.legendRow}>
                <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: COLORS.gold }]} /><Text style={styles.legendTxt}>Voyages</Text></View>
                <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: COLORS.success }]} /><Text style={styles.legendTxt}>Livrés</Text></View>
              </View>
            </View>

            {/* Par chantier */}
            <Text style={styles.title}>Par chantier — période</Text>
            <View style={styles.card}>
              {(stats?.parChantier ?? []).length === 0 ? (
                <Text style={styles.emptyTxt}>Aucun voyage sur la période.</Text>
              ) : (
                stats!.parChantier.map((c, i) => {
                  const pct = c.total ? Math.round((c.livres / c.total) * 100) : 0;
                  return (
                    <View key={i} style={[styles.chRow, i > 0 && styles.chRowBorder]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.chName} numberOfLines={1}>{c.chantier}</Text>
                        <View style={styles.barBg}><View style={[styles.barFill, { width: `${pct}%` as any }]} /></View>
                      </View>
                      <Text style={styles.chCount}>{c.livres}/{c.total}</Text>
                    </View>
                  );
                })
              )}
            </View>

          </>
        )}
      </ScrollView>

      <PickerModal
        visible={pick === 'chantier'}
        title="Filtrer par chantier"
        items={chantiers.map(c => ({ id: c.id, label: c.designation, sub: c.code }))}
        onSelect={(id) => setSelChantier(id == null ? null : chantiers.find(c => c.id === id) ?? null)}
        onClose={() => setPick(null)}
      />
      <PickerModal
        visible={pick === 'chauffeur'}
        title="Filtrer par chauffeur"
        items={chauffeurs.map(c => ({ id: c.id, label: `${c.prenom} ${c.nom}`.trim() || `#${c.id}`, sub: c.matricule != null ? String(c.matricule) : undefined }))}
        onSelect={(id) => setSelChauffeur(id == null ? null : chauffeurs.find(c => c.id === id) ?? null)}
        onClose={() => setPick(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  // Filtres
  filterCard: {
    backgroundColor: COLORS.card, borderRadius: 14, padding: 12, gap: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  periodRow: { flexDirection: 'row', gap: 6 },
  periodChip: {
    flex: 1, paddingVertical: 8, borderRadius: 20, alignItems: 'center',
    backgroundColor: COLORS.goldTint, borderWidth: 1, borderColor: 'transparent',
  },
  periodChipActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  periodTxt: { fontSize: 12, fontWeight: '700', color: COLORS.goldDark },
  periodTxtActive: { color: COLORS.brown },
  selectBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11,
    borderWidth: 1, borderColor: COLORS.border,
  },
  selectTxt: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.text },
  selectTxtMuted: { color: COLORS.textSub, fontWeight: '500' },

  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.gold, borderRadius: 10, paddingVertical: 12, marginTop: 2,
  },
  downloadBtnDisabled: { opacity: 0.6 },
  downloadTxt: { fontSize: 13.5, fontWeight: '800', color: COLORS.brown },

  // KPI grid
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  kpi: {
    width: '31.5%', flexGrow: 1, backgroundColor: COLORS.card, borderRadius: 12, padding: 12, alignItems: 'center', gap: 3,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  kpiVal: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  kpiLbl: { fontSize: 10.5, color: COLORS.textSub, textAlign: 'center' },

  title: { fontSize: 15, fontWeight: '800', color: COLORS.text, marginTop: 22, marginBottom: 10 },
  card: {
    backgroundColor: COLORS.card, borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },

  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 150, gap: 6 },
  barCol: { alignItems: 'center', gap: 4, minWidth: 34 },
  barVal: { fontSize: 10, fontWeight: '700', color: COLORS.textSub },
  bar: { width: 22, backgroundColor: COLORS.gold, borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  barLivre: { width: '100%', backgroundColor: COLORS.success },
  barLbl: { fontSize: 10, color: COLORS.textSub, fontWeight: '600' },

  legendRow: { flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  legendTxt: { fontSize: 11, color: COLORS.textSub },

  chRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  chRowBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },
  chName: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  barBg: { height: 6, backgroundColor: COLORS.goldTint, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: COLORS.success, borderRadius: 3 },
  chCount: { fontSize: 13, fontWeight: '800', color: COLORS.textSub },

  emptyTxt: { fontSize: 13, color: COLORS.textFaint, textAlign: 'center', paddingVertical: 16 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 18, paddingHorizontal: 4 },
  noteTxt: { flex: 1, fontSize: 11, color: COLORS.textSub, lineHeight: 16 },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 16, paddingBottom: 28, maxHeight: '80%',
  },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.card, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text, padding: 0 },
  optAll: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  optAllTxt: { fontSize: 14, fontWeight: '700', color: COLORS.goldDark },
  opt: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  optTxt: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  optSub: { fontSize: 11, color: COLORS.textSub, marginTop: 2 },
});
