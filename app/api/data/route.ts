import { NextRequest, NextResponse } from 'next/server';
import { calculateSummary, getAllData } from '@/lib/data-service';
import { verifyAdminRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const isPublicReadAllowed = process.env.ALLOW_PUBLIC_READ === 'true';
    const isAuth = verifyAdminRequest(request);

    // Lindungi data kas internal dari pembaca publik tanpa izin
    if (!isPublicReadAllowed && !isAuth) {
      return NextResponse.json(
        {
          success: false,
          requireAuth: true,
          error: 'Akses dibatasi: Diperlukan autentikasi PIN Bendahara untuk membaca buku kas internal.',
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const filterPeriode = searchParams.get('periode') || undefined;
    const filterKategori = searchParams.get('kategori') || undefined;

    const data = await getAllData();
    const summary = calculateSummary(
      data.pengeluaran,
      data.subsidi,
      data.kategori,
      filterPeriode,
      filterKategori
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          ...data,
          summary,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat data keuangan.' },
      { status: 500 }
    );
  }
}
