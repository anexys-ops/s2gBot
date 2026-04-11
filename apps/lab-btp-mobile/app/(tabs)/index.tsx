import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth';

export default function HomeTab() {
  const { user } = useAuth();
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bonjour {user?.name}</Text>
      <Text style={styles.role}>
        {user?.role === 'lab_admin' && 'Administrateur laboratoire'}
        {user?.role === 'lab_technician' && 'Technicien'}
        {user?.role === 'client' && 'Client'}
        {user?.role === 'site_contact' && 'Contact chantier'}
        {!['lab_admin', 'lab_technician', 'client', 'site_contact'].includes(user?.role || '') &&
          user?.role}
      </Text>
      {user?.client?.name ? (
        <Text style={styles.meta}>Client : {user.client.name}</Text>
      ) : null}
      {user?.site?.name ? (
        <Text style={styles.meta}>Chantier : {user.site.name}</Text>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Raccourcis</Text>
        <Text style={styles.cardText}>
          {isLab
            ? 'Onglet Commandes : dossiers labo, statuts et détail.'
            : 'Onglet Commandes : vos dossiers et suivis.'}
        </Text>
        <Text style={styles.cardText}>Onglet Clients : annuaire (selon vos droits API).</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f8fafc' },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  role: { fontSize: 15, color: '#64748b', marginTop: 6 },
  meta: { fontSize: 14, color: '#475569', marginTop: 4 },
  card: {
    marginTop: 28,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#0f172a' },
  cardText: { fontSize: 14, color: '#64748b', marginBottom: 6, lineHeight: 20 },
});
