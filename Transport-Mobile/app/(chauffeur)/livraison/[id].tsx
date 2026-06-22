import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import type { RootState } from '@/store';
import { getArticlesByVoyage, type ArticleScan } from '@/services/livraisonService';
import { COLORS } from '@/constants/theme';

// Libelle/couleur d'un article selon son statut de scan et la phase courante.
const statutArticle = (statut: ArticleScan['statutScan']) => {
  switch (statut) {
    case 'SCANNE_LIVRAISON':  return { label: 'Livré ✓',  color: COLORS.success, icon: 'checkmark-done-circle' };
    case 'SCANNE_CHARGEMENT': return { label: 'Chargé ✓', color: COLORS.goldDark, icon: 'checkmark-circle' };
    default:                  return { label: 'À charger', color: COLORS.warn,    icon: 'radio-button-off-outline' };
  }
};

export default function LivraisonArticlesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const voyageId = Number(id);

  const voyage = useSelector((s: RootState) => s.livraison.voyages.find(v => v.id === voyageId));

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

  const total      = articles.length;
  const charges    = articles.filter(a => a.statutScan !== 'NON_SCANNE').length;
  const livres     = articles.filter(a => a.statutScan === 'SCANNE_LIVRAISON').length;

  // Phase : tant que tout n'est pas chargé → CHARGEMENT ; sinon → LIVRAISON (à destination).
  const chargementComplet = total > 0 && articles.every(a => a.statutScan !== 'NON_SCANNE');
  const livraisonComplete = total > 0 && articles.every(a => a.statutScan === 'SCANNE_LIVRAISON');
  const dejaLivre = voyage?.etatDechargement === 'TERMINE' || livraisonComplete;
  const phase: 'CHARGEMENT' | 'LIVRAISON' = chargementComplet ? 'LIVRAISON' : 'CHARGEMENT';

  // Progression affichée selon la phase
  const fait = phase === 'LIVRAISON' ? livres : charges;
  const pct  = total ? Math.round((fait / total) * 100) : 0;

  const articleScannable = (a: ArticleScan) =>
    phase === 'CHARGEMENT' ? a.statutScan === 'NON_SCANNE' : a.statutScan === 'SCANNE_CHARGEMENT';

  // Ouvre le scanner pour un article precis (verifie le QR attendu).
  const openScanArticle = (article: ArticleScan) => {
    router.push({
      pathname: '/(chauffeur)/scan',
      params: {
        articleId:   String(article.id),
        articleNom:  article.nom,
        articleQr:   article.qrCode,
        destination: article.chantierDestination,
        voyageId:    String(voyageId),
        phase,
      },
    });
  };

  // Ouvre le scanner en mode libre : accepte le QR du voyage (marque tout) ou de n'importe quel article.
  const openScanLibre = () => {
    router.push({
      pathname: '/(chauffeur)/scan',
      params: { voyageId: String(voyageId), phase },
    });
  };

  const allerBL = () =>
    router.push({ pathname: '/(chauffeur)/bl', params: { voyageId: String(voyageId) } });

  const allerNavigation = () =>
    router.push({ pathname: '/(chauffeur)/navigation', params: { voyageId: String(voyageId) } });

  const renderItem = ({ item }: { item: ArticleScan }) => {
    const s = statutArticle(item.statutScan);
    const scannable = articleScannable(item);
    // Libelle adapté à la phase
    const label = item.statutScan === 'NON_SCANNE' && phase === 'LIVRAISON' ? 'En attente'
      : item.statutScan === 'SCANNE_CHARGEMENT' && phase === 'LIVRAISON' ? 'À livrer'
      : s.label;

    return (
      <TouchableOpacity
        style={[styles.card, !scannable && styles.cardDone]}
        activeOpacity={scannable ? 0.8 : 1}
        onPress={() => scannable && openScanArticle(item)}
      >
        <View style={[styles.statusIcon, { backgroundColor: s.color + '1F' }]}>
          <Ionicons name={s.icon as any} size={22} color={s.color} />
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.nom}</Text>
          <View style={styles.cardMeta}>
            <Ionicons name="location-outline" size={12} color={COLORS.textSub} />
            <Text style={styles.cardMetaTxt} numberOfLines={1}>{item.chantierDestination}</Text>
          </View>
          {item.referenceGap ? (
            <Text style={styles.refTxt}>Réf: {item.referenceGap}</Text>
          ) : null}
        </View>

        <View style={[styles.statusPill, { backgroundColor: s.color + '1F' }]}>
          <Text style={[styles.statusTxt, { color: s.color }]}>{label}</Text>
        </View>

        {scannable && (
          <Ionicons name="qr-code-outline" size={22} color={COLORS.goldDark} style={{ marginLeft: 4 }} />
        )}
      </TouchableOpacity>
    );
  };

  const scanLabel = phase === 'LIVRAISON' ? 'Scanner la livraison' : 'Scanner le chargement';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.brownDeep} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(chauffeur)'))}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerSub}>Voyage #{voyageId}{voyage?.client ? ` · ${voyage.client}` : ''}</Text>
          <Text style={styles.headerTitle}>{phase === 'LIVRAISON' ? 'Livraison des articles' : 'Articles à charger'}</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={allerNavigation}>
          <Ionicons name="navigate-outline" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.iconBtn, { marginLeft: 8 }]} onPress={load}>
          <Ionicons name="refresh-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Bandeau consultation (lecture seule) */}
      <View style={styles.readonlyBar}>
        <Ionicons name="eye-outline" size={13} color="rgba(255,255,255,.75)" />
        <Text style={styles.readonlyTxt}>Mode consultation — scan uniquement, aucune modification possible</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
        </View>
        <Text style={styles.progressTxt}>
          {phase === 'LIVRAISON' ? `${livres}/${total} articles livrés` : `${charges}/${total} articles chargés`}
        </Text>
      </View>

      {/* Stats pills */}
      <View style={styles.statRow}>
        <View style={styles.statPill}>
          <Text style={[styles.statNum, { color: COLORS.warn }]}>
            {articles.filter(a => a.statutScan === 'NON_SCANNE').length}
          </Text>
          <Text style={styles.statLbl}>À charger</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={[styles.statNum, { color: COLORS.goldDark }]}>
            {articles.filter(a => a.statutScan === 'SCANNE_CHARGEMENT').length}
          </Text>
          <Text style={styles.statLbl}>Chargés</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={[styles.statNum, { color: COLORS.success }]}>{livres}</Text>
          <Text style={styles.statLbl}>Livrés</Text>
        </View>
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
          data={articles}
          keyExtractor={a => String(a.id)}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[COLORS.gold]} tintColor={COLORS.gold} />}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 130 }}
          ListHeaderComponent={
            phase === 'LIVRAISON' && !dejaLivre ? (
              <View style={styles.phaseBanner}>
                <Ionicons name="cube-outline" size={18} color={COLORS.goldDark} />
                <Text style={styles.phaseBannerTxt}>
                  Arrivé à destination ? Scannez chaque article livré, ou le QR du voyage pour tout valider d'un coup.
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={(
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={48} color={COLORS.textFaint} />
              <Text style={styles.emptyTxt}>Aucun article pour ce voyage</Text>
            </View>
          )}
        />
      )}

      {/* Barre d'action bas d'écran */}
      {!loading && !error && total > 0 && (
        <View style={styles.actionBar}>
          {dejaLivre ? (
            <View style={[styles.actionBtn, styles.actionDone]}>
              <Ionicons name="checkmark-done-circle" size={20} color="#fff" />
              <Text style={styles.actionTxt}>Voyage livré</Text>
            </View>
          ) : livraisonComplete ? (
            <TouchableOpacity style={[styles.actionBtn, styles.actionGreen]} onPress={allerBL} activeOpacity={0.85}>
              <Ionicons name="document-text" size={19} color="#fff" />
              <Text style={styles.actionTxt}>Bon de livraison & terminer</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.actionBtn, styles.actionGold]} onPress={openScanLibre} activeOpacity={0.85}>
              <Ionicons name="qr-code" size={19} color={COLORS.brown} />
              <Text style={[styles.actionTxt, { color: COLORS.brown }]}>{scanLabel}</Text>
            </TouchableOpacity>
          )}
        </View>
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

  readonlyBar:  {
    backgroundColor: COLORS.brownSoft, flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 7,
  },
  readonlyTxt:  { color: 'rgba(255,255,255,.8)', fontSize: 11, flex: 1 },

  progressBar:  {
    backgroundColor: COLORS.brown, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 18,
  },
  progressBg:   {
    height: 6, backgroundColor: 'rgba(255,255,255,.18)',
    borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: COLORS.gold, borderRadius: 3 },
  progressTxt:  { color: 'rgba(255,255,255,.65)', fontSize: 11, marginTop: 6, textAlign: 'right' },

  statRow:      {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  statPill:     {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: 12, backgroundColor: COLORS.card,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  statNum:      { fontSize: 18, fontWeight: '800' },
  statLbl:      { fontSize: 10, color: COLORS.textSub, marginTop: 2 },

  phaseBanner:  {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.goldSoft, borderRadius: 12, padding: 12, marginBottom: 4,
  },
  phaseBannerTxt: { flex: 1, color: COLORS.brown, fontSize: 12, fontWeight: '600', lineHeight: 17 },

  card:         {
    backgroundColor: COLORS.card, borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardDone:     { opacity: 0.72 },
  statusIcon:   {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  cardBody:     { flex: 1, gap: 3 },
  cardTitle:    { fontSize: 14, fontWeight: '700', color: COLORS.text },
  cardMeta:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMetaTxt:  { fontSize: 12, color: COLORS.textSub, flex: 1 },
  refTxt:       { fontSize: 11, color: COLORS.textFaint },
  statusPill:   {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  statusTxt:    { fontSize: 10, fontWeight: '700' },

  actionBar:    {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: 16, paddingBottom: 26, backgroundColor: 'rgba(246,241,233,.96)',
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  actionBtn:    {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    borderRadius: 14, paddingVertical: 15,
  },
  actionGold:   { backgroundColor: COLORS.gold },
  actionGreen:  { backgroundColor: COLORS.success },
  actionDone:   { backgroundColor: COLORS.success, opacity: 0.85 },
  actionTxt:    { color: '#fff', fontWeight: '800', fontSize: 15 },

  empty:        { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTxt:     { fontSize: 15, color: COLORS.textSub, fontWeight: '600', textAlign: 'center' },
  retryBtn:     {
    backgroundColor: COLORS.gold, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20,
  },
  retryTxt:     { color: COLORS.brown, fontWeight: '700' },
});
