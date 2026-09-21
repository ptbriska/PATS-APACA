/* ==========================================================================
   PATS PORTAL - SCORING ENGINE KS13: APACA Learning Affective & Motivational Profile (LAMP)
   Modul Penilaian & Automated Rekap System
   ========================================================================== */

const REKAP_GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxMq4NjUbe0YCiYRrMXG4TvztEi8B7xpc04Te3JNNV7BBnQSCMFD1CgB0lRBUFDINWY/exec";

const KS13_Scoring = {
  /**
   * Menghitung Skor Mentah (RS), Indeks Spektrum Motivasi, Indeks Dimensi Afektif Utama,
   * Pemeringkatan Top/Lowest Driver Motivasi, Matriks Kombinasi, dan Rekomendasi Intervensi.
   */
  evaluate(answers, soalData, rubrikData) {
    // 1. Invariance Response Check (Pengerjaan 96 item)
    const totalAnswered = Object.keys(answers).length;
    const uniqueAnswers = new Set(Object.values(answers));
    if (totalAnswered >= 96 && uniqueAnswers.size === 1) {
      return {
        isInvalid: true,
        message: "Flag: INVALID - CARELESS RESPONDING (Jawaban terdeteksi seragam pada seluruh 96 butir soal)."
      };
    }

    // Inisialisasi struktur skor mentah
    const motivationRaw = {
      "Intrinsic": 0,
      "Identified": 0,
      "Introjected": 0,
      "External": 0,
      "Social": 0,
      "Achievement": 0
    };

    const affectiveRaw = {
      "Self-Efficacy": 0,
      "Interest & Curiosity": 0,
      "Persistence & Grit": 0,
      "Emotional Regulation": 0,
      "Growth Mindset": 0
    };

    const itemCounts = {
      "Intrinsic": 0, "Identified": 0, "Introjected": 0, "External": 0, "Social": 0, "Achievement": 0,
      "Self-Efficacy": 0, "Interest & Curiosity": 0, "Persistence & Grit": 0, "Emotional Regulation": 0, "Growth Mindset": 0
    };

    // 2. Akumulasi Skor Mentah berdasarkan soal.json
    if (soalData && soalData.questions) {
      soalData.questions.forEach(q => {
        const val = Number(answers[q.id]) || 1;

        if (q.dimensi === "Motivational Spectrum") {
          const sub = q.sub_dimensi;
          if (motivationRaw[sub] !== undefined) {
            motivationRaw[sub] += val;
            itemCounts[sub] += 1;
          }
        } else if (affectiveRaw[q.dimensi] !== undefined) {
          affectiveRaw[q.dimensi] += val;
          itemCounts[q.dimensi] += 1;
        }
      });
    }

    // 3. Hitung Persentase Spektrum Motivasi (4 Item per Sub-tipe: min 4, max 16)
    const motivationScores = {};
    for (const [subType, rs] of Object.entries(motivationRaw)) {
      const minVal = 4;
      const maxVal = 16;
      const pct = Math.round(((rs - minVal) / (maxVal - minVal)) * 100);
      motivationScores[subType] = Math.max(0, Math.min(100, pct));
    }

    // 4. Pemeringkatan Driver Motivasi (Top Driver 1, Top Driver 2, Lowest Driver)
    const sortedMotivations = Object.entries(motivationScores)
      .map(([type, pct]) => ({ type, pct }))
      .sort((a, b) => b.pct - a.pct);

    const topDriver1 = sortedMotivations[0];
    const topDriver2 = sortedMotivations[1];
    const lowestDriver = sortedMotivations[sortedMotivations.length - 1];

    // 5. Hitung Persentase Dimensi Afektif Utama
    const affectiveScores = {};
    const affectiveRows = [];
    let totalAffectiveSum = 0;

    const affRubrik = (rubrikData && rubrikData.rubrik_dimensi_afektif) ? rubrikData.rubrik_dimensi_afektif : {};

    for (const [dimKey, rs] of Object.entries(affectiveRaw)) {
      const count = itemCounts[dimKey] || (dimKey === "Growth Mindset" ? 8 : 16);
      const minVal = count * 1;
      const maxVal = count * 4;
      const range = maxVal - minVal;

      const pct = range > 0 ? Math.round(((rs - minVal) / range) * 100) : 0;
      const safePct = Math.max(0, Math.min(100, pct));

      affectiveScores[dimKey] = safePct;
      totalAffectiveSum += safePct;

      let levelText = "Tinggi (61% - 100%)";
      let levelKey = "Tinggi (61% - 100%)";
      if (safePct <= 40) {
        levelText = "Rendah (0% - 40%)";
        levelKey = "Rendah (0% - 40%)";
      } else if (safePct <= 60) {
        levelText = "Sedang (41% - 60%)";
        levelKey = "Sedang (41% - 60%)";
      }

      const dimInfo = affRubrik[dimKey] || {};
      const dimAnalisis = (dimInfo.analisis_tingkat_skor && dimInfo.analisis_tingkat_skor[levelKey])
        ? dimInfo.analisis_tingkat_skor[levelKey]
        : {};

      affectiveRows.push({
        dimensi: dimKey,
        judul_dimensi: dimInfo.judul_dimensi || dimKey,
        rs: rs,
        percentage: safePct,
        level: levelText.split(' ')[0],
        kondisi: dimAnalisis.kondisi || "-",
        interpretasi: dimAnalisis.interpretasi || "-",
        dampak_akademik: dimAnalisis.dampak_akademik || "-",
        saran_pengembangan: dimAnalisis.saran_pengembangan || "-"
      });
    }

    // 6. Hitung Indeks Ketahanan Akademik Global (Academic Resilience Index)
    const overallIndex = Math.round(totalAffectiveSum / Object.keys(affectiveRaw).length);

    // 7. Norma Global
    const globalNorms = (rubrikData && rubrikData.norma_kategorisasi_global) 
      ? rubrikData.norma_kategorisasi_global 
      : [];

    let matchedNorm = {
      kategori: "Moderat (Vulnerable)",
      label_status: "MODERAT & RENTAN",
      deskripsi_kondisi: "Cukup termotivasi untuk belajar, tetapi rentan mengalami penurunan daya tahan saat tekanan meningkat.",
      dampak_akademik: "Semangat belajar fluktuatif dan mudah cemas saat menghadapi tugas sulit.",
      tindakan_lanjutan: "Berikan pendampingan emosional yang konsisten dan latih reframing kegagalan."
    };

    if (overallIndex >= 81) {
      matchedNorm = globalNorms.find(n => n.rentang_skor_persen === "81% - 100%") || matchedNorm;
    } else if (overallIndex >= 61) {
      matchedNorm = globalNorms.find(n => n.rentang_skor_persen === "61% - 80%") || matchedNorm;
    } else if (overallIndex >= 41) {
      matchedNorm = globalNorms.find(n => n.rentang_skor_persen === "41% - 60%") || matchedNorm;
    } else if (overallIndex >= 21) {
      matchedNorm = globalNorms.find(n => n.rentang_skor_persen === "21% - 40%") || matchedNorm;
    } else {
      matchedNorm = globalNorms.find(n => n.rentang_skor_persen === "0% - 20%") || matchedNorm;
    }

    // 8. Deteksi Pola Kombinasi Afektif
    const comboRules = (rubrikData && rubrikData.analisis_kombinasi_afektif) 
      ? rubrikData.analisis_kombinasi_afektif 
      : [];
    const detectedCombinations = [];

    const pInterest = affectiveScores["Interest & Curiosity"] || 0;
    const pEmotional = affectiveScores["Emotional Regulation"] || 0;
    const pGrowth = affectiveScores["Growth Mindset"] || 0;
    const pSelfEfficacy = affectiveScores["Self-Efficacy"] || 0;
    const pIdentified = motivationScores["Identified"] || 0;
    const pGrit = affectiveScores["Persistence & Grit"] || 0;

    // Pola 1: High Curiosity + Low Emotional Regulation
    if (pInterest >= 65 && pEmotional <= 40) {
      const c = comboRules.find(r => r.nama_pola.includes("High Curiosity"));
      if (c) detectedCombinations.push(c);
    }
    // Pola 2: High Growth Mindset + Low Self-Efficacy
    if (pGrowth >= 65 && pSelfEfficacy <= 40) {
      const c = comboRules.find(r => r.nama_pola.includes("High Growth Mindset"));
      if (c) detectedCombinations.push(c);
    }
    // Pola 3: High Value-Driven + Low Grit
    if (pIdentified >= 65 && pGrit <= 40) {
      const c = comboRules.find(r => r.nama_pola.includes("High Value-Driven"));
      if (c) detectedCombinations.push(c);
    }

    return {
      isInvalid: false,
      overallIndex: overallIndex,
      globalNorm: matchedNorm,
      motivationScores: motivationScores,
      rankedMotivations: {
        top1: topDriver1,
        top2: topDriver2,
        lowest: lowestDriver
      },
      affectiveScores: affectiveScores,
      affectiveRows: affectiveRows,
      detectedCombinations: detectedCombinations
    };
  },

  /**
   * Menyusun Payload dan Mengirimkan Hasil Rekap ke Google Sheets via GAS
   */
  async sendRekapToGAS(answers, userSession, evaluationResult) {
    if (evaluationResult.isInvalid) return;

    const motStr = Object.entries(evaluationResult.motivationScores)
      .map(([m, p]) => `${m}: ${p}%`)
      .join(", ");

    const affStr = Object.entries(evaluationResult.affectiveScores)
      .map(([a, p]) => `${a}: ${p}%`)
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
      kode_modul: "KS13",
      skor_mentah: `Ketahanan Indeks: ${evaluationResult.overallIndex}% | Top Driver: ${evaluationResult.rankedMotivations.top1.type}`,
      standard_score: `Motivasi: (${motStr}) | Afektif: (${affStr})`,
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
      console.log("Sistem Rekap KS13: Data pengerjaan LAMP berhasil terkirim.");
    } catch (error) {
      console.error("Sistem Rekap Error KS13:", error);
    }
  }
};
