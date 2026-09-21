/* ==========================================================================
   PATS PORTAL - SCORING ENGINE KU5: APACA General Behavior Preference Indicator (GBPI - DISC)
   Modul Penilaian 24 Block Forced-Choice (Most & Least), Kalkulasi 3 Grafik DISC, & Profiling
   ========================================================================== */

const REKAP_GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxMq4NjUbe0YCiYRrMXG4TvztEi8B7xpc04Te3JNNV7BBnQSCMFD1CgB0lRBUFDINWY/exec";

const KU5_Scoring = {
  /**
   * Menghitung:
   * 1. Skor Mentah MOST (M_D, M_I, M_S, M_C) -> Rentang 0-24
   * 2. Skor Mentah LEAST (L_D, L_I, L_S, L_C) -> Rentang 0-24
   * 3. Skor Perbedaan / Change (Diff_D, Diff_I, Diff_S, Diff_C = M - L) -> Rentang -24 s/d +24
   * 4. Pengenalan Pola Kombinasi DISC (High D, High I, High S, High C, DI/ID, DS/SD, DC/CD, IS/SI, IC/CI, SC/CS)
   * 5. Penarikan Rincian Diagnostik dari rubrik.json
   */
  evaluate(answers, soalData, rubrikData) {
    if (!soalData || !soalData.questions) {
      return { isInvalid: true, message: "Data soal KU5 tidak ditemukan." };
    }

    const mostScores = { D: 0, I: 0, S: 0, C: 0 };
    const leastScores = { D: 0, I: 0, S: 0, C: 0 };

    const questionMap = new Map(soalData.questions.map(q => [q.id, q]));
    let invalidProtocolTriggered = false;

    // 1. Iterasi 24 Block Soal
    for (let i = 1; i <= 24; i++) {
      const qObj = questionMap.get(i);
      if (!qObj) continue;

      // Dukung berbagai variasi struktur penyimpanan jawaban
      let mostCode = null;
      let leastCode = null;

      if (answers[i]) {
        mostCode = answers[i].most || answers[i].M;
        leastCode = answers[i].least || answers[i].L;
      } else {
        mostCode = answers[`${i}_M`] || answers[`${i}_most`];
        leastCode = answers[`${i}_L`] || answers[`${i}_least`];
      }

      // Validasi protokol: Opsi Most dan Least tidak boleh sama di block yang sama
      if (mostCode && leastCode && mostCode === leastCode) {
        invalidProtocolTriggered = true;
      }

      // Akumulasi Poin MOST
      if (mostCode && qObj.options) {
        const optM = qObj.options.find(o => o.code === mostCode);
        if (optM && optM.dimension) {
          mostScores[optM.dimension] = (mostScores[optM.dimension] || 0) + 1;
        }
      }

      // Akumulasi Poin LEAST
      if (leastCode && qObj.options) {
        const optL = qObj.options.find(o => o.code === leastCode);
        if (optL && optL.dimension) {
          leastScores[optL.dimension] = (leastScores[optL.dimension] || 0) + 1;
        }
      }
    }

    if (invalidProtocolTriggered) {
      return {
        isInvalid: true,
        message: "Flag: INVALID RESPONSE PROTOCOL (Terdeteksi pemilihan opsi MOST dan LEAST pada pilihan baris yang sama)."
      };
    }

    // 2. Kalkulasi Skor Perbedaan / Mirror Self (Difference = Most - Least)
    const diffScores = {
      D: mostScores.D - leastScores.D,
      I: mostScores.I - leastScores.I,
      S: mostScores.S - leastScores.S,
      C: mostScores.C - leastScores.C
    };

    // 3. Penentuan Pola Profil DISC
    const sortedDiff = Object.entries(diffScores)
      .map(([dim, val]) => ({ dim, val }))
      .sort((a, b) => b.val - a.val);

    const top1 = sortedDiff[0];
    const top2 = sortedDiff[1];

    let patternKey = "High_" + top1.dim;

    // Cek apakah membentuk pola kombinasi 2 dimensi dominan
    const diffGap = top1.val - top2.val;
    if (top2.val >= 2 && diffGap <= 5) {
      const pair1 = `${top1.dim}${top2.dim}`;
      const pair2 = `${top2.dim}${top1.dim}`;

      const validPairs = ["DI_ID", "DS_SD", "DC_CD", "IS_SI", "IC_CI", "SC_CS"];
      const matched = validPairs.find(p => p.includes(top1.dim) && p.includes(top2.dim));
      if (matched) {
        patternKey = matched;
      }
    }

    // 4. Ambil Rincian Profil dari rubrik.json
    const polaList = (rubrikData && rubrikData.pola_kombinasi_disc) ? rubrikData.pola_kombinasi_disc : {};
    const profileDetail = polaList[patternKey] || polaList["High_" + top1.dim] || {
      kode_pola: patternKey,
      nama_pola: "Profil DISC Adaptif",
      ringkasan_perilaku: "Profil perilaku kerja dan interaksi harian.",
      kekuatan_utama: [],
      kelemahan_utama: [],
      gaya_komunikasi: "-",
      gaya_relasi: "-",
      gaya_belajar_kerja: "-",
      lingkungan_ideal: "-",
      pemicu_motivasi: "-",
      pemicu_stres: "-",
      potensi_karir: [],
      saran_pengembangan: "-"
    };

    return {
      isInvalid: false,
      patternKey: patternKey,
      rawScores: {
        most: mostScores,
        least: leastScores,
        diff: diffScores
      },
      sortedDiff: sortedDiff,
      profileDetail: profileDetail
    };
  },

  /**
   * Mengirimkan Hasil Rekap KU5 ke Google Apps Script
   */
  async sendRekapToGAS(answers, userSession, evaluationResult) {
    if (evaluationResult.isInvalid) return;

    const m = evaluationResult.rawScores.most;
    const l = evaluationResult.rawScores.least;
    const d = evaluationResult.rawScores.diff;

    const mostStr = `M(D:${m.D}, I:${m.I}, S:${m.S}, C:${m.C})`;
    const leastStr = `L(D:${l.D}, I:${l.I}, S:${l.S}, C:${l.C})`;
    const diffStr = `Diff(D:${d.D}, I:${d.I}, S:${d.S}, C:${d.C})`;

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
      kode_modul: "KU5",
      skor_mentah: `Pola DISC: ${evaluationResult.patternKey} (${evaluationResult.profileDetail.nama_pola})`,
      standard_score: `${mostStr} | ${leastStr} | ${diffStr}`,
      kategori_hasil: `Profil: ${evaluationResult.profileDetail.nama_pola}`,
      raw_answers: JSON.stringify(answers)
    };

    try {
      fetch(REKAP_GAS_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      console.log("Sistem Rekap KU5: Data DISC berhasil terkirim.");
    } catch (error) {
      console.error("Sistem Rekap Error KU5:", error);
    }
  }
};
