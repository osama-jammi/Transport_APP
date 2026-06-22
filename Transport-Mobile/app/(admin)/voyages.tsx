import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getVoyagesConteneurs, type VoyageConteneur } from '@/services/livraisonService';
import { COLORS } from '@/constants/theme';

type Filtre = 'TOUS' | 'EN_COURS' | 'LIVRE' | 'ATTENTE';
const FILTRES: { key: Filtre; label: string }[] = [
  { key: 'TOUS',     label: 'Tous' },
  { key: 'EN_COURS', label: 'En cours' },
  { key: 'LIVRE',    label: 'Livrés' },
  { key: 'ATTENTE',  label: 'En attente' },
];

const statut = (v: VoyageConteneur): { label: string; color: string } => {
  if (v.realDechargement) return { label: 'Livré ✓', color: COLORS.success };
  if (v.realChargement)   return { label: 'En route', color: COLORS.goldDark };
  return { label: 'En attente', color: COLORS.warn };
};

const matchFiltre = (v: VoyageConteneur, f: Filtre) => {
  if (f === 'TOUS') return true;
  if (f === 'LIVRE') return !!v.realDechargement;
  if (f === 'ATTENTE') return !v.realChargement && !v.realDechargement;
  return !v.realDechargement; // EN_COURS = pas encore livré
};

const formatJour = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : null;

export default function AdminVoyages() {
  const router = useRouter();
  const [voyages, setLocal] = useState<VoyageConteneur[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtre, setFiltre] = useState<Filtre>('TOUS');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLocal(await getVoyagesConteneurs()); // sans chauffeurId → tous les voyages
    } catch {
      // garde l'existant
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const affiches = voyages.filter(v => matchFiltre(v, filtre));

  const renderItem = ({ item }: { item: VoyageConteneur }) => {
    const s = statut(item);
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => router.push(`/(chauffeur)/voyage/${item.id}` as any)}
      >
        <View style={styles.cardBody}>
          <Text style={styles.title} numberOfLines={1}>
            Voyage #{item.id}{formatJour(item.dateVoyage) ? ` · ${formatJour(item.dateVoyage)}` : ''}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons name="person-outline" size={12} color={COLORS.textSub} />
            <Text style={styles.meta} numberOfLines={1}>{item.chauffeur || 'Non affecté'}</Text>
            <Ionicons name="cube-outline" size={12} color={COLORS.textSub} style={{ marginLeft: 10 }} />
            <Text style={styles.meta}>{item.nbLivraisons} livr.</Text>
            {item.nbMatieres > 0 ? (
              <>
                <Ionicons name="layers-outline" size={12} color={COLORS.textSub} style={{ marginLeft: 10 }} />
                <Text style={styles.meta}>{item.nbMatieres} mat.</Text>
              </>
            ) : null}
          </View>
          {item.localNom ? (
            <View style={styles.metaRow}>
              <Ionicons name="business-outline" size={12} color={COLORS.textSub} />
              <Text style={styles.meta} numberOfLines={1}>Départ : {item.localNom}</Text>
            </View>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 8 }}>
          <View style={[styles.pill, { backgroundColor: s.color + '22' }]}>
            <Text style={[styles.pillTxt, { color: s.color }]}>{s.label}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textFaint} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {FILTRES.map(f => {
          const active = filtre === f.key;
          const n = voyages.filter(v => matchFiltre(v, f.key)).length;
          return (
            <TouchableOpacity key={f.key} style={[styles.chip, active && styles.chipActive]} onPress={() => setFiltre(f.key)} activeOpacity={0.8}>
              <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{f.label} ({n})</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading && voyages.length === 0 ? (
        <ActivityIndicator color={COLORS.gold} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={affiches}
          keyExtractor={v => String(v.id)}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[COLORS.gold]} tintColor={COLORS.gold} />}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          ListEmptyComponent={(
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={52} color={COLORS.textFaint} />
              <Text style={styles.emptyTxt}>Aucun voyage</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16, paddingBottom: 4 },
  chip: { backgroundColor: COLORS.card, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: COLORS.border },
  chipActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  chipTxt: { fontSize: 12.5, fontWeight: '700', color: COLORS.textSub },
  chipTxtActive: { color: COLORS.brown },

  card: {
    backgroundColor: COLORS.card, borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardBody: { flex: 1, gap: 3 },
  title: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { fontSize: 12, color: COLORS.textSub },
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  pillTxt: { fontSize: 10, fontWeight: '800' },

  empty: { alignItems: 'center', paddingTop: 70, gap: 8 },
  emptyTxt: { fontSize: 16, fontWeight: '700', color: COLORS.textSub },
});
