import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";

const API_BASE = "/api/v1/auth";

export async function registerPasskey(): Promise<boolean> {
  // Get registration options
  const optionsRes = await fetch(`${API_BASE}/registration/options`, {
    credentials: "include",
  });
  if (!optionsRes.ok) {
    const err = await optionsRes.json();
    throw new Error(err.error || "Failed to get registration options");
  }
  const options = await optionsRes.json();

  // Start WebAuthn registration
  const credential = await startRegistration({ optionsJSON: options });

  // Verify with server
  const verifyRes = await fetch(`${API_BASE}/registration/verify`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credential),
  });

  if (!verifyRes.ok) {
    const err = await verifyRes.json();
    throw new Error(err.error || "Registration verification failed");
  }

  const result = await verifyRes.json();
  return result.verified;
}

export async function authenticatePasskey(): Promise<boolean> {
  // Get authentication options
  const optionsRes = await fetch(`${API_BASE}/authentication/options`, {
    credentials: "include",
  });
  if (!optionsRes.ok) {
    const err = await optionsRes.json();
    throw new Error(err.error || "Failed to get authentication options");
  }
  const options = await optionsRes.json();

  // Start WebAuthn authentication
  const credential = await startAuthentication({ optionsJSON: options });

  // Verify with server
  const verifyRes = await fetch(`${API_BASE}/authentication/verify`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credential),
  });

  if (!verifyRes.ok) {
    const err = await verifyRes.json();
    throw new Error(err.error || "Authentication failed");
  }

  const result = await verifyRes.json();
  return result.verified;
}

export async function checkSession(): Promise<{
  authenticated: boolean;
  user: { id: string; username: string } | null;
}> {
  const res = await fetch(`${API_BASE}/session`, { credentials: "include" });
  return res.json();
}

export async function checkSetupNeeded(): Promise<boolean> {
  const res = await fetch(`${API_BASE}/setup-needed`, { credentials: "include" });
  const data = await res.json();
  return data.setupNeeded;
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/logout`, {
    method: "POST",
    credentials: "include",
  });
}
