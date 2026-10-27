import { NextRequest, NextResponse } from 'next/server';
import {
  checkRateLimit,
  clearFailedAttempts,
  createSessionToken,
  getClientIp,
  recordFailedAttempt,
  validateLogin,
  validatePin,
  verifyAdminRequest,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth
 * Memeriksa apakah klien memiliki sesi admin yang valid
 */
export async function GET(request: NextRequest) {
  const isAuth = verifyAdminRequest(request);
  return NextResponse.json({
    success: true,
    authenticated: isAuth,
    username: isAuth ? 'MMD' : null,
  });
}

/**
 * POST /api/auth
 * Login Administrator dengan Username & Password (atau PIN)
 * Proteksi Brute-Force & Rate Limiting IP
 */
export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);

  // 1. Periksa Batas Percobaan (Rate Limiting)
  const rateLimitStatus = checkRateLimit(clientIp);
  if (!rateLimitStatus.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: rateLimitStatus.error || 'Terlalu banyak percobaan gagal. Akses dikunci sementara.',
        lockedForSeconds: rateLimitStatus.lockedForSeconds,
      },
      { status: 429 } // HTTP 429 Too Many Requests
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const username = String(body.username || '').trim();
    const password = String(body.password || body.pin || '').trim();

    if (!username && !password) {
      return NextResponse.json(
        { success: false, error: 'Username dan Password wajib diisi.' },
        { status: 400 }
      );
    }

    // 2. Validasi Kredensial
    let isValid = false;
    if (username) {
      isValid = validateLogin(username, password);
    } else {
      // Fallback PIN direct
      isValid = validatePin(password) || validateLogin('MMD', password);
    }

    if (!isValid) {
      // Catat kegagalan dan tambahkan delay kecil untuk mitigasi brute force
      const failInfo = recordFailedAttempt(clientIp);
      await new Promise(resolve => setTimeout(resolve, 600));

      if (failInfo.locked) {
        return NextResponse.json(
          {
            success: false,
            error: 'Terlalu banyak percobaan salah. Akses ditolak dan dikunci selama 15 menit.',
            lockedForSeconds: failInfo.lockedForSeconds,
          },
          { status: 429 }
        );
      }

      const errMsg = username
        ? `Username atau Password Bendahara salah. Sisa kesempatan: ${failInfo.remainingAttempts} kali.`
        : `Kredensial Bendahara salah. Sisa kesempatan: ${failInfo.remainingAttempts} kali.`;

      return NextResponse.json(
        {
          success: false,
          error: errMsg,
          remainingAttempts: failInfo.remainingAttempts,
        },
        { status: 401 }
      );
    }

    // 3. Login Berhasil: Bersihkan riwayat kegagalan untuk IP ini
    clearFailedAttempts(clientIp);

    const token = createSessionToken();
    const response = NextResponse.json({
      success: true,
      message: 'Login Bendahara MMD berhasil.',
      username: 'MMD',
      token,
    });

    // Simpan ke cookie HttpOnly untuk keamanan maksimal (Sesi 8 jam)
    response.cookies.set('mmd_admin_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Terjadi kesalahan sistem autentikasi.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth
 * Logout / menghapus sesi admin
 */
export async function DELETE() {
  const response = NextResponse.json({
    success: true,
    message: 'Sesi Bendahara telah diakhiri.',
  });

  response.cookies.set('mmd_admin_session', '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
  });

  return response;
}
