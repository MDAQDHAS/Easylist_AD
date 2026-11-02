import fs from 'node:fs';
import {
  initializeApp,
  getApps,
  getApp,
  cert,
  applicationDefault,
  type App,
} from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

export const DEFAULT_FIREBASE_PROJECT_ID = 'easylist-588d9';

function unquoteEnvValue(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function resolveFirebaseProjectId(): string {
  const configured = unquoteEnvValue(process.env.FIREBASE_PROJECT_ID);
  return configured || DEFAULT_FIREBASE_PROJECT_ID;
}

export function initializeFirebaseAdmin(): App {
  if (getApps().length > 0) {
    return getApp();
  }

  const projectId = resolveFirebaseProjectId();
  const clientEmail = unquoteEnvValue(process.env.FIREBASE_CLIENT_EMAIL);
  let privateKey = unquoteEnvValue(process.env.FIREBASE_PRIVATE_KEY);
  const serviceAccountJson = unquoteEnvValue(process.env.FIREBASE_SERVICE_ACCOUNT);
  const adcPath = unquoteEnvValue(process.env.GOOGLE_APPLICATION_CREDENTIALS);

  if (serviceAccountJson) {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(serviceAccountJson) as Record<string, unknown>;
    } catch {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT JSON.');
      throw new Error('Firebase Admin service account configuration is invalid.');
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      console.error('FIREBASE_SERVICE_ACCOUNT must contain a JSON object.');
      throw new Error('Firebase Admin service account configuration is invalid.');
    }

    if (typeof parsed.private_key === 'string' && parsed.private_key.includes('\\n')) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }

    if (parsed.project_id && parsed.project_id !== projectId) {
      console.error('Firebase Admin service account project does not match the configured project.');
      throw new Error('Firebase Admin service account project mismatch.');
    }

    return initializeApp({
      credential: cert(parsed),
      projectId,
    });
  }

  if (clientEmail && privateKey) {
    // Handle escaped newlines in environment variable
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    });
  }

  if (adcPath) {
    if (!fs.existsSync(adcPath)) {
      console.error('GOOGLE_APPLICATION_CREDENTIALS file was not found.');
      throw new Error('Firebase Admin service account configuration is invalid.');
    }

    return initializeApp({
      credential: applicationDefault(),
      projectId,
    });
  }

  // Attempt Google Application Default Credentials or Project ID fallback
  try {
    return initializeApp({
      credential: applicationDefault(),
      projectId,
    });
  } catch (err) {
    console.warn(
      'Firebase Admin SDK initialized with project ID only. Service account credentials recommended for production:',
      err instanceof Error ? err.message : String(err)
    );

    return initializeApp({
      projectId,
    });
  }
}

export const firebaseApp: App = initializeFirebaseAdmin();
export const authAdmin: Auth = getAuth(firebaseApp);
console.info('Firebase Admin runtime configuration:', {
  projectId: firebaseApp.options.projectId || 'unknown',
  credentialSource: firebaseApp.options.credential?.constructor.name || 'none',
});
