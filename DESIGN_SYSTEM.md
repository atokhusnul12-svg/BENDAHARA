# DESIGN_SYSTEM.md — Bendahara MMD

> **Identitas Visual:** *Institutional Finance — Refined Islamic Elegance*  
> **Karakter:** Profesional, tenang, elegan, terpercaya, dan fungsional untuk bendahara pesantren.  
> **Filosofi Anti-Slop:** Menolak dekorasi berlebihan (gradient ungu-biru acak, glassmorphism berlebihan, bayangan tebal, kartu seragam tanpa hierarki). Setiap elemen visual memiliki tujuan administratif yang jelas.

---

## 1. Fondasi Warna (Color Palette)

Palet warna dirancang khusus mencerminkan martabat institusi keagamaan dan presisi pembukuan keuangan:

| Token / Nama | Hex | Fungsi & Peran |
|---|---|---|
| **Primary Forest Green** | `#174D3C` | Warna identitas utama, header, tombol utama, teks judul penting. |
| **Deep Green** | `#10382D` | Varian gelap untuk card hero, kontras tinggi, dan state hover tombol. |
| **Primary Light / Tint** | `#EBF3EF` | Background aksen tombol sekunder, pill kategori, dan baris aktif. |
| **Neutral Soft Background**| `#F5F7F4` | Latar belakang seluruh halaman (ramah di mata, hangat, bukan putih silau). |
| **Surface Utama (Card)** | `#FFFFFF` | Latar belakang kartu, modal, tabel, dan formulir input. |
| **Surface Subdued** | `#EDF1EE` | Latar belakang kontrol input, stepper jumlah, dan container pendukung. |
| **Text Utama (Heading/Data)**| `#1E2925` | Teks judul, angka saldo kas, dan label form (kontras tinggi WCAG AAA). |
| **Text Sekunder (Keterangan)**| `#65736C` | Teks pembantu, tanggal, satuan, dan metadata sekunder. |
| **Border Halus** | `#E1E8E2` | Garis batas kartu, pemisah baris tabel, dan outline input. |
| **Accent Muted Gold** | `#B69A5C` | Aksen kehormatan (insignia MMD, badge verifikasi, highlight plafon). |
| **Gold Surface / Light** | `#F9F6EE` | Background aksen lembut untuk saldo terkonfirmasi & subsidi. |

### Semantic Colors
- **Success (Surplus / Tersinkron):** `#1B7340` (Teks) / `#EBF7EE` (Latar) / `#B7E4C7` (Border)
- **Warning (Pending / Realisasi Tinggi):** `#B45309` (Teks) / `#FEF3C7` (Latar) / `#FDE68A` (Border)
- **Error (Defisit / Gagal):** `#B91C1C` (Teks) / `#FEE2E2` (Latar) / `#FECACA` (Border)
- **Info (Proses / Bantuan):** `#0369A1` (Teks) / `#E0F2FE` (Latar) / `#BAE6FD` (Border)

---

## 2. Tipografi (Typography)

Menggunakan dua keluarga font komplementer:
1. **Plus Jakarta Sans:** Judul halaman, nominal saldo (`font-headline`, `font-title-currency`), dan angka kas.
2. **Inter:** Label formulir, teks paragraf, rincian transaksi, dan navigasi (`font-body`, `font-label`).

### Tabular Numbers untuk Finansial
Semua nominal uang, subtotal, kuantitas, dan persentase diwajibkan menggunakan kelas CSS `tabular-nums` atau `font-variant-numeric: tabular-nums` agar angka sejajar secara vertikal dan mudah dibandingkan dalam hitungan detik.

### Skala Tipografi
- **Display Saldo:** `text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight`
- **Heading 1:** `text-xl sm:text-2xl font-bold text-[#1E2925]`
- **Heading 2:** `text-lg font-bold text-[#1E2925]`
- **Body Regular:** `text-sm leading-relaxed text-[#1E2925]`
- **Body Muted:** `text-xs sm:text-sm text-[#65736C]`
- **Caption / Meta:** `text-[11px] sm:text-xs font-medium text-[#65736C]`

---

## 3. Sistem Spacing & Grid (8-Point Grid)

- **Kelipatan:** 4px, 8px, 12px, 16px, 24px, 32px, 48px.
- **Container Lebar:**
  - **Mobile (< 768px):** Full width dengan padding horizontal 16px (`px-4`), dioptimalkan untuk pengoperasian satu tangan.
  - **Tablet (768px - 1023px):** `max-w-3xl` atau `max-w-4xl` dengan margin otomatis.
  - **Desktop (>= 1024px):** `max-w-6xl` dengan padding horizontal 24px-32px (`px-6 lg:px-8`), menghadirkan tata letak proporsional tanpa ruang kosong buangan.
- **Radius Sudut:**
  - Kontrol kecil & tag: `rounded-lg` (8px)
  - Kartu & kontainer utama: `rounded-xl` (12px) atau `rounded-2xl` (16px)
  - Badge & pill filter: `rounded-full` (9999px)
  - Modal mobile: `rounded-t-2xl sm:rounded-2xl`

---

## 4. Komponen Antarmuka Utama

### A. Header Institusi
- Menampilkan logo resmi MMD MIDA Sumbersari Kediri dengan rasio proporsional.
- Di desktop: Memuat menu navigasi utama (Beranda, Laporan, Subsidi, Pengaturan), status sinkronisasi Sheets yang jelas, dan tombol keluar.
- Di mobile: Menampilkan identitas ringkas, indikator status sinkronisasi, dan tombol aksi.

### B. Bottom Navigation (Khusus Mobile)
- Aktif hanya pada layar `< 768px` (`md:hidden`).
- Area sentuh minimal 48 × 48 piksel.
- Label teks jelas di bawah ikon untuk mencegah ambiguitas navigasi.

### C. Kartu Total Saldo Kas (Hero Card)
- Latar deep forest green dengan ornamen geometris Islam 8-titik lembut (opacity 6%).
- Saldo kas ditampilkan dominan dengan pembedaan tegas antara **Saldo Terkonfirmasi Sheets** dan **Saldo Sementara**.
- Progress bar realisasi anggaran dengan companion text persentase.

### D. Tabel & Daftar Transaksi Responsif
- **Desktop:** Menampilkan tabel terstruktur lengkap (Tanggal, Kategori, Jenis Acara, Rincian Barang, Qty/Satuan, Harga, Total, Status, Aksi).
- **Mobile:** Kartu transaksi terkompresi vertikal yang memprioritaskan nama kegiatan, nominal pengeluaran, dan status sinkronisasi tanpa overflow horizontal.

### E. Formulir Modal Transaksi & Subsidi
- Area sentuh tombol stepper (+ / -) minimal 44 × 44 piksel.
- Form scrollable dengan `overscroll-contain` agar tidak menyeret latar belakang.
- **Session Guard Terproteksi:** Mempertahankan seluruh nilai ketikan saat keyboard HP dibuka/ditutup, fokus berpindah, atau background refresh berlangsung.
- Validasi instan dengan pesan galat kontekstual.

---

## 5. Standar Aksesibilitas & Responsivitas (Anti-Slop Gate)

1. **Kontras Teks:** Semua teks memenuhi standar WCAG AA (rasio kontras >= 4.5:1 untuk teks biasa, >= 3:1 untuk teks besar).
2. **Keyboard Navigation:** Seluruh kontrol memiliki state `focus-visible:ring-2 focus-visible:ring-[#174D3C] focus-visible:ring-offset-2`.
3. **Modal Escape:** Semua modal dapat ditutup dengan tombol Escape atau klik backdrop.
4. **Resiliensi Data:** Jika penyimpanan gagal, data formulir tidak hilang dan modal tetap terbuka.
5. **No Em Dashes:** Menggunakan tanda baca baku bahasa Indonesia tanpa karakter em dash dekoratif.
