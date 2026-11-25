import { Feather } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Avatar, DevelopmentNotice, InlineAlert, Panel, PrimaryButton, ScreenShell, SectionHeading, TextField } from '@/components/ui';
import {
  bookInPersonAppointment,
  cancelPatientAppointment,
  createAppointmentIdempotencyKey,
  getDoctorAvailability,
  getPatientAppointments,
  getVerifiedDoctor,
  reschedulePatientAppointment,
  searchVerifiedDoctors,
} from '@/services/careService';
import { isBackendConfigured } from '@/services/apiClient';
import type { PatientAppointment } from '@/services/careService';
import { colors, radii } from '@/theme/tokens';

function errorText(error: unknown, fallback: string) {
  if (isAxiosError(error)) {
    const message = (error.response?.data as { message?: unknown } | undefined)?.message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join(' ');
  }
  return error instanceof Error ? error.message : fallback;
}

function formatSlot(startAt: string, timezone: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone }).format(new Date(startAt));
}

function formatFee(minor: number | null, currency: string | null) {
  if (minor === null || currency === null) return 'Fee not listed';
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(minor / 100); } catch { return 'Fee not listed'; }
}

function AppointmentCard({ appointment, onCancel, onReschedule, busy }: {
  appointment: PatientAppointment;
  onCancel: () => void;
  onReschedule: () => void;
  busy: boolean;
}) {
  const canChange = appointment.status === 'CONFIRMED' && new Date(appointment.slot.startAt) > new Date();
  const badgeColor = appointment.status === 'CONFIRMED' ? colors.tealPale : colors.paper;

  return (
    <Panel style={{ marginBottom: 12, padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 16 }}>{appointment.doctor.fullName}</Text>
          <Text style={{ color: colors.inkSoft, fontSize: 12, marginTop: 3 }}>{appointment.doctor.specialty.name} · {appointment.doctor.department.name}</Text>
        </View>
        <View style={{ borderRadius: radii.pill, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: badgeColor }}>
          <Text style={{ color: colors.teal, fontSize: 9, fontWeight: '700' }}>{appointment.status}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 13 }}>
        <Feather name="calendar" size={14} color={colors.teal} />
        <Text style={{ color: colors.ink, fontSize: 12, fontWeight: '600', flex: 1 }}>{formatSlot(appointment.slot.startAt, appointment.slot.timezone)}</Text>
      </View>
      <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 8 }}>{appointment.doctor.hospital.name}{appointment.doctor.hospital.city ? ` · ${appointment.doctor.hospital.city}` : ''}</Text>
      {canChange ? (
        <View style={{ flexDirection: 'row', gap: 9, marginTop: 14 }}>
          <PrimaryButton label="Reschedule" variant="secondary" loading={busy} onPress={onReschedule} style={{ flex: 1, minHeight: 44, paddingHorizontal: 10 }} />
          <PrimaryButton label="Cancel" variant="quiet" loading={busy} onPress={onCancel} style={{ flex: 1, minHeight: 44, paddingHorizontal: 10 }} />
        </View>
      ) : null}
    </Panel>
  );
}

export default function AppointmentsScreen() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeDoctorId, setActiveDoctorId] = useState('');
  const [reschedulingId, setReschedulingId] = useState('');
  const [notice, setNotice] = useState('');
  const idempotencyKeys = useRef(new Map<string, string>());

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const doctorsQuery = useQuery({
    queryKey: ['directory', 'doctors', debouncedSearch],
    queryFn: () => searchVerifiedDoctors(debouncedSearch),
    enabled: isBackendConfigured,
  });
  const appointmentsQuery = useQuery({
    queryKey: ['patient', 'appointments'],
    queryFn: getPatientAppointments,
    enabled: isBackendConfigured,
  });
  const doctorQuery = useQuery({
    queryKey: ['directory', 'doctor', activeDoctorId],
    queryFn: () => getVerifiedDoctor(activeDoctorId),
    enabled: isBackendConfigured && Boolean(activeDoctorId),
  });
  const availabilityQuery = useQuery({
    queryKey: ['directory', 'doctor', activeDoctorId, 'availability'],
    queryFn: () => getDoctorAvailability(activeDoctorId),
    enabled: isBackendConfigured && Boolean(activeDoctorId),
  });

  const bookingMutation = useMutation({
    mutationFn: ({ doctorId, slotId, idempotencyKey }: { doctorId: string; slotId: string; idempotencyKey: string }) => bookInPersonAppointment(doctorId, slotId, idempotencyKey),
    onSuccess: async (_appointment, variables) => {
      idempotencyKeys.current.delete(variables.slotId);
      setNotice('Your appointment is confirmed.');
      setActiveDoctorId('');
      setReschedulingId('');
      await queryClient.invalidateQueries({ queryKey: ['patient', 'appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['patient', 'home'] });
    },
  });
  const changeMutation = useMutation({
    mutationFn: ({ appointmentId, action, newSlotId }: { appointmentId: string; action: 'cancel' | 'reschedule'; newSlotId?: string }) =>
      action === 'cancel' ? cancelPatientAppointment(appointmentId) : reschedulePatientAppointment(appointmentId, newSlotId!),
    onSuccess: async (_appointment, variables) => {
      setNotice(variables.action === 'cancel' ? 'Your appointment was cancelled.' : 'Your appointment time was changed.');
      setReschedulingId('');
      setActiveDoctorId('');
      await queryClient.invalidateQueries({ queryKey: ['patient', 'appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['directory', 'doctor'] });
      await queryClient.invalidateQueries({ queryKey: ['patient', 'home'] });
    },
  });

  const handleSlotPress = (slotId: string) => {
    setNotice('');
    if (reschedulingId) {
      changeMutation.mutate({ appointmentId: reschedulingId, action: 'reschedule', newSlotId: slotId });
      return;
    }
    const key = idempotencyKeys.current.get(slotId) ?? createAppointmentIdempotencyKey();
    idempotencyKeys.current.set(slotId, key);
    bookingMutation.mutate({ doctorId: activeDoctorId, slotId, idempotencyKey: key });
  };

  const appointments = appointmentsQuery.data ?? [];
  const upcoming = appointments.filter((item) => item.status === 'CONFIRMED' && new Date(item.slot.startAt) > new Date());
  const upcomingIds = new Set(upcoming.map((item) => item.id));
  const history = appointments.filter((item) => !upcomingIds.has(item.id));

  return (
    <ScreenShell>
      <View style={{ marginBottom: 22 }}>
        <Text style={{ color: colors.teal, fontSize: 10, fontWeight: '700', letterSpacing: 1.3 }}>YOUR VISITS</Text>
        <Text style={{ color: colors.ink, fontSize: 29, fontWeight: '700', letterSpacing: -0.8, marginTop: 6 }}>Appointments</Text>
        <Text style={{ color: colors.inkSoft, fontSize: 13, lineHeight: 19, marginTop: 6 }}>Find an approved clinician and choose a time from their current availability.</Text>
      </View>

      {!isBackendConfigured ? <DevelopmentNotice>The verified directory and booking service are not connected in this build. No sample clinicians or appointments are shown.</DevelopmentNotice> : null}
      {notice ? <InlineAlert tone="success">{notice}</InlineAlert> : null}
      {bookingMutation.isError ? <InlineAlert>{errorText(bookingMutation.error, 'We could not book that time. Refresh availability and try again.')}</InlineAlert> : null}
      {changeMutation.isError ? <InlineAlert>{errorText(changeMutation.error, 'We could not change this appointment. Please try again.')}</InlineAlert> : null}

      <SectionHeading title="Find a doctor" />
      <TextField
        label="Search the verified directory"
        placeholder="Doctor, specialty or hospital"
        icon="search"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
        autoCorrect={false}
        editable={isBackendConfigured}
        returnKeyType="search"
      />

      {doctorsQuery.isLoading ? (
        <Panel style={{ marginBottom: 12 }}><Text style={{ color: colors.inkSoft, fontSize: 13 }}>Searching approved doctors…</Text></Panel>
      ) : doctorsQuery.isError ? (
        <Panel style={{ marginBottom: 12 }}>
          <Text style={{ color: colors.ink, fontWeight: '700' }}>Directory search is unavailable.</Text>
          <Text onPress={() => void doctorsQuery.refetch()} style={{ color: colors.blue, fontWeight: '700', fontSize: 12, marginTop: 9 }}>Try again</Text>
        </Panel>
      ) : doctorsQuery.data?.length ? doctorsQuery.data.map((doctor) => (
        <Pressable key={doctor.id} accessibilityRole="button" accessibilityLabel={`View ${doctor.fullName}`} onPress={() => { setActiveDoctorId(doctor.id); setReschedulingId(''); setNotice(''); }} style={({ pressed }) => [pressed && { opacity: 0.86 }]}>
          <Panel style={{ marginBottom: 11, padding: 15 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
              <Avatar name={doctor.fullName} size={43} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '700' }}>{doctor.fullName}</Text>
                <Text style={{ color: colors.teal, fontSize: 11, fontWeight: '600', marginTop: 3 }}>{doctor.specialty.name} · {doctor.department.name}</Text>
              </View>
              <Feather name="check-circle" size={17} color={colors.teal} />
            </View>
            <Text style={{ color: colors.inkSoft, fontSize: 11, lineHeight: 16, marginTop: 11 }}>{doctor.hospital.name}{doctor.hospital.city ? ` · ${doctor.hospital.city}` : ''}</Text>
            <Text style={{ color: colors.muted, fontSize: 10, marginTop: 5 }}>{doctor.yearsExperience === null ? 'Experience not listed' : `${doctor.yearsExperience} years experience`} · {formatFee(doctor.consultationFeeMinor, doctor.currency)}</Text>
          </Panel>
        </Pressable>
      )) : isBackendConfigured && !doctorsQuery.isLoading ? (
        <Panel style={{ alignItems: 'center', paddingVertical: 22, marginBottom: 12 }}>
          <Feather name="search" size={19} color={colors.teal} />
          <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '700', marginTop: 9 }}>No approved doctors found</Text>
          <Text style={{ color: colors.muted, fontSize: 11, textAlign: 'center', marginTop: 5 }}>Try another name, specialty or hospital.</Text>
        </Panel>
      ) : null}

      {activeDoctorId ? (
        <View style={{ marginTop: 13, marginBottom: 12 }}>
          <SectionHeading title={reschedulingId ? 'Choose a new time' : 'Available times'} action="Close" onAction={() => { setActiveDoctorId(''); setReschedulingId(''); }} />
          {doctorQuery.data ? <Text style={{ color: colors.inkSoft, fontSize: 12, marginBottom: 10 }}>{doctorQuery.data.fullName} · {doctorQuery.data.hospital.name}</Text> : null}
          {availabilityQuery.isLoading ? <Panel><Text style={{ color: colors.inkSoft, fontSize: 12 }}>Loading current availability…</Text></Panel> : null}
          {availabilityQuery.isError ? (
            <Panel><Text style={{ color: colors.ink, fontWeight: '700' }}>Availability could not be loaded.</Text><Text onPress={() => void availabilityQuery.refetch()} style={{ color: colors.blue, fontSize: 12, fontWeight: '700', marginTop: 8 }}>Refresh</Text></Panel>
          ) : null}
          {availabilityQuery.data?.length ? availabilityQuery.data.slice(0, 12).map((slot) => (
            <Panel key={slot.id} style={{ marginBottom: 9, padding: 13 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '700' }}>{formatSlot(slot.startAt, slot.timezone)}</Text>
                  <Text style={{ color: colors.muted, fontSize: 10, marginTop: 3 }}>In person · {slot.timezone}</Text>
                </View>
                <PrimaryButton label={reschedulingId ? 'Reschedule' : 'Book'} loading={bookingMutation.isPending || changeMutation.isPending} onPress={() => handleSlotPress(slot.id)} style={{ minHeight: 42, paddingHorizontal: 13 }} />
              </View>
            </Panel>
          )) : null}
          {availabilityQuery.data?.length === 0 ? <Panel><Text style={{ color: colors.inkSoft, fontSize: 12 }}>There are no available times in the next 30 days.</Text></Panel> : null}
          {availabilityQuery.data && availabilityQuery.data.length > 12 ? <Text style={{ color: colors.muted, fontSize: 10 }}>Showing the next 12 available times.</Text> : null}
        </View>
      ) : null}

      <View style={{ marginTop: 21 }}>
        <SectionHeading title="Upcoming" />
        {appointmentsQuery.isLoading ? <Panel><Text style={{ color: colors.inkSoft, fontSize: 12 }}>Loading your appointments…</Text></Panel> : null}
        {appointmentsQuery.isError ? <Panel><Text style={{ color: colors.ink, fontWeight: '700' }}>Your appointments could not be loaded.</Text><Text onPress={() => void appointmentsQuery.refetch()} style={{ color: colors.blue, fontSize: 12, fontWeight: '700', marginTop: 8 }}>Try again</Text></Panel> : null}
        {!appointmentsQuery.isLoading && !appointmentsQuery.isError && upcoming.length === 0 ? (
          <Panel style={{ alignItems: 'center', paddingVertical: 23, marginBottom: 12 }}>
            <Feather name="calendar" size={20} color={colors.teal} />
            <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '700', marginTop: 9 }}>No upcoming visits</Text>
            <Text style={{ color: colors.muted, fontSize: 11, textAlign: 'center', marginTop: 5 }}>Appointments confirmed by your care team will appear here.</Text>
          </Panel>
        ) : null}
        {upcoming.map((appointment) => (
          <AppointmentCard
            key={appointment.id}
            appointment={appointment}
            busy={changeMutation.isPending}
            onCancel={() => changeMutation.mutate({ appointmentId: appointment.id, action: 'cancel' })}
            onReschedule={() => { setActiveDoctorId(appointment.doctor.id); setReschedulingId(appointment.id); setNotice('Choose a new time with the same doctor.'); }}
          />
        ))}
      </View>

      {history.length ? (
        <View style={{ marginTop: 17 }}>
          <SectionHeading title="Appointment history" />
          {history.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} busy={false} onCancel={() => undefined} onReschedule={() => undefined} />)}
        </View>
      ) : null}
    </ScreenShell>
  );
}
