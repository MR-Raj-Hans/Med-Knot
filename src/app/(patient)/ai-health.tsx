import { Feather } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { DevelopmentNotice, Panel, PrimaryButton, ScreenShell } from '@/components/ui';
import { isBackendConfigured } from '@/services/apiClient';
import { colors, radii } from '@/theme/tokens';

const prompts = ['How long has this been happening?', 'What should I tell my doctor?', 'What care option is right for me?'];

export default function AiHealthScreen() {
  return (
    <ScreenShell>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 8, marginBottom: 24 }}>
        <View style={{ width: 50, height: 50, borderRadius: 18, backgroundColor: colors.limePale, alignItems: 'center', justifyContent: 'center' }}><Feather name="activity" size={22} color={colors.blueDeep} /></View>
        <View>
          <Text style={{ color: colors.teal, fontSize: 10, fontWeight: '700', letterSpacing: 1.3 }}>CARE NAVIGATION</Text>
          <Text style={{ color: colors.ink, fontSize: 27, fontWeight: '700', letterSpacing: -0.7, marginTop: 3 }}>AI Health</Text>
        </View>
      </View>
      <View style={{ backgroundColor: colors.ink, borderRadius: radii.xl, padding: 22, marginBottom: 22 }}>
        <Text style={{ color: colors.lime, fontSize: 10, fontWeight: '700', letterSpacing: 1.3 }}>A CALMER NEXT STEP</Text>
        <Text style={{ color: '#FFFFFF', fontSize: 23, lineHeight: 29, fontWeight: '700', letterSpacing: -0.5, marginTop: 12 }}>Understand where to go for care.</Text>
        <Text style={{ color: 'rgba(255,255,255,0.74)', fontSize: 13, lineHeight: 20, marginTop: 9 }}>
          Share what you&apos;re experiencing and get help finding the right care pathway once MedKnot&apos;s clinical service is connected.
        </Text>
        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.16)', marginVertical: 18 }} />
        <View style={{ flexDirection: 'row', gap: 9, alignItems: 'flex-start' }}>
          <Feather name="shield" size={15} color={colors.lime} style={{ marginTop: 2 }} />
          <Text style={{ color: '#FFFFFF', fontSize: 11, lineHeight: 17, flex: 1 }}>Decision support only. A licensed healthcare professional must review clinical recommendations.</Text>
        </View>
      </View>

      <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '700', marginBottom: 12 }}>Things you can ask</Text>
      <View style={{ gap: 9, marginBottom: 22 }}>
        {prompts.map((prompt) => (
          <View key={prompt} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 15, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 13 }}>
            <Feather name="message-circle" size={15} color={colors.teal} />
            <Text style={{ color: colors.inkSoft, fontSize: 12, flex: 1 }}>{prompt}</Text>
            <Feather name="arrow-up-right" size={14} color={colors.muted} />
          </View>
        ))}
      </View>

      <Panel style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 8 }}>
          <Feather name="lock" size={15} color={colors.teal} />
          <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '700' }}>Clinical AI service</Text>
        </View>
        <Text style={{ color: colors.inkSoft, fontSize: 12, lineHeight: 18 }}>
          {isBackendConfigured ? 'The triage API contract is ready. Symptom submissions will be enabled after the backend confirms its clinical review and emergency guidance responses.' : 'Not connected in this preview. No symptom details are collected or assessed here.'}
        </Text>
      </Panel>
      <DevelopmentNotice>If you may be experiencing an emergency, contact your local emergency service now. Do not wait for an AI response.</DevelopmentNotice>
      <PrimaryButton label="Assessment unavailable in preview" disabled onPress={() => undefined} style={{ marginTop: 10 }} />
      <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 12, marginBottom: 8 }}>No diagnosis or prescription is provided by this screen.</Text>
    </ScreenShell>
  );
}
