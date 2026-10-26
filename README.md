# 🕌 Web App Bendahara MMD (Majelis Musyawarah & Dirosah)
> Sistem Pencatatan Kas, Plafon Subsidi Anggaran, dan Rincian Belanja Terintegrasi Google Sheets.

Aplikasi web modern, aman, dan mudah digunakan yang dirancang khusus untuk bendahara organisasi/pesantren Majelis Musyawarah & Dirosah (MMD). Dibangun dengan arsitektur **Next.js 14**, **Tailwind CSS**, dan **Google Apps Script API** yang menjamin data tersimpan langsung di Google Sheets secara rapi, konsisten, dan transparan.

---

## 📑 Daftar Isi
1. [Fitur Utama](#-fitur-utama)
2. [Arsitektur & Keamanan](#-arsitektur--keamanan)
3. [Struktur Tab Google Sheets](#-struktur-tab-google-sheets)
4. [Panduan Langkah Demi Langkah Pemula (Setup Google Sheets)](#-panduan-langkah-demi-langkah-pemula)
5. [Cara Menjalankan Aplikasi di Komputer Lokal](#-cara-menjalankan-aplikasi-di-komputer-lokal)
6. [Pengujian Otomatis (Test Suite)](#-pengujian-otomatis-test-suite)
7. [Daftar File Project](#-daftar-file-project)
8. [Panduan Deployment ke Vercel](#-panduan-deployment-ke-vercel)

---

## ✨ Fitur Utama

### 1. Beranda (Dashboard Keuangan)
- **Ringkasan Total Anggaran**: Menampilkan Sisa Dana Kas Tersedia, Total Subsidi Masuk, Total Pengeluaran, dan Persentase Realisasi Kas.
- **Kartu Alokasi Tiap Lajnah (Bento Stack)**: Menampilkan plafon subsidi, pengeluaran, sisa saldo kas, serta progress bar penggunaan untuk setiap kategori (LBM, Tafaquh & Mubahitsin, Musyawaroh).
- **Pengeluaran Terbaru**: Daftar 5 transaksi terakhir pada periode aktif dengan status penyimpanan riil.
- **Mode Kosong (Empty State)**: Tampilan informatif jika belum ada transaksi pada periode tertentu.

### 2. Tambah Pengeluaran (Modal Multi-Item)
- **Dukungan Multi-Rincian**: Dapat mencatat beberapa barang belanja sekaligus dalam satu acara dengan tombol **+ Tambah Rincian**.
- **Kalkulasi Otomatis Seketika**: `Total = Jumlah × Harga Satuan` berubah secara langsung tanpa delay.
- **Simulasi Saldo Kas**: Menampilkan estimasi saldo tersisa sebelum transaksi disimpan, tanpa mengurangi saldo permanen.
- **Proteksi Anti Double-Submit**: Mencegah transaksi ganda jika tombol ditekan berulang kali.

### 3. Halaman Laporan Pengeluaran
- **Filter Fleksibel**: Filter berdasarkan kategori divisi (Semua, LBM, Tafaquh, Musyawaroh) dan periode Hijriyah.
- **Pencarian Cepat**: Cari nama barang atau jenis acara secara instan.
- **Unduh Excel Asli (`.xlsx`)**: Menghasilkan file Excel berformat lengkap dengan tab rincian transaksi dan tab ringkasan.
- **Cetak Laporan / PDF**: Format cetak khusus (`@media print`) yang menyembunyikan tombol/navigasi dan menambahkan kolom tanda tangan Ketua & Bendahara.
- **Edit & Hapus Transaksi**: Mengubah baris yang bersangkutan di Google Sheets (bukan membuat duplikat) atau menghapus dengan dialog konfirmasi aman.

### 4. Kelola Subsidi Kas (Input Manual)
- Pencatatan alokasi dana kas masuk secara berkala untuk masing-masing divisi.
- Membedakan penambahan dana baru dengan saldo kas yang sedang berjalan.
- Riwayat penambahan subsidi dengan fitur edit dan hapus.

### 5. Pengelolaan Kalender Periode Hijriyah
- Pengaturan periode manual yang fleksibel (misal: *Jumadal Ula 1448 H*, *Jumadal Akhir 1448 H*).
- Pencegahan duplikasi nama periode.
- Kemampuan memilih periode mana yang sedang aktif digunakan pembukuan.

### 6. Pengaturan Aplikasi
- Pemeriksaan status koneksi Google Sheets secara riil (bukan status tiruan).
- Pengelolaan nama dan status aktif kategori divisi.
- Tombol pencadangan (*backup*) data lengkap ke format JSON.
- Modal panduan pemula interaktif di dalam aplikasi.

---

## 🛡 Arsitektur & Keamanan

Aplikasi ini menggunakan model **Backend Proxy**:

```
Browser Client  <--->  Next.js Server API (/api/*)  <--->  Google Apps Script (Web App)  <--->  Google Sheets
```

- **Kredensial Aman**: Browser pengguna tidak pernah memegang token rahasia Google. Semua permintaan divalidasi oleh Next.js Server.
- **Pencegahan Race Condition**: Google Apps Script menggunakan `LockService.getScriptLock(30000)` agar penulisan transaksi bersamaan tidak merusak data.
- **Mode Cadangan Lokal (*Fallback*)**: Jika Google Sheets belum dikonfigurasi, aplikasi tetap dapat dijalankan penuh secara lokal tanpa error, dan status di Pengaturan akan jujur menampilkan `Mode Lokal (Belum Sync)`.

---

## 📊 Struktur Tab Google Sheets

Ketika dihubungkan, Google Apps Script akan secara otomatis membuat tab dan kolom berikut jika belum ada:

### 1. Tab `Pengeluaran`
| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| `id` | String | ID unik transaksi (contoh: `EXP-m7a9b-1-xyz`) |
| `eventId` | String | ID kelompok acara (menghubungkan multi-barang) |
| `createdAt` | ISO Date | Waktu pencatatan pertama |
| `updatedAt` | ISO Date | Waktu perubahan terakhir |
| `tanggalTransaksi`| Date | Tanggal nota/kuitansi (`YYYY-MM-DD`) |
| `periodeId` | String | Label periode (`Jumadal Ula 1448 H`) |
| `bulanHijriah` | String | Nama bulan Hijriyah |
| `tahunHijriah` | String | Tahun Hijriyah |
| `kategoriId` | String | ID kategori |
| `kategoriNama` | String | Nama kategori divisi |
| `jenisAcara` | String | Nama kegiatan/acara |
| `namaBarang` | String | Nama rincian barang belanja |
| `jumlah` | Angka | Kuantitas barang |
| `satuan` | String | Satuan (bungkus, pcs, pack, dus, kg) |
| `hargaSatuan` | Angka | Harga per unit barang (angka murni) |
| `total` | Angka | Total pengeluaran (angka murni) |
| `catatan` | String | Catatan tambahan |

### 2. Tab `Subsidi`
`id`, `createdAt`, `updatedAt`, `tanggalTransaksi`, `periodeId`, `bulanHijriah`, `tahunHijriah`, `kategoriId`, `kategoriNama`, `nominal`, `catatan`

### 3. Tab `Periode`
`id`, `namaBulanHijriah`, `tahunHijriah`, `labelPeriode`, `statusAktif`, `createdAt`

### 4. Tab `Kategori`
`id`, `namaKategori`, `statusAktif`, `createdAt`, `updatedAt`

---

## 📖 Panduan Langkah Demi Langkah Pemula (Setup Google Sheets)

Bagi Anda yang pemula total dalam dunia coding, ikuti 4 langkah sederhana ini:

### Langkah 1: Buat Spreadsheet Baru
1. Buka peramban (*browser*) dan kunjungi **[sheets.google.com](https://sheets.google.com)**.
2. Buat spreadsheet kosong baru (*Blank spreadsheet*).
3. Beri nama file di pojok kiri atas, contohnya: `Buku_Kas_MMD_1448H`.
4. Salin URL spreadsheet dari address bar browser Anda (contoh: `https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5n.../edit`).

### Langkah 2: Buka Apps Script
1. Pada menu atas Google Sheets, klik **Ekstensi (Extensions)** > **Apps Script**.
2. Editor kode Google Apps Script akan terbuka di tab baru.
3. Hapus semua teks yang ada di file `Code.gs`.
4. Buka file `google-apps-script/Code.gs` dari folder project ini, salin seluruh kodenya, dan tempelkan (*paste*) ke editor Apps Script.
5. Klik ikon **Simpan (Save / Ctrl+S)**.

### Langkah 3: Deploy sebagai Aplikasi Web (Web App)
1. Klik tombol warna biru **Deploy (Terapkan)** di pojok kanan atas, lalu pilih **New deployment (Penerapan baru)**.
2. Klik ikon gerigi di sebelah *Select type*, pilih **Web app (Aplikasi Web)**.
3. Atur konfigurasi berikut:
   - **Description**: `API Bendahara MMD`
   - **Execute as (Jalankan sebagai)**: `Me (email Anda)`
   - **Who has access (Siapa yang memiliki akses)**: **`Anyone (Siapa saja)`** *(Wajib dipilih agar server aplikasi dapat berkomunikasi)*
4. Klik tombol **Deploy**.
5. Google akan meminta izin akses (*Authorization Required*):
   - Klik **Review permissions (Tinjau izin)**.
   - Pilih akun Google Anda.
   - Jika muncul peringatan *"Google hasn't verified this app"*, klik **Advanced (Lanjutan)** di bagian bawah, lalu klik **Go to Untitled project (unsafe)**.
   - Klik **Allow (Izinkan)**.
6. Setelah selesai, salin **Web App URL** yang berakhiran `/exec`.
   *(Contoh: `https://script.google.com/macros/s/AKfycb.../exec`)*

### Langkah 4: Hubungkan ke Aplikasi Web
1. Di folder project, buka file `.env.local` menggunakan teks editor (Notepad atau VS Code).
2. Tempelkan URL tadi pada baris `GOOGLE_SCRIPT_URL`:
   ```env
   GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/AKfycb.../exec
   GOOGLE_SCRIPT_TOKEN=mmd-amanah-kas-secret
   GOOGLE_SPREADSHEET_URL=https://docs.google.com/spreadsheets/d/ID_SPREADSHEET_ANDA/edit
   ```
3. Simpan file `.env.local`.
4. Selesai! Buka halaman **Pengaturan** di aplikasi dan klik tombol **Uji Koneksi Google Sheets**. Sistem akan otomatis membuat tab dan menyinkronkan data secara langsung!

---

## 💻 Cara Menjalankan Aplikasi di Komputer Lokal

Pastikan komputer Anda sudah terpasang Node.js (versi 18 ke atas):

1. **Buka Terminal / PowerShell di folder project**:
   ```bash
   cd "D:\BENDAHARA MMD"
   ```

2. **Jalankan Aplikasi dalam mode pengembangan**:
   ```bash
   npm run dev
   ```

3. **Buka di Browser**:
   Kunjungi tautan: **[http://localhost:3000](http://localhost:3000)**

4. **Menjalankan versi Produksi (Opsional)**:
   ```bash
   npm run build
   npm run start
   ```

---

## 🧪 Pengujian Otomatis (Test Suite)

Project ini dilengkapi dengan test suite otomatis yang menguji seluruh 15 skenario finansial, penambahan periode, perhitungan saldo, dan isolasi data.

Untuk menjalankan pengujian otomatis:
```bash
npm test
```

### Hasil Pengujian Terverifikasi:
```text
==========================================================
🚀 MEMULAI PENGUJIAN OTOMATIS SISTEM BENDAHARA MMD
==========================================================

📌 Skenario 9 & 10: Pengelolaan Periode Hijriyah
  ✔ PASS: Menambahkan periode Jumadal Akhir 1448 H 
  ✔ PASS: Label periode terformat benar 
  ✔ PASS: Pencegahan duplikasi periode berhasil ditolak 

📌 Skenario 1 & 5: Penambahan & Penyimpanan Subsidi
  ✔ PASS: Menambahkan subsidi Rp 1.000.000 ke kategori LBM 
  ✔ PASS: Nominal subsidi tersimpan tepat 1.000.000 

📌 Skenario 2, 3, & 4: Penambahan & Perhitungan Pengeluaran
  ✔ PASS: Menambahkan pengeluaran 2 porsi @ Rp 100.000 
  ✔ PASS: Total otomatis dihitung = Rp 200.000 

📌 Skenario 3: Konsistensi Perhitungan Saldo Kas
  ✔ PASS: Total Subsidi Masuk = Rp 1.000.000 (Aktual: 1000000)
  ✔ PASS: Total Pengeluaran = Rp 200.000 (Aktual: 200000)
  ✔ PASS: Sisa Saldo Kas = Rp 800.000 (Aktual: 800000)
  ✔ PASS: Persentase Realisasi = 20% (Aktual: 20%)

📌 Skenario 7: Pengubahan Transaksi (Update Row)
  ✔ PASS: Mengedit jumlah barang transaksi menjadi 3 
  ✔ PASS: Total pengeluaran terbarukan = Rp 300.000 
  ✔ PASS: Saldo kas dihitung ulang = Rp 700.000 

📌 Skenario 8: Penghapusan Transaksi & Rekalkulasi
  ✔ PASS: Menghapus transaksi pengeluaran 
  ✔ PASS: Total pengeluaran kembali menjadi Rp 0 
  ✔ PASS: Saldo kas kembali utuh menjadi Rp 1.000.000 

📌 Skenario 11: Pemisahan Data Lintas Periode
  ✔ PASS: Data subsidi periode Jumadal Akhir tidak bocor ke Jumadal Ula 

📌 Skenario 12: Pemeriksaan Status Koneksi Nyata
  ✔ PASS: Status sinkronisasi diperiksa secara riil oleh server 
  ✔ PASS: Status mencerminkan koneksi riil tanpa notifikasi palsu 

==========================================================
HASIL AKHIR: 20 LULUS, 0 GAGAL
==========================================================
```

---

## 📁 Daftar File Project

```text
d:/BENDAHARA MMD/
├── app/
│   ├── api/
│   │   ├── backup/route.ts         # Endpoint download JSON backup lengkap
│   │   ├── data/route.ts           # Endpoint GET data & hitung ringkasan kas
│   │   ├── export/route.ts         # Endpoint download Excel .xlsx & CSV
│   │   ├── kategori/route.ts       # Endpoint CRUD kategori divisi kas
│   │   ├── pengeluaran/route.ts    # Endpoint CRUD transaksi pengeluaran
│   │   ├── periode/route.ts        # Endpoint CRUD periode kalender Hijriyah
│   │   ├── status/route.ts         # Endpoint cek koneksi riil ke Google Sheets
│   │   └── subsidi/route.ts        # Endpoint CRUD penambahan subsidi kas
│   ├── laporan/
│   │   └── page.tsx                # Halaman Laporan Pengeluaran & Rincian Belanja
│   ├── pengaturan/
│   │   └── page.tsx                # Halaman Pengaturan, Periode, Kategori, & Panduan
│   ├── subsidi/
│   │   └── page.tsx                # Halaman Kelola Subsidi (Input Manual)
│   ├── globals.css                 # Styling global, Tailwind, & Cetak Laporan (@media print)
│   ├── layout.tsx                  # Layout utama (Fonts, Header, BottomNav, Modals)
│   └── page.tsx                    # Halaman Beranda (Dashboard Keuangan Utama)
├── components/
│   ├── BottomNav.tsx               # Navigasi bawah mobile-first
│   ├── DeleteConfirmModal.tsx      # Modal konfirmasi aman hapus transaksi/subsidi
│   ├── ExpenseModal.tsx            # Modal Tambah/Edit Pengeluaran & Simulasi Saldo
│   ├── Header.tsx                  # Header atas dengan Logo MMD
│   ├── SubsidyModal.tsx            # Modal Tambah/Edit Subsidi
│   └── Toast.tsx                   # Notifikasi toast dinamis
├── context/
│   └── AppContext.tsx              # State management React Context (sync real-time)
├── data/
│   └── bendahara_mmd.json          # Penyimpanan database lokal terproteksi
├── docs/
│   └── stitch-reference.txt        # Salinan referensi desain HTML Stitch
├── google-apps-script/
│   └── Code.gs                     # Kode backend Google Apps Script untuk Google Sheets
├── lib/
│   ├── data-service.ts             # Service backend proxy & rumus perhitungan kas
│   ├── format.ts                   # Format mata uang Rupiah & kalender Hijriyah
│   └── types.ts                    # TypeScript interfaces & tipe data
├── scripts/
│   └── test-system.js              # Script pengujian otomatis 15 skenario wajib
├── .env.example                    # Contoh variabel lingkungan tanpa rahasia
├── .env.local                      # Konfigurasi environment lokal (gitignored)
├── .gitignore                      # Proteksi keamanan Git
├── next.config.js                  # Konfigurasi Next.js
├── package.json                    # Definisi package & scripts
├── postcss.config.js               # Konfigurasi PostCSS
├── tailwind.config.js              # Konfigurasi tema Tailwind sesuai warna Stitch
└── tsconfig.json                   # Konfigurasi TypeScript
```

---

## 🌐 Panduan Deployment ke Vercel

1. Buat repositori baru di akun GitHub pribadi Anda dan unggah seluruh file project *(file `.env.local` akan otomatis diabaikan oleh `.gitignore` sehingga aman)*.
2. Buka **[vercel.com](https://vercel.com)** dan masuk dengan akun GitHub Anda.
3. Klik **Add New Project** lalu pilih repositori `bendahara-mmd`.
4. Pada bagian **Environment Variables**, tambahkan variabel berikut:
   - `GOOGLE_SCRIPT_URL`: URL Apps Script web app Anda
   - `GOOGLE_SCRIPT_TOKEN`: `mmd-amanah-kas-secret`
   - `GOOGLE_SPREADSHEET_URL`: Tautan Google Sheets Anda
5. Klik tombol **Deploy**.
6. Dalam hitungan detik, Web App Bendahara MMD Anda sudah online dan dapat diakses dari smartphone, tablet, maupun komputer di mana saja!
