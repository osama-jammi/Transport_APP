import { View, Text, StyleSheet, TouchableOpacity, Image, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, LOGO } from '@/constants/theme';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.brownDeep} />

      {/* Logo / Header */}
      <View style={styles.header}>
        <View style={styles.logoCard}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.tagline}>Transport & Livraison</Text>
      </View>

      {/* Cards info */}
      <View style={styles.infoWrap}>
        <View style={styles.infoCard}>
          <View style={styles.infoIcon}><Ionicons name="qr-code-outline" size={24} color={COLORS.goldDark} /></View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.infoTitle}>Connexion par QR Code</Text>
            <Text style={styles.infoSub}>
              Scannez votre QR code chauffeur pour vous identifier
            </Text>
          </View>
        </View>
        <View style={styles.infoCard}>
          <View style={styles.infoIcon}><Ionicons name="location-outline" size={24} color={COLORS.goldDark} /></View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.infoTitle}>Suivi GPS temps réel</Text>
            <Text style={styles.infoSub}>
              Votre position est transmise automatiquement pendant la tournée
            </Text>
          </View>
        </View>
        <View style={styles.infoCard}>
          <View style={styles.infoIcon}><Ionicons name="cube-outline" size={24} color={COLORS.goldDark} /></View>
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
        <Ionicons name="qr-code" size={22} color={COLORS.brown} />
        <Text style={styles.connectTxt}>Scanner mon QR Code</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.adminBtn}
        onPress={() => router.push('/(auth)/admin-login' as any)}
        activeOpacity={0.85}
      >
        <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.gold} />
        <Text style={styles.adminTxt}>Connexion administrateur </Text>
      </TouchableOpacity>


    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: 24,
    justifyContent: 'space-between',
  },
  header: { alignItems: 'center', paddingTop: 64, gap: 14 },
  logoCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 26,
    paddingVertical: 22,
    shadowColor: COLORS.brown,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
  },
  logo: { width: 230, height: 66 },
  tagline: { fontSize: 15, color: COLORS.textSub, textAlign: 'center', fontWeight: '600' },
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
  infoIcon: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: COLORS.goldSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  infoTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  infoSub: { fontSize: 12, color: COLORS.textSub, marginTop: 2, lineHeight: 17 },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gold,
    borderRadius: 16,
    padding: 18,
    gap: 10,
    shadowColor: COLORS.gold,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  connectTxt: { color: COLORS.brown, fontSize: 17, fontWeight: '800' },
  adminBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    borderRadius: 16,
    padding: 14,
    gap: 10,
    marginTop: 12,
  },
  adminTxt: { color: COLORS.gold, fontSize: 14, fontWeight: '700' },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.textFaint,
    paddingBottom: 16,
    lineHeight: 18,
  },
});
