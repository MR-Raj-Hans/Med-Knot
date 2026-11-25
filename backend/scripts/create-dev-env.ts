import { randomBytes } from 'node:crypto';
import { access, writeFile } from 'node:fs/promises';

const path = new URL('../.env', import.meta.url);
try {
  await access(path);
  throw new Error('backend/.env already exists. It was left unchanged.');
} catch (error) {
  if (error instanceof Error && error.message.includes('already exists')) throw error;
}

const password = () => randomBytes(24).toString('base64url');
const accessSecret = randomBytes(48).toString('base64url');
const postgresPassword = password();
const redisPassword = password();
const contents = `APP_ENV=development
PORT=4400
DATABASE_URL=postgresql://medknot_dev:${encodeURIComponent(postgresPassword)}@127.0.0.1:55432/medknot_dev
REDIS_URL=redis://:${encodeURIComponent(redisPassword)}@127.0.0.1:56379/0
POSTGRES_DB=medknot_dev
POSTGRES_USER=medknot_dev
POSTGRES_PASSWORD=${postgresPassword}
REDIS_PASSWORD=${redisPassword}
ACCESS_TOKEN_SECRET=${accessSecret}
ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_TTL_DAYS=30
OTP_TTL_MINUTES=10
PASSWORD_RESET_TTL_MINUTES=15
RATE_LIMIT_WINDOW_SECONDS=60
RATE_LIMIT_MAX_REQUESTS=10
CORS_ORIGINS=http://localhost:8081,http://localhost:19006
SWAGGER_ENABLED=true
BOOTSTRAP_ADMIN_CONFIRM=
BOOTSTRAP_ADMIN_EMAIL=
BOOTSTRAP_ADMIN_PASSWORD=
BOOTSTRAP_ADMIN_NAME=
`;
await writeFile(path, contents, { flag: 'wx', mode: 0o600 });
console.log('Created backend/.env with random local-only secrets. Keep it out of Git.');
