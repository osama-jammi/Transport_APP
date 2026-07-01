import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Alert,
  StyleSheet, ActivityIndicator, RefreshControl, StatusBar, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getArticlesByVoyage, getMatieresDuVoyageConteneur, getLivraisonsDuVoyage, getArriveeChantier,
  mpEstChargee, mpEstLivree,
  type ArticleScan, type MatiereMp, type Voyage,
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
  const voyageConteneurId = vcId ? Number(vcId) : null;
  const code = projetCode || null;

  // 1 ligne = 1 chantier : on agrège tous les OF du chantier + ses MP.
  const [ofs,       setOfs]       = useState<Voyage[]>([]);
  const [articles,  setArticles]  = useState<ArticleScan[]>([]);
  // Articles regroupés par OF (livraison) pour afficher un titre par livraison.
  const [articleGroupes, setArticleGroupes] = useState<{ of: Voyage; articles: ArticleScan[] }[]>([]);
  const [matieres,  setMatieres]  = useState<MatiereMp[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  // Arrivée niveau (voyage conteneur, chantier) — sert aux lignes SANS OF (MP/stock seuls),
  // qui n'ont pas de livraison GAP pour porter arrivee_dechargement.
  const [arriveeChantier, setArriveeChantier] = useState<string | null>(null);

  const primaryOfId   = ofs[0]?.id ?? Number(id);
  const chantierLabel = ofs[0]?.client ?? '';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Tous les OF du chantier (filtrés par projetCode ; fallback sur l'OF passé en paramètre)
      let chantierOfs: Voyage[] = [];
      if (voyageConteneurId) {
        const livs = await getLivraisonsDuVoyage(voyageConteneurId);
        chantierOfs = code ? livs.filter(l => (l.projetCode ?? null) === code) : livs;
        if (chantierOfs.length === 0 && id) chantierOfs = livs.filter(l => l.id === Number(id));
      }
      setOfs(chantierOfs);

      // Articles de chaque OF (gardés groupés par livraison) + MP du chantier
      const [artsLists, allMp] = await Promise.all([
        Promise.all(chantierOfs.map(o => getArticlesByVoyage(o.id))),
        voyageConteneurId ? getMatieresDuVoyageConteneur(voyageConteneurId) : Promise.resolve([]),
      ]);
      const groupes = chantierOfs.map((o, i) => ({ of: o, articles: artsLists[i] ?? [] }));
      setArticleGroupes(groupes);
      setArticles(groupes.flatMap(g => g.articles));
      // MP affectées à CE chantier uniquement (comparaison normalisée comme le web).
      const norm = (s?: string | null) => (s || '').trim();
      setMatieres(code ? allMp.filter(m => norm(m.projet) === norm(code)) : allMp);

      // Arrivée (voyage conteneur, chantier) — pour les lignes sans OF (MP/stock seuls).
      if (voyageConteneurId && code) {
        try { setArriveeChantier(await getArriveeChantier(voyageConteneurId, code)); }
        catch { setArriveeChantier(null); }
      } else {
        setArriveeChantier(null);
      }
    } catch {
      setError('Impossible de charger la ligne.');
    } finally {
      setLoading(false);
    }
  }, [id, voyageConteneurId, code]);

  // Recharge a chaque fois que l'ecran reprend le focus (ex. retour depuis le scan)
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const total      = articles.length;

  // MP en 2 phases (comme les articles) : CHARGE puis LIVRE.
  const matieresToutesChargees = matieres.every(m => mpEstChargee(m.statut));
  const matieresToutesLivrees  = matieres.every(m => mpEstLivree(m.statut));

  // CHARGEMENT complet = tous les articles chargés ET toutes les MP chargées
  const articlesCharges    = articles.every(a => a.statutScan !== 'NON_SCANNE');
  const chargementComplet  = (total > 0 || matieres.length > 0) && articlesCharges && matieresToutesChargees;
  const phase: 'CHARGEMENT' | 'LIVRAISON' = chargementComplet ? 'LIVRAISON' : 'CHARGEMENT';

  // LIVRAISON complète = articles livrés ET MP toutes LIVRE
  const articlesTousLivres = total === 0 || articles.every(a => a.statutScan === 'SCANNE_LIVRAISON');
  const livraisonComplete  = phase === 'LIVRAISON' && (total > 0 || matieres.length > 0) && articlesTousLivres && matieresToutesLivrees;
  const tousOfLivres       = ofs.length > 0 && ofs.every(o => o.etatDechargement === 'TERMINE');
  // Ligne "terminée" (lecture seule) :
  //  • lignes avec OF → une fois réellement LIVRÉE (BL fourni → etatDechargement TERMINE),
  //    pas juste après le 2ᵉ scan ;
  //  • lignes MP seules (sans OF) → quand toutes les MP sont livrées (pas de BL attendu).
  const ligneTerminee      = ofs.length > 0 ? tousOfLivres
                                            : (matieres.length > 0 && matieresToutesLivrees);
  const dejaLivre          = ligneTerminee;

  // Arrivée confirmée au chantier : soit via une livraison (geofence « Je suis sur place »
  // / code de forçage, propagée à tous les OF du chantier), soit via le couple
  // (voyage conteneur, chantier) pour les lignes SANS OF (MP/stock seuls).
  const arriveeConfirmee   = ofs.some(o => o.arriveeConfirmee) || !!arriveeChantier;
  // En phase LIVRAISON, le 2ᵉ scan est INTERDIT tant que l'arrivée n'est pas confirmée —
  // que la ligne ait des OF ou soit composée uniquement de matières/stock.
  const arriveeRequise     = phase === 'LIVRAISON' && !dejaLivre
                              && (ofs.length > 0 || matieres.length > 0) && !arriveeConfirmee;

  // Progression / pastilles : combinent articles ET matières premières.
  const itemsACharger = articles.filter(a => a.statutScan === 'NON_SCANNE').length
                      + matieres.filter(m => !mpEstChargee(m.statut)).length;
  const itemsCharges  = articles.filter(a => a.statutScan === 'SCANNE_CHARGEMENT').length
                      + matieres.filter(m => mpEstChargee(m.statut) && !mpEstLivree(m.statut)).length;
  const itemsLivres   = articles.filter(a => a.statutScan === 'SCANNE_LIVRAISON').length
                      + matieres.filter(m => mpEstLivree(m.statut)).length;
  const itemsTotal    = articles.length + matieres.length;
  const faitItems     = phase === 'LIVRAISON' ? itemsLivres : (itemsCharges + itemsLivres);
  const pctItems      = itemsTotal ? Math.round((faitItems / itemsTotal) * 100) : 0;

  // En phase LIVRAISON, tant que l'arrivée n'est pas confirmée, aucune carte n'est
  // scannable : pas de bouton/QR affiché (l'utilisateur doit d'abord confirmer sa
  // localisation via l'écran Navigation).
  const arriveeOk = phase !== 'LIVRAISON' || arriveeConfirmee;
  const articleScannable = (a: ArticleScan) =>
    !dejaLivre && arriveeOk && (phase === 'CHARGEMENT' ? a.statutScan === 'NON_SCANNE' : a.statutScan === 'SCANNE_CHARGEMENT');
  // MP scannable : au chargement si pas encore chargée ; à la livraison si chargée mais pas livrée.
  const mpScannable = (m: MatiereMp) =>
    !dejaLivre && arriveeOk && (phase === 'CHARGEMENT' ? !mpEstChargee(m.statut) : (mpEstChargee(m.statut) && !mpEstLivree(m.statut)));

  // Paramètres communs passés au scanner (contexte chantier).
  const baseParams = { voyageId: String(primaryOfId), phase, vcId: vcId ?? '', projetCode: projetCode ?? '' };

  const allerNavigation = () =>
    router.push({
      pathname: '/(chauffeur)/navigation',
      params: { voyageId: String(primaryOfId), vcId: vcId ?? '', projetCode: projetCode ?? '' },
    });

  // Garde du 2ᵉ scan : tant que l'arrivée n'est pas confirmée, on redirige vers l'écran
  // Navigation (« Je suis sur place » / code de forçage) au lieu d'ouvrir le scanner.
  // Renvoie true si le scan peut continuer.
  const verifierArrivee = (): boolean => {
    if (!arriveeRequise) return true;
    Alert.alert(
      'Confirmez votre arrivée',
      "Avant de scanner la livraison, confirmez votre arrivée au chantier (« Je suis sur place ») ou forcez avec le code administration.",
      [
        { text: 'Annuler', style: 'cancel' },
        { text: "Confirmer l'arrivée", onPress: allerNavigation },
      ],
    );
    return false;
  };

  // Ouvre le scanner pour un article precis (verifie le QR attendu).
  const openScanArticle = (article: ArticleScan) => {
    if (!verifierArrivee()) return;
    router.push({
      pathname: '/(chauffeur)/scan',
      params: {
        ...baseParams,
        articleId:   String(article.id),
        articleNom:  article.nom,
        articleQr:   article.qrCode,
        destination: article.chantierDestination,
      },
    });
  };

  // Ouvre le scanner pour une MP précise (comme un article).
  const scannerMp = (m: MatiereMp) => {
    if (!verifierArrivee()) return;
    router.push({
      pathname: '/(chauffeur)/scan',
      params: { ...baseParams, articleNom: m.designation ?? m.reference, articleQr: `DETAIL_MP:${m.id}` },
    });
  };

  // Carte d'une ligne (matière première OU stock) — même rendu, distinguée par la source.
  const renderMpCard = (m: MatiereMp) => {
    const livre   = mpEstLivree(m.statut);
    const charge  = mpEstChargee(m.statut) && !livre;
    const scannable = mpScannable(m);
    const statutColor = livre ? COLORS.success : charge ? COLORS.goldDark : COLORS.warn;
    const statutTxt   = livre ? 'Livré ✓' : charge ? 'Chargé ✓' : (phase === 'LIVRAISON' ? 'À livrer' : 'À charger');
    return (
      <TouchableOpacity key={String(m.id)} style={[styles.mpCard, !scannable && styles.mpCardDone]}
        activeOpacity={scannable ? 0.8 : 1} onPress={() => scannable && scannerMp(m)}>
        <View style={styles.mpCardBody}>
          <Text style={styles.mpDesig} numberOfLines={2}>{m.designation || m.reference || '—'}</Text>
          {m.reference ? <Text style={styles.mpRef}>Réf {m.reference}</Text> : null}
          {m.source === 'STOCK'
            ? (m.depot ? <Text style={styles.mpRef}>Dépôt {m.depot}</Text> : null)
            : (m.pieceFournisseur ? <Text style={styles.mpRef}>Pièce {m.pieceFournisseur}</Text> : null)}
          <Text style={styles.mpRef}>Qté : {m.quantite ?? '—'}{m.unite ? ` ${m.unite}` : ''}</Text>
        </View>
        <View style={styles.mpRight}>
          <View style={[styles.mpStatusPill, { backgroundColor: statutColor + '22' }]}>
            <Text style={[styles.mpStatusTxt, { color: statutColor }]}>{statutTxt}</Text>
          </View>
          {scannable && (
            <Ionicons name="qr-code-outline" size={20} color={COLORS.goldDark} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Ouvre le scanner en mode libre (QR voyage, QR ligne, QR article, ou QR MP).
  const openScanLibre = () => {
    if (!verifierArrivee()) return;
    router.push({ pathname: '/(chauffeur)/scan', params: baseParams });
  };

  const allerBL = () =>
    router.push({ pathname: '/(chauffeur)/bl', params: { voyageId: String(primaryOfId) } });

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
          <Text style={styles.headerSub} numberOfLines={1}>{chantierLabel ? `Chantier · ${chantierLabel}` : `Voyage #${vcId ?? ''}`}</Text>
          <Text style={styles.headerTitle}>{phase === 'LIVRAISON' ? 'Livraison de la ligne' : 'Ligne à charger'}</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={allerNavigation}>
          <Ionicons name="navigate-outline" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.iconBtn, { marginLeft: 8 }]} onPress={load}>
          <Ionicons name="refresh-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Bandeau état : uniquement quand la ligne est terminée (lecture seule) */}
      {dejaLivre && (
        <View style={[styles.readonlyBar, { backgroundColor: COLORS.success }]}>
          <Ionicons name="checkmark-done-circle" size={13} color="#fff" />
          <Text style={[styles.readonlyTxt, { color: '#fff' }]}>Ligne terminée</Text>
        </View>
      )}

      {/* Progress bar (articles + matières premières) */}
      <View style={styles.progressBar}>
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${pctItems}%` as any }]} />
        </View>
        <Text style={styles.progressTxt}>
          {phase === 'LIVRAISON' ? `${itemsLivres}/${itemsTotal} livré(s)` : `${faitItems}/${itemsTotal} chargé(s)`}
        </Text>
      </View>

      {/* Stats pills (articles + matières premières) */}
      <View style={styles.statRow}>
        <View style={styles.statPill}>
          <Text style={[styles.statNum, { color: COLORS.warn }]}>{itemsACharger}</Text>
          <Text style={styles.statLbl}>À charger</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={[styles.statNum, { color: COLORS.goldDark }]}>{itemsCharges}</Text>
          <Text style={styles.statLbl}>Chargés</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={[styles.statNum, { color: COLORS.success }]}>{itemsLivres}</Text>
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
            arriveeRequise ? (
              <TouchableOpacity style={styles.arriveeBanner} onPress={allerNavigation} activeOpacity={0.85}>
                <Ionicons name="location" size={18} color="#fff" />
                <Text style={styles.arriveeBannerTxt}>
                  Confirmez votre arrivée au chantier avant de scanner la livraison.
                </Text>
                <Ionicons name="chevron-forward" size={18} color="#fff" />
              </TouchableOpacity>
            ) : (
              <View style={styles.phaseBanner}>
                <Ionicons name="cube-outline" size={18} color={COLORS.goldDark} />
                <Text style={styles.phaseBannerTxt}>
                  Arrivé à destination ? Scannez chaque article livré, ou le QR du voyage pour tout valider d'un coup.
                </Text>
              </View>
            )
          )}

          {/* Articles regroupés par livraison (OF) : un titre par livraison, puis ses articles */}
          {articles.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={48} color={COLORS.textFaint} />
              <Text style={styles.emptyTxt}>Aucun article pour cette ligne</Text>
            </View>
          ) : (
            articleGroupes.filter(g => g.articles.length > 0).map(g => (
              <View key={String(g.of.id)} style={{ gap: 10 }}>
                <View style={styles.ofHeader}>
                  <Ionicons name="cube-outline" size={15} color={COLORS.brownSoft} />
                  <Text style={styles.ofHeaderTxt} numberOfLines={1}>
                    Livraison #{g.of.id}{g.of.client ? ` · ${g.of.client}` : ''}
                  </Text>
                  <Text style={styles.ofHeaderMeta}>{g.articles.length} article(s)</Text>
                </View>
                {g.articles.map(item => <View key={String(item.id)}>{renderItem({ item })}</View>)}
              </View>
            ))
          )}

          {/* Matières premières (source ≠ STOCK) */}
          {matieres.filter(m => (m.source || 'MATIERE') !== 'STOCK').length > 0 && (
            <View style={styles.mpSection}>
              <View style={styles.mpHeader}>
                <Ionicons name="cube-outline" size={16} color={COLORS.brownSoft} />
                <Text style={styles.mpHeaderTxt}>
                  Matières premières ({matieres.filter(m => (m.source || 'MATIERE') !== 'STOCK').length})</Text>
              </View>
              {matieres.filter(m => (m.source || 'MATIERE') !== 'STOCK').map(renderMpCard)}
            </View>
          )}

          {/* Stock — section dédiée (séparée des matières premières) */}
          {matieres.filter(m => m.source === 'STOCK').length > 0 && (
            <View style={styles.mpSection}>
              <View style={styles.mpHeader}>
                <Ionicons name="file-tray-stacked-outline" size={16} color={COLORS.brownSoft} />
                <Text style={styles.mpHeaderTxt}>
                  Stock ({matieres.filter(m => m.source === 'STOCK').length})</Text>
              </View>
              {matieres.filter(m => m.source === 'STOCK').map(renderMpCard)}
            </View>
          )}
        </ScrollView>
      )}

      {/* Barre d'action bas d'écran */}
      {!loading && !error && (total > 0 || matieres.length > 0) && (
        <View style={styles.actionBar}>
          {ligneTerminee ? (
            <View style={[styles.actionBtn, styles.actionDone]}>
              <Ionicons name="checkmark-done-circle" size={20} color="#fff" />
              <Text style={styles.actionTxt}>Ligne terminée</Text>
            </View>
          ) : livraisonComplete ? (
            <TouchableOpacity style={[styles.actionBtn, styles.actionGreen]} onPress={allerBL} activeOpacity={0.85}>
              <Ionicons name="document-text" size={19} color="#fff" />
              <Text style={styles.actionTxt}>Bon de livraison & terminer</Text>
            </TouchableOpacity>
          ) : arriveeRequise ? (
            /* Phase LIVRAISON sans arrivée confirmée → on impose d'abord la confirmation. */
            <TouchableOpacity style={[styles.actionBtn, styles.actionArrivee]} onPress={allerNavigation} activeOpacity={0.85}>
              <Ionicons name="navigate" size={19} color="#fff" />
              <Text style={styles.actionTxt}>Confirmer mon arrivée au chantier</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.actionBtn, styles.actionGold]} onPress={openScanLibre} activeOpacity={0.85}>
              <Ionicons
                name={phase === 'LIVRAISON' && arriveeConfirmee ? 'checkmark-done-circle' : 'qr-code'}
                size={19} color={COLORS.brown} />
              <Text style={[styles.actionTxt, { color: COLORS.brown }]}>
                {phase === 'CHARGEMENT' && articlesCharges && !matieresToutesChargees
                  ? 'Scanner les MP restantes'
                  : (phase === 'LIVRAISON' && arriveeConfirmee
                      ? 'Arrivé ✓ — Scanner la livraison'
                      : scanLabel)}
              </Text>
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

  arriveeBanner:  {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.teal, borderRadius: 12, padding: 12, marginBottom: 4,
  },
  arriveeBannerTxt: { flex: 1, color: '#fff', fontSize: 12, fontWeight: '700', lineHeight: 17 },

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
  actionArrivee:{ backgroundColor: COLORS.teal },
  actionDone:   { backgroundColor: COLORS.success, opacity: 0.85 },
  actionTxt:    { color: '#fff', fontWeight: '800', fontSize: 15 },

  empty:        { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTxt:     { fontSize: 15, color: COLORS.textSub, fontWeight: '600', textAlign: 'center' },
  retryBtn:     {
    backgroundColor: COLORS.gold, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20,
  },
  retryTxt:     { color: COLORS.brown, fontWeight: '700' },

  // En-tête d'un groupe d'articles (par livraison/OF)
  ofHeader:     {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border, marginTop: 4,
  },
  ofHeaderTxt:  { flex: 1, fontSize: 13, fontWeight: '800', color: COLORS.brown },
  ofHeaderMeta: { fontSize: 11, color: COLORS.textSub, fontWeight: '600' },

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
