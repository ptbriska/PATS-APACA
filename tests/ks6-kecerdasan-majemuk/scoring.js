/* ==========================================================================
   PATS PORTAL - SCORING ENGINE KS6: Multiple Intelligence Inventory (AMII)
   ========================================================================== */

const REKAP_GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxMq4NjUbe0YCiYRrMXG4TvztEi8B7xpc04Te3JNNV7BBnQSCMFD1CgB0lRBUFDINWY/exec";

const KS6_Scoring = {
  /**
   * Menghitung Skor Mentah (RS), Konversi T-Score, dan Rekomendasi Karir Kombinasi
   */
  evaluate(answers, soalData, rubrikData) {
    const rawScores = {};

    // 1. Invariance Response Check (Flag: Invalid Response pada 80 item)
    const totalAnswered = Object.keys(answers).length;
    const uniqueAnswers = new Set(Object.values(answers));
    if (totalAnswered >= 80 && uniqueAnswers.size === 1) {
      return { 
        isInvalid: true, 
        message: "Flag: Invalid Response. Jawaban terdeteksi seragam pada seluruh 80 butir soal." 
      };
    }

    // 2. Kalkulasi Skor Mentah (RS) dengan Bobot Favorable & Unfavorable
    if (soalData && soalData.questions) {
      soalData.questions.forEach(q => {
        const ansVal = Number(answers[q.id]) || 1;
        let finalItemScore = ansVal;

        if (q.type === "Unfavorable") {
          finalItemScore = 5 - ansVal; // Reverse scoring (STS=4, TS=3, S=2, SS=1)
        }

        if (!rawScores[q.kategori]) {
          rawScores[q.kategori] = 0;
        }
        
        rawScores[q.kategori] += finalItemScore;
      });
    }

    // 3. Konversi Skor Mentah ke T-Score
    // Formula T-Score = 50 + 10 * ((RS - Mu) / Sigma)
    // Parameter Standar Psikometri untuk 10 Item Likert 4 Opsi: Mu = 25, Sigma = 5
    const MU = 25;
    const SIGMA = 5;
    
    const dimensionDetails = [];
    const rubrikDesc = rubrikData?.rubrik_deskripsi_dimensi || {};
    const normaList = rubrikData?.norma_kategorisasi_global || [];

    for (const [kategori, rs] of Object.entries(rawScores)) {
      // Kalkulasi T-Score
      let tScore = Math.round(50 + 10 * ((rs - MU) / SIGMA));
      // Batasi rentang T-Score teoritis wajar (20 - 80)
      tScore = Math.max(20, Math.min(80, tScore));

      // Kategorisasi Berdasarkan Norma KS6
      let levelObj = normaList.find(n => n.kategori === "Sangat Rendah") || { kategori: "Sangat Rendah", label_status: "DORMANT" };
      if (tScore >= 65) {
        levelObj = normaList.find(n => n.kategori === "Sangat Tinggi") || levelObj;
      } else if (tScore >= 55) {
        levelObj = normaList.find(n => n.kategori === "Tinggi") || levelObj;
      } else if (tScore >= 45) {
        levelObj = normaList.find(n => n.kategori === "Sedang") || levelObj;
      } else if (tScore >= 35) {
        levelObj = normaList.find(n => n.kategori === "Rendah") || levelObj;
      }

      // Ambil detail narasi dari rubrik
      const dimInfo = rubrikDesc[kategori] || {};
      
      dimensionDetails.push({
        kategori: kategori,
        rs: rs,
        tScore: tScore,
        level: levelObj.kategori,
        label_status: levelObj.label_status,
        judul_dimensi: dimInfo.judul_dimensi || kategori,
        deskripsi_umum: dimInfo.deskripsi_umum || "-",
        rekomendasi_pengembangan: dimInfo.rekomendasi_pengembangan || "-"
      });
    }

    // 4. Sorting Dimensi (Highest T-Score to Lowest)
    const sortedDimensions = [...dimensionDetails].sort((a, b) => b.tScore - a.tScore);
    const top1 = sortedDimensions[0].kategori;
    const top2 = sortedDimensions[1].kategori;
    const comboKey1 = `${top1} + ${top2}`;
    const comboKey2 = `${top2} + ${top1}`; // Reverse check

    // 5. Ekstraksi Rekomendasi Karir Kombinasi (Top 2)
    const careerList = rubrikData?.pedoman_rekomendasi_karir || [];
    let matchedCareer = careerList.find(c => c.kombinasi_dominan === comboKey1 || c.kombinasi_dominan === comboKey2);

    // Fallback dinamis jika kombinasi tidak ada di database manual
    if (!matchedCareer) {
      matchedCareer = {
        combo: `${top1} + ${top2}`,
        studi: `Program studi yang mengakomodasi kecerdasan ${top1} dan terapan ${top2}.`,
        profesi: `Bidang profesi lintas disiplin antara spesialisasi ${top1} dan ${top2}.`,
        analisis: `Kombinasi unik antara kapasitas ${top1} dengan kapabilitas pendukung dari ${top2}. Profil ini menghasilkan pendekatan penyelesaian masalah yang hibrida dan kreatif.`
      };
    } else {
      matchedCareer.combo = matchedCareer.kombinasi_dominan;
      matchedCareer.studi = matchedCareer.rekomendasi_program_studi;
      matchedCareer.profesi = matchedCareer.rekomendasi_profesi;
      matchedCareer.analisis = matchedCareer.analisis_potensi;
    }

    return {
      isInvalid: false,
      rawScores: rawScores,
      dimensionDetails: dimensionDetails,
      sortedDimensions: sortedDimensions,
      careerRecommendation: matchedCareer
    };
  },

  /**
   * Mengirimkan Hasil Rekap ke Google Sheets
   */
  async sendRekapToGAS(answers, userSession, evaluationResult) {
    if (evaluationResult.isInvalid) return;

    const top1 = evaluationResult.sortedDimensions[0];
    const top2 = evaluationResult.sortedDimensions[1];
    const topSummary = `Top 1: ${top1.kategori} (T=${top1.tScore}) | Top 2: ${top2.kategori} (T=${top2.tScore})`;

    const tScoreStr = evaluationResult.dimensionDetails
      .map(d => `${d.kategori}: ${d.tScore}`)
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
      asal_instansi: userSession.asal_instansi || "Umum",
      daerah: "Umum",
      kode_modul: "KS6",
      skor_mentah: "Raw Score tersimpan di log",
      standard_score: tScoreStr,
      kategori_hasil: topSummary,
      raw_answers: JSON.stringify(answers)
    };

    try {
      fetch(REKAP_GAS_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      console.log("Sistem Rekap: Data KS6 (AMII) berhasil terkirim.");
    } catch (error) {
      console.error("Sistem Rekap Error KS6:", error);
    }
  }
};
