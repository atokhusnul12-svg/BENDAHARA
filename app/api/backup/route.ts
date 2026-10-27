import { NextRequest, NextResponse } from 'next/server';
import { getAllData } from '@/lib/data-service';
import { verifyAdminRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    if (!verifyAdminRequest(request)) {
      return NextResponse.json({ success: false, error: 'Akses ditolak: Diperlukan autentikasi PIN Bendahara.' }, { status: 401 });
    }

    const data = await getAllData();
    const backupPayload = {
      appName: 'Bendahara MMD',
      institution: 'Majelis Musyawarah & Dirosah',
      backupDate: new Date().toISOString(),
      data: {
        pengeluaran: data.pengeluaran,
        subsidi: data.subsidi,
        periode: data.periode,
        kategori: data.kategori,
      },
    };

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `Backup_Kas_MMD_${dateStr}.json`;

    return new NextResponse(JSON.stringify(backupPayload, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal membuat backup data.' },
      { status: 500 }
    );
  }
}
