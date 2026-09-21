/* ==========================================================================
   PATS PORTAL - SCORING ENGINE KU4: APACA Personality Preference Indicator (PPI)
   Modul Penilaian MBTI General, Consolidator 4 Dikotomi, & PCI Calculation
   ========================================================================== */

const REKAP_GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxMq4NjUbe0YCiYRrMXG4TvztEi8B7xpc04Te3JNNV7BBnQSCMFD1CgB0lRBUFDINWY/exec";

const KU4_Scoring = {
  /**
   * Menghitung:
   * 1. Akumulasi Poin per Kutub (E, I, S, N, T, F, J, P) -> Min 0, Max 15 per pasang.
   * 2. Kode Tipe Kepribadian (16 Profil, e.g., ENTJ, INFP).
   * 3. Indeks Kejelasan Preferensi (Preference Clarity Index - PCI %) per Dikotomi.
   * 4. Pemetaan Kategori Kejelasan (Very Clear, Clear, Moderate, Slight).
   * 5. Penarikan Rincian Diagnostik dari rubrik.json.
   */
  evaluate(answers, soalData, rubrikData) {
    if (!soalData || !soalData.questions) {
      return { isInvalid: true, message: "Data soal KU4 tidak ditemukan." };
    }

    const totalAnswered = Object.keys(answers).length;
    const uniqueAnswers = new Set(Object.values(answers));

    // Careless Responding Check (60 soal dijawab seragam A semua atau B semua)
    if (totalAnswered >= 60 && uniqueAnswers.size === 1) {
      return {
        isInvalid: true,
        message: "Flag: INVALID - CARELESS RESPONDING (Jawaban terdeteksi seragam pada seluruh 60 butir soal)."
      };
    }

    const counts = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };
    const questionMap = new Map(soalData.questions.map(q => [q.id, q]));

    // 1. Akumulasi Poin berdasarkan Pilihan Opsi A atau B
    for (let i = 1; i <= 60; i++) {
      const userChoice = answers[i]; // 'A' atau 'B'
      const qObj = questionMap.get(i);

      if (qObj && userChoice) {
        const selectedOpt = qObj.options.find(opt => opt.code === userChoice);
        if (selectedOpt && selectedOpt.pole) {
          counts[selectedOpt.pole] = (counts[selectedOpt.pole] || 0) + 1;
        }
      }
    }

    // 2. Penentuan Kutub Pemenang per Dikotomi
    const poleE_I = counts.E >= counts.I ? 'E' : 'I';
    const poleS_N = counts.S >= counts.N ? 'S' : 'N';
    const poleT_F = counts.T >= counts.F ? 'T' : 'F';
    const poleJ_P = counts.J >= counts.P ? 'J' : 'P';

    const mbtiCode = `${poleE_I}${poleS_N}${poleT_F}${poleJ_P}`;

    // 3. Kalkulasi Preference Clarity Index (PCI %) & Persentase Sisi
    // Formula PCI = (|Skor A - Skor B| / 15) * 100
    const calcDichotomy = (cntA, cntB, labelA, labelB) => {
      const diff = Math.abs(cntA - cntB);
      const pciVal = Math.round((diff / 15) * 100);
      const pctA = Math.round((cntA / 15) * 100);
      const pctB = 100 - pctA;
      const winner = cntA >= cntB ? labelA : labelB;

      // Kategori PCI
      let category = "Slight";
      if (pciVal >= 76) category = "Very Clear";
      else if (pciVal >= 51) category = "Clear";
      else if (pciVal >= 26) category = "Moderate";

      return {
        winner,
        cntA,
        cntB,
        pctA,
        pctB,
        pciVal,
        category
      };
    };

    const dichotomies = {
      E_vs_I: calcDichotomy(counts.E, counts.I, 'E', 'I'),
      S_vs_N: calcDichotomy(counts.S, counts.N, 'S', 'N'),
      T_vs_F: calcDichotomy(counts.T, counts.F, 'T', 'F'),
      J_vs_P: calcDichotomy(counts.J, counts.P, 'J', 'P')
    };

    // 4. Ambil Rincian Profil dari rubrik.json
    const tipeList = (rubrikData && rubrikData.tipe_kepribadian) ? rubrikData.tipe_kepribadian : {};
    const profileDetail = tipeList[mbtiCode] || {
      kode: mbtiCode,
      julukan: "Tipe Kepribadian Disesuaikan",
      kluster: "Umum",
      ringkasan_karakter: "Profil kepribadian berbasis dikotomi Jungian.",
      kekuatan_utama: [],
      kelemahan_utama: [],
      gaya_komunikasi: "-",
      gaya_relasi: "-",
      gaya_belajar_kerja: "-",
      lingkungan_ideal: "-",
      potensi_karir: [],
      saran_pengembangan: "-"
    };

    return {
      isInvalid: false,
      mbtiCode: mbtiCode,
      counts: counts,
      dichotomies: dichotomies,
      profileDetail: profileDetail
    };
  },

  /**
   * Mengirimkan Hasil Rekap KU4 ke Google Apps Script
   */
  async sendRekapToGAS(answers, userSession, evaluationResult) {
    if (evaluationResult.isInvalid) return;

    const c = evaluationResult.counts;
    const countStr = `E:${c.E}, I:${c.I}, S:${c.S}, N:${c.N}, T:${c.T}, F:${c.F}, J:${c.J}, P:${c.P}`;

    const now = new Date();
    const formattedTimestamp = now.getFullYear() + "-" +
      String(now.getMonth() + 1).padStart(2, '0') + "-" +
      String(now.getDate()).padStart(2, '0') + " " +
      String(now.getHours()).padStart(2, '0') + ":" +
      String(now.getMinutes()).padStart(2, '0') + ":" +
      String(now.getSeconds()).padStart(2, '0');

    const payload = {
      timestamp: formattedTimestamp,
      kode_akses: userSession.kode_akses || "-",
      nama_lengkap: userSession.nama_lengkap || "-",
      asal_instansi: userSession.asal_instansi || "Umum",
      daerah: `${userSession.asal_kabupaten || ''}, ${userSession.asal_provinsi || ''}`.replace(/^,\s*|\s*,\s*$/g, '') || "Umum",
      kode_modul: "KU4",
      skor_mentah: `Tipe MBTI: ${evaluationResult.mbtiCode} (${evaluationResult.profileDetail.julukan})`,
      standard_score: `Hitung Skor: (${countStr})`,
      kategori_hasil: `Kluster: ${evaluationResult.profileDetail.kluster}`,
      raw_answers: JSON.stringify(answers)
    };

    try {
      fetch(REKAP_GAS_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      console.log("Sistem Rekap KU4: Data PPI MBTI berhasil terkirim.");
    } catch (error) {
      console.error("Sistem Rekap Error KU4:", error);
    }
  }
};
