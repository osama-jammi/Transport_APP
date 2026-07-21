import { useEffect, useCallback, useState, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
  Alert, StatusBar, Vibration, AppState,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import type { RootState } from '@/store';
import { getVoyagesConteneurs, type VoyageConteneur } from '@/services/livraisonService';
import { clearChauffeur } from '@/store/authSlice';
import { logout as logoutService } from '@/services/authService';
import { startTrajetVoyage, stopTrajetVoyage, startSuiviChauffeur, stopSuiviChauffeur, setTrackingEnabled } from '@/services/gpsService';
import { isFeatureEnabled } from '@/services/featureService';
import { enregistrerPush } from '@/services/pushService';
import { COLORS, GRADIENT_HEADER, SHADOWS, RADIUS } from '@/constants/theme';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false,
    shouldShowBanner: true, shouldShowList: true,
  }),
});

// Sonnerie + notification a l'arrivee d'un nouveau voyage (app ouverte)
async function sonnerNouveauVoyage(nb: number) {
  // Vibration (fonctionne dans Expo Go) — boucle 3x pour un "sonner" net
  Vibration.vibrate([0, 500, 250, 500, 250, 500]);
  // Alerte in-app : visible meme dans Expo Go (contrairement a la banniere systeme)
  Alert.alert(
    'Nouveau voyage',
    nb > 1 ? `${nb} nouveaux voyages vous ont ete attribues.` : 'Un nouveau voyage vous a ete attribue.',
  );
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status === 'granted') {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Nouveau voyage assigne',
          body: nb > 1 ? `${nb} nouveaux voyages vous ont ete attribues.` : 'Un nouveau voyage vous a ete attribue.',
          sound: true,
        },
        trigger: null,
      });
    }
  } catch { /* Expo Go : la vibration suffit */ }
}

type Filtre = 'EN_COURS' | 'LIVRE' | 'TOUS';

const FILTRES: { key: Filtre; label: string; icon: string }[] = [
  { key: 'EN_COURS', label: 'En cours', icon: 'time-outline' },
  { key: 'LIVRE',    label: 'Livrés',   icon: 'checkmark-done-outline' },
  { key: 'TOUS',     label: 'Tous',     icon: 'albums-outline' },
];

// Un voyage est « livré » quand son déchargement réel est enregistré.
const estLivre = (v: VoyageConteneur) => !!v.realDechargement;

export default function VoyagesScreen() {
  const dispatch  = useDispatch();
  const router    = useRouter();
  const chauffeur = useSelector((s: RootState) => s.auth.chauffeur);

  const [voyages, setVoyagesState] = useState<VoyageConteneur[]>([]);
  const [loading, setLoadingState] = useState(false);

  // Filtre actif — par defaut « voyages en cours »
  const [filtre, setFiltre] = useState<Filtre>('EN_COURS');

  const knownIds = useRef<Set<number> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoadingState(true);
    try {
      const data = await getVoyagesConteneurs(chauffeur?.id);
      // FIFO : le voyage assigné en premier (id le plus petit) apparaît en tête de liste.
      const dataFifo = [...data].sort((a, b) => a.id - b.id);
      setVoyagesState(dataFifo);
      // Détecte les voyages nouvellement assignés → sonnerie + notification
      const ids = new Set(data.map(v => v.id));
      if (knownIds.current) {
        const nouveaux = data.filter(v => !knownIds.current!.has(v.id));
        if (nouveaux.length) sonnerNouveauVoyage(nouveaux.length);
      }
      knownIds.current = ids;
    } catch {
      // silencieux, retry possible via pull-to-refresh
    } finally {
      if (!silent) setLoadingState(false);
    }
  }, [chauffeur?.id]);

  useEffect(() => { load(); }, [load]);

  // Sondage périodique (silencieux) : détecte les nouveaux voyages sans spinner
  useEffect(() => {
    const t = setInterval(() => { load(true); }, 12_000);
    return () => clearInterval(t);
  }, [load]);

  // Rafraîchit immédiatement quand l'app revient au premier plan
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') load(true);
    });
    return () => sub.remove();
  }, [load]);

  // Enregistre le téléphone pour les notifications push distantes (dev build)
  useEffect(() => {
    if (chauffeur?.id) enregistrerPush(chauffeur.id);
  }, [chauffeur?.id]);

  // Suivi du trajet : un point GPS toutes les 2 minutes. Le trajet n'est rattaché au
  // voyage qu'À PARTIR DU CHARGEMENT (1er scan → realChargement renseigné). Avant le
  // chargement, le chauffeur reste suivi (suivi général), mais ces points NE font PAS
  // partie du trajet du voyage : ainsi le trajet du voyage démarre au chargement, pas à
  // la connexion.
  const voyageActif = voyages.find((v: VoyageConteneur) => !v.realDechargement) ?? null;
  // On ne tague le trajet avec le voyage que lorsque son chargement a commencé.
  const voyageTrajetId = voyageActif?.realChargement ? voyageActif.id : undefined;
  useEffect(() => {
    if (!chauffeur?.id) return;
    let annule = false;

    // Applique l'interrupteur « tracking » (admin) : coupe RÉELLEMENT le GPS s'il est
    // désactivé, le (re)démarre sinon. Ré-évalué périodiquement pour réagir à chaud
    // quand l'admin bascule l'interrupteur pendant que l'app tourne.
    const appliquerSuivi = async () => {
      // Le suivi GPS est piloté par la fonctionnalité « suivi-trajets » (qui inclut le GPS).
      const trackingOn = await isFeatureEnabled('suivi-trajets');
      if (annule) return;
      setTrackingEnabled(trackingOn);
      if (!trackingOn) return; // setTrackingEnabled(false) a déjà tout arrêté
      if (voyageTrajetId) {
        // Chargement commencé → trajet lié au voyage (avec le chauffeur)
        stopSuiviChauffeur();
        startTrajetVoyage(voyageTrajetId, chauffeur.camionId ?? undefined, chauffeur.id);
      } else {
        // Pas encore chargé (ou aucun voyage) → suivi général du chauffeur, hors trajet voyage
        stopTrajetVoyage();
        startSuiviChauffeur(chauffeur.id, chauffeur.camionId ?? undefined);
      }
    };

    appliquerSuivi();
    const t = setInterval(appliquerSuivi, 30_000);
    return () => { annule = true; clearInterval(t); stopTrajetVoyage(); stopSuiviChauffeur(); };
  }, [voyageTrajetId, chauffeur?.id, chauffeur?.camionId]);

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnecter', style: 'destructive',
        onPress: async () => {
          await logoutService();
          dispatch(clearChauffeur());
          router.replace('/(auth)');
        },
      },
    ]);
  };

  // Compteurs (sur la liste complete, independamment du filtre)
  const nbEnCours = voyages.filter(v => !estLivre(v)).length;
  const nbLivres  = voyages.filter(estLivre).length;

  // Liste filtree
  const voyagesAffiches = voyages.filter(v =>
    filtre === 'TOUS' ? true : filtre === 'LIVRE' ? estLivre(v) : !estLivre(v),
  );

  // Statut global du voyage : Livré > En route (chargé) > À charger
  const voyageStatut = (v: VoyageConteneur): { label: string; color: string } => {
    if (v.realDechargement) return { label: 'Livré ✓', color: COLORS.success };
    if (v.realChargement)   return { label: 'En route', color: COLORS.goldDark };
    return { label: 'À charger', color: COLORS.gold };
  };

  const formatJour = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : null;

  const renderItem = ({ item, index }: { item: VoyageConteneur; index: number }) => {
    const st = voyageStatut(item);
    const livre = estLivre(item);
    const prioritaire = !livre && index === 0 && filtre !== 'LIVRE';
    return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => router.push(`/(chauffeur)/voyage/${item.id}` as any)}
    >
      <View style={styles.cardLeft}>
        <View style={[styles.indexBadge, { backgroundColor: livre ? COLORS.success : prioritaire ? COLORS.danger : COLORS.gold }]}>
          {livre
            ? <Ionicons name="checkmark" size={16} color="#fff" />
            : <Text style={styles.indexBadgeTxt}>{index + 1}</Text>}
        </View>
      </View>
      <View style={styles.cardBody}>
        {prioritaire && (
          <Text style={styles.priorityTag}>● PRIORITAIRE</Text>
        )}
        <Text style={styles.cardTitle}>Voyage #{item.id}{formatJour(item.dateVoyage) ? ` · ${formatJour(item.dateVoyage)}` : ''}</Text>
        <View style={styles.cardMeta}>
          <Ionicons name="cube-outline" size={13} color={COLORS.textSub} />
          <Text style={styles.cardMetaTxt}>{item.nbLivraisons} livraison(s)</Text>
          {item.nbMatieres > 0 ? (
            <>
              <Ionicons name="layers-outline" size={13} color={COLORS.textSub} style={{ marginLeft: 10 }} />
              <Text style={styles.cardMetaTxt}>{item.nbMatieres} matière(s)</Text>
            </>
          ) : null}
        </View>
        {item.localNom ? (
          <View style={styles.cardMeta}>
            <Ionicons name="business-outline" size={13} color={COLORS.textSub} />
            <Text style={styles.cardMetaTxt} numberOfLines={1}>Départ : {item.localNom}</Text>
          </View>
        ) : null}
        <View style={[styles.statusPill, { backgroundColor: st.color + '22' }]}>
          <View style={[styles.statusDot, { backgroundColor: st.color }]} />
          <Text style={[styles.statusTxt, { color: st.color }]}>{st.label}</Text>
        </View>
      </View>
      <View style={styles.chevronWrap}>
        <Ionicons name="chevron-forward" size={18} color={COLORS.goldDark} />
      </View>
    </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.brownDeep} />

      {/* Header */}
      <LinearGradient colors={GRADIENT_HEADER as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        {/* Halos decoratifs */}
        <View style={styles.blobTop} pointerEvents="none" />
        <View style={styles.blobBottom} pointerEvents="none" />

        <View style={styles.brandBar}>
          <View style={styles.brandLeft}>
            <View style={styles.brandIcon}>
              <Ionicons name="cube" size={15} color="#fff" />
            </View>
            <Text style={styles.brandTxt}>Transport <Text style={styles.brandTxtLight}>· Livraison</Text></Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.userRow}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarTxt}>
              {chauffeur?.prenom?.[0]}{chauffeur?.nom?.[0]}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerGreet}>Bonjour 👋</Text>
            <Text style={styles.headerName}>{chauffeur?.prenom} {chauffeur?.nom}</Text>
            <View style={styles.headerMatRow}>
              <Ionicons name="id-card-outline" size={12} color="rgba(255,255,255,.7)" />
              <Text style={styles.headerSub}>{chauffeur?.matricule}</Text>
            </View>
          </View>
        </View>

        {/* Mini resume En cours / Livres */}
        <View style={styles.headerStats}>
          <View style={styles.headerStat}>
            <Text style={styles.headerStatVal}>{nbEnCours}</Text>
            <Text style={styles.headerStatLbl}>En cours</Text>
          </View>
          <View style={styles.headerStatSep} />
          <View style={styles.headerStat}>
            <Text style={styles.headerStatVal}>{nbLivres}</Text>
            <Text style={styles.headerStatLbl}>Livrés</Text>
          </View>
          <View style={styles.headerStatSep} />
          <View style={styles.headerStat}>
            <Text style={styles.headerStatVal}>{voyages.length}</Text>
            <Text style={styles.headerStatLbl}>Total</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Filtres */}
      <View style={styles.filterRow}>
        {FILTRES.map(f => {
          const active = filtre === f.key;
          const n = f.key === 'EN_COURS' ? nbEnCours : f.key === 'LIVRE' ? nbLivres : voyages.length;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, active && styles.filterChipActive]}
              activeOpacity={0.8}
              onPress={() => setFiltre(f.key)}
            >
              <Ionicons name={f.icon as any} size={14} color={active ? '#fff' : COLORS.textSub} />
              <Text style={[styles.filterTxt, active && styles.filterTxtActive]}>{f.label}</Text>
              <View style={[styles.filterCount, active && styles.filterCountActive]}>
                <Text style={[styles.filterCountTxt, active && styles.filterCountTxtActive]}>{n}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Section title */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {filtre === 'LIVRE' ? 'Voyages livrés' : filtre === 'TOUS' ? 'Tous les voyages' : 'Voyages en cours'}
        </Text>
        <TouchableOpacity onPress={() => load()}>
          <Ionicons name="refresh-outline" size={20} color={COLORS.goldDark} />
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator color={COLORS.gold} style={{ marginTop: 20 }} />}

      <FlatList
        data={voyagesAffiches}
        keyExtractor={(v) => String(v.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load()} colors={[COLORS.gold]} tintColor={COLORS.gold} />}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name={filtre === 'LIVRE' ? 'checkmark-done-circle-outline' : 'cube-outline'} size={56} color={COLORS.textFaint} />
              <Text style={styles.emptyTxt}>
                {filtre === 'LIVRE' ? 'Aucun voyage livré' : 'Aucun voyage en cours'}
              </Text>
              <Text style={styles.emptySubTxt}>Tirez pour actualiser</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.bg },

  header:         {
    backgroundColor: COLORS.brown,
    paddingTop: 50, paddingBottom: 18, paddingHorizontal: 20,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    overflow: 'hidden', ...SHADOWS.md,
  },
  blobTop:        {
    position: 'absolute', top: -70, right: -50, width: 190, height: 190, borderRadius: 95,
    backgroundColor: 'rgba(255,255,255,.10)',
  },
  blobBottom:     {
    position: 'absolute', bottom: -60, left: -40, width: 150, height: 150, borderRadius: 75,
    backgroundColor: 'rgba(117,213,205,.16)',
  },
  brandBar:       {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  brandLeft:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandIcon:      {
    width: 28, height: 28, borderRadius: 9, backgroundColor: 'rgba(255,255,255,.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  brandTxt:       { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.2 },
  brandTxtLight:  { color: 'rgba(255,255,255,.7)', fontWeight: '500' },
  logoutBtn:      {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,.14)',
    alignItems: 'center', justifyContent: 'center',
  },

  userRow:        { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18 },
  headerAvatar:   {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: COLORS.gold,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,.35)',
  },
  headerAvatarTxt:{ color: '#fff', fontWeight: '800', fontSize: 16 },
  headerGreet:    { color: 'rgba(255,255,255,.7)', fontSize: 12 },
  headerName:     { color: '#fff', fontWeight: '800', fontSize: 17 },
  headerMatRow:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  headerSub:      { color: 'rgba(255,255,255,.7)', fontSize: 11 },

  headerStats:    {
    flexDirection: 'row', alignItems: 'center', marginTop: 18,
    backgroundColor: 'rgba(255,255,255,.12)', borderRadius: 16, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,.16)',
  },
  headerStat:     { flex: 1, alignItems: 'center' },
  headerStatVal:  { color: '#fff', fontWeight: '800', fontSize: 18 },
  headerStatLbl:  { color: 'rgba(255,255,255,.72)', fontSize: 11, marginTop: 1 },
  headerStatSep:  { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,.18)' },

  filterRow:      {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2,
  },
  filterChip:     {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: COLORS.card, borderRadius: 22, paddingVertical: 10, paddingHorizontal: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  filterChipActive: { backgroundColor: COLORS.teal, borderColor: COLORS.teal, ...SHADOWS.teal },
  filterTxt:      { fontSize: 12.5, fontWeight: '700', color: COLORS.textSub },
  filterTxtActive:{ color: '#fff' },
  filterCount:    {
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5,
    backgroundColor: COLORS.goldTint, alignItems: 'center', justifyContent: 'center',
  },
  filterCountActive: { backgroundColor: 'rgba(255,255,255,.25)' },
  filterCountTxt: { fontSize: 11, fontWeight: '800', color: COLORS.goldDark },
  filterCountTxtActive: { color: '#fff' },

  sectionHeader:  {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4,
  },
  sectionTitle:   { fontSize: 15, fontWeight: '800', color: COLORS.text },

  card:           {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  cardLeft:       { alignItems: 'center' },
  indexBadge:     {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    ...SHADOWS.sm,
  },
  indexBadgeTxt:  { color: '#fff', fontWeight: '800', fontSize: 13 },
  cardBody:       { flex: 1, gap: 4 },
  priorityTag:    { color: COLORS.danger, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  cardTitle:      { fontSize: 15, fontWeight: '700', color: COLORS.text },
  cardMeta:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMetaTxt:    { fontSize: 12, color: COLORS.textSub },
  statusPill:     { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
                    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginTop: 4 },
  statusDot:      { width: 6, height: 6, borderRadius: 3 },
  statusTxt:      { fontSize: 11, fontWeight: '800' },
  chevronWrap:    { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.goldTint,
                    alignItems: 'center', justifyContent: 'center' },

  empty:          { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTxt:       { fontSize: 16, fontWeight: '600', color: COLORS.textSub },
  emptySubTxt:    { fontSize: 13, color: COLORS.textFaint },
});
