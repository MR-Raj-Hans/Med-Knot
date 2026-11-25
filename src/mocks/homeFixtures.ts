import type { HomeSummary } from '@/types/health';

export const developmentHomeSummary: HomeSummary = {
  patientName: 'there',
  nextAppointment: {
    id: 'fixture-appointment-1',
    doctorName: 'Dr. Aisha Menon',
    specialty: 'Cardiology',
    dateLabel: 'Thu, 26 Nov',
    timeLabel: '10:30 AM',
    location: 'MedKnot Care · Room 204',
    status: 'confirmed',
  },
  prescriptionCount: 2,
  followUpLabel: 'Blood pressure review · 8 Dec',
  dataSource: 'development-fixture',
};
