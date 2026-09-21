/* ==========================================================================
   PATS PORTAL - SCORING ENGINE KU1: APACA Grit & Growth Mindset Inventory (AGMI)
   Modul Penilaian & Automated Rekap System (Dual Output: Grit & Growth Mindset)
   ========================================================================== */

const REKAP_GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxMq4NjUbe0YCiYRrMXG4TvztEi8B7xpc04Te3JNNV7BBnQSCMFD1CgB0lRBUFDINWY/exec";

const KU1_Scoring = {
  /**
   * Menghitung Dual Output:
   * 1. Indeks Grit (0-100%) berdasarkan Dimensi 1 & 2
   * 2. Indeks Growth Mindset (0-100% & Skor 20-80) berdasarkan Dimensi 3 & 4
   * 3. Breakdown 4 Dimensi, Matriks Kombinasi Tipologi, dan Panduan Coaching.
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

    // Inisialisasi Struktur Skor Mentah per Dimensi
    const dimensionRaw = {
      "Consistency of Interest": 0,
      "Perseverance of Effort": 0,
      "Belief in Malleability": 0,
      "Response to Challenge": 0
    };

    // 2. Akumulasi Skor Favorable & Unfavorable (STS=1, TS=2, S=3, SS=4)
    if (soalData && soalData.questions) {
      soalData.questions.forEach(q => {
        const userVal = Number(answers[q.id]) || 1;
        const dimName = q.dimensi;

        // Favorable: 1->1, 2->2, 3->3, 4->4
        // Unfavorable: 1->4, 2->3, 3->2, 4->1
        let itemScore = q.is_favorable ? userVal : (5 - userVal);

        if (dimensionRaw[dimName] !== undefined) {
          dimensionRaw[dimName] += itemScore;
        }
      });
    }

    // 3. KALKULASI DUAL OUTPUT

    // --- A. SKALA GRIT (Dimensi 1 + Dimensi 2 | RS: 20 - 80) ---
    const rsGrit = dimensionRaw["Consistency of Interest"] + dimensionRaw["Perseverance of Effort"];
    const gritIndex = Math.round(((rsGrit - 20) / 60) * 100);
    const safeGritIndex = Math.max(0, Math.min(100, gritIndex));

    const gritNorms = (rubrikData && rubrikData.norma_kategorisasi_grit) ? rubrikData.norma_kategorisasi_grit : [];
    let matchedGritNorm = gritNorms.find(n => safeGritIndex >= 81 ? n.rentang_skor_persen === "81% - 100%" :
                                              safeGritIndex >= 61 ? n.rentang_skor_persen === "61% - 80%" :
                                              safeGritIndex >= 41 ? n.rentang_skor_persen === "41% - 60%" :
                                                                    n.rentang_skor_persen === "0% - 40%");

    if (!matchedGritNorm) {
      matchedGritNorm = { kategori: "Moderate Grit", label_status: "MODERATE GRIT", deskripsi_kondisi: "-" };
    }

    // --- B. SKALA GROWTH MINDSET (Dimensi 3 + Dimensi 4 | RS: 20 - 80) ---
    const rsMindset = dimensionRaw["Belief in Malleability"] + dimensionRaw["Response to Challenge"];
    const mindsetIndex = Math.round(((rsMindset - 20) / 60) * 100);
    const safeMindsetIndex = Math.max(0, Math.min(100, mindsetIndex));

    const mindsetNorms = (rubrikData && rubrikData.norma_kategorisasi_mindset) ? rubrikData.norma_kategorisasi_mindset : [];
    let matchedMindsetNorm = mindsetNorms.find(n => rsMindset >= 66 ? n.skor_mentah === "66 - 80" :
                                                    rsMindset >= 51 ? n.skor_mentah === "51 - 65" :
                                                    rsMindset >= 36 ? n.skor_mentah === "36 - 50" :
                                                                      n.skor_mentah === "20 - 35");

    if (!matchedMindsetNorm) {
      matchedMindsetNorm = { tipologi: "Leaning Growth", label_status: "LEANING GROWTH", deskripsi_kondisi: "-" };
    }

    // 4. Hitung Indeks Persentase 4 Dimensi Utama (10 Item per Dimensi | RS: 10 - 40)
    const dimensionScores = {};
    const dimensionRows = [];
    const rubrikDim = (rubrikData && rubrikData.rubrik_dimensi_utama) ? rubrikData.rubrik_dimensi_utama : {};

    for (const [dimKey, rs] of Object.entries(dimensionRaw)) {
      // Formula Persentase (%): ((RSdim - 10) / 30) * 100
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

    // 5. Deteksi Pola Matriks Tipologi Kombinasi
    const comboRules = (rubrikData && rubrikData.matriks_tipologi_kombinasi) ? rubrikData.matriks_tipologi_kombinasi : [];
    let matchedCombo = null;

    if (safeGritIndex >= 65 && rsMindset >= 51) {
      matchedCombo = comboRules.find(r => r.nama_pola.includes("Resilient Master"));
    } else if (safeGritIndex >= 65 && rsMindset <= 50) {
      matchedCombo = comboRules.find(r => r.nama_pola.includes("Fragile Perfectionist"));
    } else if (safeGritIndex <= 60 && rsMindset >= 51) {
      matchedCombo = comboRules.find(r => r.nama_pola.includes("Idle Idealist"));
    } else {
      matchedCombo = comboRules.find(r => r.nama_pola.includes("Defensive Stagnator"));
    }

    return {
      isInvalid: false,
      rsGrit: rsGrit,
      gritIndex: safeGritIndex,
      gritNorm: matchedGritNorm,
      rsMindset: rsMindset,
      mindsetIndex: safeMindsetIndex,
      mindsetNorm: matchedMindsetNorm,
      dimensionScores: dimensionScores,
      dimensionRows: dimensionRows,
      matchedCombo: matchedCombo
    };
  },

  /**
   * Mengirimkan Hasil Rekap KU1 ke Google Apps Script
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
      kode_modul: "KU1",
      skor_mentah: `Grit: ${evaluationResult.gritIndex}% (${evaluationResult.gritNorm.kategori}) | Growth: ${evaluationResult.mindsetIndex}% (${evaluationResult.mindsetNorm.tipologi})`,
      standard_score: `Profil Dimensi: (${dimStr})`,
      kategori_hasil: `Tipologi: ${evaluationResult.matchedCombo ? evaluationResult.matchedCombo.nama_pola : 'Kombinasi Standard'}`,
      raw_answers: JSON.stringify(answers)
    };

    try {
      fetch(REKAP_GAS_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      console.log("Sistem Rekap KU1: Data AGMI berhasil terkirim.");
    } catch (error) {
      console.error("Sistem Rekap Error KU1:", error);
    }
  }
};
