import { useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useDispatch } from 'react-redux';
import { connectByQrCode } from '@/services/authService';
import { setChauffeur } from '@/store/authSlice';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const dispatch = useDispatch();

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>L'accès à la caméra est nécessaire pour s'identifier.</Text>
        <Text style={styles.btn} onPress={requestPermission}>Autoriser</Text>
      </View>
    );
  }

  const handleScan = async ({ data }: { data: string }) => {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);
    try {
      const chauffeur = await connectByQrCode(data);
      dispatch(setChauffeur(chauffeur));
      router.replace('/(chauffeur)');
    } catch {
      Alert.alert('Erreur', 'QR code invalide ou chauffeur introuvable.', [
        { text: 'Réessayer', onPress: () => setScanned(false) },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Scannez votre QR code chauffeur</Text>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleScan}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />
      {loading && <ActivityIndicator size="large" color="#6d4aff" style={styles.loader} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  title: { color: '#fff', textAlign: 'center', fontSize: 18, padding: 20, fontWeight: '600' },
  camera: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  msg: { fontSize: 16, textAlign: 'center', marginBottom: 12 },
  btn: { color: '#6d4aff', fontWeight: 'bold', fontSize: 16 },
  loader: { position: 'absolute', bottom: 40, alignSelf: 'center' },
});
