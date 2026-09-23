import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { type FormField, type TaskForm, mobileTasksApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { API_BASE } from '@/lib/config';
import { getStoredToken } from '@/lib/tokenStorage';

function AnswerInput({ field, value, editable, onChange }: { field: FormField; value: unknown; editable: boolean; onChange: (value: unknown) => void }) {
  if (field.type === 'formula') return <Text style={styles.muted}>{value == null ? 'Calculé à l’enregistrement' : String(value)}{field.unit ? ` ${field.unit}` : ''}</Text>;
  if (field.type === 'boolean') return <Switch disabled={!editable} value={value === true} onValueChange={onChange} />;
  if (field.type === 'select') return <View style={styles.options}>{(field.options ?? []).map((option) => <Pressable key={option} disabled={!editable} style={[styles.option, value === option && styles.optionSelected]} onPress={() => onChange(option)}><Text>{option}</Text></Pressable>)}</View>;
  if (field.type === 'checkboxes') return <View style={styles.options}>{(field.options ?? []).map((option) => {
    const selected = Array.isArray(value) && value.includes(option);
    return <Pressable key={option} disabled={!editable} style={[styles.option, selected && styles.optionSelected]} onPress={() => onChange(selected ? (value as string[]).filter((item) => item !== option) : [...(Array.isArray(value) ? value : []), option])}><Text>{selected ? '☑ ' : '☐ '}{option}</Text></Pressable>;
  })}</View>;
  return <TextInput style={styles.input} editable={editable} value={value == null ? '' : String(value)}
    placeholder={field.type === 'date' ? 'AAAA-MM-JJ' : field.label} keyboardType={field.type === 'number' ? 'decimal-pad' : 'default'}
    onChangeText={(text) => onChange(field.type === 'number' ? text.replace(',', '.') : text)} />;
}

function FormCard({ taskId, form, canReview, onChanged }: { taskId: number; form: TaskForm; canReview: boolean; onChanged: () => void }) {
  const [answers, setAnswers] = useState<Record<string, unknown>>(form.submission?.answers ?? {});
  const [correctionNote, setCorrectionNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const status = form.submission?.status ?? 'draft';
  const editable = status === 'draft' || status === 'correction_requested';

  useEffect(() => { setAnswers(form.submission?.answers ?? {}); }, [form.submission?.id, form.submission?.updated_at]);
  useEffect(() => { void getStoredToken().then(setToken); }, []);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      onChanged();
      Alert.alert('Formulaire', success);
    } catch (error) {
      Alert.alert('Erreur', (error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addPhoto(field: FormField) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Appareil photo', 'Autorisez l’accès à la caméra pour joindre une photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.75 });
    if (result.canceled || !result.assets[0]?.uri) return;
    await run(async () => {
      await mobileTasksApi.saveForm(taskId, form.test_type.id, answers);
      await mobileTasksApi.uploadPhoto(taskId, form.test_type.id, field.key, result.assets[0].uri, result.assets[0].fileName ?? undefined, result.assets[0].mimeType ?? undefined);
    }, 'Photo enregistrée sur la tâche.');
  }

  function updateTable(fieldKey: string, rows: Record<string, unknown>[]) {
    setAnswers((current) => ({ ...current, [fieldKey]: rows }));
  }

  return <View style={styles.card}>
    <Text style={styles.formTitle}>{form.test_type.name}</Text>
    {form.test_type.norm ? <Text style={styles.muted}>Norme : {form.test_type.norm}</Text> : null}
    <Text style={styles.status}>État : {status}</Text>
    {form.submission?.correction_note ? <Text style={styles.correction}>Correction demandée : {form.submission.correction_note}</Text> : null}
    {form.form_fields.map((field) => <View key={field.key} style={styles.field}>
      <Text style={styles.label}>{field.label}{field.unit ? ` (${field.unit})` : ''}{field.required ? ' *' : ''}</Text>
      {field.type === 'photo' ? <>
        {(form.submission?.photos ?? []).filter((photo) => photo.field_key === field.key).map((photo) => <View key={photo.id}>
          <Text style={styles.muted}>📷 {photo.original_name}</Text>
          {token ? <Image style={styles.photo} source={{ uri: `${API_BASE}/mobile/task-forms/photos/${photo.id}`, headers: { Authorization: `Bearer ${token}`, Accept: 'image/*' } }} /> : null}
        </View>)}
        {editable ? <Pressable style={styles.secondaryButton} disabled={busy} onPress={() => void addPhoto(field)}><Text>Prendre une photo</Text></Pressable> : null}
      </> : field.type === 'table' ? <View>
        {(Array.isArray(answers[field.key]) ? answers[field.key] as Record<string, unknown>[] : []).map((row, rowIndex, allRows) => <View key={rowIndex} style={styles.tableRow}>
          <Text style={styles.muted}>Ligne {rowIndex + 1}</Text>
          {(field.columns ?? []).map((column) => <View key={column.key} style={styles.field}>
            <Text style={styles.label}>{column.label}{column.required ? ' *' : ''}</Text>
            <AnswerInput field={column} value={row[column.key]} editable={editable} onChange={(value) => updateTable(field.key, allRows.map((item, index) => index === rowIndex ? { ...item, [column.key]: value } : item))} />
          </View>)}
          {editable ? <Pressable style={styles.secondaryButton} disabled={busy} onPress={() => updateTable(field.key, allRows.filter((_, index) => index !== rowIndex))}><Text>Retirer la ligne</Text></Pressable> : null}
        </View>)}
        {editable ? <Pressable style={styles.secondaryButton} disabled={busy} onPress={() => updateTable(field.key, [...(Array.isArray(answers[field.key]) ? answers[field.key] as Record<string, unknown>[] : []), {}])}><Text>+ Ajouter une ligne</Text></Pressable> : null}
      </View> : <AnswerInput field={field} value={answers[field.key]} editable={editable} onChange={(value) => setAnswers((current) => ({ ...current, [field.key]: value }))} />}
    </View>)}
    {editable ? <View style={styles.actions}>
      <Pressable style={styles.secondaryButton} disabled={busy} onPress={() => void run(() => mobileTasksApi.saveForm(taskId, form.test_type.id, answers), 'Brouillon enregistré.')}><Text>Enregistrer</Text></Pressable>
      <Pressable style={styles.primaryButton} disabled={busy} onPress={() => void run(async () => {
        await mobileTasksApi.saveForm(taskId, form.test_type.id, answers);
        await mobileTasksApi.submitForm(taskId, form.test_type.id);
      }, 'Formulaire soumis pour validation.')}><Text style={styles.primaryText}>Soumettre</Text></Pressable>
    </View> : null}
    {canReview && status === 'submitted' ? <View style={styles.field}>
      <TextInput style={styles.input} placeholder="Motif de correction" value={correctionNote} onChangeText={setCorrectionNote} />
      <View style={styles.actions}>
        <Pressable style={styles.secondaryButton} disabled={busy || !correctionNote.trim()} onPress={() => void run(() => mobileTasksApi.reviewForm(taskId, form.test_type.id, 'correction', correctionNote), 'Correction demandée.')}><Text>Demander correction</Text></Pressable>
        <Pressable style={styles.primaryButton} disabled={busy} onPress={() => void run(() => mobileTasksApi.reviewForm(taskId, form.test_type.id, 'validate'), 'Formulaire validé.')}><Text style={styles.primaryText}>Valider</Text></Pressable>
      </View>
    </View> : null}
  </View>;
}

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const taskId = Number(id);
  const qc = useQueryClient();
  const { user } = useAuth();
  const task = useQuery({ queryKey: ['mobile-task', taskId], queryFn: () => mobileTasksApi.get(taskId), enabled: taskId > 0 });
  const forms = useQuery({ queryKey: ['mobile-task-forms', taskId], queryFn: () => mobileTasksApi.forms(taskId), enabled: taskId > 0 });
  const canReview = user?.role === 'lab_admin' || user?.role === 'responsable';

  if (task.isLoading || forms.isLoading) return <View style={styles.center}><ActivityIndicator /></View>;
  if (task.isError || forms.isError || !task.data) return <View style={styles.center}><Text>{(task.error || forms.error as Error)?.message ?? 'Tâche introuvable'}</Text></View>;

  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Text style={styles.heading}>{task.data.libelle ?? task.data.numero}</Text>
    <Text style={styles.muted}>{task.data.numero} · {task.data.ordre_mission?.numero}</Text>
    <Text style={styles.detail}>Client : {task.data.client?.name ?? '—'}</Text>
    <Text style={styles.detail}>Chantier : {task.data.site?.name ?? '—'}</Text>
    <Text style={styles.detail}>Date : {task.data.planned_date ?? 'À planifier'} · {task.data.statut}</Text>
    <Text style={styles.section}>Formulaires liés à la tâche</Text>
    {(forms.data?.forms ?? []).length === 0 ? <Text style={styles.muted}>Aucun formulaire affecté au produit ou à son action.</Text> : null}
    {(forms.data?.forms ?? []).map((form) => <FormCard key={form.test_type.id} taskId={taskId} form={form} canReview={canReview} onChanged={() => {
      void qc.invalidateQueries({ queryKey: ['mobile-task-forms', taskId] });
      void qc.invalidateQueries({ queryKey: ['mobile-task', taskId] });
      void qc.invalidateQueries({ queryKey: ['mobile-tasks'] });
    }} />)}
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f8fafc' }, content: { padding: 16, paddingBottom: 40 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  heading: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  muted: { color: '#64748b', marginBottom: 4 }, detail: { color: '#334155', marginTop: 4 }, section: { fontSize: 18, fontWeight: '700', marginTop: 24, marginBottom: 10 },
  card: { padding: 14, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 14 },
  formTitle: { fontSize: 17, fontWeight: '700' }, status: { color: '#475569', marginTop: 6 }, correction: { color: '#b45309', marginTop: 8 },
  field: { marginTop: 16, gap: 6 }, label: { fontWeight: '600', color: '#334155' }, input: { borderWidth: 1, borderColor: '#cbd5e1', padding: 10, borderRadius: 8 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap' }, secondaryButton: { padding: 10, borderRadius: 8, backgroundColor: '#e2e8f0' }, primaryButton: { padding: 10, borderRadius: 8, backgroundColor: '#b45309' }, primaryText: { color: '#fff', fontWeight: '700' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, option: { padding: 8, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8 }, optionSelected: { backgroundColor: '#fed7aa' },
  photo: { width: '100%', height: 180, borderRadius: 8, marginTop: 4 },
  tableRow: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, marginBottom: 8 },
});
