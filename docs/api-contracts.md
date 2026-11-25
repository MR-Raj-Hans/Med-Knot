# MedKnot API contract

The local NestJS API is served under `/api/v1`. The mobile client reads `EXPO_PUBLIC_API_BASE_URL`. The local service is documented in [`backend/README.md`](../backend/README.md); no public API host is deployed.

## Authentication

All requests and responses use JSON unless noted. Successful login and OTP verification require `verified: true`. Access tokens expire after 15 minutes by default; refresh tokens are opaque, rotate on every use, and are stored by the app in Expo SecureStore on native platforms.

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| POST | `/auth/request-verification` | `{ fullName, email, phone, password, acceptedTerms: true }` | `{ challengeId, mode, devCode? }` |
| POST | `/auth/verify-otp` | `{ challengeId, code }` | `{ accessToken, refreshToken, accessTokenExpiresIn, verified, patient: { id, fullName } }` |
| POST | `/auth/resend-verification` | `{ challengeId, email }` | `{ challengeId, mode, devCode? }` |
| POST | `/auth/login` | `{ email, password }` | `{ accessToken, refreshToken, accessTokenExpiresIn, verified, patient }` |
| POST | `/auth/sign-in` | Same as `/auth/login` (compatibility alias) | Same as `/auth/login` |
| POST | `/auth/refresh` | `{ refreshToken }` | A new access and refresh token pair; the previous refresh token is consumed |
| POST | `/auth/sign-out` | Bearer access token; empty body | `204 No Content`; revokes the session immediately |
| GET | `/auth/me` | Bearer access token | `{ id, fullName, email, phone, createdAt, patient: { id, fullName } }` |
| POST | `/auth/forgot-password` | `{ email }` | `{ accepted: true, devCode? }` in development; generic acknowledgment for unknown emails |
| POST | `/auth/reset-password` | `{ email, code, newPassword }` | `{ changed: true }` |

The local development email adapter returns a random six-digit OTP/reset code in the response. Only an HMAC digest is stored; codes expire, are single-use and allow at most five attempts. With `EMAIL_PROVIDER=resend`, the API sends verification and reset messages through Resend and returns no code. Production requires that provider and its sender/API-key configuration; startup rejects the development adapter, and provider delivery failures return 503. Resend is not live-tested until credentials are supplied. Verification resend is limited to the latest challenge and observes a 30-second default cooldown. Do not use real patient details with the local API.

Authentication attempts are rate limited by IP and account/challenge through Redis. Auth requests fail closed if Redis is unavailable. Invalid credentials return a generic response. Refresh token reuse revokes the session family. Passwords are hashed using Argon2id. Audit entries record auth events without passwords, codes, token values, request bodies, or medical details.

## Patient endpoints

| Method | Path | Auth | Behavior |
| --- | --- | --- | --- |
| GET | `/patient/home` | Patient | Returns the authenticated patient's name, next confirmed appointment if present, count of released prescriptions, and `followUpLabel: null` until follow-ups exist; the view is audited |
| GET | `/patients/me` | Patient | Returns the authenticated patient's profile and contact fields |
| GET | `/patients/:patientId` | Patient | Returns a profile only when its owner is the authenticated patient |

The database starts with an empty patient profile. The home endpoint does not substitute sample appointments or medical records when an API URL is configured.

## Verified directory endpoints

The Stage 3 endpoints below require a patient session for search. Results are sourced from the MedKnot directory database and include only active, approved records. Staff must add records and complete verification; no test doctors or hospitals are seeded.

| Method | Path | Auth | Behavior |
| --- | --- | --- | --- |
| GET | `/directory/hospitals?search=&city=&latitude=&longitude=&radiusKm=&page=&pageSize=` | Patient | Search approved hospital listings with bounded pagination. When both coordinates are supplied, returns Haversine distance and sorts nearest first. Includes active departments, contact and address fields. |
| GET | `/directory/doctors?search=&city=&hospitalId=&departmentId=&specialtyId=&online=&page=&pageSize=` | Patient | Server-side filter and pagination of approved doctors at active, approved hospitals. |
| GET | `/directory/doctors/:doctorId` | Patient | Return a verified profile and admin-approved qualifications; no unverified profiles are exposed. |
| GET | `/directory/specialties` | Patient | Return active specialties with at least one approved directory doctor. |

Directory administration requires the global `admin` role or active, hospital-scoped `hospital_admin` membership where noted. All writes create audit events.

| Method | Path | Auth | Behavior |
| --- | --- | --- | --- |
| POST | `/admin/directory/hospitals` | Global admin | Create a pending hospital listing; it stays hidden until approved. |
| PATCH | `/admin/directory/hospitals/:hospitalId/verification` | Global admin | `{ action: "approve" | "reject" }`; approval activates the hospital. |
| POST | `/admin/directory/specialties` | Global admin | Create a specialty. |
| POST | `/admin/hospitals/:hospitalId/departments` | Global or scoped hospital admin | Add a department to the authorized hospital. |
| POST | `/admin/hospitals/:hospitalId/doctors` | Global or scoped hospital admin | Attach an active existing MedKnot user, submitted qualifications, hospital department and specialty as a pending doctor profile. |
| PATCH | `/admin/hospitals/:hospitalId/doctors/:doctorId/verification` | Global or scoped hospital admin | Approve/reject a profile; approval requires an approved hospital and active department. |

The directory currently has no licensed external provider feed, opening-hours data, maps UI, or automated doctor invitation email. Nearby distances use request coordinates and do not persist patient location.

## Appointments and clinician availability

Appointment slots are created by authorized staff or an accepted, approved clinician membership. Slot creation rejects overlapping windows and serializes schedule changes per doctor. Booking is server-authoritative: the API conditionally claims an available slot, creates the confirmed appointment, adds history and writes the audit event in one database transaction. A unique active-slot value protects against double booking; clients provide a UUID idempotency key for safe retries.

| Method | Path | Auth | Behavior |
| --- | --- | --- | --- |
| GET | `/appointments/availability/:doctorId?from=&to=` | Patient | Return up to 200 available future slots in a maximum 31-day window. |
| POST | `/appointments` | Patient | `{ doctorId, slotId, consultationMode: "IN_PERSON", idempotencyKey }`; confirm only if the slot is still available. |
| GET | `/appointments?page=&pageSize=&status=` | Patient | Return only the caller's appointments, paginated. |
| GET | `/appointments/:appointmentId` | Patient | Return a booking only when it belongs to the caller. |
| PATCH | `/appointments/:appointmentId` | Patient | `{ action: "cancel" }` or `{ action: "reschedule", newSlotId }`; only confirmed future appointments can change, and rescheduling keeps the same doctor. |
| POST | `/admin/hospitals/:hospitalId/doctors/:doctorId/slots` | Global or scoped hospital admin | Add explicit future availability windows for an approved doctor. |
| POST | `/clinician/hospitals/:hospitalId/accept` | Clinician | Accept the approved hospital membership invitation. |
| POST | `/clinician/hospitals/:hospitalId/availability` | Clinician | Add availability windows for the caller's approved profile at the accepted hospital. |
| PATCH | `/clinician/hospitals/:hospitalId/availability/:slotId` | Clinician | Block or restore an unbooked future slot owned by the caller. |
| GET | `/clinician/hospitals/:hospitalId/appointments?page=&pageSize=&status=` | Clinician | List only appointments belonging to the caller's approved doctor profile and active hospital membership. Defaults to confirmed and completed. |
| PATCH | `/clinician/hospitals/:hospitalId/appointments/:appointmentId/complete` | Clinician | Complete the caller's confirmed appointment after its scheduled end time; writes appointment history and an audit event. |

Cancellation is allowed until the appointment starts; the slot returns to availability. Rescheduling is limited to a future slot with the same doctor. There are no cancellation fees configured. `ONLINE_VIDEO` requests return 503 until a real video provider and booking workflow are configured. Queue check-in, live position, estimated wait times and staff controls are not implemented.

## Clinical notes

Clinical-note text is encrypted by the API with AES-256-GCM before it reaches PostgreSQL. `RECORD_ENCRYPTION_KEY` must be a base64-encoded 32-byte key in production and stored outside the database; losing or changing it without a planned key rotation makes existing notes unreadable. Local development can derive a non-production key from `ACCESS_TOKEN_SECRET`, so changing that secret also makes local notes unreadable. Database migrations do not create or seed clinical content.

| Method | Path | Auth | Behavior |
| --- | --- | --- | --- |
| GET | `/clinical-records` | Patient | Return only the caller's released records; access is audited. |
| GET | `/clinical-records/:recordId` | Patient | Read a released record only when it belongs to the caller; access is audited. |
| POST | `/clinical-records/notes` | Patient | `{ title, content }`; create an encrypted patient-authored private note. |
| POST | `/clinician/hospitals/:hospitalId/appointments/:appointmentId/notes` | Clinician | `{ title, content }`; create one encrypted draft for the caller's completed appointment. |
| POST | `/clinician/hospitals/:hospitalId/clinical-records/:recordId/release` | Clinician | Release only the caller's own draft for a completed visit; it then appears in the patient's timeline. |
| GET | `/prescriptions` | Patient | Return the caller's released, encrypted prescriptions; access is audited. |
| GET | `/prescriptions/:prescriptionId` | Patient | Read a released prescription only when it belongs to the caller; access is audited. |
| POST | `/clinician/hospitals/:hospitalId/appointments/:appointmentId/prescriptions` | Clinician | Create an encrypted draft containing up to 20 clinician-entered medication entries for the caller's completed visit. |
| POST | `/clinician/hospitals/:hospitalId/prescriptions/:prescriptionId/release` | Clinician | Release only the caller's own prescription draft for a completed visit. |

Note and prescription content is never written to application audit metadata or HTTP request logs. Patients cannot read drafts. Notes are immutable after creation; one clinician consultation note is allowed per appointment. Prescriptions store clinician-entered medication name, dosage, route, frequency, duration, quantity, and refill fields; this is not an e-prescribing service and performs no interaction checks or pharmacy transmission. This foundation does not provide uploads, diagnoses, lab results, structured medical history, retention controls, or production key rotation. Do not use real patient data until the deployment key, database, privacy controls and operational policies are reviewed and configured.

## Health and documentation

- `GET /health/live` checks that the API process responds.
- `GET /health/ready` checks PostgreSQL and Redis; returns 503 if either dependency is unavailable.
- Development Swagger UI: `/api/v1/docs`; disabled in production.

Errors use `{ statusCode, error, message, requestId }`. Request IDs are returned in `X-Request-Id` and audit records. Validation rejects unknown fields and malformed inputs.

## Authorization foundation

Roles and permissions are database-backed (`patient`, `clinician`, `hospital_admin`, `admin`). Patient APIs enforce patient role and profile ownership. The access-policy guard can enforce role and permission codes; the hospital-scope guard verifies an active membership for the route's `hospitalId`. There is no public role assignment or admin creation endpoint. A local guarded bootstrap command creates the first administrator.

## Planned service paths

These routes are not implemented yet; agree on their payloads before adding screens or enabling listeners:

- Queue check-in, live queue status, and authorized staff controls.
- `POST /ai/triage`, `GET /ai/assessments`
- `GET /patient/lab-reports`, `GET /patient/notifications`, `GET /patient/follow-ups`

Booking must enforce duplicate-slot prevention on the backend. AI triage must identify urgency, emergency guidance, suggested department, assessment time, and clinician-review requirement. It must not diagnose or prescribe.

The app's Socket.IO client remains disconnected until server event names and payload versions are agreed:

- `appointment.status.updated`: `{ appointmentId, status, updatedAt, version }`
- `appointment.queue.updated`: `{ appointmentId, position, estimatedWaitMinutes, updatedAt, version }`
- `doctor.availability.updated`: `{ doctorId, date, slots, updatedAt, version }`
- `patient.notification.created`: `{ notificationId, category, title, body, createdAt }`
