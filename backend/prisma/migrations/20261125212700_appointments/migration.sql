-- Additive appointment scheduling models. Existing users, hospitals and clinical data remain untouched.
CREATE TYPE "AvailabilitySlotStatus" AS ENUM ('AVAILABLE', 'BOOKED', 'BLOCKED');
CREATE TYPE "ConsultationMode" AS ENUM ('IN_PERSON', 'ONLINE_VIDEO');
CREATE TYPE "AppointmentStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');
CREATE TYPE "AppointmentEvent" AS ENUM ('BOOKED', 'CANCELLED', 'RESCHEDULED');

CREATE TABLE "doctor_availability_slots" (
  "id" UUID NOT NULL,
  "doctor_profile_id" UUID NOT NULL,
  "start_at" TIMESTAMPTZ(3) NOT NULL,
  "end_at" TIMESTAMPTZ(3) NOT NULL,
  "timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
  "status" "AvailabilitySlotStatus" NOT NULL DEFAULT 'AVAILABLE',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "doctor_availability_slots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "doctor_availability_slots_time_check" CHECK ("end_at" > "start_at")
);

CREATE TABLE "appointments" (
  "id" UUID NOT NULL,
  "patient_profile_id" UUID NOT NULL,
  "doctor_profile_id" UUID NOT NULL,
  "slot_id" UUID NOT NULL,
  "active_slot_id" UUID,
  "idempotency_key" UUID NOT NULL,
  "idempotency_hash" CHAR(64) NOT NULL,
  "consultation_mode" "ConsultationMode" NOT NULL,
  "status" "AppointmentStatus" NOT NULL DEFAULT 'CONFIRMED',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "appointment_status_history" (
  "id" UUID NOT NULL,
  "appointment_id" UUID NOT NULL,
  "actor_id" UUID,
  "event" "AppointmentEvent" NOT NULL,
  "from_status" "AppointmentStatus",
  "to_status" "AppointmentStatus" NOT NULL,
  "from_slot_id" UUID,
  "to_slot_id" UUID,
  "from_slot_start_at" TIMESTAMPTZ(3),
  "to_slot_start_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "appointment_status_history_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "doctor_availability_slots_doctor_profile_id_start_at_key" ON "doctor_availability_slots"("doctor_profile_id", "start_at");
CREATE INDEX "doctor_availability_slots_doctor_profile_id_status_start_at_idx" ON "doctor_availability_slots"("doctor_profile_id", "status", "start_at");
CREATE UNIQUE INDEX "appointments_active_slot_id_key" ON "appointments"("active_slot_id");
CREATE UNIQUE INDEX "appointments_idempotency_key_key" ON "appointments"("idempotency_key");
CREATE INDEX "appointments_patient_profile_id_status_created_at_idx" ON "appointments"("patient_profile_id", "status", "created_at");
CREATE INDEX "appointments_doctor_profile_id_status_created_at_idx" ON "appointments"("doctor_profile_id", "status", "created_at");
CREATE INDEX "appointment_status_history_appointment_id_created_at_idx" ON "appointment_status_history"("appointment_id", "created_at");
CREATE INDEX "appointment_status_history_actor_id_created_at_idx" ON "appointment_status_history"("actor_id", "created_at");

ALTER TABLE "doctor_availability_slots" ADD CONSTRAINT "doctor_availability_slots_doctor_profile_id_fkey"
  FOREIGN KEY ("doctor_profile_id") REFERENCES "doctor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_profile_id_fkey"
  FOREIGN KEY ("patient_profile_id") REFERENCES "patient_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_profile_id_fkey"
  FOREIGN KEY ("doctor_profile_id") REFERENCES "doctor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_slot_id_fkey"
  FOREIGN KEY ("slot_id") REFERENCES "doctor_availability_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_active_slot_id_fkey"
  FOREIGN KEY ("active_slot_id") REFERENCES "doctor_availability_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appointment_status_history" ADD CONSTRAINT "appointment_status_history_appointment_id_fkey"
  FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appointment_status_history" ADD CONSTRAINT "appointment_status_history_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
