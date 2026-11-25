import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { PrimaryButton, ScreenShell } from '@/components/ui';
import { colors } from '@/theme/tokens';

export default function NotFoundScreen() {
  return (
    <ScreenShell>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.teal, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 }}>MEDKNOT PATIENT</Text>
        <Text style={{ color: colors.ink, fontSize: 28, fontWeight: '700', marginTop: 12 }}>We lost that page.</Text>
        <Text style={{ color: colors.inkSoft, fontSize: 14, textAlign: 'center', lineHeight: 21, marginTop: 8, marginBottom: 24 }}>Let&apos;s get you back to your care home.</Text>
        <PrimaryButton label="Go to welcome" onPress={() => router.replace('/welcome')} />
      </View>
    </ScreenShell>
  );
}
