# Backend development notes

- This service uses NestJS 11, TypeScript ESM, Node.js 22.12+, Prisma 7 and PostgreSQL. Relative TypeScript imports use `.js` suffixes.
- Review the matching NestJS and Prisma versioned documentation before changing framework APIs or schema/client integration.
- Keep business logic in feature modules. Do not add public admin registration; the first global administrator is created only by the guarded local bootstrap command.
- Never put passwords, one-time codes, refresh tokens, authorization headers, or patient medical data in logs or audit metadata.
- Keep the local OTP/reset adapter restricted to `APP_ENV=development`. Production auth flows must fail clearly until real delivery services are configured.
- Local Compose uses loopback ports 55432 and 56379. Do not modify or stop unrelated Docker services.
- No cloud deployment or hosted telemetry is configured. Do not link external services or create cloud resources as part of routine local development.
- Preserve generated local data and ignored `.env` files. Never put local secrets in Git.
