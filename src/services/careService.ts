import { apiClient, isBackendConfigured } from '@/services/apiClient';

export type VerifiedDoctor = {
  id: string;
  fullName: string;
  biography: string | null;
  yearsExperience: number | null;
  consultationFeeMinor: number | null;
  currency: string | null;
  onlineConsultation: boolean;
  verified: true;
  hospital: { id: string; name: string; city: string | null; addressLine1: string | null; phone: string | null };
  department: { id: string; name: string };
  specialty: { id: string; name: string };
  qualifications: { qualification: string; institution: string; yearCompleted: number | null }[];
};

export type AvailableSlot = { id: string; startAt: string; endAt: string; timezone: string };

export type VerifiedHospital = {
  id: string;
  name: string;
  addressLine1: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
  departments: { id: string; name: string }[];
  verified: true;
};

export type PatientAppointment = {
  id: string;
  status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
  consultationMode: 'IN_PERSON' | 'ONLINE_VIDEO';
  createdAt: string;
  slot: AvailableSlot;
  doctor: {
    id: string;
    fullName: string;
    hospital: { id: string; name: string; city: string | null; addressLine1: string | null; phone: string | null };
    department: { id: string; name: string };
    specialty: { id: string; name: string };
  };
  history: { event: string; fromStatus: string | null; toStatus: string; fromSlotStartAt: string | null; toSlotStartAt: string | null; createdAt: string }[];
};

type Paginated<T> = { items: T[]; page: number; pageSize: number; hasMore?: boolean; total?: number };

function requireBackend() {
  if (!isBackendConfigured) throw new Error('Connect MedKnot to its API to use the verified care directory.');
}

export async function searchVerifiedDoctors(search: string): Promise<VerifiedDoctor[]> {
  requireBackend();
  const { data } = await apiClient.get<Paginated<VerifiedDoctor>>('/directory/doctors', {
    params: { ...(search.trim() ? { search: search.trim() } : {}), page: 1, pageSize: 20 },
  });
  return data.items;
}

export async function searchVerifiedHospitals(city: string): Promise<VerifiedHospital[]> {
  requireBackend();
  const { data } = await apiClient.get<Paginated<VerifiedHospital>>('/directory/hospitals', {
    params: { city: city.trim(), page: 1, pageSize: 30 },
  });
  return data.items;
}

export async function getVerifiedDoctor(doctorId: string): Promise<VerifiedDoctor> {
  requireBackend();
  const { data } = await apiClient.get<VerifiedDoctor>(`/directory/doctors/${doctorId}`);
  return data;
}

export async function getDoctorAvailability(doctorId: string): Promise<AvailableSlot[]> {
  requireBackend();
  const { data } = await apiClient.get<{ items: AvailableSlot[] }>(`/appointments/availability/${doctorId}`);
  return data.items;
}

export async function getPatientAppointments(): Promise<PatientAppointment[]> {
  requireBackend();
  const { data } = await apiClient.get<Paginated<PatientAppointment>>('/appointments', { params: { page: 1, pageSize: 50 } });
  return data.items;
}

export async function bookInPersonAppointment(doctorId: string, slotId: string, idempotencyKey: string) {
  requireBackend();
  const { data } = await apiClient.post<PatientAppointment>('/appointments', {
    doctorId,
    slotId,
    idempotencyKey,
    consultationMode: 'IN_PERSON',
  });
  return data;
}

export async function cancelPatientAppointment(appointmentId: string) {
  requireBackend();
  const { data } = await apiClient.patch<PatientAppointment>(`/appointments/${appointmentId}`, { action: 'cancel' });
  return data;
}

export async function reschedulePatientAppointment(appointmentId: string, newSlotId: string) {
  requireBackend();
  const { data } = await apiClient.patch<PatientAppointment>(`/appointments/${appointmentId}`, { action: 'reschedule', newSlotId });
  return data;
}

export function createAppointmentIdempotencyKey() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}
