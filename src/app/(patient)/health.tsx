import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { DevelopmentNotice, Panel, PrimaryButton, ScreenShell, SectionHeading } from '@/components/ui';
import { createPatientHealthNote, getPatientHealthRecords } from '@/services/healthRecordService';
import { isBackendConfigured } from '@/services/apiClient';
import { useSessionStore } from '@/store/sessionStore';
import { colors } from '@/theme/tokens';

export default function MyHealthScreen() {
  const session = useSessionStore((state) => state.session);
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const recordsQuery = useQuery({ queryKey: ['patient', 'health-records'], queryFn: getPatientHealthRecords, enabled: isBackendConfigured && !!session });
  const saveNote = useMutation({
    mutationFn: () => createPatientHealthNote(title.trim(), content.trim()),
    onSuccess: async () => {
      setTitle('');
      setContent('');
      await queryClient.invalidateQueries({ queryKey: ['patient', 'health-records'] });
    },
  });
  const records = recordsQuery.data ?? [];

  return (
    <ScreenShell>
      <Text style={{ color: colors.teal, fontSize: 10, fontWeight: '700', letterSpacing: 1.3, marginTop: 8 }}>YOUR HEALTH RECORDS</Text>
      <Text style={{ color: colors.ink, fontSize: 29, fontWeight: '700', letterSpacing: -0.8, marginTop: 7, marginBottom: 8 }}>My Health</Text>
      <Text style={{ color: colors.inkSoft, fontSize: 13, lineHeight: 20, marginBottom: 21 }}>Private notes you add and consultation notes your care team has shared with you.</Text>
      {!isBackendConfigured ? <DevelopmentNotice>Health records are not connected to a backend in this build. No sample records are shown.</DevelopmentNotice> : null}

      <SectionHeading title="Add a personal note" />
      <Panel style={{ padding: 14, marginBottom: 22 }}>
        <Text style={{ color: colors.ink, fontSize: 12, fontWeight: '700', marginBottom: 7 }}>Title</Text>
        <TextInput value={title} onChangeText={setTitle} maxLength={120} placeholder="For example, symptoms to discuss" placeholderTextColor={colors.muted} accessibilityLabel="Health note title" style={inputStyle} />
        <Text style={{ color: colors.ink, fontSize: 12, fontWeight: '700', marginTop: 12, marginBottom: 7 }}>Note</Text>
        <TextInput value={content} onChangeText={setContent} maxLength={8000} multiline textAlignVertical="top" placeholder="Write a private note for your health record" placeholderTextColor={colors.muted} accessibilityLabel="Health note content" style={[inputStyle, { minHeight: 112, paddingTop: 12 }]} />
        {saveNote.isError ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12, marginTop: 8 }}>Your note could not be saved. Check your connection and try again.</Text> : null}
        <PrimaryButton label={saveNote.isPending ? 'Saving…' : 'Save private note'} icon="lock" disabled={!isBackendConfigured || title.trim().length === 0 || content.trim().length === 0 || saveNote.isPending} onPress={() => saveNote.mutate()} style={{ marginTop: 13 }} />
      </Panel>

      <SectionHeading title="Your records" />
      {recordsQuery.isLoading ? <Panel style={{ alignItems: 'center', padding: 18 }}><ActivityIndicator color={colors.teal} /><Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>Loading your records…</Text></Panel> : null}
      {recordsQuery.isError ? <Panel><Text style={{ color: colors.ink, fontWeight: '700' }}>Your records could not be loaded.</Text><Text accessibilityRole="link" onPress={() => void recordsQuery.refetch()} style={{ color: colors.teal, fontSize: 12, fontWeight: '700', marginTop: 8 }}>Try again</Text></Panel> : null}
      {!recordsQuery.isLoading && !recordsQuery.isError && records.length === 0 ? (
        <Panel style={{ alignItems: 'center', paddingVertical: 23, marginBottom: 12 }}>
          <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: colors.tealPale, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><Feather name="folder" size={22} color={colors.teal} /></View>
          <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '700' }}>No shared records yet</Text>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6, maxWidth: 265 }}>Released notes from a completed visit will appear here alongside your private notes.</Text>
        </Panel>
      ) : null}
      <View style={{ gap: 10 }}>
        {records.map((record) => (
          <Panel key={record.id} style={{ padding: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: colors.tealPale, alignItems: 'center', justifyContent: 'center' }}><Feather name={record.type === 'PATIENT_NOTE' ? 'edit-3' : record.type === 'PRESCRIPTION' ? 'clipboard' : 'file-text'} size={17} color={colors.teal} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 13 }}>{record.title}</Text>
                <Text style={{ color: colors.muted, fontSize: 10, marginTop: 3 }}>{record.type === 'PATIENT_NOTE' ? 'Private note' : `Shared by ${record.authorName}`}{record.hospitalName ? ` · ${record.hospitalName}` : ''}</Text>
              </View>
            </View>
            <Text selectable style={{ color: colors.inkSoft, fontSize: 12, lineHeight: 19, marginTop: 12 }}>{record.content}</Text>
            <Text style={{ color: colors.muted, fontSize: 10, marginTop: 10 }}>{new Date(record.releasedAt ?? record.createdAt).toLocaleDateString()}</Text>
          </Panel>
        ))}
      </View>
      <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 16 }}>Health information is shown as entered or released by its source. Confirm medical decisions with a licensed healthcare professional.</Text>
    </ScreenShell>
  );
}

const inputStyle = { color: colors.ink, fontSize: 13, lineHeight: 19, backgroundColor: colors.canvas, borderColor: colors.line, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 } as const;
