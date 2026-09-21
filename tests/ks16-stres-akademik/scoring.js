/* ==========================================================================
   PATS PORTAL - SCORING ENGINE KS16: APACA Academic Stress & Burnout Inventory (AASBI)
   Modul Penilaian & Automated Rekap System
   ========================================================================== */

const REKAP_GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxMq4NjUbe0YCiYRrMXG4TvztEi8B7xpc04Te3JNNV7BBnQSCMFD1CgB0lRBUFDINWY/exec";

const KS16_Scoring = {
  /**
   * Menghitung Skor Mentah (RS), Indeks Stres Akademik Global (%),
   * Skor 4 Dimensi Utama, Status Red Flag Krisis, dan Rekomendasi Intervensi.
   */
  evaluate(answers, soalData, rubrikData) {
    // 1. Validation & Careless Responding Check (40 item)
    const totalAnswered = Object.keys(answers).length;
    const uniqueAnswers = new Set(Object.values(answers));
    if (totalAnswered >= 40 && uniqueAnswers.size === 1) {
      return {
        isInvalid: true,
        message: "Flag: INVALID - CARELESS RESPONDING (Jawaban terdeteksi seragam pada seluruh 40 butir soal)."
      };
    }

    // Inisialisasi Struktur Skor Mentah
    const dimensionRaw = {
      "Academic Anxiety": 0,
      "Emotional Exhaustion": 0,
      "Burnout (Cynicism)": 0,
      "Pressure Source": 0
    };

    let totalRawScore = 0;

    // 2. Akumulasi Skor Favorable & Unfavorable
    if (soalData && soalData.questions) {
      soalData.questions.forEach(q => {
        const userVal = Number(answers[q.id]) || 1;
        const dimName = q.dimensi;

        // Favorable: STS=1, TS=2, S=3, SS=4
        // Unfavorable: STS=4, TS=3, S=2, SS=1
        let itemScore = q.is_favorable ? userVal : (5 - userVal);

        if (dimensionRaw[dimName] !== undefined) {
          dimensionRaw[dimName] += itemScore;
        }
        totalRawScore += itemScore;
      });
    }

    // 3. Hitung Indeks Stres Akademik Global (%) -> Range RS: 40 - 160 (Range = 120)
    // Formula: ((RStotal - 40) / 120) * 100
    const globalStressIndex = Math.round(((totalRawScore - 40) / 120) * 100);
    const safeGlobalIndex = Math.max(0, Math.min(100, globalStressIndex));

    // 4. Penentuan Kategori Global & RED FLAG
    const globalNorms = (rubrikData && rubrikData.norma_kategorisasi_global) ? rubrikData.norma_kategorisasi_global : [];
    
    let matchedGlobalNorm = globalNorms.find(n => safeGlobalIndex >= 76 ? n.rentang_skor_persen === "76% - 100%" :
                                                 safeGlobalIndex >= 51 ? n.rentang_skor_persen === "51% - 75%" :
                                                 safeGlobalIndex >= 26 ? n.rentang_skor_persen === "26% - 50%" :
                                                                         n.rentang_skor_persen === "0% - 25%");

    if (!matchedGlobalNorm) {
      matchedGlobalNorm = {
        kategori: "Stres Sedang",
        label_status: "STRES SEDANG",
        is_red_flag: false,
        deskripsi_kondisi: "-",
        dampak_akademik: "-",
        tindakan_lanjutan: "-"
      };
    }

    const isRedFlag = safeGlobalIndex > 75;

    // 5. Hitung Indeks Persentase per Dimensi (10 Item per Dimensi -> Range RS: 10 - 40)
    const dimensionScores = {};
    const dimensionRows = [];
    const rubrikDim = (rubrikData && rubrikData.rubrik_dimensi_utama) ? rubrikData.rubrik_dimensi_utama : {};

    for (const [dimKey, rs] of Object.entries(dimensionRaw)) {
      // Formula Indeks Dimensi (%): ((RSdim - 10) / 30) * 100
      const pct = Math.round(((rs - 10) / 30) * 100);
      const safePct = Math.max(0, Math.min(100, pct));
      dimensionScores[dimKey] = safePct;

      let levelKey = safePct >= 61 ? "Tinggi (61% - 100%)" :
                     safePct >= 41 ? "Sedang (41% - 60%)" : "Rendah (0% - 40%)";

      const dimInfo = rubrikDim[dimKey] || {};
      const dimAnalisis = (dimInfo.analisis_tingkat_skor && dimInfo.analisis_tingkat_skor[levelKey])
        ? dimInfo.analisis_tingkat_skor[levelKey]
        : {};

      dimensionRows.push({
        dimensi: dimKey,
        judul_dimensi: dimInfo.judul_dimensi || dimKey,
        rs: rs,
        percentage: safePct,
        level: levelKey.split(' ')[0],
        kondisi: dimAnalisis.kondisi || "-",
        interpretasi: dimAnalisis.interpretasi || "-",
        saran_pengembangan: dimAnalisis.saran_pengembangan || "-"
      });
    }

    return {
      isInvalid: false,
      totalRawScore: totalRawScore,
      globalStressIndex: safeGlobalIndex,
      globalNorm: matchedGlobalNorm,
      isRedFlag: isRedFlag,
      dimensionScores: dimensionScores,
      dimensionRows: dimensionRows
    };
  },

  /**
   * Mengirimkan Hasil Rekap KS16 ke Google Apps Script
   */
  async sendRekapToGAS(answers, userSession, evaluationResult) {
    if (evaluationResult.isInvalid) return;

    const dimStr = Object.entries(evaluationResult.dimensionScores)
      .map(([d, p]) => `${d}: ${p}%`)
      .join(", ");

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
      asal_instansi: userSession.asal_instansi || "Sekolah / Kampus",
      daerah: `${userSession.asal_kabupaten || ''}, ${userSession.asal_provinsi || ''}`.replace(/^,\s*|\s*,\s*$/g, '') || "Umum",
      kode_modul: "KS16",
      skor_mentah: `Indeks Stres: ${evaluationResult.globalStressIndex}% | RED FLAG: ${evaluationResult.isRedFlag ? 'YA' : 'TIDAK'}`,
      standard_score: `Profil Dimensi: (${dimStr})`,
      kategori_hasil: `${evaluationResult.globalNorm.kategori}`,
      raw_answers: JSON.stringify(answers)
    };

    try {
      fetch(REKAP_GAS_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      console.log("Sistem Rekap KS16: Data AASBI berhasil terkirim.");
    } catch (error) {
      console.error("Sistem Rekap Error KS16:", error);
    }
  }
};
