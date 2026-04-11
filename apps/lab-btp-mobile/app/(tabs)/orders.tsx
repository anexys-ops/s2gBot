import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ordersApi } from '@/lib/api';

const STATUS_FR: Record<string, string> = {
  draft: 'Brouillon',
  submitted: 'Envoyée',
  in_progress: 'En cours',
  completed: 'Terminée',
};

export default function OrdersTab() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const query = useQuery({
    queryKey: ['orders', page, search],
    queryFn: () => ordersApi.list({ page, search: search.trim() || undefined }),
  });

  const orders = query.data?.data ?? [];
  const lastPage = query.data?.last_page ?? 1;

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Rechercher (réf., notes…)"
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={() => {
          setPage(1);
          query.refetch();
        }}
        returnKeyType="search"
      />

      {query.isLoading && !query.data ? (
        <ActivityIndicator style={{ marginTop: 24 }} size="large" />
      ) : query.isError ? (
        <Text style={styles.error}>{(query.error as Error).message}</Text>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />
          }
          ListEmptyComponent={<Text style={styles.empty}>Aucune commande.</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => router.push(`/order/${item.id}`)}
              android_ripple={{ color: '#e2e8f0' }}>
              <Text style={styles.ref}>{item.reference}</Text>
              <Text style={styles.sub}>
                {item.client?.name ?? '—'} · {STATUS_FR[item.status] ?? item.status}
              </Text>
            </Pressable>
          )}
        />
      )}

      {lastPage > 1 ? (
        <View style={styles.pager}>
          <Text
            style={[styles.pageBtn, page <= 1 && styles.pageBtnOff]}
            onPress={() => page > 1 && setPage((p) => p - 1)}>
            Précédent
          </Text>
          <Text style={styles.pageInfo}>
            {page} / {lastPage}
          </Text>
          <Text
            style={[styles.pageBtn, page >= lastPage && styles.pageBtnOff]}
            onPress={() => page < lastPage && setPage((p) => p + 1)}>
            Suivant
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  search: {
    margin: 12,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    fontSize: 16,
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  ref: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  sub: { fontSize: 14, color: '#64748b', marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 32, color: '#94a3b8' },
  error: { color: '#b91c1c', margin: 16 },
  pager: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  pageBtn: { color: '#0d9488', fontWeight: '600', fontSize: 15 },
  pageBtnOff: { color: '#cbd5e1' },
  pageInfo: { fontSize: 14, color: '#64748b' },
});
