/* ==========================================================================
   PATS PORTAL - SCORING ENGINE OTM PILAR III (Science Persona Fit Test)
   Kalkulasi Skor Pilar III (0-100) dan Indeks Intimidasi / Warning Tag
   ========================================================================== */

const Pilar3_Scoring = {
  evaluate(answersByField) {
    // answersByField format: { "MTK": { 1: 5, 2: 4, ... 8: 4 }, "KIM": { ... }, ... }
    const results = {};

    Object.keys(answersByField).forEach((fieldCode) => {
      const fieldAnswers = answersByField[fieldCode] || {};
      let totalRaw = 0;

      // 1. Hitung Total Skor Mentah (C1 s.d. C8) -> Maks 40
      for (let qId = 1; qId <= 8; qId++) {
        totalRaw += parseInt(fieldAnswers[qId]) || 0;
      }

      // 2. Normalisasi Skor Pilar III ke skala 0-100: (Total / 40) * 100
      const scorePilar3 = parseFloat(((totalRaw / 40) * 100).toFixed(2));

      // 3. Hitung Indeks Intimidasi: (C1 + C2) / 2
      const c1 = parseInt(fieldAnswers[1]) || 0;
      const c2 = parseInt(fieldAnswers[2]) || 0;
      const intimidationIndex = parseFloat(((c1 + c2) / 2).toFixed(2));

      // 4. Penentuan Status Resiliensi & Warning Tag
      let statusResiliensi = "FIT (HIGH)";
      let warningTag = false;
      let evalText = "Sangat siap menghadapi tekanan; stamina mental dan daya juang tinggi.";

      if (intimidationIndex < 3.0) {
        warningTag = true;
        statusResiliensi = "RISK OF OSN BURNOUT";
        evalText = "Terintimidasi oleh tingkat kesulitan soal. Rentan panik dan burnout jika dipaksa ikut pembinaan intensif.";
      } else if (scorePilar3 < 65.0) {
        statusResiliensi = "FIT (BORDERLINE)";
        evalText = "Berada di batas minimum resiliensi mental. Butuh dorongan ekstra agar tidak minder.";
      } else if (scorePilar3 < 80.0) {
        statusResiliensi = "FIT (MODERATE)";
        evalText = "Cukup nyaman dengan rutinitas latihan soal dan analisis studi kasus.";
      }

      results[fieldCode] = {
        score_pilar3: scorePilar3,
        intimidation_index: intimidationIndex,
        warning_tag: warningTag,
        status_resiliensi: statusResiliensi,
        evaluasi: evalText
      };
    });

    return {
      field_results: results,
      timestamp: new Date().toISOString()
    };
  }
};
