import { useEffect, useCallback, useState, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
  Alert, StatusBar, Vibration, AppState,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import type { RootState } from '@/store';
import { setVoyages, setLoading } from '@/store/livraisonSlice';
import { getVoyagesEnCours, type Voyage } from '@/services/livraisonService';
import { clearChauffeur } from '@/store/authSlice';
import { logout as logoutService } from '@/services/authService';
import { startTrajetVoyage, stopTrajetVoyage } from '@/services/gpsService';
import { enregistrerPush } from '@/services/pushService';

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

export default function LivraisonsScreen() {
  const dispatch  = useDispatch();
  const router    = useRouter();
  const { voyages, loading } = useSelector((s: RootState) => s.livraison);
  const chauffeur = useSelector((s: RootState) => s.auth.chauffeur);

  const knownIds = useRef<Set<number> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) dispatch(setLoading(true));
    try {
      const data = await getVoyagesEnCours(chauffeur?.id);
      dispatch(setVoyages(data));
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
      if (!silent) dispatch(setLoading(false));
    }
  }, [dispatch, chauffeur?.id]);

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

  // Suivi du trajet : un point GPS toutes les 2 minutes, lié au voyage en cours
  // (le premier voyage non encore livré), pour tracer le déplacement du chauffeur.
  const voyageActifId = voyages.find((v: Voyage) => v.etatDechargement !== 'TERMINE')?.id;
  useEffect(() => {
    if (!voyageActifId) { stopTrajetVoyage(); return; }
    startTrajetVoyage(voyageActifId, chauffeur?.camionId ?? undefined);
    return () => stopTrajetVoyage();
  }, [voyageActifId, chauffeur?.camionId]);

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

  // Statut global du voyage : Livré > Chargé > En cours > En attente
  const voyageStatut = (v: Voyage): { label: string; color: string } => {
    if (v.etatDechargement === 'TERMINE') return { label: 'Livré ✓', color: '#16b364' };
    if (v.etatChargement === 'TERMINE') return { label: 'Chargé ✓', color: '#2563eb' };
    if (v.etatChargement === 'EN_COURS') return { label: 'En cours', color: '#8b7bff' };
    return { label: 'En attente', color: '#F59E0B' };
  };

  const renderItem = ({ item, index }: { item: Voyage; index: number }) => {
    const st = voyageStatut(item);
    return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => router.push(`/(chauffeur)/livraison/${item.id}`)}
    >
      <View style={styles.cardLeft}>
        <View style={[styles.indexBadge, { backgroundColor: index === 0 ? '#EF4444' : '#8b7bff' }]}>
          <Text style={styles.indexBadgeTxt}>{index + 1}</Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        {index === 0 && (
          <Text style={styles.priorityTag}>● PRIORITAIRE</Text>
        )}
        <Text style={styles.cardTitle}>{item.client || `Voyage #${item.id}`}</Text>
        <View style={styles.cardMeta}>
          <Ionicons name="car-outline" size={13} color="#64748B" />
          <Text style={styles.cardMetaTxt}>{item.camionImmatriculation}</Text>
          <Ionicons name="cube-outline" size={13} color="#64748B" style={{ marginLeft: 10 }} />
          <Text style={styles.cardMetaTxt}>{item.nbColis} colis</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: st.color + '20' }]}>
          <Text style={[styles.statusTxt, { color: st.color }]}>{st.label}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
    </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e1b34" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarTxt}>
            {chauffeur?.prenom?.[0]}{chauffeur?.nom?.[0]}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerGreet}>Bonjour 👋</Text>
          <Text style={styles.headerName}>{chauffeur?.prenom} {chauffeur?.nom}</Text>
          <Text style={styles.headerSub}>{chauffeur?.matricule}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{voyages.length}</Text>
          <Text style={styles.statLbl}>En cours</Text>
        </View>
        <View style={styles.statDiv} />
        <View style={styles.stat}>
          <Text style={styles.statNum}>
            {voyages.reduce((s: number, v: Voyage) => s + (v.nbColis || 0), 0)}
          </Text>
          <Text style={styles.statLbl}>Colis total</Text>
        </View>
        <View style={styles.statDiv} />
        <View style={styles.stat}>
          <Text style={styles.statNum}>
            {voyages.filter((v: Voyage) => v.etatChargement === 'TERMINE').length}
          </Text>
          <Text style={styles.statLbl}>Chargés</Text>
        </View>
      </View>

      {/* Section title */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Mes livraisons</Text>
        <TouchableOpacity onPress={() => load()}>
          <Ionicons name="refresh-outline" size={20} color="#8b7bff" />
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator color="#8b7bff" style={{ marginTop: 20 }} />}

      <FlatList
        data={voyages}
        keyExtractor={(v) => String(v.id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load()} colors={['#8b7bff']} />}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="car-outline" size={56} color="#CBD5E1" />
              <Text style={styles.emptyTxt}>Aucune livraison en cours</Text>
              <Text style={styles.emptySubTxt}>Tirez pour actualiser</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#F0F4F8' },

  header:         {
    backgroundColor: '#1e1b34',
    paddingTop: 52, paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  headerAvatar:   {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#8b7bff',
    alignItems: 'center', justifyContent: 'center',
  },
  headerAvatarTxt:{ color: '#fff', fontWeight: '800', fontSize: 16 },
  headerGreet:    { color: 'rgba(255,255,255,.6)', fontSize: 12 },
  headerName:     { color: '#fff', fontWeight: '700', fontSize: 16 },
  headerSub:      { color: 'rgba(255,255,255,.45)', fontSize: 11, marginTop: 1 },
  logoutBtn:      {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,.12)',
    alignItems: 'center', justifyContent: 'center',
  },

  statsBar:       {
    backgroundColor: '#1e1b34', paddingBottom: 20,
    paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center',
  },
  stat:           { flex: 1, alignItems: 'center' },
  statNum:        { color: '#fff', fontSize: 22, fontWeight: '800' },
  statLbl:        { color: 'rgba(255,255,255,.5)', fontSize: 11, marginTop: 2 },
  statDiv:        { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,.1)' },

  sectionHeader:  {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4,
  },
  sectionTitle:   { fontSize: 15, fontWeight: '700', color: '#1E293B' },

  card:           {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardLeft:       { alignItems: 'center' },
  indexBadge:     {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  indexBadgeTxt:  { color: '#fff', fontWeight: '800', fontSize: 13 },
  cardBody:       { flex: 1, gap: 4 },
  priorityTag:    { color: '#EF4444', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  cardTitle:      { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  cardMeta:       { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMetaTxt:    { fontSize: 12, color: '#64748B' },
  statusPill:     { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, marginTop: 2 },
  statusTxt:      { fontSize: 11, fontWeight: '700' },

  empty:          { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTxt:       { fontSize: 16, fontWeight: '600', color: '#94A3B8' },
  emptySubTxt:    { fontSize: 13, color: '#CBD5E1' },
});
