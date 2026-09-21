/* ==========================================================================
   PATS PORTAL - SCORING ENGINE OTM PILAR II (Learning & Character Fit)
   Menggunakan algoritma Asymmetric Cross-Field Mapping
   ========================================================================== */

const Pilar2_Scoring = {
  // Pemetaan ID soal ke Modul Minat
  moduleMap: {
    1: "MIN_MTK", 2: "MIN_MTK", 3: "MIN_MTK",
    4: "MIN_FIS", 5: "MIN_FIS", 6: "MIN_FIS",
    7: "MIN_KIM", 8: "MIN_KIM", 9: "MIN_KIM",
    10: "MIN_BIO", 11: "MIN_BIO", 12: "MIN_BIO",
    13: "MIN_INF", 14: "MIN_INF", 15: "MIN_INF",
    16: "MIN_AST", 17: "MIN_AST", 18: "MIN_AST",
    19: "MIN_EKO", 20: "MIN_EKO", 21: "MIN_EKO",
    22: "MIN_KBM", 23: "MIN_KBM", 24: "MIN_KBM",
    25: "MIN_GEO", 26: "MIN_GEO", 27: "MIN_GEO",
    28: "MIN_AI", 29: "MIN_AI", 30: "MIN_AI"
  },

  // Matriks Bobot Asymmetric Cross-Field Mapping
  crossFieldMatrix: {
    "Matematika": { "MIN_MTK": 0.70, "MIN_INF": 0.15, "MIN_FIS": 0.15 },
    "Fisika": { "MIN_FIS": 0.60, "MIN_MTK": 0.20, "MIN_AST": 0.20 },
    "Kimia": { "MIN_KIM": 0.55, "MIN_BIO": 0.25, "MIN_FIS": 0.15, "MIN_MTK": 0.05 },
    "Biologi": { "MIN_BIO": 0.60, "MIN_KIM": 0.30, "MIN_GEO": 0.05, "MIN_AI": 0.05 },
    "Informatika": { "MIN_INF": 0.55, "MIN_MTK": 0.30, "MIN_AI": 0.15 },
    "Astronomi": { "MIN_AST": 0.40, "MIN_FIS": 0.35, "MIN_MTK": 0.25 },
    "Kebumian": { "MIN_KBM": 0.50, "MIN_FIS": 0.20, "MIN_KIM": 0.15, "MIN_MTK": 0.15 },
    "Ekonomi": { "MIN_EKO": 0.50, "MIN_AI": 0.25, "MIN_MTK": 0.15, "MIN_GEO": 0.10 },
    "Geografi": { "MIN_GEO": 0.55, "MIN_KBM": 0.25, "MIN_EKO": 0.20 },
    "AI & Data Science": { "MIN_AI": 0.55, "MIN_INF": 0.30, "MIN_MTK": 0.15 }
  },

  evaluate(answers) {
    // 1. Hitung Total Skor Mentah per Modul
    const rawScores = {
      "MIN_MTK": 0, "MIN_FIS": 0, "MIN_KIM": 0, "MIN_BIO": 0, "MIN_INF": 0,
      "MIN_AST": 0, "MIN_EKO": 0, "MIN_KBM": 0, "MIN_GEO": 0, "MIN_AI": 0
    };

    for (let i = 1; i <= 30; i++) {
      const moduleCode = this.moduleMap[i];
      const answerVal = parseInt(answers[i]) || 0;
      rawScores[moduleCode] += answerVal;
    }

    // 2. Konversi ke Skor Dimensi Murni (MIN_j) Skala 0-100
    const pureScores = {};
    Object.keys(rawScores).forEach(mod => {
      // Formula: (Total Skor 3 Indikator / 15) * 100
      pureScores[mod] = (rawScores[mod] / 15) * 100;
    });

    // 3. Kalkulasi Skor Minat Terbobot Bidang (S_Minat_K)
    const weightedScores = {};
    const fieldEvaluations = {};

    Object.keys(this.crossFieldMatrix).forEach(field => {
      let finalScore = 0;
      const weights = this.crossFieldMatrix[field];
      
      Object.keys(weights).forEach(minCode => {
        finalScore += (pureScores[minCode] * weights[minCode]);
      });

      weightedScores[field] = parseFloat(finalScore.toFixed(2));

      // 4. Penentuan Kategori Fit Minat
      let category = "Rendah (Low Fit)";
      let desc = "Memiliki resistensi atau tidak menemukan daya tarik pada alur berpikir bidang ini.";
      
      if (finalScore >= 80.0) {
        category = "Sangat Tinggi (Strong Fit)";
        desc = "Antusiasme pekat, sangat nyaman dengan alur berpikir, dan tahan eksplorasi mandiri.";
      } else if (finalScore >= 65.0) {
        category = "Tinggi (Moderate Fit)";
        desc = "Tertarik pada bidang utama dan nyaman dengan disiplin ilmu irisannya.";
      } else if (finalScore >= 50.0) {
        category = "Sedang / Cukup (Conditional Fit)";
        desc = "Suka aspek permukaan, namun kurang nyaman pada cabang ilmu pendukungnya (rentan jenuh).";
      }

      fieldEvaluations[field] = {
        score: weightedScores[field],
        category: category,
        description: desc
      };
    });

    return {
      pure_scores: pureScores,
      weighted_evaluations: fieldEvaluations,
      timestamp: new Date().toISOString()
    };
  }
};
