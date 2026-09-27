import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { mobileTasksApi } from '@/lib/api';

export default function TasksScreen() {
  const router = useRouter();
  const query = useQuery({ queryKey: ['mobile-tasks'], queryFn: mobileTasksApi.list });

  if (query.isLoading) return <View style={styles.center}><ActivityIndicator /></View>;
  if (query.isError) return <View style={styles.center}><Text>{(query.error as Error).message}</Text></View>;

  return <FlatList
    style={styles.page}
    contentContainerStyle={styles.content}
    data={query.data ?? []}
    keyExtractor={(item) => String(item.id)}
    ListHeaderComponent={<Text style={styles.heading}>Mes tâches</Text>}
    ListEmptyComponent={<Text>Aucune tâche affectée.</Text>}
    renderItem={({ item }) => <Pressable style={styles.card} onPress={() => router.push(`/task/${item.id}`)}>
      <Text style={styles.title}>{item.libelle ?? item.numero}</Text>
      <Text>{item.numero} · {item.ordre_mission?.numero ?? 'OM'}</Text>
      <Text>{item.client?.name ?? 'Client non renseigné'} · {item.site?.name ?? 'Chantier non renseigné'}</Text>
      <Text style={styles.meta}>{item.planned_date ?? 'Date à préciser'} · {item.statut}</Text>
    </Pressable>}
  />;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 36 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 16, color: '#0f172a' },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 14, marginBottom: 10, gap: 4 },
  title: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  meta: { color: '#64748b' },
});
