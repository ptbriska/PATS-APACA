const PATS_CONFIG = {
  appName: "PATS Portal",
  appFullName: "Psikometrik & Aptitude Test System",
  organization: "Lembaga Layanan Psikometri & Asesmen",
  logoUrl: "assets/images/logo.png",
  version: "1.0.0",

  // Pengaturan CBT Default
  cbtDefaults: {
    autoSubmitOnTimeout: true,
    allowRaguRagu: true,
    showTimer: true
  },

  // Metadata 21 Jenis Tes PATS
  tests: {
    // Kategori: Pengembangan Diri (PD)
    "PD1": {
      kode: "PD1",
      folder: "pd1-kecerdasan-majemuk",
      kategori: "Pengembangan Diri",
      namaResmi: "Tes Potensi Kecerdasan (8 Multiple Intelligence)",
      namaSingkat: "Kecerdasan Majemuk",
      durasiMenit: 45
    },
    "PD2": {
      kode: "PD2",
      folder: "pd2-tes-iq",
      kategori: "Pengembangan Diri",
      namaResmi: "Tes Potensi Komprehensif 1 (IQ)",
      namaSingkat: "Tes IQ",
      durasiMenit: 60
    },
    "PD3": {
      kode: "PD3",
      folder: "pd3-potensi-komprehensif",
      kategori: "Pengembangan Diri",
      namaResmi: "Tes Potensi Komprehensif 2 (IQ, EQ, CQ, AQ)",
      namaSingkat: "Potensi Komprehensif",
      durasiMenit: 60
    },
    "PD4": {
      kode: "PD4",
      folder: "pd4-tipe-kepribadian",
      kategori: "Pengembangan Diri",
      namaResmi: "Tes Tipe Kepribadian (MBTI, Enneagram, DISC)",
      namaSingkat: "Tipe Kepribadian",
      durasiMenit: 45
    },
    "PD5": {
      kode: "PD5",
      folder: "pd5-gaya-belajar",
      kategori: "Pengembangan Diri",
      namaResmi: "Tes Gaya Belajar (VAK)",
      namaSingkat: "Gaya Belajar",
      durasiMenit: 30
    },

    // Kategori: Penjurusan & Karir (PK)
    "PK1": {
      kode: "PK1",
      folder: "pk1-minat-bakat",
      kategori: "Penjurusan & Karir",
      namaResmi: "Tes Minat Bakat",
      namaSingkat: "Minat Bakat",
      durasiMenit: 45
    },
    "PK2": {
      kode: "PK2",
      folder: "pk2-potensi-jurusan",
      kategori: "Penjurusan & Karir",
      namaResmi: "Tes Potensi Jurusan Kuliah",
      namaSingkat: "Potensi Jurusan",
      durasiMenit: 45
    },
    "PK3": {
      kode: "PK3",
      folder: "pk3-potensi-karir",
      kategori: "Penjurusan & Karir",
      namaResmi: "Tes Potensi Karir",
      namaSingkat: "Potensi Karir",
      durasiMenit: 45
    },
    "PK4": {
      kode: "PK4",
      folder: "pk4-nilai-kerja",
      kategori: "Penjurusan & Karir",
      namaResmi: "Tes Orientasi Nilai Kerja (Work Values)",
      namaSingkat: "Nilai Kerja",
      durasiMenit: 30
    },

    // Kategori: Kesiapan Sekolah (KS)
    "KS1": {
      kode: "KS1",
      folder: "ks1-kesiapan-sekolah",
      kategori: "Kesiapan Sekolah",
      namaResmi: "Tes Kesiapan Sekolah (NST)",
      namaSingkat: "Kesiapan Sekolah",
      durasiMenit: 45
    },
    "KS2": {
      kode: "KS2",
      folder: "ks2-iq-anak",
      kategori: "Kesiapan Sekolah",
      namaResmi: "Tes Kecerdasan Anak (WISC dan CPM)",
      namaSingkat: "IQ Anak",
      durasiMenit: 60
    },
    "KS3": {
      kode: "KS3",
      folder: "ks3-deteksi-belajar",
      kategori: "Kesiapan Sekolah",
      namaResmi: "Tes Deteksi Dini Kesulitan Belajar (Disleksia/ADHD)",
      namaSingkat: "Deteksi Belajar",
      durasiMenit: 30
    },
    "KS4": {
      kode: "KS4",
      folder: "ks4-sensori-motorik",
      kategori: "Kesiapan Sekolah",
      namaResmi: "Tes Sensori & Motorik Anak",
      namaSingkat: "Sensori Motorik",
      durasiMenit: 30
    },

    // Kategori: Kesehatan Mental (KM)
    "KM1": {
      kode: "KM1",
      folder: "km1-daya-juang",
      kategori: "Kesehatan Mental",
      namaResmi: "Tes Grit & Growth Mindset",
      namaSingkat: "Daya Juang",
      durasiMenit: 30
    },
    "KM2": {
      kode: "KM2",
      folder: "km2-stres-akademik",
      kategori: "Kesehatan Mental",
      namaResmi: "Tes Stres & Kecemasan Akademik (Burnout)",
      namaSingkat: "Stres Akademik",
      durasiMenit: 30
    },
    "KM3": {
      kode: "KM3",
      folder: "km3-perilaku-digital",
      kategori: "Kesehatan Mental",
      namaResmi: "Tes Profil Perilaku Digital & Literacy",
      namaSingkat: "Perilaku Digital",
      durasiMenit: 30
    },
    "KM4": {
      kode: "KM4",
      folder: "km4-adaptabilitas-budaya",
      kategori: "Kesehatan Mental",
      namaResmi: "Tes Adaptabilitas Budaya & Studi Mandiri",
      namaSingkat: "Adaptabilitas Budaya",
      durasiMenit: 30
    },

    // Kategori: Ekosistem Sekolah (ES)
    "ES1": {
      kode: "ES1",
      folder: "es1-potensi-kepemimpinan",
      kategori: "Ekosistem Sekolah",
      namaResmi: "Tes Potensi Kepemimpinan & Soft Skills (OSIS)",
      namaSingkat: "Potensi Kepemimpinan",
      durasiMenit: 40
    },
    "ES2": {
      kode: "ES2",
      folder: "es2-talenta-osn",
      kategori: "Ekosistem Sekolah",
      namaResmi: "Tes Talent Bidang OSN",
      namaSingkat: "Talenta OSN",
      durasiMenit: 60
    },
    "ES3": {
      kode: "ES3",
      folder: "es3-gaya-mengajar",
      kategori: "Ekosistem Sekolah",
      namaResmi: "Tes Profil Gaya Mengajar Guru",
      namaSingkat: "Gaya Mengajar",
      durasiMenit: 30
    },
    "ES4": {
      kode: "ES4",
      folder: "es4-pola-asuh",
      kategori: "Ekosistem Sekolah",
      namaResmi: "Tes Profil Pola Asuh Orang Tua (Parenting Style)",
      namaSingkat: "Pola Asuh",
      durasiMenit: 30
    }
  }
};
