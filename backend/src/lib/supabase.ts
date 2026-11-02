import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export class SupabaseConfigurationError extends Error {
  constructor() {
    super('Supabase service configuration is unavailable.');
    this.name = 'SupabaseConfigurationError';
  }
}

interface SupabaseAdminConfig {
  url?: string;
  serviceRoleKey?: string;
}

function normalizeSecretValue(value?: string): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function isNonServiceRoleKey(key: string): boolean {
  if (key.startsWith('sb_publishable_')) {
    return true;
  }

  const parts = key.split('.');
  if (parts.length === 3) {
    try {
      const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
      const payload = JSON.parse(payloadJson) as { role?: unknown };
      if (typeof payload.role === 'string' && payload.role !== 'service_role') {
        return true;
      }
    } catch {
      // Ignore non-JSON segments and let the client handle validation
    }
  }

  return false;
}

export function createSupabaseAdminClient({
  url,
  serviceRoleKey,
}: SupabaseAdminConfig): SupabaseClient {
  const cleanUrl = normalizeSecretValue(url);
  const cleanKey = normalizeSecretValue(serviceRoleKey);

  if (!cleanUrl || !cleanKey || isNonServiceRoleKey(cleanKey)) {
    throw new SupabaseConfigurationError();
  }

  return createClient(cleanUrl, cleanKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

let cachedUrl: string | undefined;
let cachedServiceRoleKey: string | undefined;
let cachedClient: SupabaseClient | undefined;

export function getSupabaseAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (cachedClient && cachedUrl === url && cachedServiceRoleKey === serviceRoleKey) {
    return cachedClient;
  }

  const client = createSupabaseAdminClient({ url, serviceRoleKey });
  cachedUrl = url;
  cachedServiceRoleKey = serviceRoleKey;
  cachedClient = client;
  return client;
}

const clientOverrides = {} as SupabaseClient;

export const supabase: SupabaseClient = new Proxy(clientOverrides, {
  get(target, property) {
    if (Reflect.has(target, property)) {
      return Reflect.get(target, property);
    }

    const client = getSupabaseAdminClient();
    const member = Reflect.get(client, property, client);
    return typeof member === 'function' ? member.bind(client) : member;
  },
});
