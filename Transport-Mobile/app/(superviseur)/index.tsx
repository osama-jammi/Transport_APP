import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ScrollView } from 'react-native';
import api from '@/services/api';
import { ENDPOINTS } from '@/constants/api';
import type { PositionGpsResponseDTO } from '@/types/gps';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/theme';

export default function SuperviseurScreen() {
  const [positions, setPositions] = useState<PositionGpsResponseDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'map' | 'list'>('list');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<PositionGpsResponseDTO[]>(ENDPOINTS.GPS_POSITIONS);
      setPositions(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <View style={styles.container}>
      {/* Toggle carte (placeholder) / liste */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggle, view === 'map' && styles.toggleActive]}
          onPress={() => setView('map')}
        >
          <Ionicons name="map-outline" size={18} color={view === 'map' ? COLORS.goldDark : '#888'} />
          <Text style={[styles.toggleTxt, view === 'map' && styles.toggleTxtActive]}>Carte</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggle, view === 'list' && styles.toggleActive]}
          onPress={() => setView('list')}
        >
          <Ionicons name="list-outline" size={18} color={view === 'list' ? COLORS.goldDark : '#888'} />
          <Text style={[styles.toggleTxt, view === 'list' && styles.toggleTxtActive]}>Liste</Text>
        </TouchableOpacity>
      </View>

      {view === 'map' ? (
        /* ── Placeholder carte — react-native-maps nécessite un dev build ── */
        <ScrollView contentContainerStyle={styles.mapPlaceholderWrap}>
          <Ionicons name="map" size={64} color="#CBD5E0" />
          <Text style={styles.mapTitle}>Carte GPS</Text>
          <Text style={styles.mapSub}>
            La carte est disponible uniquement dans un{'\n'}
            <Text style={{ fontWeight: '700' }}>development build</Text>.
          </Text>
          <Text style={styles.mapSub}>
            Passez en vue <Text style={{ fontWeight: '700' }}>Liste</Text> pour voir les positions.
          </Text>

          {/* Affichage grille des positions en mode carte */}
          {positions.length > 0 && (
            <View style={styles.gridWrap}>
              <Text style={styles.gridTitle}>{positions.length} camion(s) localisé(s)</Text>
              {positions.map((p) => (
                <View key={p.id} style={styles.gridCard}>
                  <Ionicons name="car" size={22} color="#6d4aff" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.gridImmat}>{p.immatriculation}</Text>
                    <Text style={styles.gridGps}>
                      {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: '#EBF8FF' }]}>
                    <Text style={[styles.badgeTxt, { color: '#2B6CB0' }]}>
                      {new Date(p.horodatage).toLocaleTimeString()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={positions}
          keyExtractor={(p) => String(p.id)}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
          contentContainerStyle={{ padding: 12, gap: 10 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="car" size={22} color="#6d4aff" />
                <Text style={styles.cardTitle}>{item.immatriculation}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeTxt}>En route</Text>
                </View>
              </View>
              <Text style={styles.cardInfo}>
                <Ionicons name="person-outline" size={13} /> {item.chauffeur}
              </Text>
              <Text style={styles.cardInfo}>
                <Ionicons name="time-outline" size={13} />{' '}
                {new Date(item.horodatage).toLocaleString()}
              </Text>
              <View style={styles.gpsRow}>
                <Ionicons name="location-outline" size={13} color="#3182CE" />
                <Text style={styles.gpsText}>
                  {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="car-outline" size={48} color="#CBD5E0" />
                <Text style={styles.empty}>Aucun camion localisé.</Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  toggleRow: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#E2E8F0' },
  toggle: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, gap: 6 },
  toggleActive: { borderBottomWidth: 2, borderBottomColor: COLORS.goldDark },
  toggleTxt: { color: '#888', fontWeight: '600' },
  toggleTxtActive: { color: COLORS.goldDark },
  // Map placeholder
  mapPlaceholderWrap: { padding: 24, alignItems: 'center', gap: 12, flexGrow: 1 },
  mapTitle: { fontSize: 20, fontWeight: '700', color: '#4A5568', marginTop: 8 },
  mapSub: { fontSize: 13, color: '#718096', textAlign: 'center', lineHeight: 20 },
  gridWrap: { width: '100%', marginTop: 16, gap: 8 },
  gridTitle: { fontSize: 13, fontWeight: '700', color: '#2D3748', marginBottom: 4 },
  gridCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 12, gap: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  gridImmat: { fontSize: 14, fontWeight: '700', color: COLORS.goldDark },
  gridGps: { fontSize: 11, color: '#A0AEC0', marginTop: 2 },
  // List
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 14, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 4, elevation: 2, gap: 4 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.goldDark, flex: 1 },
  cardInfo: { fontSize: 13, color: '#555' },
  gpsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  gpsText: { fontSize: 12, color: '#3182CE', fontFamily: 'monospace' },
  badge: { backgroundColor: '#F0FFF4', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeTxt: { fontSize: 11, fontWeight: '700', color: '#276749' },
  emptyWrap: { alignItems: 'center', marginTop: 60, gap: 12 },
  empty: { textAlign: 'center', color: '#888', fontSize: 15 },
});
