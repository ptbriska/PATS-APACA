/**
 * scoring1.js - Engine Kalkulasi Skor & Gatekeeper Pilar I (OSN Aptitude Test)
 * Mengacu pada Pedoman Metode Operasional Pilar I
 */

const SCORING_PILAR1 = {
  // Config Durasi & Jumlah Soal per Sub-Modul
  modules_config: {
    NUM: { name: "Numerik & Manipulasi Aljabar", n_soal: 4, t_max: 300 },
    LOG: { name: "Logika Deductif & Formal", n_soal: 4, t_max: 360 },
    PAT: { name: "Pattern Recognition & Abstraksi", n_soal: 4, t_max: 240 },
    SPA: { name: "Visual-Spasial & Proyeksi 3D", n_soal: 4, t_max: 300 },
    DAT: { name: "Data Interpretation & Graph Analysis", n_soal: 4, t_max: 420 },
    ALG: { name: "Problem Decomposition & Algoritmik", n_soal: 4, t_max: 420 },
    SAI: { name: "Literasi Konseptual Sains & Proses", n_soal: 4, t_max: 360 },
    EKO: { name: "Spasial-Ekologis & Relasi Wilayah", n_soal: 4, t_max: 300 }
  },

  // Matriks Pembobotan Field-Driven (Total = 1.0 per Bidang)
  field_weights: {
    "Matematika": { LOG: 0.50, NUM: 0.50 },
    "Fisika": { NUM: 0.40, LOG: 0.35, SAI: 0.25 },
    "Kimia": { SAI: 0.40, NUM: 0.30, DAT: 0.30 },
    "Biologi": { SAI: 0.45, DAT: 0.35, PAT: 0.20 },
    "Informatika": { ALG: 0.45, LOG: 0.35, PAT: 0.20 },
    "Astronomi": { NUM: 0.40, SPA: 0.35, LOG: 0.25 },
    "Kebumian": { SPA: 0.30, SAI: 0.30, EKO: 0.25, DAT: 0.15 },
    "Ekonomi": { DAT: 0.40, NUM: 0.35, LOG: 0.25 },
    "Geografi": { EKO: 0.35, SPA: 0.25, DAT: 0.20, SAI: 0.20 },
    "AI & Data Science": { DAT: 0.40, ALG: 0.35, LOG: 0.25 }
  },

  /**
   * 1. Hitung Speed-Accuracy Score per Sub-Modul (Mi)
   * Formula: Mi = (Bi/Ni * 70) + (Tsisa/Tmax * 30)
   * Tsisa hanya dihitung jika seluruh soal terisi.
   */
  calculateModuleScore: function(moduleCode, userAnswers, answerKeys, timeSpentSeconds) {
    const config = this.modules_config[moduleCode];
    if (!config) return 0;

    let correctCount = 0;
    let answeredCount = 0;

    // Evaluasi jawaban
    for (let qId in answerKeys) {
      if (userAnswers[qId] !== undefined && userAnswers[qId] !== "") {
        answeredCount++;
        if (userAnswers[qId] === answerKeys[qId]) {
          correctCount++;
        }
      }
    }

    const Bi = correctCount;
    const Ni = config.n_soal;
    const Tmax = config.t_max;
    
    // Tsisa dihitung jika semua soal diisi, jika ada kosong = 0
    let Tsisa = 0;
    if (answeredCount === Ni) {
      Tsisa = Math.max(0, Tmax - timeSpentSeconds);
    }

    const accuracyComp = (Bi / Ni) * 70;
    const speedComp = (Tsisa / Tmax) * 30;
    const Mi = accuracyComp + speedComp;

    return {
      module_code: moduleCode,
      correct: Bi,
      total_soal: Ni,
      time_spent: timeSpentSeconds,
      time_remaining: Tsisa,
      accuracy_score: accuracyComp,
      speed_score: speedComp,
      final_score: parseFloat(Mi.toFixed(2))
    };
  },

  /**
   * 2. Hitung Skor Terbobot & Status Gatekeeper per Bidang
   * Formula: SBakat_K = Sum(Mi * Wi,K)
   * Gatekeeper: PASS jika SBakat_K >= 60, LOCKED jika < 60
   */
  calculateFieldScores: function(moduleScoresMap) {
    const results = {};

    for (let fieldName in this.field_weights) {
      const weights = this.field_weights[fieldName];
      let weightedSum = 0;

      for (let modCode in weights) {
        const Mi = moduleScoresMap[modCode] ? moduleScoresMap[modCode].final_score : 0;
        const Wi = weights[modCode];
        weightedSum += Mi * Wi;
      }

      const SBakat = parseFloat(weightedSum.toFixed(2));
      const isPass = SBakat >= 60.0;

      let category = "Kurang (Low Readiness)";
      if (SBakat >= 80.0) category = "Sangat Tinggi (Superior)";
      else if (SBakat >= 60.0) category = "Tinggi (Competent)";
      else if (SBakat >= 40.0) category = "Cukup / Sedang (Moderate Limit)";

      results[fieldName] = {
        field_name: fieldName,
        score: SBakat,
        gatekeeper_status: isPass ? "PASS" : "LOCKED",
        category: category,
        is_eligible_top1: isPass
      };
    }

    return results;
  }
};
