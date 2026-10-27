import { NextRequest } from 'next/server';
import crypto from 'crypto';

/**
 * Modul Autentikasi & Otorisasi Server Bendahara MMD
 * Menjaga endpoint penulisan agar tidak bisa dieksploitasi oleh publik
 */

const DEFAULT_ADMIN_PIN = '144805'; // PIN Default (Bulan 5 / Jumadal Ula 1448 H), dapat diubah via env
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 Jam

function getAdminPin(): string {
  return (process.env.ADMIN_PIN || DEFAULT_ADMIN_PIN).trim();
}

function getSecretKey(): string {
  return (
    process.env.ADMIN_SECRET ||
    process.env.GOOGLE_SCRIPT_TOKEN ||
    'mmd-secure-salt-key-kediri-2026-9f8e7d6c5b4a'
  ).trim();
}

/**
 * Validasi PIN Administrator menggunakan timing-safe comparison
 */
export function validatePin(inputPin: string): boolean {
  if (!inputPin) return false;
  const expected = getAdminPin();
  const a = Buffer.from(inputPin.trim());
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Membuat Token Sesi Administrator bertanda tangan HMAC
 */
export function createSessionToken(): string {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `mmd_admin:${expiresAt}`;
  const hmac = crypto.createHmac('sha256', getSecretKey()).update(payload).digest('hex');
  return Buffer.from(`${payload}:${hmac}`).toString('base64');
}

/**
 * Verifikasi Token Sesi Administrator
 */
export function verifySessionToken(token: string | null | undefined): boolean {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return false;
    const [prefix, expiresAtStr, signature] = parts;
    if (prefix !== 'mmd_admin') return false;

    const expiresAt = parseInt(expiresAtStr, 10);
    if (isNaN(expiresAt) || Date.now() > expiresAt) return false;

    const payload = `${prefix}:${expiresAtStr}`;
    const expectedSig = crypto.createHmac('sha256', getSecretKey()).update(payload).digest('hex');
    const a = Buffer.from(signature);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (e) {
    return false;
  }
}

/**
 * Helper untuk memvalidasi request pada Next.js API Routes
 * Memeriksa header Authorization Bearer, x-admin-pin, atau cookie mmd_admin_session
 */
export function verifyAdminRequest(request: NextRequest): boolean {
  // 1. Periksa header x-admin-pin langsung (berguna untuk skrip/integrasi terpercaya)
  const directPin = request.headers.get('x-admin-pin');
  if (directPin && validatePin(directPin)) {
    return true;
  }

  // 2. Periksa Authorization Bearer Token
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.substring(7).trim();
    if (verifySessionToken(bearerToken)) {
      return true;
    }
  }

  // 3. Periksa Cookie sesi admin
  const cookieToken = request.cookies.get('mmd_admin_session')?.value;
  if (cookieToken && verifySessionToken(cookieToken)) {
    return true;
  }

  return false;
}
