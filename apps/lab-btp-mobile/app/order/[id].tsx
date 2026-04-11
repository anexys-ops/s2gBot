import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ordersApi } from '@/lib/api';

type OrderDetail = Awaited<ReturnType<typeof ordersApi.get>>;

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = Number(id);

  const query = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => ordersApi.get(orderId),
    enabled: Number.isFinite(orderId) && orderId > 0,
  });

  if (!Number.isFinite(orderId) || orderId <= 0) {
    return (
      <View style={styles.center}>
        <Text>Commande invalide.</Text>
      </View>
    );
  }

  if (query.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (query.isError || !query.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{(query.error as Error)?.message ?? 'Introuvable'}</Text>
      </View>
    );
  }

  const o = query.data as OrderDetail & {
    order_items?: Array<{
      id: number;
      quantity: number;
      test_type?: { name: string };
      samples?: Array<{ id: number; reference: string; status: string }>;
    }>;
    notes?: string | null;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.ref}>{o.reference}</Text>
      <Text style={styles.line}>Client : {o.client?.name ?? '—'}</Text>
      <Text style={styles.line}>Chantier : {o.site?.name ?? '—'}</Text>
      <Text style={styles.line}>Statut : {o.status}</Text>
      <Text style={styles.line}>Date : {String(o.order_date).slice(0, 10)}</Text>
      {o.notes ? <Text style={styles.notes}>{o.notes}</Text> : null}

      <Text style={styles.section}>Lignes & échantillons</Text>
      {(o.order_items ?? []).length === 0 ? (
        <Text style={styles.muted}>Aucune ligne.</Text>
      ) : (
        o.order_items!.map((item) => (
          <View key={item.id} style={styles.block}>
            <Text style={styles.itemTitle}>
              {item.test_type?.name ?? 'Essai'} ×{item.quantity}
            </Text>
            {(item.samples ?? []).map((s) => (
              <Text key={s.id} style={styles.sample}>
                · {s.reference} ({s.status})
              </Text>
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  ref: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  line: { fontSize: 15, color: '#334155', marginBottom: 6 },
  notes: { fontSize: 14, color: '#64748b', marginTop: 12, fontStyle: 'italic' },
  section: { fontSize: 17, fontWeight: '600', marginTop: 24, marginBottom: 10, color: '#0f172a' },
  muted: { color: '#94a3b8' },
  block: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  itemTitle: { fontWeight: '600', color: '#0f172a' },
  sample: { fontSize: 14, color: '#64748b', marginTop: 4, marginLeft: 4 },
  error: { color: '#b91c1c', textAlign: 'center' },
});
