/* ==========================================================================
   PATS PORTAL - TOTAL SCORING ENGINE (OTM COMBINED RECOMMENDATION)
   Menggabungkan Pilar I (Bakat), Pilar II (Minat), & Pilar III (Resiliensi)
   ========================================================================== */

const Total_Scoring = {
  // Bobot Penggabungan 3 Pilar (Total = 100%)
  weights: {
    pilar1_bakat: 0.50,   // 50% Bakat Kognitif
    pilar2_minat: 0.30,   // 30% Minat Terbobot (Learning Fit)
    pilar3_persona: 0.20  // 20% Resiliensi & Science Comfort
  },

  // Daftar 10 Bidang OSN & AI
  fields: [
    "Matematika", "Fisika", "Kimia", "Biologi", "Informatika",
    "Astronomi", "Kebumian", "Ekonomi", "Geografi", "AI & Data Science"
  ],

  /**
   * Menghitung Skor Akhir Kombinasi dari 3 Pilar
   * @param {Object} pilar1Data - Results dari Pilar I (Aptitude)
   * @param {Object} pilar2Data - Results dari Pilar II (Interest)
   * @param {Object} pilar3Data - Results dari Pilar III (Persona)
   */
  evaluateTotal(pilar1Data, pilar2Data, pilar3Data) {
    if (!pilar1Data || !pilar2Data || !pilar3Data) {
      return {
        isInvalid: true,
        message: "Data hasil salah satu Pilar tes belum lengkap di sesi ini."
      };
    }

    const fieldSummary = [];

    // Mapping Kode Bidang Pilar III ke Nama Lengkap Bidang
    const codeToFieldMap = {
      "MTK": "Matematika", "FIS": "Fisika", "KIM": "Kimia", "BIO": "Biologi",
      "INF": "Informatika", "AST": "Astronomi", "KBM": "Kebumian",
      "EKO": "Ekonomi", "GEO": "Geografi", "AI": "AI & Data Science"
    };

    // Loop Kalkulasi per Bidang OSN
    this.fields.forEach((field) => {
      // 1. Ambil Skor Pilar I (Bakat) -> Skala 0-100
      const sPilar1 = pilar1Data.weighted_scores ? (pilar1Data.weighted_scores[field] || 0) : 0;

      // 2. Ambil Skor Pilar II (Minat Terbobot) -> Skala 0-100
      const sPilar2Eval = pilar2Data.weighted_evaluations ? pilar2Data.weighted_evaluations[field] : null;
      const sPilar2 = sPilar2Eval ? sPilar2Eval.score : 0;

      // 3. Ambil Skor Pilar III (Resiliensi & Warning Tag) -> Skala 0-100
      // Cari kode bidang dari name
      const fieldCode = Object.keys(codeToFieldMap).find(key => codeToFieldMap[key] === field);
      const sPilar3Eval = (pilar3Data.field_results && fieldCode) ? pilar3Data.field_results[fieldCode] : null;
      
      const sPilar3 = sPilar3Eval ? sPilar3Eval.score_pilar3 : 0;
      const intimidationIndex = sPilar3Eval ? sPilar3Eval.intimidation_index : 0;
      const warningTag = sPilar3Eval ? sPilar3Eval.warning_tag : false;

      // 4. Kalkulasi Skor Total Kombinasi (S_Total)
      const sTotal = parseFloat((
        (sPilar1 * this.weights.pilar1_bakat) +
        (sPilar2 * this.weights.pilar2_minat) +
        (sPilar3 * this.weights.pilar3_persona)
      ).toFixed(2));

      // 5. Penentuan Kategori Rekomendasi
      let statusRekomendasi = "TIDAK DIREKOMENDASIKAN";
      let priorityLevel = 4;

      if (sTotal >= 78.0 && !warningTag) {
        statusRekomendasi = "SANGAT DIREKOMENDASIKAN (PRIORITAS UTAMA)";
        priorityLevel = 1;
      } else if (sTotal >= 65.0 && !warningTag) {
        statusRekomendasi = "DIREKOMENDASIKAN (POTENSIAL)";
        priorityLevel = 2;
      } else if (sTotal >= 50.0 || warningTag) {
        statusRekomendasi = warningTag ? "PERLU PENDAMPINGAN (RISK OF OSN BURNOUT)" : "PERLU PERTIMBANGAN";
        priorityLevel = 3;
      }

      fieldSummary.push({
        bidang: field,
        skor_total: sTotal,
        skor_pilar1_bakat: sPilar1,
        skor_pilar2_minat: sPilar2,
        skor_pilar3_persona: sPilar3,
        indeks_intimidasi: intimidationIndex,
        warning_tag: warningTag,
        status_rekomendasi: statusRekomendasi,
        priority_level: priorityLevel
      });
    });

    // Urutkan bidang berdasarkan Skor Total tertinggi
    fieldSummary.sort((a, b) => b.skor_total - a.skor_total);

    return {
      isInvalid: false,
      top_recommendation: fieldSummary[0],
      secondary_recommendation: fieldSummary[1],
      all_fields_ranking: fieldSummary,
      timestamp: new Date().toISOString()
    };
  },

  /**
   * Helper fungsi untuk mengambil data otomatis dari sessionStorage
   */
  loadAndEvaluateFromSession() {
    const p1Raw = sessionStorage.getItem("pats_pilar1_results");
    const p2Raw = sessionStorage.getItem("pats_pilar2_results");
    const p3Raw = sessionStorage.getItem("pats_pilar3_results");

    const p1Data = p1Raw ? JSON.parse(p1Raw) : null;
    const p2Data = p2Raw ? JSON.parse(p2Raw) : null;
    const p3Data = p3Raw ? JSON.parse(p3Raw) : null;

    return this.evaluateTotal(p1Data, p2Data, p3Data);
  }
};
