import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, validatePin, verifyAdminRequest } from '@/lib/auth';

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
  });
}

/**
 * POST /api/auth
 * Login / verifikasi PIN Bendahara
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const pin = String(body.pin || '').trim();

    if (!pin) {
      return NextResponse.json(
        { success: false, error: 'PIN Akses Bendahara wajib diisi.' },
        { status: 400 }
      );
    }

    if (!validatePin(pin)) {
      return NextResponse.json(
        { success: false, error: 'PIN Akses Bendahara salah. Akses ditolak.' },
        { status: 401 }
      );
    }

    const token = createSessionToken();
    const response = NextResponse.json({
      success: true,
      message: 'Autentikasi Bendahara berhasil.',
      token,
    });

    // Simpan ke cookie HttpOnly untuk keamanan maksimal
    response.cookies.set('mmd_admin_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60, // 24 jam
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
