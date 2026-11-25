-- Add encrypted patient-entered notes and clinician consultation notes.
ALTER TYPE "AppointmentEvent" ADD VALUE IF NOT EXISTS 'COMPLETED';
CREATE TYPE "ClinicalRecordType" AS ENUM ('PATIENT_NOTE', 'CONSULTATION_NOTE');
CREATE TYPE "ClinicalRecordOrigin" AS ENUM ('PATIENT_ENTERED', 'CLINICIAN_AUTHORED');
CREATE TYPE "ClinicalRecordStatus" AS ENUM ('DRAFT', 'RELEASED', 'WITHDRAWN');
CREATE TYPE "PrescriptionStatus" AS ENUM ('DRAFT', 'RELEASED');

CREATE TABLE "clinical_records" (
  "id" UUID NOT NULL,
  "patient_profile_id" UUID NOT NULL,
  "author_id" UUID NOT NULL,
  "hospital_id" UUID,
  "appointment_id" UUID,
  "type" "ClinicalRecordType" NOT NULL,
  "origin" "ClinicalRecordOrigin" NOT NULL,
  "status" "ClinicalRecordStatus" NOT NULL DEFAULT 'DRAFT',
  "ciphertext" TEXT NOT NULL,
  "iv" VARCHAR(24) NOT NULL,
  "auth_tag" VARCHAR(32) NOT NULL,
  "key_version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "released_at" TIMESTAMPTZ(3),
  CONSTRAINT "clinical_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "clinical_records_appointment_id_key" ON "clinical_records"("appointment_id");
CREATE INDEX "clinical_records_patient_profile_id_status_created_at_idx" ON "clinical_records"("patient_profile_id", "status", "created_at");
CREATE INDEX "clinical_records_author_id_hospital_id_created_at_idx" ON "clinical_records"("author_id", "hospital_id", "created_at");

ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_patient_profile_id_fkey"
  FOREIGN KEY ("patient_profile_id") REFERENCES "patient_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_hospital_id_fkey"
  FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_appointment_id_fkey"
  FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "prescriptions" (
  "id" UUID NOT NULL,
  "patient_profile_id" UUID NOT NULL,
  "author_id" UUID NOT NULL,
  "hospital_id" UUID NOT NULL,
  "appointment_id" UUID NOT NULL,
  "status" "PrescriptionStatus" NOT NULL DEFAULT 'DRAFT',
  "ciphertext" TEXT NOT NULL,
  "iv" VARCHAR(24) NOT NULL,
  "auth_tag" VARCHAR(32) NOT NULL,
  "key_version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "released_at" TIMESTAMPTZ(3),
  CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "prescriptions_patient_profile_id_status_created_at_idx" ON "prescriptions"("patient_profile_id", "status", "created_at");
CREATE INDEX "prescriptions_author_id_hospital_id_created_at_idx" ON "prescriptions"("author_id", "hospital_id", "created_at");
CREATE INDEX "prescriptions_appointment_id_idx" ON "prescriptions"("appointment_id");

ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patient_profile_id_fkey"
  FOREIGN KEY ("patient_profile_id") REFERENCES "patient_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_hospital_id_fkey"
  FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_appointment_id_fkey"
  FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
