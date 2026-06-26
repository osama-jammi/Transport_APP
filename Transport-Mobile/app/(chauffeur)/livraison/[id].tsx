import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, StatusBar, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import type { RootState } from '@/store';
import {
  getArticlesByVoyage, getMatieresDuVoyageConteneur,
  type ArticleScan, type MatiereMp,
} from '@/services/livraisonService';
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
  const { id, vcId, projetCode } = useLocalSearchParams<{ id: string; vcId?: string; projetCode?: string }>();
  const router  = useRouter();
  const voyageId = Number(id);
  const voyageConteneurId = vcId ? Number(vcId) : null;

  const voyage = useSelector((s: RootState) => s.livraison.voyages.find(v => v.id === voyageId));

  const [articles,  setArticles]  = useState<ArticleScan[]>([]);
  const [matieres,  setMatieres]  = useState<MatiereMp[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [arts, allMp] = await Promise.all([
        getArticlesByVoyage(voyageId),
        voyageConteneurId ? getMatieresDuVoyageConteneur(voyageConteneurId) : Promise.resolve([]),
      ]);
      setArticles(arts);
      // Filtrer par chantier quand le code est défini ET qu'il y a des correspondances
      // Sinon afficher toutes les MP du voyage (le chauffeur doit toutes les valider)
      const code = projetCode || null;
      const filtered = code ? allMp.filter(m => (m.projet ?? null) === code) : allMp;
      setMatieres(filtered.length > 0 ? filtered : allMp);
    } catch {
      setError('Impossible de charger les articles.');
    } finally {
      setLoading(false);
    }
  }, [voyageId, voyageConteneurId, projetCode]);

  const scannerMp = (m: MatiereMp) => {
    router.push({
      pathname: '/(chauffeur)/scan',
      params: {
        articleNom: m.designation ?? m.reference,
        articleQr:  `DETAIL_MP:${m.id}`,
        phase: 'LIVRAISON',
      },
    });
  };

  // Recharge a chaque fois que l'ecran reprend le focus (ex. retour depuis le scan)
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const total      = articles.length;
  const charges    = articles.filter(a => a.statutScan !== 'NON_SCANNE').length;
  const livres     = articles.filter(a => a.statutScan === 'SCANNE_LIVRAISON').length;

  // Phase : tant que tout n'est pas chargé → CHARGEMENT ; sinon → LIVRAISON (à destination).
  const chargementComplet = total > 0 && articles.every(a => a.statutScan !== 'NON_SCANNE');
  const articlesTousLivres  = total === 0 || articles.every(a => a.statutScan === 'SCANNE_LIVRAISON');
  const matieresToutesLivrees = matieres.every(m => (m.statut || '').toUpperCase() === 'LIVRE');
  // Livraison complète = tous les articles livrés ET toutes les MP clôturées
  const livraisonComplete = (total > 0 || matieres.length > 0) && articlesTousLivres && matieresToutesLivrees;
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
        vcId:        vcId ?? '',
        projetCode:  projetCode ?? '',
      },
    });
  };

  // Ouvre le scanner en mode libre (QR voyage, QR article, ou QR MP).
  const openScanLibre = () => {
    router.push({
      pathname: '/(chauffeur)/scan',
      params: { voyageId: String(voyageId), phase, vcId: vcId ?? '', projetCode: projetCode ?? '' },
    });
  };

  const allerBL = () =>
    router.push({ pathname: '/(chauffeur)/bl', params: { voyageId: String(voyageId) } });

  const allerNavigation = () =>
    router.push({
      pathname: '/(chauffeur)/navigation',
      params: { voyageId: String(voyageId), vcId: vcId ?? '', projetCode: projetCode ?? '' },
    });

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

      {/* Bandeau état */}
      {dejaLivre ? (
        <View style={[styles.readonlyBar, { backgroundColor: COLORS.success }]}>
          <Ionicons name="checkmark-done-circle" size={13} color="#fff" />
          <Text style={[styles.readonlyTxt, { color: '#fff' }]}>Livraison terminée — lecture seule</Text>
        </View>
      ) : (
        <View style={styles.readonlyBar}>
          <Ionicons name="eye-outline" size={13} color="rgba(255,255,255,.75)" />
          <Text style={styles.readonlyTxt}>Mode consultation — scan uniquement, aucune modification possible</Text>
        </View>
      )}

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
        <ScrollView
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[COLORS.gold]} tintColor={COLORS.gold} />}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 130 }}
        >
          {phase === 'LIVRAISON' && !dejaLivre && (
            <View style={styles.phaseBanner}>
              <Ionicons name="cube-outline" size={18} color={COLORS.goldDark} />
              <Text style={styles.phaseBannerTxt}>
                Arrivé à destination ? Scannez chaque article livré, ou le QR du voyage pour tout valider d'un coup.
              </Text>
            </View>
          )}

          {/* Articles */}
          {articles.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={48} color={COLORS.textFaint} />
              <Text style={styles.emptyTxt}>Aucun article pour ce voyage</Text>
            </View>
          ) : (
            articles.map(item => <View key={String(item.id)}>{renderItem({ item })}</View>)
          )}

          {/* Matières premières */}
          {matieres.length > 0 && (
            <View style={styles.mpSection}>
              <View style={styles.mpHeader}>
                <Ionicons name="cube-outline" size={16} color={COLORS.brownSoft} />
                <Text style={styles.mpHeaderTxt}>Matières premières ({matieres.length})</Text>
              </View>
              {matieres.map(m => {
                const livre = (m.statut || '').toUpperCase() === 'LIVRE';
                return (
                  <View key={String(m.id)} style={[styles.mpCard, livre && styles.mpCardDone]}>
                    <View style={styles.mpCardBody}>
                      <Text style={styles.mpDesig} numberOfLines={2}>{m.designation || m.reference || '—'}</Text>
                      {m.reference ? <Text style={styles.mpRef}>Réf {m.reference}</Text> : null}
                      {m.pieceFournisseur ? <Text style={styles.mpRef}>Pièce {m.pieceFournisseur}</Text> : null}
                      <Text style={styles.mpRef}>Qté : {m.quantite ?? '—'}{m.unite ? ` ${m.unite}` : ''}</Text>
                    </View>
                    <View style={styles.mpRight}>
                      <View style={[styles.mpStatusPill, { backgroundColor: livre ? COLORS.success + '22' : COLORS.warn + '22' }]}>
                        <Text style={[styles.mpStatusTxt, { color: livre ? COLORS.success : COLORS.warn }]}>
                          {livre ? 'Livrée ✓' : 'En attente'}
                        </Text>
                      </View>
                      {!livre && !dejaLivre && (
                        <TouchableOpacity style={styles.mpBtn} onPress={() => scannerMp(m)} activeOpacity={0.75}>
                          <Ionicons name="qr-code-outline" size={14} color={COLORS.brown} />
                          <Text style={styles.mpBtnTxt}>Scanner</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* Barre d'action bas d'écran */}
      {!loading && !error && (total > 0 || matieres.length > 0) && (
        <View style={styles.actionBar}>
          {dejaLivre && voyage?.etatDechargement === 'TERMINE' ? (
            <View style={[styles.actionBtn, styles.actionDone]}>
              <Ionicons name="checkmark-done-circle" size={20} color="#fff" />
              <Text style={styles.actionTxt}>Livraison terminée</Text>
            </View>
          ) : livraisonComplete ? (
            <TouchableOpacity style={[styles.actionBtn, styles.actionGreen]} onPress={allerBL} activeOpacity={0.85}>
              <Ionicons name="document-text" size={19} color="#fff" />
              <Text style={styles.actionTxt}>Bon de livraison & terminer</Text>
            </TouchableOpacity>
          ) : articlesTousLivres && !matieresToutesLivrees ? (
            <View style={[styles.actionBtn, { backgroundColor: COLORS.warn }]}>
              <Ionicons name="layers-outline" size={19} color="#fff" />
              <Text style={styles.actionTxt}>Scannez encore les matières premières</Text>
            </View>
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

  mpSection:    { marginTop: 8, gap: 8 },
  mpHeader:     {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    marginBottom: 4,
  },
  mpHeaderTxt:  { fontSize: 14, fontWeight: '700', color: COLORS.text },
  mpCard:       {
    backgroundColor: COLORS.card, borderRadius: 12, padding: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  mpCardDone:   { opacity: 0.7 },
  mpCardBody:   { flex: 1, gap: 2 },
  mpDesig:      { fontSize: 13, fontWeight: '700', color: COLORS.text },
  mpRef:        { fontSize: 11, color: COLORS.textSub },
  mpRight:      { alignItems: 'flex-end', gap: 6 },
  mpStatusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  mpStatusTxt:  { fontSize: 10, fontWeight: '700' },
  mpBtn:        {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.gold, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  mpBtnTxt:     { fontSize: 12, fontWeight: '700', color: COLORS.brown },
});
