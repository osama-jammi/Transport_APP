import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, RefreshControl,
  TouchableOpacity, Linking, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getDepots, type Depot } from '@/services/adminService';
import { COLORS } from '@/constants/theme';

export default function AdminDepots() {
  const [depots, setDepots] = useState<Depot[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDepots(await getDepots());
    } catch {
      // garde l'existant
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const ouvrirCarte = (d: Depot) => {
    if (d.latitude == null || d.longitude == null) return;
    const url = Platform.select({
      ios: `http://maps.apple.com/?ll=${d.latitude},${d.longitude}&q=${encodeURIComponent(d.nom || 'Dépôt')}`,
      default: `https://www.google.com/maps/search/?api=1&query=${d.latitude},${d.longitude}`,
    })!;
    Linking.openURL(url).catch(() => {});
  };

  const renderItem = ({ item }: { item: Depot }) => {
    const geo = item.latitude != null && item.longitude != null;
    return (
      <TouchableOpacity style={styles.card} activeOpacity={geo ? 0.85 : 1} onPress={() => geo && ouvrirCarte(item)}>
        <View style={styles.iconWrap}>
          <Ionicons name="business" size={22} color={COLORS.brown} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.nom}>{item.nom || `Dépôt #${item.id}`}</Text>
          {geo ? (
            <View style={styles.metaRow}>
              <Ionicons name="navigate-outline" size={12} color={COLORS.textSub} />
              <Text style={styles.coords}>{item.latitude!.toFixed(5)}, {item.longitude!.toFixed(5)}</Text>
            </View>
          ) : (
            <Text style={styles.warn}>Non géolocalisé</Text>
          )}
          {item.rayon != null && (
            <View style={styles.metaRow}>
              <Ionicons name="radio-outline" size={12} color={COLORS.textSub} />
              <Text style={styles.coords}>Zone {item.rayon} m</Text>
            </View>
          )}
        </View>
        {geo && <Ionicons name="map-outline" size={20} color={COLORS.goldDark} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {loading && depots.length === 0 ? (
        <ActivityIndicator color={COLORS.gold} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={depots}
          keyExtractor={d => String(d.id)}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[COLORS.gold]} tintColor={COLORS.gold} />}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          ListEmptyComponent={(
            <View style={styles.empty}>
              <Ionicons name="business-outline" size={52} color={COLORS.textFaint} />
              <Text style={styles.emptyTxt}>Aucun dépôt</Text>
              <Text style={styles.emptySub}>Les dépôts se gèrent depuis l'application web.</Text>
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
  nom: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  coords: { fontSize: 12, color: COLORS.textSub },
  warn: { fontSize: 12, color: COLORS.warn, marginTop: 3, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 70, gap: 8 },
  emptyTxt: { fontSize: 16, fontWeight: '700', color: COLORS.textSub },
  emptySub: { fontSize: 13, color: COLORS.textFaint, textAlign: 'center', paddingHorizontal: 30 },
});
