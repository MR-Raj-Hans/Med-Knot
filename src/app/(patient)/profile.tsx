import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Avatar, DevelopmentNotice, InlineAlert, Panel, PrimaryButton, ScreenShell } from '@/components/ui';
import { authService } from '@/services/authService';
import { useSessionStore } from '@/store/sessionStore';
import { colors } from '@/theme/tokens';

const settings = [
  { icon: 'user' as const, title: 'Personal information', detail: 'Profile and contact details' },
  { icon: 'bell' as const, title: 'Notifications', detail: 'Appointment and follow-up reminders' },
  { icon: 'shield' as const, title: 'Privacy & security', detail: 'Your data and account access' },
  { icon: 'help-circle' as const, title: 'Help & support', detail: 'Get help using MedKnot' },
];

export default function ProfileScreen() {
  const session = useSessionStore((state) => state.session);
  const profile = useSessionStore((state) => state.profile);
  const clearSession = useSessionStore((state) => state.clearSession);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const displayName = session?.patientName && session.patientName !== 'there' ? session.patientName : 'MedKnot patient';

  const signOut = async () => {
    setBusy(true);
    setError('');
    try {
      await authService.signOut();
    } catch (signOutError) {
      setError(signOutError instanceof Error
        ? 'You were signed out on this device, but the server could not confirm sign-out.'
        : 'You were signed out on this device, but the server could not confirm sign-out.');
    } finally {
      clearSession();
      router.replace('/welcome');
      setBusy(false);
    }
  };

  return (
    <ScreenShell>
      <Text style={{ color: colors.teal, fontSize: 10, fontWeight: '700', letterSpacing: 1.3, marginTop: 8 }}>YOUR ACCOUNT</Text>
      <Text style={{ color: colors.ink, fontSize: 29, fontWeight: '700', letterSpacing: -0.8, marginTop: 7, marginBottom: 20 }}>Profile</Text>
      <Panel style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, marginBottom: 16 }}>
        <Avatar name={displayName} imageUri={profile?.photoUri} size={58} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '700' }}>{displayName}</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{session?.mode === 'development' ? 'Development preview account' : 'Patient account'}</Text>
        </View>
        <Feather name="edit-2" size={16} color={colors.teal} />
      </Panel>
      {session?.mode === 'development' ? <DevelopmentNotice>This preview does not connect to a real hospital account or medical record.</DevelopmentNotice> : null}
      <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '700', marginTop: 9, marginBottom: 11 }}>Settings</Text>
      <View style={{ gap: 9 }}>
        {settings.map((setting) => (
          <Panel key={setting.title} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
            <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: colors.tealPale, alignItems: 'center', justifyContent: 'center' }}><Feather name={setting.icon} size={17} color={colors.teal} /></View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '700' }}>{setting.title}</Text>
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 3 }}>{setting.detail}</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.muted} />
          </Panel>
        ))}
      </View>
      {error ? <View style={{ marginTop: 15 }}><InlineAlert>{error}</InlineAlert></View> : null}
      <PrimaryButton label="Sign out" icon="log-out" variant="secondary" loading={busy} onPress={signOut} style={{ marginTop: 22 }} />
      <Text style={{ color: colors.muted, fontSize: 10, textAlign: 'center', marginTop: 17 }}>MedKnot · Connected care. Brighter lives.</Text>
    </ScreenShell>
  );
}
