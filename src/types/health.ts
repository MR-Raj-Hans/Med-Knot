export type AppointmentSummary = {
  id: string;
  doctorName: string;
  specialty: string;
  dateLabel: string;
  timeLabel: string;
  location: string;
  status: 'confirmed' | 'requested';
};

export type HomeSummary = {
  patientName: string;
  nextAppointment: AppointmentSummary | null;
  prescriptionCount: number;
  followUpLabel: string | null;
  dataSource: 'development-fixture' | 'api';
};

export type PatientProfile = {
  dateOfBirth: string;
  gender: 'woman' | 'man' | 'nonbinary' | 'prefer-not-to-say';
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  photoUri?: string;
};
