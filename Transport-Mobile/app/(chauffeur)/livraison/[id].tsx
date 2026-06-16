import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getArticlesByVoyage, type ArticleScan } from '@/services/livraisonService';

const SCAN_STATUS: Record<string, { label: string; color: string; icon: string }> = {
  NON_SCANNE:         { label: 'À scanner',   color: '#F59E0B', icon: 'radio-button-off-outline' },
  SCANNE_CHARGEMENT:  { label: 'Chargé ✓',    color: '#8b7bff', icon: 'checkmark-circle-outline' },
  SCANNE_LIVRAISON:   { label: 'Livré ✓',     color: '#10B981', icon: 'checkmark-done-circle-outline' },
};

export default function LivraisonArticlesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const voyageId = Number(id);

  const [articles, setArticles] = useState<ArticleScan[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getArticlesByVoyage(voyageId);
      setArticles(data);
    } catch {
      setError('Impossible de charger les articles.');
    } finally {
      setLoading(false);
    }
  }, [voyageId]);

  // Recharge a chaque fois que l'ecran reprend le focus (ex. retour depuis le scan)
  // pour que la progression des articles se mette a jour.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const scanned   = articles.filter(a => a.statutScan !== 'NON_SCANNE').length;
  const total     = articles.length;
  const pct       = total ? Math.round((scanned / total) * 100) : 0;

  const openScan = (article: ArticleScan) => {
    router.push({
      pathname: '/(chauffeur)/scan',
      params: {
        articleId:    String(article.id),
        articleNom:   article.nom,
        articleQr:    article.qrCode,
        destination:  article.chantierDestination,
        voyageId:     String(voyageId),
      },
    });
  };

  const renderItem = ({ item }: { item: ArticleScan }) => {
    const s = SCAN_STATUS[item.statutScan] ?? SCAN_STATUS.NON_SCANNE;
    const canScan = item.statutScan === 'NON_SCANNE';

    return (
      <TouchableOpacity
        style={[styles.card, !canScan && styles.cardDone]}
        activeOpacity={canScan ? 0.8 : 1}
        onPress={() => canScan && openScan(item)}
      >
        <View style={[styles.statusIcon, { backgroundColor: s.color + '18' }]}>
          <Ionicons name={s.icon as any} size={22} color={s.color} />
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.nom}</Text>
          <View style={styles.cardMeta}>
            <Ionicons name="location-outline" size={12} color="#64748B" />
            <Text style={styles.cardMetaTxt} numberOfLines={1}>{item.chantierDestination}</Text>
          </View>
          {item.referenceGap ? (
            <Text style={styles.refTxt}>Réf: {item.referenceGap}</Text>
          ) : null}
        </View>

        <View style={[styles.statusPill, { backgroundColor: s.color + '18' }]}>
          <Text style={[styles.statusTxt, { color: s.color }]}>{s.label}</Text>
        </View>

        {canScan && (
          <Ionicons name="qr-code-outline" size={22} color="#8b7bff" style={{ marginLeft: 4 }} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e1b34" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(chauffeur)'))}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerSub}>Voyage #{voyageId}</Text>
          <Text style={styles.headerTitle}>Articles à livrer</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => router.push({ pathname: '/(chauffeur)/navigation', params: { voyageId: String(voyageId) } })}
        >
          <Ionicons name="navigate-outline" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.refreshBtn, { marginLeft: 8 }]} onPress={load}>
          <Ionicons name="refresh-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
        </View>
        <Text style={styles.progressTxt}>{scanned}/{total} articles scannés</Text>
      </View>

      {/* Stats pills */}
      <View style={styles.statRow}>
        <View style={[styles.statPill, { backgroundColor: '#FEF3C720' }]}>
          <Text style={[styles.statNum, { color: '#F59E0B' }]}>
            {articles.filter(a => a.statutScan === 'NON_SCANNE').length}
          </Text>
          <Text style={styles.statLbl}>À scanner</Text>
        </View>
        <View style={[styles.statPill, { backgroundColor: '#DBEAFE20' }]}>
          <Text style={[styles.statNum, { color: '#8b7bff' }]}>
            {articles.filter(a => a.statutScan === 'SCANNE_CHARGEMENT').length}
          </Text>
          <Text style={styles.statLbl}>Chargés</Text>
        </View>
        <View style={[styles.statPill, { backgroundColor: '#D1FAE520' }]}>
          <Text style={[styles.statNum, { color: '#10B981' }]}>
            {articles.filter(a => a.statutScan === 'SCANNE_LIVRAISON').length}
          </Text>
          <Text style={styles.statLbl}>Livrés</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color="#8b7bff" style={{ marginTop: 32 }} />
      ) : error ? (
        <View style={styles.empty}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.emptyTxt}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryTxt}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={articles}
          keyExtractor={a => String(a.id)}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={['#8b7bff']} />}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          ListEmptyComponent={(
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyTxt}>Aucun article pour ce voyage</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F0F4F8' },

  header:       {
    backgroundColor: '#1e1b34',
    paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  backBtn:      {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  refreshBtn:   {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerSub:    { color: 'rgba(255,255,255,.5)', fontSize: 11 },
  headerTitle:  { color: '#fff', fontSize: 17, fontWeight: '700' },

  progressBar:  {
    backgroundColor: '#1e1b34', paddingHorizontal: 16, paddingBottom: 18,
  },
  progressBg:   {
    height: 6, backgroundColor: 'rgba(255,255,255,.15)',
    borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#10B981', borderRadius: 3 },
  progressTxt:  { color: 'rgba(255,255,255,.55)', fontSize: 11, marginTop: 6, textAlign: 'right' },

  statRow:      {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  statPill:     {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: 12, backgroundColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  statNum:      { fontSize: 18, fontWeight: '800' },
  statLbl:      { fontSize: 10, color: '#94A3B8', marginTop: 2 },

  card:         {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardDone:     { opacity: 0.75 },
  statusIcon:   {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  cardBody:     { flex: 1, gap: 3 },
  cardTitle:    { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  cardMeta:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMetaTxt:  { fontSize: 12, color: '#64748B', flex: 1 },
  refTxt:       { fontSize: 11, color: '#94A3B8' },
  statusPill:   {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  statusTxt:    { fontSize: 10, fontWeight: '700' },

  empty:        { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTxt:     { fontSize: 15, color: '#94A3B8', fontWeight: '600', textAlign: 'center' },
  retryBtn:     {
    backgroundColor: '#8b7bff', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20,
  },
  retryTxt:     { color: '#fff', fontWeight: '700' },
});
