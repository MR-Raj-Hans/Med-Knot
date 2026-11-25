import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Avatar, DevelopmentNotice, IconButton, Panel, PrimaryButton, ScreenShell, SectionHeading } from '@/components/ui';
import { useSessionStore } from '@/store/sessionStore';
import { getHomeSummary } from '@/services/homeService';
import { colors, radii, shadows } from '@/theme/tokens';

const quickActions = [
  { icon: 'search' as const, label: 'Find a doctor', path: '/appointments' as const },
  { icon: 'map-pin' as const, label: 'Nearby hospitals', path: '/hospitals' as const },
  { icon: 'activity' as const, label: 'AI Health', path: '/ai-health' as const },
  { icon: 'file-text' as const, label: 'Health records', path: '/health' as const },
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function PatientHomeScreen() {
  const session = useSessionStore((state) => state.session);
  const profile = useSessionStore((state) => state.profile);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['patient', 'home'], queryFn: getHomeSummary });
  const name = data?.dataSource === 'api' ? data.patientName.split(' ')[0] : session?.patientName && session.patientName !== 'there' ? session.patientName.split(' ')[0] : data?.patientName ?? 'there';
  const appointment = data?.nextAppointment;

  return (
    <ScreenShell>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <View>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 3 }}>{greeting()},</Text>
          <Text style={{ color: colors.ink, fontSize: 25, fontWeight: '700', letterSpacing: -0.7 }}>{name}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <IconButton name="bell" accessibilityLabel="Notifications" onPress={() => router.push('/profile')} />
          <Avatar name={session?.patientName ?? 'MedKnot'} imageUri={profile?.photoUri} size={44} />
        </View>
      </View>

      {data?.dataSource === 'development-fixture' ? <DevelopmentNotice>Development preview · appointment details below are synthetic sample data.</DevelopmentNotice> : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Feather name="sun" size={14} color={colors.teal} />
        <Text style={{ color: colors.teal, fontSize: 10, fontWeight: '700', letterSpacing: 1.25 }}>YOUR CARE, AT A GLANCE</Text>
      </View>
      <View style={{ backgroundColor: colors.ink, borderRadius: radii.xl, padding: 20, marginBottom: 25, overflow: 'hidden', ...shadows.card }}>
        <View style={{ position: 'absolute', right: -48, top: -61, width: 170, height: 170, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700', letterSpacing: 1.2 }}>NEXT APPOINTMENT</Text>
          <View style={{ borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: 'rgba(216,231,152,0.17)' }}>
            <Text style={{ color: colors.lime, fontSize: 9, fontWeight: '700', letterSpacing: 0.7 }}>{appointment?.status === 'confirmed' ? 'CONFIRMED' : 'UP NEXT'}</Text>
          </View>
        </View>
        {isLoading ? (
          <View style={{ height: 107, justifyContent: 'center' }}><Text style={{ color: '#FFFFFF' }}>Loading your schedule…</Text></View>
        ) : isError ? (
          <View style={{ marginTop: 18 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 15, lineHeight: 22 }}>We couldn&apos;t load your appointment details.</Text>
            <Text onPress={() => void refetch()} style={{ color: colors.lime, fontWeight: '700', fontSize: 12, marginTop: 10 }}>Try again</Text>
          </View>
        ) : appointment ? (
          <>
            <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700', letterSpacing: -0.4, marginTop: 18 }}>{appointment.doctorName}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13, marginTop: 4 }}>{appointment.specialty}</Text>
            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 16 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Feather name="calendar" color={colors.lime} size={14} />
              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>{appointment.dateLabel}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.48)', marginHorizontal: 2 }}>·</Text>
              <Feather name="clock" color={colors.lime} size={14} />
              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>{appointment.timeLabel}</Text>
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.67)', fontSize: 11, marginTop: 10 }}>{appointment.location}</Text>
          </>
        ) : (
          <View style={{ marginTop: 19 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>No appointment booked yet</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 6 }}>Find a clinician when you’re ready.</Text>
          </View>
        )}
        <PrimaryButton label="View bookings" variant="secondary" icon="calendar" onPress={() => router.push('/appointments')} style={{ marginTop: 19, backgroundColor: '#FFFFFF', borderColor: '#FFFFFF', minHeight: 48 }} />
      </View>

      <SectionHeading title="Quick actions" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginBottom: 26 }}>
        {quickActions.map((action) => (
          <View key={action.label} style={{ width: '48%' }}>
            <Pressable accessibilityRole="button" onPress={() => router.push(action.path)} style={({ pressed }) => [{ backgroundColor: colors.paper, borderRadius: 18, borderWidth: 1, borderColor: colors.line, minHeight: 92, alignItems: 'flex-start', justifyContent: 'space-between', padding: 12 }, pressed && { opacity: 0.78 }]}>
              <View style={{ width: 31, height: 31, borderRadius: 11, backgroundColor: action.icon === 'activity' ? colors.limePale : colors.tealPale, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name={action.icon} color={action.icon === 'activity' ? colors.blueDeep : colors.teal} size={15} />
              </View>
              <Text style={{ color: colors.ink, fontSize: 11, fontWeight: '700', lineHeight: 15 }}>{action.label}</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <SectionHeading title="Your health snapshot" action="My Health" onAction={() => router.push('/health')} />
      <View style={{ flexDirection: 'row', gap: 11, marginBottom: 17 }}>
        <Panel style={{ flex: 1, padding: 15 }}>
          <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: colors.tealPale, alignItems: 'center', justifyContent: 'center' }}><Feather name="file-text" size={15} color={colors.teal} /></View>
          <Text style={{ color: colors.ink, fontSize: 21, fontWeight: '700', marginTop: 13 }}>{data?.prescriptionCount ?? '—'}</Text>
          <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>Prescriptions shared</Text>
        </Panel>
        <Panel style={{ flex: 1, padding: 15 }}>
          <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: colors.limePale, alignItems: 'center', justifyContent: 'center' }}><Feather name="repeat" size={15} color={colors.blueDeep} /></View>
          <Text style={{ color: colors.ink, fontSize: 13, lineHeight: 18, fontWeight: '700', marginTop: 13 }}>{data?.followUpLabel ?? 'No follow-ups'}</Text>
          <Text style={{ color: colors.muted, fontSize: 11, marginTop: 3 }}>Next follow-up</Text>
        </Panel>
      </View>
      <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 16, marginBottom: 8 }}>
        {data?.dataSource === 'development-fixture' ? 'Sample data for preview only. It is not part of a real medical record.' : 'Health information shown here comes from your connected care team.'}
      </Text>
    </ScreenShell>
  );
}
