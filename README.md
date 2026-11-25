# MedKnot Patient

MedKnot is a patient mobile app for Android and iOS, built with Expo Router. This repository also contains the first local backend foundation; no hosted API has been deployed.

## Run the mobile app

```powershell
npm install
npm run start
```

To use the local API, start it from [backend/README.md](backend/README.md), then create `.env.local` in the project root. For an Android emulator, set:

```env
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:4400/api/v1
EXPO_PUBLIC_AUTH_MODE=
```

A physical device needs the computer's LAN address instead of `10.0.2.2`. A real EAS preview or production APK needs a deployed HTTPS API before patient authentication can work.

Local mock auth is off by default. To use the clearly labelled UI preview without an API, set `EXPO_PUBLIC_AUTH_MODE=development` in a local Expo environment and leave the API URL empty. It is disabled in release/preview builds, does not create server accounts, and its fixed OTP is synthetic. Do not enter real patient details in that mode.

Expo SecureStore holds native access and rotating refresh tokens. Web development keeps tokens in memory only. Push delivery and clinical data integrations remain later milestones.

## Structure

- `src/app/`: Expo Router screens
- `src/components/`: reusable patient UI
- `src/services/`: API client, authentication, token storage, realtime setup
- `src/store/`: in-memory session and profile state
- `src/mocks/`: synthetic local preview fixtures
- `backend/`: NestJS API, Prisma schema/migrations, PostgreSQL and Redis Compose setup
- `docs/api-contracts.md`: implemented API routes and later integration proposals

The doctor directory, booking mutations, clinical AI service, connected health records, push credentials and realtime listeners are future milestones. The AI Health tab does not assess symptoms or diagnose conditions.
