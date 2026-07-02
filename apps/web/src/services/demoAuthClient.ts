import { apiUrl } from "./apiConfig.js";

type DemoAuthUser = {
  tenantId: string;
  companyId?: string;
};

type DemoAuthSession = {
  accessToken: string;
  user: DemoAuthUser;
};

const enabled = String(import.meta.env.VITE_DEMO_LOGIN_ENABLED ?? "false").toLowerCase() === "true";
const email = import.meta.env.VITE_DEMO_EMAIL as string | undefined;
const password = import.meta.env.VITE_DEMO_PASSWORD as string | undefined;
const storageKey = "doble-s-erp-demo-session";

let sessionPromise: Promise<DemoAuthSession | null> | null = null;

function readSession() {
  const rawSession = window.localStorage.getItem(storageKey);

  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as DemoAuthSession;
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
}

function writeSession(session: DemoAuthSession) {
  window.localStorage.setItem(storageKey, JSON.stringify(session));
}

export function clearDemoSession() {
  sessionPromise = null;
  window.localStorage.removeItem(storageKey);
}

export async function getDemoSession() {
  if (!enabled || !email || !password) {
    return null;
  }

  const existingSession = readSession();

  if (existingSession) {
    return existingSession;
  }

  sessionPromise ??= fetch(`${apiUrl}/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ email, password })
  })
    .then(async (response) => {
      if (!response.ok) {
        return null;
      }

      const body = (await response.json()) as { data?: DemoAuthSession };
      const session = body.data;

      if (!session?.accessToken) {
        return null;
      }

      writeSession(session);
      return session;
    })
    .catch(() => null)
    .finally(() => {
      sessionPromise = null;
    });

  return sessionPromise;
}
