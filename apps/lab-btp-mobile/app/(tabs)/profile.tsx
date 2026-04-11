import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { API_ORIGIN } from '@/lib/config';

export default function ProfileTab() {
  const { user, logout } = useAuth();
  const router = useRouter();

  async function onLogout() {
    Alert.alert('Déconnexion', 'Confirmer ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnexion',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>Connecté</Text>
        <Text style={styles.value}>{user?.email}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>API</Text>
        <Text style={styles.mono}>{API_ORIGIN}</Text>
        <Text style={styles.hint}>
          Build production : définir EXPO_PUBLIC_API_URL. Publication stores : EAS Build + soumission
          App Store / Play Console.
        </Text>
      </View>

      <Pressable style={styles.logout} onPress={onLogout}>
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f8fafc' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  label: { fontSize: 12, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 },
  value: { fontSize: 17, fontWeight: '600', color: '#0f172a' },
  mono: { fontSize: 13, color: '#334155' },
  hint: { fontSize: 12, color: '#94a3b8', marginTop: 10, lineHeight: 18 },
  logout: {
    marginTop: 24,
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  logoutText: { color: '#b91c1c', fontWeight: '600', fontSize: 16 },
});
