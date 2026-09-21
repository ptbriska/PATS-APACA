/* ==========================================================================
   PATS PORTAL - TOTAL SCORING ENGINE (OTM COMBINED RECOMMENDATION)
   Hub Integrasi 3 Pilar: Pilar I (Bakat), Pilar II (Minat), & Pilar III (Resiliensi)
   Sesuai Pedoman Operasional OSN Talent Mapping (OTM) Test
   ========================================================================== */

const Total_Scoring = {
  // Bobot Penggabungan 3 Pilar (Total = 100%)
  weights: {
    pilar1_bakat: 0.50,   // 50% Bakat Kognitif (Gatekeeper Principal)
    pilar2_minat: 0.30,   // 30% Minat Terbobot (Learning Fit)
    pilar3_persona: 0.20  // 20% Resiliensi & Science Comfort
  },

  // Daftar 10 Bidang OSN & AI
  fields: [
    "Matematika", "Fisika", "Kimia", "Biologi", "Informatika",
    "Astronomi", "Kebumian", "Ekonomi", "Geografi", "AI & Data Science"
  ],

  // Mapping Kode Bidang Pilar III ke Nama Lengkap Bidang
  codeToFieldMap: {
    "MTK": "Matematika", "FIS": "Fisika", "KIM": "Kimia", "BIO": "Biologi",
    "INF": "Informatika", "AST": "Astronomi", "KBM": "Kebumian",
    "EKO": "Ekonomi", "GEO": "Geografi", "AI": "AI & Data Science"
  },

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

    // Loop Kalkulasi per Bidang OSN
    this.fields.forEach((field) => {
      // 1. Ekstraksi Skor Pilar I (Bakat & Gatekeeper Status)
      const p1FieldData = pilar1Data.field_scores ? pilar1Data.field_scores[field] : null;
      const sPilar1 = p1FieldData ? (p1FieldData.score || 0) : 0;
      const gatekeeperStatus = p1FieldData ? p1FieldData.gatekeeper_status : "LOCKED";
      const isGatekeeperPass = (gatekeeperStatus === "PASS") && (sPilar1 >= 60.0);

      // 2. Ekstraksi Skor Pilar II (Minat Terbobot)
      const p2FieldData = pilar2Data.weighted_evaluations ? pilar2Data.weighted_evaluations[field] : null;
      const sPilar2 = p2FieldData ? p2FieldData.score : 0;

      // 3. Ekstraksi Skor Pilar III (Resiliensi & Warning Tag)
      const fieldCode = Object.keys(this.codeToFieldMap).find(key => this.codeToFieldMap[key] === field);
      const p3FieldData = (pilar3Data.field_results && fieldCode) ? pilar3Data.field_results[fieldCode] : null;
      
      const sPilar3 = p3FieldData ? p3FieldData.score_pilar3 : 0;
      const intimidationIndex = p3FieldData ? p3FieldData.intimidation_index : 0;
      const warningTag = p3FieldData ? p3FieldData.warning_tag : false;

      // 4. Kalkulasi Skor Total Kombinasi (S_Total)
      const sTotal = parseFloat((
        (sPilar1 * this.weights.pilar1_bakat) +
        (sPilar2 * this.weights.pilar2_minat) +
        (sPilar3 * this.weights.pilar3_persona)
      ).toFixed(2));

      // 5. Logika Penetapan Status Rekomendasi Sesuai Matriks OTM
      let statusRekomendasi = "TIDAK DIREKOMENDASIKAN (LOCKED)";
      let priorityLevel = 4;
      let isEligibleTop = false;

      // ATURAN MUTLAK: Jika Gatekeeper LOCKED (<60), Otomatis Diskualifikasi dari Top 1
      if (!isGatekeeperPass) {
        statusRekomendasi = "TIDAK DIREKOMENDASIKAN (LOCKED)";
        priorityLevel = 4;
        isEligibleTop = false;
      } else if (warningTag) {
        // Lolos Kognitif tetapi Terintimidasi
        statusRekomendasi = "PERLU PENDAMPINGAN (RISK OF OSN BURNOUT)";
        priorityLevel = 3;
        isEligibleTop = true; // Tetap bisa dipertimbangkan dengan syarat
      } else if (sTotal >= 75.0) {
        statusRekomendasi = "SANGAT DIREKOMENDASIKAN (REKOMENDASIKAN UTAMA)";
        priorityLevel = 1;
        isEligibleTop = true;
      } else if (sTotal >= 60.0) {
        statusRekomendasi = "DIREKOMENDASIKAN (ALTERNATIF)";
        priorityLevel = 2;
        isEligibleTop = true;
      } else {
        statusRekomendasi = "PERLU PERTIMBANGAN";
        priorityLevel = 3;
        isEligibleTop = true;
      }

      fieldSummary.push({
        bidang: field,
        skor_total: sTotal,
        skor_pilar1_bakat: sPilar1,
        skor_pilar2_minat: sPilar2,
        skor_pilar3_persona: sPilar3,
        gatekeeper_status: isGatekeeperPass ? "PASS" : "LOCKED",
        indeks_intimidasi: intimidationIndex,
        warning_tag: warningTag,
        status_rekomendasi: statusRekomendasi,
        priority_level: priorityLevel,
        is_eligible_top: isEligibleTop
      });
    });

    // 6. Urutkan Bidang: Utamakan yang PASS Gatekeeper, Lalu Urutkan dari Skor Total Tertinggi
    fieldSummary.sort((a, b) => {
      if (a.is_eligible_top !== b.is_eligible_top) {
        return a.is_eligible_top ? -1 : 1; // Prioritaskan yang Lolos Gatekeeper
      }
      return b.skor_total - a.skor_total; // Urutkan Skor Total
    });

    // Ambil Rincian IQ dari Pilar I untuk Laporan Akhir
    const iqSummary = pilar1Data.iq_result || { iq_score: 0, category: "-" };

    return {
      isInvalid: false,
      iq_summary: iqSummary,
      top_recommendation: fieldSummary[0],
      secondary_recommendation: fieldSummary[1],
      tertiary_recommendation: fieldSummary[2],
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
