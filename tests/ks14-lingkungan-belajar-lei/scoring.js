/* ==========================================================================
   PATS PORTAL - SCORING ENGINE KS14: APACA Learning Environment Inventory (LEI)
   Modul Penilaian & Automated Rekap System
   ========================================================================== */

const REKAP_GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxMq4NjUbe0YCiYRrMXG4TvztEi8B7xpc04Te3JNNV7BBnQSCMFD1CgB0lRBUFDINWY/exec";

const KS14_Scoring = {
  /**
   * Menghitung Indeks Persentase 5 Dimensi Utama, Sub-Dimensi,
   * Matriks Triggers (Optimal vs Distraksi), Pola Kombinasi Ekosistem,
   * serta Kesiapan Pembelajaran Jarak Jauh (Remote Learning Readiness).
   */
  evaluate(answers, soalData, rubrikData) {
    // 1. Invariance Response Check (90 item)
    const totalAnswered = Object.keys(answers).length;
    const uniqueAnswers = new Set(Object.values(answers));
    if (totalAnswered >= 90 && uniqueAnswers.size === 1) {
      return {
        isInvalid: true,
        message: "Flag: INVALID - CARELESS RESPONDING (Jawaban terdeteksi seragam pada seluruh 90 butir soal)."
      };
    }

    // Inisialisasi struktur penampung skor mentah
    const mainDimensionsRaw = {
      "Physical Environment": 0,
      "Social Environment": 0,
      "Digital Environment": 0,
      "Temporal Environment": 0,
      "Structure": 0
    };

    const subDimensionsRaw = {};
    const itemCounts = {
      "Physical Environment": 0,
      "Social Environment": 0,
      "Digital Environment": 0,
      "Temporal Environment": 0,
      "Structure": 0
    };
    const subItemCounts = {};

    // 2. Akumulasi Skor Mentah berdasarkan soal.json
    if (soalData && soalData.questions) {
      soalData.questions.forEach(q => {
        const val = Number(answers[q.id]) || 1;
        const mainDim = q.dimensi;
        const subDim = q.sub_dimensi;

        // Abaikan item khusus validasi untuk kalkulasi dimensi utama
        if (mainDim !== "Validation") {
          if (mainDimensionsRaw[mainDim] !== undefined) {
            mainDimensionsRaw[mainDim] += val;
            itemCounts[mainDim] += 1;
          }

          if (subDim) {
            if (!subDimensionsRaw[subDim]) {
              subDimensionsRaw[subDim] = 0;
              subItemCounts[subDim] = 0;
            }
            subDimensionsRaw[subDim] += val;
            subItemCounts[subDim] += 1;
          }
        }
      });
    }

    // 3. Hitung Persentase Indeks 5 Dimensi Utama
    const mainScores = {};
    const mainRows = [];
    const globalNorms = (rubrikData && rubrikData.norma_kategorisasi_global) ? rubrikData.norma_kategorisasi_global : [];

    for (const [dimKey, rs] of Object.entries(mainDimensionsRaw)) {
      const count = itemCounts[dimKey] || 1;
      const minVal = count * 1;
      const maxVal = count * 4;
      const range = maxVal - minVal;

      const pct = range > 0 ? Math.round(((rs - minVal) / range) * 100) : 0;
      const safePct = Math.max(0, Math.min(100, pct));
      mainScores[dimKey] = safePct;

      let normMatch = globalNorms.find(n => safePct >= 81 ? n.rentang_skor_persen === "81% - 100%" :
                                            safePct >= 61 ? n.rentang_skor_persen === "61% - 80%" :
                                            safePct >= 41 ? n.rentang_skor_persen === "41% - 60%" :
                                            safePct >= 21 ? n.rentang_skor_persen === "21% - 40%" :
                                                            n.rentang_skor_persen === "0% - 20%");

      if (!normMatch) {
        normMatch = { kategori: "Netral", label_status: "NETRAL", deskripsi_kondisi: "-" };
      }

      mainRows.push({
        dimensi: dimKey,
        rs: rs,
        percentage: safePct,
        kategori: normMatch.kategori,
        label_status: normMatch.label_status,
        deskripsi: normMatch.deskripsi_kondisi,
        dampak: normMatch.dampak_akademik
      });
    }

    // 4. Hitung Persentase Indeks Sub-Dimensi
    const subScores = {};
    for (const [subKey, rs] of Object.entries(subDimensionsRaw)) {
      const count = subItemCounts[subKey] || 3;
      const minVal = count * 1;
      const maxVal = count * 4;
      const range = maxVal - minVal;

      const pct = range > 0 ? Math.round(((rs - minVal) / range) * 100) : 0;
      subScores[subKey] = Math.max(0, Math.min(100, pct));
    }

    // 5. Pemetaan Optimal Triggers vs Distracting Triggers Matrix
    const optimalTriggers = [];
    const distractingTriggers = [];

    for (const [subKey, pct] of Object.entries(subScores)) {
      if (pct >= 61) {
        optimalTriggers.push({ name: subKey, score: pct });
      } else if (pct <= 40) {
        distractingTriggers.push({ name: subKey, score: pct });
      }
    }

    optimalTriggers.sort((a, b) => b.score - a.score);
    distractingTriggers.sort((a, b) => a.score - b.score);

    // 6. Deteksi Pola Kombinasi Ekosistem Belajar
    const comboRules = (rubrikData && rubrikData.matriks_kondisi_ekstrem_dan_kombinasi) ? rubrikData.matriks_kondisi_ekstrem_dan_kombinasi : [];
    const detectedCombinations = [];

    const soundScore = subScores["Suara"] || 50;
    const solitaryScore = subScores["Sendiri"] || 50;
    const digitalScore = mainScores["Digital Environment"] || 50;
    const pairGroupScore = Math.max(subScores["Berpasangan"] || 0, subScores["Kelompok Kecil"] || 0);
    const nightScore = subScores["Malam Hari"] || 50;
    const deadlineScore = subScores["Deadline-driven"] || 50;

    // Pola 1: Quiet Solitary Digital Learner
    if (soundScore <= 40 && solitaryScore >= 70 && digitalScore >= 65) {
      const c = comboRules.find(r => r.nama_pola.includes("Quiet Solitary Digital"));
      if (c) detectedCombinations.push(c);
    }

    // Pola 2: Collaborative Interactive Learner
    if (pairGroupScore >= 70 && soundScore > 40) {
      const c = comboRules.find(r => r.nama_pola.includes("Collaborative Interactive"));
      if (c) detectedCombinations.push(c);
    }

    // Pola 3: Deadline-Driven Night-Owl
    if (nightScore >= 70 && deadlineScore >= 70) {
      const c = comboRules.find(r => r.nama_pola.includes("Deadline-Driven Night-Owl"));
      if (c) detectedCombinations.push(c);
    }

    // 7. Remote Learning Readiness Check
    const selfPacedScore = subScores["Self-paced"] || 0;
    const isRemoteReady = digitalScore >= 65 && selfPacedScore >= 65;

    return {
      isInvalid: false,
      mainScores: mainScores,
      mainRows: mainRows,
      subScores: subScores,
      optimalTriggers: optimalTriggers,
      distractingTriggers: distractingTriggers,
      detectedCombinations: detectedCombinations,
      remoteLearning: {
        isReady: isRemoteReady,
        digitalScore: digitalScore,
        selfPacedScore: selfPacedScore
      }
    };
  },

  /**
   * Mengirimkan Hasil Rekap KS14 ke Google Apps Script
   */
  async sendRekapToGAS(answers, userSession, evaluationResult) {
    if (evaluationResult.isInvalid) return;

    const mainStr = Object.entries(evaluationResult.mainScores)
      .map(([m, p]) => `${m}: ${p}%`)
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
      kode_modul: "KS14",
      skor_mentah: `Remote Ready: ${evaluationResult.remoteLearning.isReady ? 'YA' : 'TIDAK'}`,
      standard_score: `Profil Dimensi: (${mainStr})`,
      kategori_hasil: `Triggers Utama: ${evaluationResult.optimalTriggers.slice(0, 2).map(t => t.name).join(", ") || 'Fleksibel'}`,
      raw_answers: JSON.stringify(answers)
    };

    try {
      fetch(REKAP_GAS_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      console.log("Sistem Rekap KS14: Data LEI berhasil terkirim.");
    } catch (error) {
      console.error("Sistem Rekap Error KS14:", error);
    }
  }
};
