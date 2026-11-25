import { apiClient, isBackendConfigured } from '@/services/apiClient';

export type HealthRecord = {
  id: string;
  type: 'PATIENT_NOTE' | 'CONSULTATION_NOTE' | 'PRESCRIPTION';
  origin: 'PATIENT_ENTERED' | 'CLINICIAN_AUTHORED';
  status: 'DRAFT' | 'RELEASED' | 'WITHDRAWN';
  title: string;
  content: string;
  authorName: string;
  hospitalName: string | null;
  createdAt: string;
  releasedAt: string | null;
};

function requireBackend() {
  if (!isBackendConfigured) throw new Error('Connect MedKnot to its API to use health records.');
}

export async function getPatientHealthRecords() {
  requireBackend();
  const [recordsResponse, prescriptionsResponse] = await Promise.all([
    apiClient.get<{ items: HealthRecord[]; hasMore: boolean }>('/clinical-records'),
    apiClient.get<{ items: PatientPrescription[]; hasMore: boolean }>('/prescriptions'),
  ]);
  const prescriptions = prescriptionsResponse.data.items.map((item): HealthRecord => ({
    id: `prescription-${item.id}`,
    type: 'PRESCRIPTION',
    origin: 'CLINICIAN_AUTHORED',
    status: item.status,
    title: 'Prescription',
    content: [
      ...item.medications.map((medication) => [
        `${medication.medicineName}${medication.strength ? ` · ${medication.strength}` : ''}`,
        `Dosage: ${medication.dosage}`,
        medication.route ? `Route: ${medication.route}` : '',
        `Frequency: ${medication.frequency}`,
        medication.duration ? `Duration: ${medication.duration}` : '',
        medication.quantity ? `Quantity: ${medication.quantity}` : '',
        `Refills: ${medication.refills}`,
      ].filter(Boolean).join('\n')),
      item.instructions,
    ].filter(Boolean).join('\n\n'),
    authorName: item.authorName,
    hospitalName: item.hospitalName,
    createdAt: item.createdAt,
    releasedAt: item.releasedAt,
  }));
  return [...recordsResponse.data.items, ...prescriptions].sort((a, b) => new Date(b.releasedAt ?? b.createdAt).getTime() - new Date(a.releasedAt ?? a.createdAt).getTime());
}

type PatientPrescription = {
  id: string;
  status: 'DRAFT' | 'RELEASED';
  medications: { medicineName: string; strength: string; dosage: string; route: string; frequency: string; duration: string; quantity: string; refills: number }[];
  instructions: string;
  authorName: string;
  hospitalName: string;
  createdAt: string;
  releasedAt: string | null;
};

export async function createPatientHealthNote(title: string, content: string) {
  requireBackend();
  const { data } = await apiClient.post<HealthRecord>('/clinical-records/notes', { title, content });
  return data;
}
