/* ==========================================================================
   PATS PORTAL - CONFIGURATION & METADATA CENTER (config.js)
   Pusat Konfigurasi System & Master Data 31 Modul Ujian PATS
   ========================================================================== */

const PATS_CONFIG = {
  appName: "PATS Portal",
  appFullName: "Psikometrik & Aptitude Test System",
  version: "2.0.0",

  // Master Data Identitas Lembaga (Kop Surat Laporan Resmi)
  organization: {
    name: "APACA CONSULTING & PSYCHOMETRIC CENTER",
    subTitle: "Layanan Asesmen Psikologi & Family Guidance",
    sippNumber: "SIPP No: 2026-0819-PSI-01",
    address: "Jl. Racing Center, Perum. Mustika Mulia, Blok B5, No. 8, Panakkukang, Makassar, Sulawesi Selatan",
    logoUrl: "assets/images/logo.png"
  },

  // Pengaturan CBT Default
  cbtDefaults: {
    autoSubmitOnTimeout: true,
    allowRaguRagu: true,
    showTimer: true
  },

  // Metadata Modul Tes PATS (31 Modul Tes Terintegrasi)
  tests: {
    // ==========================================
    // 1. KATEGORI: Anak (Pra Sekolah - Sekolah Dasar)
    // ==========================================
    "KA1": {
      kode: "KA1",
      folder: "ka1-kesiapan-masuk-sd",
      kategori: "Anak (Pra Sekolah-Sekolah Dasar)",
      namaResmi: "Asesmen Psikologi Kesiapan Masuk SD",
      namaSingkat: "Kesiapan Masuk SD",
      durasiMenit: 45
    },
    "KA2": {
      kode: "KA2",
      folder: "ka2-iq-kecerdasan-anak",
      kategori: "Anak (Pra Sekolah-Sekolah Dasar)",
      namaResmi: "Tes Psikologi IQ & Kecerdasan Anak",
      namaSingkat: "IQ & Kecerdasan Anak",
      durasiMenit: 60
    },
    "KA3": {
      kode: "KA3",
      folder: "ka3-skrining-hambatan-belajar",
      kategori: "Anak (Pra Sekolah-Sekolah Dasar)",
      namaResmi: "Skrining Klinis & Hambatan Belajar",
      namaSingkat: "Skrining Hambatan Belajar",
      durasiMenit: 30
    },
    "KA4": {
      kode: "KA4",
      folder: "ka4-skrining-sensori-motorik",
      kategori: "Anak (Pra Sekolah-Sekolah Dasar)",
      namaResmi: "Skrining Perkembangan Sensori & Motorik",
      namaSingkat: "Skrining Sensori & Motorik",
      durasiMenit: 30
    },

    // ==========================================
    // 2. KATEGORI: Siswa (SD - Mahasiswa)
    // ==========================================
    "KS1": {
      kode: "KS1",
      folder: "ks1-minat-bakat-osn",
      kategori: "Siswa (SD-Mahasiswa)",
      namaResmi: "Pemetaan Minat & Bakat Potensial Analitis Bidang OSN",
      namaSingkat: "Minat Bakat OSN",
      durasiMenit: 45
    },
    "KS2": {
      kode: "KS2",
      folder: "ks2-potensi-inteligensi-siswa",
      kategori: "Siswa (SD-Mahasiswa)",
      namaResmi: "Asesmen Potensi Komprehensif & Inteligensi",
      namaSingkat: "Potensi & Inteligensi Siswa",
      durasiMenit: 60
    },
    "KS3": {
      kode: "KS3",
      folder: "ks3-keselarasan-jurusan-kuliah",
      kategori: "Siswa (SD-Mahasiswa)",
      namaResmi: "Asesmen Keselarasan Jurusan Kuliah",
      namaSingkat: "Keselarasan Jurusan Kuliah",
      durasiMenit: 45
    },
    "KS4": {
      kode: "KS4",
      folder: "ks4-kesiapan-studi-mandiri-rantau",
      kategori: "Siswa (SD-Mahasiswa)",
      namaResmi: "Indeks Kesiapan Studi Mandiri & Rantau",
      namaSingkat: "Kesiapan Studi Mandiri/Rantau",
      durasiMenit: 30
    },
    "KS5": {
      kode: "KS5",
      folder: "ks5-gaya-belajar-lsp",
      kategori: "Siswa (SD-Mahasiswa)",
      namaResmi: "Asesmen Modalitas Gaya Belajar (LSP)",
      namaSingkat: "Gaya Belajar (LSP)",
      durasiMenit: 30
    },
    "KS6": {
      kode: "KS6",
      folder: "ks6-kecerdasan-majemuk",
      kategori: "Siswa (SD-Mahasiswa)",
      namaResmi: "Pemetaan 8 Pola Kecerdasan Majemuk",
      namaSingkat: "Kecerdasan Majemuk",
      durasiMenit: 45
    },
    "KS7": {
      kode: "KS7",
      folder: "ks7-bakat-analitis-osn",
      kategori: "Siswa (SD-Mahasiswa)",
      namaResmi: "Pemetaan Bakat Analitis OSN",
      namaSingkat: "Bakat Analitis OSN",
      durasiMenit: 60
    },
    "KS8": {
      kode: "KS8",
      folder: "ks8-penalaran-kritis-logika",
      kategori: "Siswa (SD-Mahasiswa)",
      namaResmi: "Tes Penalaran Kritis & Logika Analitis",
      namaSingkat: "Penalaran Kritis & Logika",
      durasiMenit: 45
    },
    "KS9": {
      kode: "KS9",
      folder: "ks9-struktur-pengajaran-lam",
      kategori: "Siswa (SD-Mahasiswa)",
      namaResmi: "Asesmen Kesesuaian Metodologi & Struktur Pengajaran (LAM)",
      namaSingkat: "Struktur Pengajaran (LAM)",
      durasiMenit: 30
    },
    "KS10": {
      kode: "KS10",
      folder: "ks10-teknik-belajar-taktis-lte",
      kategori: "Siswa (SD-Mahasiswa)",
      namaResmi: "Asesmen Efektivitas Teknik Belajar Taktis (LTE)",
      namaSingkat: "Teknik Belajar Taktis (LTE)",
      durasiMenit: 30
    },
    "KS11": {
      kode: "KS11",
      folder: "ks11-belajar-mandiri-lsi",
      kategori: "Siswa (SD-Mahasiswa)",
      namaResmi: "Asesmen Kapasitas Self-Regulated Learning (LSI)",
      namaSingkat: "Belajar Mandiri (LSI)",
      durasiMenit: 30
    },
    "KS12": {
      kode: "KS12",
      folder: "ks12-operasi-kognitif-lcpi",
      kategori: "Siswa (SD-Mahasiswa)",
      namaResmi: "Pemetaan Operasi Kognitif Saat Belajar (LCPI)",
      namaSingkat: "Operasi Kognitif (LCPI)",
      durasiMenit: 30
    },
    "KS13": {
      kode: "KS13",
      folder: "ks13-motivasi-emosi-belajar-lamp",
      kategori: "Siswa (SD-Mahasiswa)",
      namaResmi: "Pemetaan 6 Tipe Motivasi, Efikasi Diri & Emosi Belajar (LAMP)",
      namaSingkat: "Motivasi & Emosi Belajar (LAMP)",
      durasiMenit: 35
    },
    "KS14": {
      kode: "KS14",
      folder: "ks14-lingkungan-belajar-lei",
      kategori: "Siswa (SD-Mahasiswa)",
      namaResmi: "Pemetaan Kondisi Lingkungan Belajar Optimal (LEI)",
      namaSingkat: "Lingkungan Belajar (LEI)",
      durasiMenit: 30
    },
    "KS15": {
      kode: "KS15",
      folder: "ks15-preferensi-media-belajar-lrp",
      kategori: "Siswa (SD-Mahasiswa)",
      namaResmi: "Pemetaan Hirarki Preferensi Format Materi & Media (LRP)",
      namaSingkat: "Preferensi Media Belajar (LRP)",
      durasiMenit: 30
    },
    "KS16": {
      kode: "KS16",
      folder: "ks16-stres-akademik",
      kategori: "Siswa (SD-Mahasiswa)",
      namaResmi: "Survei Tingkat Kejenuhan & Stres Akademik",
      namaSingkat: "Stres Akademik",
      durasiMenit: 30
    },

    // ==========================================
    // 3. KATEGORI: Dewasa (Mahasiswa - Pekerja)
    // ==========================================
    "KD1": {
      kode: "KD1",
      folder: "kd1-proyeksi-karir",
      kategori: "Dewasa (Mahasiswa-Pekerja)",
      namaResmi: "Pemetaan Proyeksi Karir Masa Depan",
      namaSingkat: "Proyeksi Karir",
      durasiMenit: 45
    },
    "KD2": {
      kode: "KD2",
      folder: "kd2-nilai-prinsip-kerja",
      kategori: "Dewasa (Mahasiswa-Pekerja)",
      namaResmi: "Inventori Nilai & Prinsip Kerja",
      namaSingkat: "Nilai & Prinsip Kerja",
      durasiMenit: 30
    },
    "KD3": {
      kode: "KD3",
      folder: "kd3-potensi-inteligensi-dewasa",
      kategori: "Dewasa (Mahasiswa-Pekerja)",
      namaResmi: "Asesmen Potensi Komprehensif & Inteligensi",
      namaSingkat: "Potensi & Inteligensi Dewasa",
      durasiMenit: 60
    },
    "KD4": {
      kode: "KD4",
      folder: "kd4-gaya-kepemimpinan-korporat",
      kategori: "Dewasa (Mahasiswa-Pekerja)",
      namaResmi: "Asesmen Gaya Kepemimpinan di Korporat",
      namaSingkat: "Gaya Kepemimpinan Korporat",
      durasiMenit: 40
    },
    "KD5": {
      kode: "KD5",
      folder: "kd5-ketahanan-ketelitian-kerja",
      kategori: "Dewasa (Mahasiswa-Pekerja)",
      namaResmi: "Tes Ketahanan & Ketelitian Kerja (Kraepelin/Pauli)",
      namaSingkat: "Ketahanan & Ketelitian Kerja",
      durasiMenit: 20
    },
    "KD6": {
      kode: "KD6",
      folder: "kd6-stres-kerja",
      kategori: "Dewasa (Mahasiswa-Pekerja)",
      namaResmi: "Survei Tingkat Kejenuhan & Stres",
      namaSingkat: "Stres Kerja",
      durasiMenit: 30
    },

    // ==========================================
    // 4. KATEGORI: Umum (Karakter & Kesehatan Mental)
    // ==========================================
    "KU1": {
      kode: "KU1",
      folder: "ku1-daya-juang-pola-pikir",
      kategori: "Umum (Karakter & Kesehatan Mental)",
      namaResmi: "Asesmen Daya Juang & Pola Pikir",
      namaSingkat: "Daya Juang & Pola Pikir",
      durasiMenit: 30
    },
    "KU2": {
      kode: "KU2",
      folder: "ku2-integritas-etika",
      kategori: "Umum (Karakter & Kesehatan Mental)",
      namaResmi: "Tes Integritas & Etika",
      namaSingkat: "Integritas & Etika",
      durasiMenit: 30
    },
    "KU3": {
      kode: "KU3",
      folder: "ku3-etika-perilaku-digital",
      kategori: "Umum (Karakter & Kesehatan Mental)",
      namaResmi: "Asesmen Etika & Perilaku Digital",
      namaSingkat: "Etika & Perilaku Digital",
      durasiMenit: 30
    },
    "KU4": {
      kode: "KU4",
      folder: "ku4-kepribadian-mbti",
      kategori: "Umum (Karakter & Kesehatan Mental)",
      namaResmi: "Pemetaan Preferensi Tipe Kepribadian MBTI",
      namaSingkat: "Kepribadian MBTI",
      durasiMenit: 45
    },
    "KU5": {
      kode: "KU5",
      folder: "ku5-perilaku-komunikasi-disc",
      kategori: "Umum (Karakter & Kesehatan Mental)",
      namaResmi: "Pemetaan Profil Perilaku & Gaya Komunikasi DISC",
      namaSingkat: "Perilaku & Komunikasi DISC",
      durasiMenit: 30
    },
    "KU6": {
      kode: "KU6",
      folder: "ku6-tipe-enneagram",
      kategori: "Umum (Karakter & Kesehatan Mental)",
      namaResmi: "Pemetaan 9 Tipe Kepribadian & Motivasi Dasar Enneagram",
      namaSingkat: "Tipe Enneagram",
      durasiMenit: 45
    },
    "KU7": {
      kode: "KU7",
      folder: "ku7-kepribadian-big-five",
      kategori: "Umum (Karakter & Kesehatan Mental)",
      namaResmi: "Asesmen Lima Faktor Utama Trait Kepribadian (Big Five / OCEAN)",
      namaSingkat: "Kepribadian Big Five",
      durasiMenit: 40
    },
    "KU8": {
      kode: "KU8",
      folder: "ku8-kepemimpinan-soft-skills",
      kategori: "Umum (Karakter & Kesehatan Mental)",
      namaResmi: "Asesmen Kepemimpinan & Soft Skills",
      namaSingkat: "Kepemimpinan & Soft Skills",
      durasiMenit: 40
    },
    "KU9": {
      kode: "KU9",
      folder: "ku9-pengambilan-keputusan",
      kategori: "Umum (Karakter & Kesehatan Mental)",
      namaResmi: "Tes Pengambilan Keputusan",
      namaSingkat: "Pengambilan Keputusan",
      durasiMenit: 30
    },

    // ==========================================
    // 5. KATEGORI: Khusus (Parenting & Sekolah)
    // ==========================================
    "KK1": {
      kode: "KK1",
      folder: "kk1-gaya-mengajar-pendidik",
      kategori: "Khusus (Parenting & Sekolah)",
      namaResmi: "Inventori Gaya Mengajar Pendidik",
      namaSingkat: "Gaya Mengajar Pendidik",
      durasiMenit: 30
    },
    "KK2": {
      kode: "KK2",
      folder: "kk2-pola-asuh-orang-tua",
      kategori: "Khusus (Parenting & Sekolah)",
      namaResmi: "Pemetaan Pola Asuh Orang Tua",
      namaSingkat: "Pola Asuh Orang Tua",
      durasiMenit: 30
    }
  }
};
