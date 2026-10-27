import { NextRequest } from 'next/server';
import crypto from 'crypto';

/**
 * =========================================================================
 * MODUL AUTENTIKASI & KEAMANAN BENDAHARA MMD
 * Perlindungan Endpoint, Pencegahan Brute-Force, dan Validasi Kredensial
 * =========================================================================
 */

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // Sesi 8 Jam untuk keamanan kas

// Rate Limiter / Brute-Force Protection
interface FailedAttemptInfo {
  attempts: number;
  firstAttempt: number;
  lockedUntil?: number;
}

const rateLimitMap = new Map<string, FailedAttemptInfo>();
const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // Window 15 Menit
const LOCKOUT_MS = 15 * 60 * 1000; // Kunci 15 Menit

/**
 * Mengambil PIN Administrator
 * Di lingkungan produksi (Vercel), wajib disetel via ADMIN_PIN.
 * Tidak ada fallback statis jika di produksi.
 */
export function getAdminPinConfig(): { success: boolean; pin?: string; error?: string } {
  const envPin = process.env.ADMIN_PIN?.trim();
  if (envPin && envPin.length >= 4) {
    return { success: true, pin: envPin };
  }

  // Jika di lingkungan produksi dan belum dikonfigurasi, tolak operasi
  if (process.env.NODE_ENV === 'production') {
    return {
      success: false,
      error: 'Konfigurasi Keamanan Belum Lengkap: Variabel ADMIN_PIN belum disetel pada Environment Variables Vercel. Harap atur PIN pada dashboard Vercel.',
    };
  }

  // Khusus lingkungan non-produksi lokal / testing
  return { success: true, pin: envPin || '144805' };
}

/**
 * Mengambil Secret Key untuk enkripsi sesi HMAC
 * Di lingkungan produksi, wajib disetel via ADMIN_SESSION_SECRET atau ADMIN_SECRET.
 */
export function getSecretKeyConfig(): { success: boolean; secret?: string; error?: string } {
  const envSecret = (process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SECRET)?.trim();
  if (envSecret && envSecret.length >= 16) {
    return { success: true, secret: envSecret };
  }

  if (process.env.NODE_ENV === 'production') {
    return {
      success: false,
      error: 'Konfigurasi Keamanan Belum Lengkap: Variabel ADMIN_SESSION_SECRET belum disetel pada Environment Variables Vercel.',
    };
  }

  // Default lokal khusus testing/dev
  return { success: true, secret: 'mmd-dev-salt-key-kediri-1448-local-only' };
}

/**
 * Pemeriksaan Rate Limiting berdasarkan IP Klien
 */
export function checkRateLimit(clientIp: string): {
  allowed: boolean;
  remainingAttempts?: number;
  lockedForSeconds?: number;
  error?: string;
} {
  const now = Date.now();
  const record = rateLimitMap.get(clientIp);
  if (!record) return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS };

  // Periksa apakah sedang terkunci
  if (record.lockedUntil && record.lockedUntil > now) {
    const lockedForSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    const minutes = Math.ceil(lockedForSeconds / 60);
    return {
      allowed: false,
      lockedForSeconds,
      error: `Akses dikunci sementara: Terlalu banyak percobaan PIN yang salah. Silakan coba lagi dalam ${minutes} menit demi keamanan buku kas.`,
    };
  }

  // Bersihkan record jika window sudah kedaluwarsa
  if (now - record.firstAttempt > WINDOW_MS) {
    rateLimitMap.delete(clientIp);
    return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS };
  }

  const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - record.attempts);
  return { allowed: true, remainingAttempts: remaining };
}

/**
 * Catat Percobaan PIN Salah
 */
export function recordFailedAttempt(clientIp: string): {
  locked: boolean;
  remainingAttempts: number;
  lockedForSeconds?: number;
  error?: string;
} {
  const now = Date.now();
  const record = rateLimitMap.get(clientIp);

  if (!record || now - record.firstAttempt > WINDOW_MS) {
    rateLimitMap.set(clientIp, { attempts: 1, firstAttempt: now });
    return { locked: false, remainingAttempts: MAX_FAILED_ATTEMPTS - 1 };
  }

  record.attempts += 1;
  if (record.attempts >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS;
    rateLimitMap.set(clientIp, record);
    return {
      locked: true,
      remainingAttempts: 0,
      lockedForSeconds: LOCKOUT_MS / 1000,
      error: 'Terlalu banyak percobaan gagal. Akses dikunci selama 15 menit.',
    };
  }

  rateLimitMap.set(clientIp, record);
  return { locked: false, remainingAttempts: MAX_FAILED_ATTEMPTS - record.attempts };
}

/**
 * Hapus catatan gagal saat login berhasil
 */
export function clearFailedAttempts(clientIp: string): void {
  rateLimitMap.delete(clientIp);
}

/**
 * Reset memory rate limit (khusus unit testing)
 */
export function resetRateLimitStore(): void {
  rateLimitMap.clear();
}

/**
 * Validasi PIN Administrator menggunakan timing-safe comparison
 */
export function validatePin(inputPin: string): boolean {
  if (!inputPin) return false;
  const config = getAdminPinConfig();
  if (!config.success || !config.pin) return false;

  const a = Buffer.from(inputPin.trim());
  const b = Buffer.from(config.pin);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Membuat Token Sesi Administrator bertanda tangan HMAC
 */
export function createSessionToken(): string {
  const config = getSecretKeyConfig();
  if (!config.success || !config.secret) {
    throw new Error(config.error || 'Kunci rahasia sesi belum dikonfigurasi.');
  }

  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `mmd_admin:${expiresAt}`;
  const hmac = crypto.createHmac('sha256', config.secret).update(payload).digest('hex');
  return Buffer.from(`${payload}:${hmac}`).toString('base64');
}

/**
 * Verifikasi Token Sesi Administrator
 */
export function verifySessionToken(token: string | null | undefined): boolean {
  if (!token) return false;
  try {
    const config = getSecretKeyConfig();
    if (!config.success || !config.secret) return false;

    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return false;
    const [prefix, expiresAtStr, signature] = parts;
    if (prefix !== 'mmd_admin') return false;

    const expiresAt = parseInt(expiresAtStr, 10);
    if (isNaN(expiresAt) || Date.now() > expiresAt) return false;

    const payload = `${prefix}:${expiresAtStr}`;
    const expectedSig = crypto.createHmac('sha256', config.secret).update(payload).digest('hex');
    const a = Buffer.from(signature);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (e) {
    return false;
  }
}

/**
 * Ekstrak IP klien dari NextRequest
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

/**
 * Helper untuk memvalidasi request pada Next.js API Routes
 * Memeriksa header Authorization Bearer, x-admin-pin, atau cookie mmd_admin_session
 */
export function verifyAdminRequest(request: NextRequest): boolean {
  // 1. Periksa header x-admin-pin langsung (untuk skrip/integrasi terpercaya)
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
