const USERS_KEY = 'cl_users';
const SESSION_KEY = 'cl_sess';

function readJSON(storage, key, fallback) {
  try {
    const value = storage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch (error) {
    console.error(`Error reading "${key}" from storage:`, error);
    return fallback;
  }
}

function bytesToHex(bytes) {
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function getUsers() {
  return readJSON(localStorage, USERS_KEY, []);
}

export function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getMovies(userId) {
  return readJSON(localStorage, `cl_mv_${userId}`, []);
}

export function saveMovies(userId, movies) {
  localStorage.setItem(`cl_mv_${userId}`, JSON.stringify(movies));
}

export function getSession() {
  return readJSON(sessionStorage, SESSION_KEY, null);
}

export function saveSession(user) {
  const sessionPayload = {
    id: user.id,
    email: user.email,
    token: user.sessionToken
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionPayload));
}

export function verifySessionUser(session, users) {
  if (!session || typeof session.id !== 'string' || typeof session.token !== 'string' || !session.token) {
    return null;
  }
  return users.find(candidate =>
    candidate.id === session.id &&
    typeof candidate.sessionToken === 'string' &&
    constantTimeEqual(candidate.sessionToken, session.token)
  ) || null;
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export async function hashPassword(password, saltHex, iterations = 100000) {
  const salt = saltHex
    ? hexToBytes(saltHex)
    : crypto.getRandomValues(new Uint8Array(16));
  const resolvedSaltHex = saltHex || bytesToHex(salt);
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    256
  );
  return `pbkdf2$${iterations}$${resolvedSaltHex}$${bytesToHex(new Uint8Array(bits))}`;
}

export async function verifyPassword(password, storedHash) {
  if (typeof storedHash !== 'string' || !storedHash) {
    return false;
  }
  if (storedHash.startsWith('pbkdf2$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 4) return false;
    const iterations = Number.parseInt(parts[1], 10);
    const saltHex = parts[2];
    if (!Number.isInteger(iterations) || iterations < 10000 || !/^[0-9a-f]+$/i.test(saltHex) || saltHex.length % 2 !== 0) {
      return false;
    }
    const computed = await hashPassword(password, saltHex, iterations);
    return constantTimeEqual(computed, storedHash);
  }
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  const legacyDigest = bytesToHex(new Uint8Array(buffer));
  return constantTimeEqual(legacyDigest, storedHash);
}

export function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}
