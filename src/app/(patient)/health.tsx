import { Feather } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { DevelopmentNotice, Panel, ScreenShell, SectionHeading } from '@/components/ui';
import { useSessionStore } from '@/store/sessionStore';
import { colors } from '@/theme/tokens';

const recordTypes = [
  { icon: 'activity' as const, title: 'Medical history', detail: 'Conditions and health background' },
  { icon: 'file-text' as const, title: 'Prescriptions', detail: 'Doctor-approved medicine instructions' },
  { icon: 'clipboard' as const, title: 'Lab reports', detail: 'Results shared by your care team' },
  { icon: 'heart' as const, title: 'Allergies', detail: 'Important information for your clinicians' },
];

export default function MyHealthScreen() {
  const session = useSessionStore((state) => state.session);
  return (
    <ScreenShell>
      <Text style={{ color: colors.teal, fontSize: 10, fontWeight: '700', letterSpacing: 1.3, marginTop: 8 }}>YOUR PERSONAL HEALTH SPACE</Text>
      <Text style={{ color: colors.ink, fontSize: 29, fontWeight: '700', letterSpacing: -0.8, marginTop: 7, marginBottom: 8 }}>My Health</Text>
      <Text style={{ color: colors.inkSoft, fontSize: 13, lineHeight: 20, marginBottom: 21 }}>A clear view of the information your care team shares with you.</Text>
      {session?.mode === 'development' ? <DevelopmentNotice>No patient records are connected in the development preview.</DevelopmentNotice> : null}
      <Panel style={{ alignItems: 'center', paddingVertical: 24, marginBottom: 24 }}>
        <View style={{ width: 58, height: 58, borderRadius: 20, backgroundColor: colors.tealPale, alignItems: 'center', justifyContent: 'center', marginBottom: 13 }}><Feather name="folder" size={23} color={colors.teal} /></View>
        <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '700' }}>Your records will live here</Text>
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 7, maxWidth: 260 }}>Medical information appears after it is shared by your connected healthcare provider.</Text>
      </Panel>
      <SectionHeading title="Health library" />
      <View style={{ gap: 10 }}>
        {recordTypes.map((record) => (
          <Panel key={record.title} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
            <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: colors.tealPale, alignItems: 'center', justifyContent: 'center' }}><Feather name={record.icon} size={17} color={colors.teal} /></View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 13 }}>{record.title}</Text>
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 3 }}>{record.detail}</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.muted} />
          </Panel>
        ))}
      </View>
      <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 16 }}>Medical instructions should always come from your healthcare professional. Each connected record will show its source and date.</Text>
    </ScreenShell>
  );
}
