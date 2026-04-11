import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { clientsApi } from '@/lib/api';

export default function ClientsTab() {
  const [search, setSearch] = useState('');

  const query = useQuery({
    queryKey: ['clients', search],
    queryFn: () => clientsApi.list({ search: search.trim() || undefined }),
  });

  const list = Array.isArray(query.data) ? query.data : [];

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Rechercher un client…"
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={() => query.refetch()}
        returnKeyType="search"
      />

      {query.isLoading && !query.data ? (
        <ActivityIndicator style={{ marginTop: 24 }} size="large" />
      ) : query.isError ? (
        <Text style={styles.error}>{(query.error as Error).message}</Text>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />
          }
          ListEmptyComponent={<Text style={styles.empty}>Aucun client.</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.name}>{item.name}</Text>
              {item.email ? <Text style={styles.sub}>{item.email}</Text> : null}
              {item.siret ? <Text style={styles.sub}>SIRET {item.siret}</Text> : null}
            </View>
          )}
        />
      )}
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
  name: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  sub: { fontSize: 14, color: '#64748b', marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 32, color: '#94a3b8' },
  error: { color: '#b91c1c', margin: 16 },
});
