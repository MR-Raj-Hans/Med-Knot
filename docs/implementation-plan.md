# MedKnot product implementation checklist

This checklist tracks the continuation of the existing Phase 1 implementation. It is intentionally staged so each domain can be reviewed and verified without replacing the working patient app or inventing provider-backed data.

## Stage 1 — repository audit and protection

- [x] Confirm branch and inspect staged, unstaged, and untracked files.
- [x] Confirm existing Phase 1 API, schema, migrations, Expo app identity, and EAS preview profile.
- [x] Create a timestamped source snapshot outside the repository before product changes.
- [x] Preserve `dist-preview-static/` and `android-build-output/`.
- [x] Record external service and local infrastructure blockers.

Snapshots:

- `C:\Users\Rajh4\AppData\Local\Packages\openai.codex_2p2nqsd0c76g0\AC\#!sandbox.{2f860887-903f-485e-8763-480730fe35df}\Temp\MedKnot-source-backup-20261125-210827`
- `C:\Users\Rajh4\AppData\Local\Packages\openai.codex_2p2nqsd0c76g0\AC\#!sandbox.{acb517be-e174-426d-acc5-d8ffae11e18d}\Temp\MedKnot-stage3-source-backup-20261125-211646`
- `C:\Users\Rajh4\AppData\Local\Packages\openai.codex_2p2nqsd0c76g0\AC\#!sandbox.{6a453b8f-156c-4703-94c4-89b6859a859b}\Temp\MedKnot-stage4-source-backup-20261125-212652`
- `C:\Users\Rajh4\AppData\Local\Packages\openai.codex_2p2nqsd0c76g0\AC\#!sandbox.{7d6185c0-beac-4225-855d-1c1b98b20b2e}\Temp\MedKnot-stage5-source-backup-20261125-214646`

The snapshots contain source/config files and exclude generated folders, Git metadata, local `.env`, and build artifacts.

## Stages 2–12

| Stage | Scope | Status | External requirements / exit evidence |
| --- | --- | --- | --- |
| 2 | Production email delivery, OTP/reset templates and safe auth behavior | Implemented; live send blocked | A verified sender domain and Resend API key are needed for live delivery. Fake transport tests pass. |
| 3 | Hospitals, departments, doctors, verification and admin workflows | Implemented as APIs; migration pending local DB | Requires approved staff-entered directory records and deployment of the additive migration. No real records are seeded. |
| 4 | Doctor discovery, transactional appointments and queue | Discovery/booking implemented; clinician appointment completion added in Stage 5; queue pending | Requires staff-approved doctors and slots. Online booking is disabled until video provider integration; queue management is not implemented. |
| 5 | Patient records and documents | Encrypted note and prescription foundation implemented; migration pending | Patient-authored notes and released clinician consultation notes/prescriptions. Production requires a separately managed 32-byte encryption key. Attachments, diagnoses, labs, e-prescribing and key rotation remain incomplete. |
| 6 | AI Health provider and cited medical knowledge | Not started | No AI provider is selected or credentialed; an approved, licensed reference corpus and clinical safety review are also required. |
| 7 | Foreground location and nearby hospitals | Manual city search UI and server-calculated distance API implemented; native location/map flow pending | `expo-location` is not installed and npm registry DNS previously failed; approved directory records or a configured places provider are required for genuine nearby results. |
| 8 | Online consultations | Not started | A video provider account, credentials and clinical workflow. |
| 9 | Email/push notifications and background delivery | Not started | Email provider, Expo push credentials, queue/worker deployment. |
| 10 | Expo OTA channels and APK version policy | Not started | Existing EAS project is identified; `expo-updates` and EAS CLI are unavailable locally, and update channels/runtime policy are not configured. |
| 11 | Public HTTPS deployment configuration | Not started | Hosting, domain, PostgreSQL, Redis, storage and provider credentials. |
| 12 | Full QA, new APK build and installation/device checks | Not started | EAS CLI cannot be installed while npm DNS fails; the prior ADB daemon failed to start and no device installation is verified. |

## Audit findings

- Existing mobile UI is a patient-facing foundation; doctor discovery and in-person booking now connect to the API. Online video, AI messaging, attachments, structured diagnoses and lab records remain unavailable. Prescription records are clinician-entered and do not include interaction checks or pharmacy transmission.
- Phase 1 Prisma schema has users, patient profiles, roles/permissions, hospital membership, refresh sessions, verification/reset tokens and audit logs. Stage 3 adds operational directory models for hospitals, departments, specialties, doctor profiles and qualifications. Stages 4–5 add appointment and encrypted clinical-note models. Notification and release-policy models are still pending.
- The app identifies `@rajhans/medknot` with EAS project ID `3aac34be-f139-4a91-bdb2-6eb165b9bbbe`; Android and iOS identifiers remain `com.medknot.patient`.
- `eas.json` has an internal Android APK preview profile. No update channel/runtime version is currently configured.
- npm registry access fails with DNS `ENOTFOUND registry.npmjs.org`; Docker Desktop's Linux engine pipe is unavailable in this session. Do not report live provider, database, build, or device tests unless those services become reachable.
- Stage 3 directory content is entered by authorized MedKnot staff and only becomes searchable after approval. No external hospital feed, or admin web app exists yet; doctor profiles attach an existing verified MedKnot account.
- Stage 4 adds patient-facing doctor search, slot selection, idempotent booking, cancellation/rescheduling, clinician availability, and invitation acceptance. Only in-person booking is enabled. The appointment and directory migrations were schema-validated but could not be applied because PostgreSQL is not reachable on `127.0.0.1:55432`.
- Stage 5 adds AES-256-GCM encrypted patient notes, clinician consultation-note drafts, and clinician-entered prescription drafts linked to completed appointments. Clinicians must be approved active members and may release only their own drafts; patients see only released records they own. Reads and state changes are audited without note contents. My Health reads notes/prescriptions and creates personal notes with explicit disconnected/empty states. The migration is additive but cannot be applied until PostgreSQL is available. Local development derives a test-only key from the local access-token secret; production must set `RECORD_ENCRYPTION_KEY` to a base64-encoded 32-byte key. File attachments, external storage, diagnoses, lab reports, e-prescribing, pharmacy integration and key rotation remain incomplete.
- Stage 5 verification: Prisma schema validates; backend build/typecheck/lint pass; backend tests pass (10 suites / 27 tests); mobile typecheck/lint pass; mobile tests pass (4 suites / 6 tests); web export succeeds. PostgreSQL is not reachable, so migration `20261125214600_clinical_notes` is not applied and live API behavior is not verified. The pre-existing APK and `dist-preview-static/` were not modified.
- Stage 7's mobile fallback searches the approved MedKnot directory by manually entered city/area and clearly does not claim distance-ranked results. The directory API already calculates actual distance when explicit coordinates are supplied. Foreground permission, live coordinates, map markers and directions remain pending because the SDK-compatible location package is absent and no places provider is configured.
- Stage 7 fallback verification: mobile typecheck/lint pass, mobile tests pass (4 suites / 6 tests), and Expo web export succeeds. The hospital query cannot be exercised against PostgreSQL until the local service is available; no permission or map behavior was tested.
