import { useEffect, useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, RefreshControl, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { RootState } from '@/store';
import { clearChauffeur } from '@/store/authSlice';
import { logout as logoutService } from '@/services/authService';
import { getDashboardStats, type DashboardStats } from '@/services/adminService';
import { COLORS, GRADIENT, LOGO } from '@/constants/theme';

const fmtDuree = (m: number | null) => {
  if (m == null) return '—';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h${String(r).padStart(2, '0')}` : `${h}h`;
};

export default function AdminDashboard() {
  const router    = useRouter();
  const dispatch  = useDispatch();
  const chauffeur = useSelector((s: RootState) => s.auth.chauffeur);

  const [stats, setStats]     = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setStats(await getDashboardStats());
    } catch {
      // garde les anciennes valeurs
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => load(true), 30_000);
    return () => clearInterval(t);
  }, [load]);

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

  const kpis = [
    { label: "Voyages aujourd'hui", value: stats?.voyagesAujourdhui ?? 0, icon: 'cube',                 color: COLORS.goldDark, bg: COLORS.goldSoft },
    { label: 'Livrés',             value: stats?.livresAujourdhui ?? 0,   icon: 'checkmark-done',        color: COLORS.success,  bg: COLORS.successBg },
    { label: 'En cours',           value: stats?.enCoursAujourdhui ?? 0,  icon: 'time',                  color: COLORS.info,     bg: '#E5EDFB' },
    { label: 'En attente',         value: stats?.enAttenteAujourdhui ?? 0, icon: 'hourglass',            color: COLORS.warn,     bg: COLORS.warnBg },
  ];

  // Routes du groupe (admin) — typées au lancement de Metro (cast côté push)
  const menu: { label: string; sub: string; icon: string; route: string }[] = [
    { label: 'Suivi chauffeurs', sub: 'Positions GPS en direct', icon: 'location',    route: '/(admin)/chauffeurs' },
    { label: 'Voyages',          sub: 'Toutes les livraisons',   icon: 'list',        route: '/(admin)/voyages' },
    { label: 'Dépôts',           sub: 'Locaux de départ',        icon: 'business',    route: '/(admin)/depots' },
    { label: 'Analyses',         sub: 'Statistiques détaillées', icon: 'stats-chart', route: '/(admin)/analyses' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.brownDeep} />

      {/* Header */}
      <LinearGradient colors={GRADIENT as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <View style={styles.brandBar}>
          <View style={styles.logoPill}>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.userRow}>
          <View style={styles.avatar}>
            <Ionicons name="shield-checkmark" size={22} color={COLORS.brown} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.greet}>Tableau de bord</Text>
            <Text style={styles.name}>{chauffeur?.prenom} {chauffeur?.nom}</Text>
            <Text style={styles.role}>Administrateur · Superviseur</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load()} colors={[COLORS.gold]} tintColor={COLORS.gold} />}
      >
        {loading && !stats ? (
          <ActivityIndicator color={COLORS.gold} style={{ marginTop: 30 }} />
        ) : (
          <>
            {/* KPI grid */}
            <View style={styles.kpiGrid}>
              {kpis.map(k => (
                <View key={k.label} style={styles.kpiCard}>
                  <View style={[styles.kpiIcon, { backgroundColor: k.bg }]}>
                    <Ionicons name={k.icon as any} size={18} color={k.color} />
                  </View>
                  <Text style={styles.kpiValue}>{k.value}</Text>
                  <Text style={styles.kpiLabel}>{k.label}</Text>
                </View>
              ))}
            </View>

            {/* Bande de stats secondaires */}
            <View style={styles.secRow}>
              <View style={styles.secCard}>
                <Ionicons name="people-outline" size={18} color={COLORS.gold} />
                <Text style={styles.secVal}>{stats?.chauffeursActifs ?? 0}</Text>
                <Text style={styles.secLbl}>Chauffeurs actifs</Text>
              </View>
              <View style={styles.secCard}>
                <Ionicons name="speedometer-outline" size={18} color={COLORS.gold} />
                <Text style={styles.secVal}>{fmtDuree(stats?.dureeMoyenneMinutes ?? null)}</Text>
                <Text style={styles.secLbl}>Durée moyenne</Text>
              </View>
              <View style={styles.secCard}>
                <Ionicons name="layers-outline" size={18} color={COLORS.gold} />
                <Text style={styles.secVal}>{stats?.articlesAujourdhui ?? 0}</Text>
                <Text style={styles.secLbl}>Articles du jour</Text>
              </View>
            </View>

            {/* Menu */}
            <Text style={styles.sectionTitle}>Gestion</Text>
            <View style={styles.menuGrid}>
              {menu.map(m => (
                <TouchableOpacity key={m.label} style={styles.menuCard} activeOpacity={0.85} onPress={() => router.push(m.route as any)}>
                  <View style={styles.menuIcon}>
                    <Ionicons name={m.icon as any} size={24} color={COLORS.brown} />
                  </View>
                  <Text style={styles.menuLabel}>{m.label}</Text>
                  <Text style={styles.menuSub}>{m.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Aperçu par chantier */}
            {stats?.parChantier && stats.parChantier.length > 0 && (
              <>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Par chantier (aujourd'hui)</Text>
                  <TouchableOpacity onPress={() => router.push('/(admin)/analyses' as any)}>
                    <Text style={styles.link}>Tout voir</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.card}>
                  {stats.parChantier.slice(0, 5).map((c, i) => {
                    const pct = c.total ? Math.round((c.livres / c.total) * 100) : 0;
                    return (
                      <View key={i} style={[styles.chRow, i > 0 && styles.chRowBorder]}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.chName} numberOfLines={1}>{c.chantier}</Text>
                          <View style={styles.barBg}>
                            <View style={[styles.barFill, { width: `${pct}%` as any }]} />
                          </View>
                        </View>
                        <Text style={styles.chCount}>{c.livres}/{c.total}</Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    backgroundColor: COLORS.brown,
    paddingTop: 50, paddingBottom: 18, paddingHorizontal: 20,
    borderBottomLeftRadius: 22, borderBottomRightRadius: 22,
  },
  brandBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logoPill: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  logo: { width: 132, height: 30 },
  logoutBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,.14)', alignItems: 'center', justifyContent: 'center',
  },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18 },
  avatar: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  greet: { color: 'rgba(255,255,255,.6)', fontSize: 12 },
  name:  { color: '#fff', fontWeight: '700', fontSize: 16 },
  role:  { color: 'rgba(255,255,255,.9)', fontSize: 11, marginTop: 1, fontWeight: '600' },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: {
    width: '47.8%', flexGrow: 1, backgroundColor: COLORS.card, borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  kpiIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  kpiValue: { fontSize: 26, fontWeight: '800', color: COLORS.text },
  kpiLabel: { fontSize: 12, color: COLORS.textSub, marginTop: 2 },

  secRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  secCard: {
    flex: 1, backgroundColor: COLORS.card, borderRadius: 12, padding: 12, alignItems: 'center', gap: 3,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  secVal: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  secLbl: { fontSize: 10, color: COLORS.textSub, textAlign: 'center' },

  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text, marginTop: 22, marginBottom: 10 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { color: COLORS.goldDark, fontWeight: '700', fontSize: 13, marginTop: 22 },

  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  menuCard: {
    width: '47.8%', flexGrow: 1, backgroundColor: COLORS.card, borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  menuIcon: {
    width: 46, height: 46, borderRadius: 14, backgroundColor: COLORS.goldSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  menuLabel: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  menuSub: { fontSize: 11.5, color: COLORS.textSub, marginTop: 2 },

  card: {
    backgroundColor: COLORS.card, borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  chRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  chRowBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },
  chName: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  barBg: { height: 6, backgroundColor: COLORS.goldTint, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: COLORS.success, borderRadius: 3 },
  chCount: { fontSize: 13, fontWeight: '800', color: COLORS.textSub },
});
