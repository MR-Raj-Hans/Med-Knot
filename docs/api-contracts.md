# MedKnot patient API contract (draft)

The mobile client reads its base URL from `EXPO_PUBLIC_API_BASE_URL`. Leave it unset to use the clearly marked development preview. Development fixtures live under `src/mocks/`; the app never substitutes a successful API response when a URL is configured and the server fails.

## Authentication

All patient routes are served by the shared NestJS API. Use JSON request and response bodies. A successful sign-in or OTP verification must include `verified: true`; the app will not establish a patient session without that server confirmation.

| Method | Path | Request | Response |
| --- | --- | --- | --- |
| POST | `/auth/request-verification` | `{ fullName, email, phone, password, acceptedTerms }` | `{ challengeId }` |
| POST | `/auth/verify-otp` | `{ challengeId, code }` | `{ accessToken, verified, patient: { fullName } }` |
| POST | `/auth/resend-verification` | `{ challengeId, email }` | `{ challengeId }` |
| POST | `/auth/sign-in` | `{ email, password }` | `{ accessToken, verified, patient: { fullName } }` |
| POST | `/auth/forgot-password` | `{ email }` | Non-enumerating acknowledgement |
| POST | `/auth/sign-out` | Empty body; bearer token | `204 No Content` |

The access token is stored with Expo SecureStore on iOS and Android. Do not put medical data, passwords, or one-time codes in local storage or logs.

## Patient home

`GET /patient/home` returns:

```json
{
  "patientName": "Riya Sharma",
  "nextAppointment": {
    "id": "appointment-id",
    "doctorName": "Dr. Aisha Menon",
    "specialty": "Cardiology",
    "dateLabel": "Thu, 26 Nov",
    "timeLabel": "10:30 AM",
    "location": "MedKnot Care · Room 204",
    "status": "confirmed"
  },
  "activePrescriptionCount": 2,
  "followUpLabel": "Blood pressure review · 8 Dec"
}
```

`nextAppointment` and `followUpLabel` may be `null`. Appointment and medical-record values must be sourced from the authenticated patient record. The local sample appointment under `src/mocks/homeFixtures.ts` is synthetic and is labelled in the UI.

## Planned service paths

These paths are proposed for the mobile and dashboard teams to align before implementation:

- `GET /departments`, `GET /doctors`, `GET /doctors/:doctorId`, `GET /doctors/:doctorId/availability`
- `POST /appointments`, `GET /appointments`, `GET /appointments/:appointmentId`, `PATCH /appointments/:appointmentId`, `DELETE /appointments/:appointmentId`
- `POST /ai/triage`, `GET /ai/assessments`
- `GET /patient/records`, `GET /patient/prescriptions`, `GET /patient/lab-reports`, `GET /patient/notifications`, `GET /patient/follow-ups`

Booking must enforce duplicate-slot prevention on the backend. AI triage responses must identify urgency, any emergency guidance, the suggested department, the assessment timestamp, and a clinician-review requirement. They are decision support and must not diagnose or prescribe.

## Realtime events

The Socket.IO client is created with the bearer token in `auth.token`, reconnects with bounded delay, and starts disconnected. The server and dashboard should agree on these event names and payload versions before a listener is enabled:

- `appointment.status.updated`: `{ appointmentId, status, updatedAt, version }`
- `appointment.queue.updated`: `{ appointmentId, position, estimatedWaitMinutes, updatedAt, version }`
- `doctor.availability.updated`: `{ doctorId, date, slots, updatedAt, version }`
- `patient.notification.created`: `{ notificationId, category, title, body, createdAt }`

Clients should discard stale `version` or `updatedAt` values and refetch canonical state after reconnecting.
