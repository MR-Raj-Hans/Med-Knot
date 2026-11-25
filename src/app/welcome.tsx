import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { AuthTopBar, PrimaryButton, ScreenShell } from '@/components/ui';
import { colors, radii } from '@/theme/tokens';

const features = [
  { icon: 'calendar' as const, title: 'Care, in one place', copy: 'Appointments, visits and next steps together.' },
  { icon: 'heart' as const, title: 'A clearer health picture', copy: 'Your records stay close and easy to understand.' },
  { icon: 'message-circle' as const, title: 'Support when you need it', copy: 'Find the right care path with MedKnot AI Health.' },
];

export default function WelcomeScreen() {
  return (
    <ScreenShell>
      <AuthTopBar />
      <View style={{ marginTop: 12, marginBottom: 26 }}>
        <Text style={{ color: colors.teal, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 }}>CARE THAT STAYS CONNECTED</Text>
        <Text style={{ color: colors.ink, fontSize: 36, lineHeight: 42, fontWeight: '700', letterSpacing: -1.4, marginTop: 12 }}>
          Your health,{ '\n' }all in one place.
        </Text>
        <Text style={{ color: colors.inkSoft, fontSize: 15, lineHeight: 23, marginTop: 12, maxWidth: 315 }}>
          A calmer way to keep up with appointments, health records and the people who care for you.
        </Text>
      </View>

      <View style={{ borderRadius: radii.xl, backgroundColor: colors.ink, padding: 20, marginBottom: 22, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', right: -27, top: -42, width: 142, height: 142, borderRadius: 80, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: 'rgba(216,231,152,0.17)', alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="activity" size={17} color={colors.lime} />
          </View>
          <Text style={{ color: colors.lime, fontSize: 10, fontWeight: '700', letterSpacing: 1.2 }}>YOUR CARE, CONNECTED</Text>
        </View>
        <Text style={{ color: '#FFFFFF', fontSize: 19, lineHeight: 26, fontWeight: '600', marginTop: 18, maxWidth: 240 }}>
          Small steps toward brighter days.
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18, gap: 7 }}>
          {[0, 1, 2].map((item) => <View key={item} style={{ width: item === 0 ? 27 : 6, height: 6, borderRadius: 4, backgroundColor: item === 0 ? colors.lime : 'rgba(255,255,255,0.28)' }} />)}
        </View>
      </View>

      <View style={{ gap: 14, marginBottom: 24 }}>
        {features.map((feature) => (
          <View key={feature.title} style={{ flexDirection: 'row', gap: 13, alignItems: 'center' }}>
            <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.tealPale, alignItems: 'center', justifyContent: 'center' }}>
              <Feather name={feature.icon} size={17} color={colors.teal} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 13 }}>{feature.title}</Text>
              <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 2 }}>{feature.copy}</Text>
            </View>
          </View>
        ))}
      </View>

      <PrimaryButton label="Create your account" icon="user-plus" onPress={() => router.push('/register')} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 18, marginBottom: 16 }}>
        <Text style={{ color: colors.muted, fontSize: 13 }}>Already have an account?</Text>
        <Text accessibilityRole="link" onPress={() => router.push('/sign-in')} style={{ color: colors.blue, fontSize: 13, fontWeight: '700' }}>Sign in</Text>
      </View>
      <Text style={{ textAlign: 'center', color: colors.muted, fontSize: 10, lineHeight: 16, marginHorizontal: 12 }}>
        By continuing, you agree to our Terms of Service and Privacy Policy.
      </Text>
    </ScreenShell>
  );
}
