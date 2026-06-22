import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TouchableOpacity, Linking, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPositions, type PositionGps } from '@/services/adminService';
import { COLORS } from '@/constants/theme';

// Ancienneté du point GPS → couleur (vert < 5 min, orange < 30 min, gris au-delà)
function fraicheur(horodatage: string): { label: string; color: string } {
  const diffMin = (Date.now() - new Date(horodatage).getTime()) / 60000;
  if (diffMin < 5)  return { label: 'En direct', color: COLORS.success };
  if (diffMin < 30) return { label: `${Math.round(diffMin)} min`, color: COLORS.warn };
  return { label: `${Math.round(diffMin)} min`, color: COLORS.textFaint };
}

export default function AdminChauffeurs() {
  const [positions, setPositions] = useState<PositionGps[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setPositions(await getPositions());
    } catch {
      // garde l'existant
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => load(true), 15_000);
    return () => clearInterval(t);
  }, [load]);

  const ouvrirCarte = (p: PositionGps) => {
    const url = Platform.select({
      ios: `http://maps.apple.com/?ll=${p.latitude},${p.longitude}&q=${encodeURIComponent(p.immatriculation)}`,
      default: `https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`,
    })!;
    Linking.openURL(url).catch(() => {});
  };

  const renderItem = ({ item }: { item: PositionGps }) => {
    const f = fraicheur(item.horodatage);
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => ouvrirCarte(item)}>
        <View style={styles.iconWrap}>
          <Ionicons name="car" size={22} color={COLORS.brown} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.immat}>{item.immatriculation || 'Camion'}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="person-outline" size={12} color={COLORS.textSub} />
            <Text style={styles.meta}>{item.chauffeur || '—'}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="navigate-outline" size={12} color={COLORS.textSub} />
            <Text style={styles.coords}>{item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <View style={[styles.pill, { backgroundColor: f.color + '22' }]}>
            <Text style={[styles.pillTxt, { color: f.color }]}>{f.label}</Text>
          </View>
          <Ionicons name="map-outline" size={20} color={COLORS.goldDark} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {loading && positions.length === 0 ? (
        <ActivityIndicator color={COLORS.gold} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={positions}
          keyExtractor={p => String(p.id)}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load()} colors={[COLORS.gold]} tintColor={COLORS.gold} />}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          ListEmptyComponent={(
            <View style={styles.empty}>
              <Ionicons name="car-outline" size={52} color={COLORS.textFaint} />
              <Text style={styles.emptyTxt}>Aucun camion localisé</Text>
              <Text style={styles.emptySub}>Les positions s'affichent dès qu'un chauffeur est en tournée.</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  card: {
    backgroundColor: COLORS.card, borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  iconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.goldSoft, alignItems: 'center', justifyContent: 'center' },
  immat: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  meta: { fontSize: 12, color: COLORS.textSub },
  coords: { fontSize: 11, color: COLORS.textFaint },
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  pillTxt: { fontSize: 10, fontWeight: '800' },
  empty: { alignItems: 'center', paddingTop: 70, gap: 8 },
  emptyTxt: { fontSize: 16, fontWeight: '700', color: COLORS.textSub },
  emptySub: { fontSize: 13, color: COLORS.textFaint, textAlign: 'center', paddingHorizontal: 30 },
});
