import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Bendahara MMD - Kas & Subsidi Pesantren',
    short_name: 'Bendahara MMD',
    description: 'Aplikasi kas dan subsidi anggaran Majelis Musyawarah & Dirosah MMD Pesantren terintegrasi Google Sheets',
    start_url: '/',
    display: 'standalone',
    background_color: '#f4fbf8',
    theme_color: '#006a62',
    icons: [
      {
        src: '/icon.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
