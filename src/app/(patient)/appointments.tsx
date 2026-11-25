import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { DevelopmentNotice, IconButton, Panel, PrimaryButton, ScreenShell, SectionHeading } from '@/components/ui';
import { getHomeSummary } from '@/services/homeService';
import { colors, radii } from '@/theme/tokens';

export default function AppointmentsScreen() {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['patient', 'home'], queryFn: getHomeSummary });
  const [showDiscoveryNote, setShowDiscoveryNote] = useState(false);
  const appointment = data?.nextAppointment;

  return (
    <ScreenShell>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 }}>
        <View>
          <Text style={{ color: colors.teal, fontSize: 10, fontWeight: '700', letterSpacing: 1.3 }}>YOUR VISITS</Text>
          <Text style={{ color: colors.ink, fontSize: 29, fontWeight: '700', letterSpacing: -0.8, marginTop: 6 }}>Bookings</Text>
        </View>
        <IconButton name="plus" accessibilityLabel="Find a doctor" onPress={() => setShowDiscoveryNote(true)} />
      </View>
      {showDiscoveryNote ? <DevelopmentNotice>Doctor discovery and booking will connect to the shared hospital directory in the next milestone.</DevelopmentNotice> : null}
      {data?.dataSource === 'development-fixture' ? <DevelopmentNotice>Preview appointment information is synthetic sample data.</DevelopmentNotice> : null}
      <SectionHeading title="Upcoming" />
      {isLoading ? (
        <Panel><Text style={{ color: colors.inkSoft }}>Loading your visits…</Text></Panel>
      ) : isError ? (
        <Panel>
          <Text style={{ color: colors.ink, fontWeight: '700' }}>We couldn&apos;t load your bookings.</Text>
          <Text onPress={() => void refetch()} style={{ color: colors.blue, fontWeight: '700', fontSize: 13, marginTop: 11 }}>Try again</Text>
        </Panel>
      ) : appointment ? (
        <Panel style={{ marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: colors.tealPale, alignItems: 'center', justifyContent: 'center' }}><Feather name="user" color={colors.teal} size={20} /></View>
            <View style={{ borderRadius: radii.pill, backgroundColor: colors.limePale, paddingHorizontal: 10, paddingVertical: 6 }}><Text style={{ color: colors.blueDeep, fontSize: 9, fontWeight: '700' }}>{appointment.status.toUpperCase()}</Text></View>
          </View>
          <Text style={{ color: colors.ink, fontSize: 19, fontWeight: '700', marginTop: 16 }}>{appointment.doctorName}</Text>
          <Text style={{ color: colors.inkSoft, fontSize: 13, marginTop: 4 }}>{appointment.specialty}</Text>
          <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 17 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Feather name="calendar" size={15} color={colors.teal} /><Text style={{ color: colors.ink, fontWeight: '600', fontSize: 13 }}>{appointment.dateLabel}</Text>
            <Feather name="clock" size={15} color={colors.teal} style={{ marginLeft: 9 }} /><Text style={{ color: colors.ink, fontWeight: '600', fontSize: 13 }}>{appointment.timeLabel}</Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 12 }}>{appointment.location}</Text>
        </Panel>
      ) : (
        <Panel style={{ alignItems: 'center', paddingVertical: 32, marginBottom: 18 }}>
          <View style={{ width: 55, height: 55, borderRadius: 20, backgroundColor: colors.tealPale, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}><Feather name="calendar" size={22} color={colors.teal} /></View>
          <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '700' }}>No upcoming visits</Text>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 7 }}>Appointments from your connected care team will appear here.</Text>
        </Panel>
      )}
      <PrimaryButton label="Doctor discovery coming soon" icon="search" variant="secondary" disabled onPress={() => setShowDiscoveryNote(true)} />
      <View style={{ marginTop: 26 }}>
        <SectionHeading title="Past visits" />
        <Panel style={{ paddingVertical: 17 }}>
          <Text style={{ color: colors.inkSoft, fontSize: 13 }}>Your appointment history will be available once your patient account is connected.</Text>
        </Panel>
      </View>
    </ScreenShell>
  );
}
