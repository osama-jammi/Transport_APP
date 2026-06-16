import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Logo / Header */}
      <View style={styles.header}>
        <View style={styles.logoCircle}>
          <Ionicons name="car" size={56} color="#fff" />
        </View>
        <Text style={styles.appName}>Transport Livraison</Text>
        <Text style={styles.tagline}>Gestion des tournées & livraisons</Text>
      </View>

      {/* Cards info */}
      <View style={styles.infoWrap}>
        <View style={styles.infoCard}>
          <Ionicons name="qr-code-outline" size={28} color="#6d4aff" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.infoTitle}>Connexion par QR Code</Text>
            <Text style={styles.infoSub}>
              Scannez votre QR code chauffeur pour vous identifier
            </Text>
          </View>
        </View>
        <View style={styles.infoCard}>
          <Ionicons name="location-outline" size={28} color="#6d4aff" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.infoTitle}>Suivi GPS temps réel</Text>
            <Text style={styles.infoSub}>
              Votre position est transmise automatiquement pendant la tournée
            </Text>
          </View>
        </View>
        <View style={styles.infoCard}>
          <Ionicons name="cube-outline" size={28} color="#6d4aff" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.infoTitle}>Scan des articles</Text>
            <Text style={styles.infoSub}>
              Validez le chargement et la livraison de chaque colis
            </Text>
          </View>
        </View>
      </View>

      {/* Bouton connexion */}
      <TouchableOpacity
        style={styles.connectBtn}
        onPress={() => router.push('/(auth)/scan')}
        activeOpacity={0.85}
      >
        <Ionicons name="qr-code" size={22} color="#fff" />
        <Text style={styles.connectTxt}>Scanner mon QR Code</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>
        Contactez votre superviseur pour obtenir votre QR code chauffeur
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7FAFC',
    padding: 24,
    justifyContent: 'space-between',
  },
  header: { alignItems: 'center', paddingTop: 60, gap: 12 },
  logoCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#6d4aff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6d4aff',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  appName: { fontSize: 26, fontWeight: '800', color: '#6d4aff', marginTop: 8 },
  tagline: { fontSize: 14, color: '#718096', textAlign: 'center' },
  infoWrap: { gap: 12 },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  infoTitle: { fontSize: 14, fontWeight: '700', color: '#1A202C' },
  infoSub: { fontSize: 12, color: '#718096', marginTop: 2, lineHeight: 17 },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6d4aff',
    borderRadius: 16,
    padding: 18,
    gap: 10,
    shadowColor: '#6d4aff',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  connectTxt: { color: '#fff', fontSize: 17, fontWeight: '700' },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: '#A0AEC0',
    paddingBottom: 16,
    lineHeight: 18,
  },
});
