import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { setVoyages } from '@/store/livraisonSlice';
import { getLivraisonsDuVoyage, type Voyage } from '@/services/livraisonService';
import { COLORS } from '@/constants/theme';

// Statut d'une livraison du voyage : Livré > Chargé > En cours.
const statutLivraison = (v: Voyage): { label: string; color: string; icon: string } => {
  if (v.etatDechargement === 'TERMINE') return { label: 'Livré ✓', color: COLORS.success, icon: 'checkmark-done-circle' };
  if (v.etatChargement === 'TERMINE')   return { label: 'Chargé ✓', color: COLORS.goldDark, icon: 'checkmark-circle' };
  return { label: 'À charger', color: COLORS.warn, icon: 'radio-button-off-outline' };
};

export default function VoyageLivraisonsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router   = useRouter();
  const dispatch = useDispatch();
  const voyageId = Number(id);

  const [livraisons, setLivraisons] = useState<Voyage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLivraisonsDuVoyage(voyageId);
      setLivraisons(data);
      // Alimente le store : les écrans détail / BL / navigation lisent la livraison ici.
      dispatch(setVoyages(data));
    } catch {
      setError('Impossible de charger les livraisons du voyage.');
    } finally {
      setLoading(false);
    }
  }, [voyageId, dispatch]);

  // Recharge a chaque focus (ex. retour depuis une livraison) pour mettre a jour la progression.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const total  = livraisons.length;
  const livres = livraisons.filter(v => v.etatDechargement === 'TERMINE').length;
  const pct    = total ? Math.round((livres / total) * 100) : 0;

  const renderItem = ({ item, index }: { item: Voyage; index: number }) => {
    const s = statutLivraison(item);
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => router.push(`/(chauffeur)/livraison/${item.id}`)}
      >
        <View style={[styles.statusIcon, { backgroundColor: s.color + '1F' }]}>
          <Ionicons name={s.icon as any} size={22} color={s.color} />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.client || `Livraison #${item.id}`}</Text>
          <View style={styles.cardMeta}>
            <Ionicons name="cube-outline" size={12} color={COLORS.textSub} />
            <Text style={styles.cardMetaTxt}>{item.nbArticles ?? item.nbColis} article(s)</Text>
            {item.bl ? (
              <>
                <Ionicons name="document-text-outline" size={12} color={COLORS.textSub} style={{ marginLeft: 10 }} />
                <Text style={styles.cardMetaTxt} numberOfLines={1}>BL {item.bl}</Text>
              </>
            ) : null}
          </View>
        </View>
        <View style={[styles.statusPill, { backgroundColor: s.color + '1F' }]}>
          <Text style={[styles.statusTxt, { color: s.color }]}>{s.label}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textFaint} style={{ marginLeft: 2 }} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.brownDeep} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(chauffeur)'))}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerSub}>Voyage #{voyageId}</Text>
          <Text style={styles.headerTitle}>Livraisons du voyage</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={load}>
          <Ionicons name="refresh-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
        </View>
        <Text style={styles.progressTxt}>{livres}/{total} livraison(s) livrée(s)</Text>
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
      ) : (
        <FlatList
          data={livraisons}
          keyExtractor={v => String(v.id)}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[COLORS.gold]} tintColor={COLORS.gold} />}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          ListEmptyComponent={(
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={48} color={COLORS.textFaint} />
              <Text style={styles.emptyTxt}>Aucune livraison dans ce voyage</Text>
            </View>
          )}
        />
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
  backBtn:      {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtn:      {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerSub:    { color: 'rgba(255,255,255,.55)', fontSize: 11 },
  headerTitle:  { color: '#fff', fontSize: 17, fontWeight: '700' },

  progressBar:  {
    backgroundColor: COLORS.brown, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 18,
  },
  progressBg:   {
    height: 6, backgroundColor: 'rgba(255,255,255,.18)',
    borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: COLORS.gold, borderRadius: 3 },
  progressTxt:  { color: 'rgba(255,255,255,.65)', fontSize: 11, marginTop: 6, textAlign: 'right' },

  card:         {
    backgroundColor: COLORS.card, borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  statusIcon:   {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  cardBody:     { flex: 1, gap: 3 },
  cardTitle:    { fontSize: 14, fontWeight: '700', color: COLORS.text },
  cardMeta:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMetaTxt:  { fontSize: 12, color: COLORS.textSub },
  statusPill:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusTxt:    { fontSize: 10, fontWeight: '700' },

  empty:        { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTxt:     { fontSize: 15, color: COLORS.textSub, fontWeight: '600', textAlign: 'center' },
  retryBtn:     { backgroundColor: COLORS.gold, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
  retryTxt:     { color: COLORS.brown, fontWeight: '700' },
});
