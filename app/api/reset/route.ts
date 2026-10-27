import { NextRequest, NextResponse } from 'next/server';
import { resetToCleanState } from '@/lib/data-service';
import { verifyAdminRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    if (!verifyAdminRequest(request)) {
      return NextResponse.json({ success: false, error: 'Akses ditolak: Diperlukan autentikasi PIN Bendahara.' }, { status: 401 });
    }

    const cleanDb = resetToCleanState();
    return NextResponse.json({
      success: true,
      message: 'Seluruh data lokal dan simulasi pengujian telah dibersihkan. Sistem kembali ke data awal.',
      data: cleanDb,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mereset data.' },
      { status: 500 }
    );
  }
}
