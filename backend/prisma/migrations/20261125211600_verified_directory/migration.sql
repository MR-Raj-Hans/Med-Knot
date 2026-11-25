-- Additive hospital and doctor directory foundation. Existing Phase 1 rows are preserved.
CREATE TYPE "HospitalStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');
CREATE TYPE "DirectoryVerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "hospitals"
  ADD COLUMN "address_line1" VARCHAR(200),
  ADD COLUMN "city" VARCHAR(100),
  ADD COLUMN "region" VARCHAR(100),
  ADD COLUMN "postal_code" VARCHAR(24),
  ADD COLUMN "country" VARCHAR(100),
  ADD COLUMN "phone" VARCHAR(24),
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION,
  ADD COLUMN "status" "HospitalStatus" NOT NULL DEFAULT 'SUSPENDED',
  ADD COLUMN "verification_status" "DirectoryVerificationStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "verified_at" TIMESTAMPTZ(3);

CREATE TABLE "departments" (
  "id" UUID NOT NULL,
  "hospital_id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "slug" VARCHAR(96) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "specialties" (
  "id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "slug" VARCHAR(96) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "specialties_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "doctor_profiles" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "hospital_id" UUID NOT NULL,
  "department_id" UUID NOT NULL,
  "specialty_id" UUID NOT NULL,
  "license_number" VARCHAR(100) NOT NULL,
  "biography" VARCHAR(2000),
  "years_experience" INTEGER,
  "consultation_fee_minor" INTEGER,
  "currency" CHAR(3),
  "online_consultation" BOOLEAN NOT NULL DEFAULT false,
  "verification_status" "DirectoryVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "verified_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "doctor_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "doctor_qualifications" (
  "id" UUID NOT NULL,
  "doctor_profile_id" UUID NOT NULL,
  "qualification" VARCHAR(160) NOT NULL,
  "institution" VARCHAR(160) NOT NULL,
  "year_completed" INTEGER,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "doctor_qualifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "departments_hospital_id_slug_key" ON "departments"("hospital_id", "slug");
CREATE INDEX "departments_hospital_id_is_active_name_idx" ON "departments"("hospital_id", "is_active", "name");
CREATE UNIQUE INDEX "specialties_name_key" ON "specialties"("name");
CREATE UNIQUE INDEX "specialties_slug_key" ON "specialties"("slug");
CREATE UNIQUE INDEX "doctor_profiles_user_id_hospital_id_key" ON "doctor_profiles"("user_id", "hospital_id");
CREATE UNIQUE INDEX "doctor_profiles_hospital_id_license_number_key" ON "doctor_profiles"("hospital_id", "license_number");
CREATE INDEX "doctor_profiles_verification_status_specialty_id_hospital_id_idx" ON "doctor_profiles"("verification_status", "specialty_id", "hospital_id");
CREATE INDEX "doctor_profiles_department_id_verification_status_idx" ON "doctor_profiles"("department_id", "verification_status");
CREATE INDEX "doctor_qualifications_doctor_profile_id_display_order_idx" ON "doctor_qualifications"("doctor_profile_id", "display_order");
CREATE INDEX "hospitals_status_verification_status_city_idx" ON "hospitals"("status", "verification_status", "city");

ALTER TABLE "departments" ADD CONSTRAINT "departments_hospital_id_fkey"
  FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doctor_profiles" ADD CONSTRAINT "doctor_profiles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doctor_profiles" ADD CONSTRAINT "doctor_profiles_hospital_id_fkey"
  FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doctor_profiles" ADD CONSTRAINT "doctor_profiles_department_id_fkey"
  FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doctor_profiles" ADD CONSTRAINT "doctor_profiles_specialty_id_fkey"
  FOREIGN KEY ("specialty_id") REFERENCES "specialties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doctor_qualifications" ADD CONSTRAINT "doctor_qualifications_doctor_profile_id_fkey"
  FOREIGN KEY ("doctor_profile_id") REFERENCES "doctor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
