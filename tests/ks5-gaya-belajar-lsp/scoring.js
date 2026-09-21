/* ==========================================================================
   PATS PORTAL - SCORING ENGINE KS5: Learning Style Preference Test (LSP)
   ========================================================================== */

const REKAP_GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxMq4NjUbe0YCiYRrMXG4TvztEi8B7xpc04Te3JNNV7BBnQSCMFD1CgB0lRBUFDINWY/exec";

const KS5_Scoring = {
  /**
   * Menghitung Skor Mentah (RS), Indeks Persentase, dan Kategorisasi KS5
   */
  evaluate(answers, soalData, rubrikData) {
    const rawScores = {};
    const itemCounts = {};

    // 1. Invariance & Rapid Response Check (Batas wajar: Jawaban bervariasi)
    const totalAnswered = Object.keys(answers).length;
    const uniqueAnswers = new Set(Object.values(answers));
    if (totalAnswered >= 80 && uniqueAnswers.size === 1) {
      return { 
        isInvalid: true, 
        message: "INVALID - INATTENTIVE RESPONDING: Jawaban terdeteksi seragam pada seluruh butir soal (80 item)." 
      };
    }

    // 2. Hitung Skor Mentah berdasarkan Kategori Soal
    if (soalData && soalData.questions) {
      soalData.questions.forEach(q => {
        // Validasi Penguat (Item 73-80) tidak dihitung dalam persentase dominasi utama
        if (q.kategori.includes("Validasi")) return;

        const ansVal = Number(answers[q.id]) || 1;
        let finalItemScore = ansVal;

        if (q.type === "Unfavorable") {
          finalItemScore = 5 - ansVal;
        }

        if (!rawScores[q.kategori]) {
          rawScores[q.kategori] = 0;
          itemCounts[q.kategori] = 0;
        }
        
        rawScores[q.kategori] += finalItemScore;
        itemCounts[q.kategori] += 1;
      });
    }

    // 3. Kalkulasi Persentase Dominasi (Psub)
    // Formula KS5: Psub(%) = (RSsub - RSmin) / (RSmax - RSmin) * 100
    const percentages = {};
    const levels = {};
    const detailedDiagnostics = [];
    
    // Kelompokkan untuk mencari top dominant di setiap dimensi besar
    const groupedScores = {
      "Modalitas": [],
      "Pemrosesan": [],
      "Lingkungan": [],
      "Interaksi": []
    };

    const rubrikDesc = rubrikData?.rubrik_deskripsi || {};
    const normaList = rubrikData?.norma_kategorisasi_global || [];

    for (const [kategori, rs] of Object.entries(rawScores)) {
      const count = itemCounts[kategori];
      const rsMin = count * 1;
      const rsMax = count * 4;
      const range = rsMax - rsMin;

      const pct = Math.round(((rs - rsMin) / range) * 100);
      percentages[kategori] = pct;

      // Kategorisasi Berdasarkan Norma KS5
      let levelObj = normaList.find(n => n.rentang_skor_persen === "0% - 25%") || { kategori: "Sangat Rendah", label_status: "ZONA FRIKSI" };
      if (pct >= 76) {
        levelObj = normaList.find(n => n.rentang_skor_persen === "76% - 100%") || levelObj;
      } else if (pct >= 51) {
        levelObj = normaList.find(n => n.rentang_skor_persen === "51% - 75%") || levelObj;
      } else if (pct >= 26) {
        levelObj = normaList.find(n => n.rentang_skor_persen === "26% - 50%") || levelObj;
      }
      
      levels[kategori] = levelObj.kategori;

      // Masukkan ke grup untuk pencarian "Top Dominant" di Ringkasan Eksekutif
      const mainDim = kategori.split(" - ")[0];
      if (groupedScores[mainDim]) {
        groupedScores[mainDim].push({ name: kategori, score: pct, level: levelObj.kategori });
      }

      // Ambil detail narasi dari rubrik
      const dimInfo = rubrikDesc[kategori] || {};
      detailedDiagnostics.push({
        kategori: kategori,
        judul_dimensi: dimInfo.judul_dimensi || kategori,
        score: pct,
        level: levelObj.kategori,
        label_status: levelObj.label_status,
        deskripsi_umum: dimInfo.deskripsi_umum || "-",
        rekomendasi_strategi: dimInfo.rekomendasi_strategi || "-"
      });
    }

    // Sort diagnostics by score (Tertinggi ke terendah)
    detailedDiagnostics.sort((a, b) => b.score - a.score);

    // Cari sub-dimensi paling dominan di setiap 4 Dimensi Utama
    const topDominants = {};
    for (const dim in groupedScores) {
      if (groupedScores[dim].length > 0) {
        groupedScores[dim].sort((a, b) => b.score - a.score);
        topDominants[dim] = groupedScores[dim][0];
      } else {
        topDominants[dim] = { name: "-", score: 0, level: "-" };
      }
    }

    return {
      isInvalid: false,
      rawScores: rawScores,
      percentages: percentages,
      levels: levels,
      topDominants: topDominants,
      detailedDiagnostics: detailedDiagnostics
    };
  },

  /**
   * Mengirimkan Hasil Rekap ke Google Sheets
   */
  async sendRekapToGAS(answers, userSession, evaluationResult) {
    if (evaluationResult.isInvalid) return;

    // Stringify Top Dominants untuk rekapan cepat HR/Guru
    const topSummary = Object.entries(evaluationResult.topDominants)
      .map(([dim, data]) => `${dim}: ${data.name.split(" - ")[1]} (${data.score}%)`)
      .join(" | ");

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
      kode_modul: "KS5",
      skor_mentah: "Detail tersimpan di log",
      standard_score: topSummary,
      kategori_hasil: "PROFIL TEREKAM",
      raw_answers: JSON.stringify(answers)
    };

    try {
      fetch(REKAP_GAS_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      console.log("Sistem Rekap: Data KS5 (LSP) berhasil terkirim.");
    } catch (error) {
      console.error("Sistem Rekap Error KS5:", error);
    }
  }
};
