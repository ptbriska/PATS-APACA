/* ==========================================================================
   PATS PORTAL - SCORING ENGINE KS7: OSN Screen Test (OST)
   ========================================================================== */

const REKAP_GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxMq4NjUbe0YCiYRrMXG4TvztEi8B7xpc04Te3JNNV7BBnQSCMFD1CgB0lRBUFDINWY/exec";

const KS7_Scoring = {
  /**
   * Menghitung Skor Parameter (P01-P15), Indeks Potensi OSN (SOST), dan Evaluasi Kelayakan
   */
  evaluate(answers, soalData, rubrikData) {
    const paramRawItems = {};

    // 1. Invariance Response Check (Flag: Invalid Response pada 30 item)
    const totalAnswered = Object.keys(answers).length;
    const uniqueAnswers = new Set(Object.values(answers));
    if (totalAnswered >= 30 && uniqueAnswers.size === 1) {
      return { 
        isInvalid: true, 
        message: "Flag: Invalid Response. Jawaban terdeteksi seragam pada seluruh 30 butir soal." 
      };
    }

    // Grouping Skor per Parameter (P01 - P15)
    if (soalData && soalData.questions) {
      soalData.questions.forEach(q => {
        const ansVal = Number(answers[q.id]) || 1;
        
        if (!paramRawItems[q.kategori]) {
          paramRawItems[q.kategori] = [];
        }
        paramRawItems[q.kategori].push(ansVal);
      });
    }

    // 2. Perhitungan Skor Parameter Pk = (ItemA + ItemB) / 2
    const parameterScores = {};
    let sumPk = 0;

    for (let i = 1; i <= 15; i++) {
      const pCode = `P${String(i).padStart(2, '0')}`;
      const items = paramRawItems[pCode] || [1, 1];
      const pk = (items[0] + items[1]) / 2;
      
      parameterScores[pCode] = pk;
      sumPk += pk;
    }

    // 3. Perhitungan Indeks Potensi OSN (SOST) = (Sum(Pk) / 75) * 100
    // Formula Manual Book KS7: Max theoretical sum Pk = 75
    const sostIndex = Math.min(100, Math.max(0, (sumPk / 75) * 100));

    // 4. Penentuan Zona Keputusan & Kelayakan
    const normaList = rubrikData?.norma_kategorisasi_global || [];
    let matchedNorm = normaList.find(n => n.action_type === "SHOW_SAVE_BUDGET_NOTE") || {
      rentang_skor: "0,0 - 54,9",
      kategori_indeks: "KURANG POTENSIAL (Low OSN Fit)",
      status_kelayakan: "NOT RECOMMENDED",
      action_type: "SHOW_SAVE_BUDGET_NOTE",
      deskripsi_profil: "Profil karakter emosional saat ini belum selaras dengan beban pembinaan OSN.",
      rekomendasi_sistem: "TIDAK DISARANKAN UNTUK OSN / OTM TEST."
    };

    if (sostIndex >= 75.0) {
      matchedNorm = normaList.find(n => n.status_kelayakan === "RECOMMENDED FOR OTM") || matchedNorm;
    } else if (sostIndex >= 55.0) {
      matchedNorm = normaList.find(n => n.status_kelayakan === "OPTIONAL OTM") || matchedNorm;
    }

    // 5. Perhitungan Skor 3 Pilar Utama OSN (% dari nilai maksimal pilar)
    // Pilar 1: P01, P02, P12, P15 (4 parameter, max Pk=5 -> max sum=20)
    const pilar1Sum = (parameterScores["P01"] + parameterScores["P02"] + parameterScores["P12"] + parameterScores["P15"]);
    const pilar1Pct = (pilar1Sum / 20) * 100;

    // Pilar 2: P04, P05, P06, P11, P14 (5 parameter, max Pk=5 -> max sum=25)
    const pilar2Sum = (parameterScores["P04"] + parameterScores["P05"] + parameterScores["P06"] + parameterScores["P11"] + parameterScores["P14"]);
    const pilar2Pct = (pilar2Sum / 25) * 100;

    // Pilar 3: P03, P07, P08, P09, P10, P13 (6 parameter, max Pk=5 -> max sum=30)
    const pilar3Sum = (parameterScores["P03"] + parameterScores["P07"] + parameterScores["P08"] + parameterScores["P09"] + parameterScores["P10"] + parameterScores["P13"]);
    const pilar3Pct = (pilar3Sum / 30) * 100;

    return {
      isInvalid: false,
      parameterScores: parameterScores,
      sumPk: sumPk,
      sostIndex: sostIndex,
      matchedNorm: matchedNorm,
      pillarScores: {
        pilar1: Math.min(100, pilar1Pct),
        pilar2: Math.min(100, pilar2Pct),
        pilar3: Math.min(100, pilar3Pct)
      }
    };
  },

  /**
   * Mengirimkan Hasil Rekap ke Google Sheets
   */
  async sendRekapToGAS(answers, userSession, evaluationResult) {
    if (evaluationResult.isInvalid) return;

    const summaryStr = `SOST: ${evaluationResult.sostIndex.toFixed(1)}% | ${evaluationResult.matchedNorm.status_kelayakan}`;
    const paramStr = Object.entries(evaluationResult.parameterScores)
      .map(([p, score]) => `${p}: ${score}`)
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
      kode_modul: "KS7",
      skor_mentah: `Sum(Pk): ${evaluationResult.sumPk.toFixed(1)}`,
      standard_score: paramStr,
      kategori_hasil: summaryStr,
      raw_answers: JSON.stringify(answers)
    };

    try {
      fetch(REKAP_GAS_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      console.log("Sistem Rekap: Data KS7 (OST) berhasil terkirim.");
    } catch (error) {
      console.error("Sistem Rekap Error KS7:", error);
    }
  }
};
