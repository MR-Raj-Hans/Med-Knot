# MedKnot Patient

The patient-only mobile application for Android and iOS. Doctor and hospital admin dashboards are outside this project.

## First milestone

The current milestone provides a short animated splash, welcome, registration, sign-in, OTP verification, optional profile setup, patient home, and a five-destination patient tab shell.

## Run it

```powershell
npm install
npm run start
```

For a connected backend, copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_BASE_URL`. Without it, auth and the home summary use a clearly labelled development preview in development builds and the EAS `preview` build profile only. The preview's OTP is `246810`; it does not verify a real account or persist a real session. Production builds require the backend URL and never accept the preview OTP or local mock sign-in. Do not use real medical details in preview mode.

Expo SecureStore, notifications and image picker use native modules. Push notification delivery on Android needs a development build; Expo Go only supports local notifications for this SDK.

## Structure

- `src/app/`: Expo Router screens
- `src/components/`: reusable patient UI components
- `src/services/`: API client, authentication, session storage and realtime setup
- `src/store/`: local session and profile state
- `src/theme/`: MedKnot design tokens
- `src/mocks/`: synthetic development fixtures
- `docs/api-contracts.md`: draft NestJS and Socket.IO integration contract

The doctor directory, booking mutations, clinical AI service, connected health records, push credentials and live-event listeners are future milestones. The AI Health tab currently explains that it is unavailable and provides emergency guidance; it does not assess symptoms.
