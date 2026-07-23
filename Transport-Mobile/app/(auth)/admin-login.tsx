import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Image,
  StatusBar, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, LOGO } from '@/constants/theme';
import { loginSuperviseur } from '@/services/superviseurAuth';
import { storeChauffeur } from '@/services/authService';
import { setChauffeur } from '@/store/authSlice';

export default function AdminLoginScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const connexion = async () => {
    if (!username.trim() || !password) {
      Alert.alert('Connexion', 'Saisissez votre identifiant et votre mot de passe.');
      return;
    }
    setLoading(true);
    try {
      const profil = await loginSuperviseur(username, password);
      await storeChauffeur(profil);
      dispatch(setChauffeur(profil));
      router.replace('/(admin)' as any);
    } catch (e: any) {
      Alert.alert('Connexion administrateur', e?.message || 'Échec de la connexion.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={COLORS.brownDeep} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.back} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={COLORS.brown} />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.logoCard}>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={styles.title}>Connexion administrateur</Text>
          <Text style={styles.subtitle}>Identifiez-vous avec votre compte superviseur</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Identifiant</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="person-outline" size={20} color={COLORS.textSub} />
            <TextInput
              style={styles.input}
              placeholder="Nom d'utilisateur"
              placeholderTextColor={COLORS.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              value={username}
              onChangeText={setUsername}
              returnKeyType="next"
              editable={!loading}
            />
          </View>

          <Text style={styles.label}>Mot de passe</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSub} />
            <TextInput
              style={styles.input}
              placeholder="Mot de passe"
              placeholderTextColor={COLORS.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!showPwd}
              value={password}
              onChangeText={setPassword}
              returnKeyType="go"
              onSubmitEditing={connexion}
              editable={!loading}
            />
            <TouchableOpacity onPress={() => setShowPwd((v) => !v)} hitSlop={10}>
              <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textSub} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.7 }]}
            onPress={connexion}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={COLORS.brown} />
              : <Ionicons name="log-in-outline" size={22} color={COLORS.brown} />}
            <Text style={styles.btnTxt}>{loading ? 'Connexion…' : 'Se connecter'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, paddingTop: 56 },
  back: { position: 'absolute', top: 48, left: 16, zIndex: 10, padding: 4 },
  header: { alignItems: 'center', gap: 12, marginTop: 24, marginBottom: 36 },
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
  logo: { width: 220, height: 64 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginTop: 6 },
  subtitle: { fontSize: 13, color: COLORS.textSub, textAlign: 'center' },
  form: { gap: 8 },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginTop: 10, marginLeft: 2 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    gap: 10,
  },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: COLORS.text },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gold,
    borderRadius: 16,
    padding: 18,
    gap: 10,
    marginTop: 28,
    shadowColor: COLORS.gold,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  btnTxt: { color: COLORS.brown, fontSize: 17, fontWeight: '800' },
});
