import { View, Text, StyleSheet, TouchableOpacity, Image, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, LOGO, GRADIENT_HEADER, SHADOWS, RADIUS } from '@/constants/theme';

const FEATURES = [
  { icon: 'qr-code-outline',  title: 'Connexion par QR Code', sub: 'Scannez votre QR code chauffeur pour vous identifier' },
  { icon: 'location-outline', title: 'Suivi GPS temps réel',   sub: 'Votre position est transmise automatiquement pendant la tournée' },
  { icon: 'cube-outline',     title: 'Scan des articles',      sub: 'Validez le chargement et la livraison de chaque colis' },
] as const;

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.brownDeep} />

      {/* Hero dégradé */}
      <LinearGradient
        colors={GRADIENT_HEADER as any}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.blobTop} pointerEvents="none" />
        <View style={styles.blobBottom} pointerEvents="none" />
        <View style={styles.logoCard}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.tagline}>Transport &amp; Livraison</Text>
        <View style={styles.taglineChip}>
          <Ionicons name="shield-checkmark" size={12} color="#fff" />
          <Text style={styles.taglineChipTxt}>Plateforme sécurisée DivNet</Text>
        </View>
      </LinearGradient>

      {/* Contenu */}
      <View style={styles.body}>
        <View style={styles.infoWrap}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.infoCard}>
              <View style={styles.infoIcon}>
                <Ionicons name={f.icon as any} size={22} color={COLORS.goldDark} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.infoTitle}>{f.title}</Text>
                <Text style={styles.infoSub}>{f.sub}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => router.push('/(auth)/scan')}>
            <LinearGradient
              colors={['#19D0C5', '#069B92'] as any}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.connectBtn}
            >
              <Ionicons name="qr-code" size={22} color="#fff" />
              <Text style={styles.connectTxt}>Scanner mon QR Code</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.adminBtn}
            onPress={() => router.push('/(auth)/admin-login' as any)}
            activeOpacity={0.85}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.goldDark} />
            <Text style={styles.adminTxt}>Connexion administrateur</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  hero: {
    paddingTop: 72, paddingBottom: 34, paddingHorizontal: 24,
    alignItems: 'center', gap: 14, overflow: 'hidden',
    borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
    ...SHADOWS.md,
  },
  blobTop: {
    position: 'absolute', top: -80, right: -60, width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,.10)',
  },
  blobBottom: {
    position: 'absolute', bottom: -50, left: -40, width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(117,213,205,.16)',
  },
  logoCard: {
    backgroundColor: '#fff', borderRadius: 22,
    paddingHorizontal: 26, paddingVertical: 22, ...SHADOWS.lg,
  },
  logo: { width: 220, height: 64 },
  tagline: { fontSize: 16, color: '#fff', textAlign: 'center', fontWeight: '800', letterSpacing: 0.2 },
  taglineChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,.16)', borderColor: 'rgba(255,255,255,.22)', borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: RADIUS.pill,
  },
  taglineChipTxt: { color: '#fff', fontSize: 11.5, fontWeight: '700' },

  body: { flex: 1, padding: 24, justifyContent: 'space-between' },
  infoWrap: { gap: 12, marginTop: 4 },
  infoCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: RADIUS.lg, padding: 15,
    borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.sm,
  },
  infoIcon: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: COLORS.goldSoft, alignItems: 'center', justifyContent: 'center',
  },
  infoTitle: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  infoSub: { fontSize: 12, color: COLORS.textSub, marginTop: 2, lineHeight: 17 },

  actions: { gap: 12, marginTop: 16 },
  connectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: RADIUS.lg, padding: 18, gap: 10, ...SHADOWS.teal,
  },
  connectTxt: { color: '#fff', fontSize: 17, fontWeight: '800' },
  adminBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, padding: 15, gap: 10,
  },
  adminTxt: { color: COLORS.goldDark, fontSize: 14, fontWeight: '700' },
});
