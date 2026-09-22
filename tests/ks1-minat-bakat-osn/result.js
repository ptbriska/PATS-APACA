/* ==========================================================================
   PATS PORTAL - REPORT GENERATOR ENGINE (OTM RESULT.JS)
   Mengekstrak data dari SessionStorage, membaca rubrik.json, dan merender
   seluruh komponen Laporan OTM secara dinamis.
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Setup Kop Laporan
  if (typeof PATS_CONFIG !== "undefined" && PATS_CONFIG.organization) {
    const org = PATS_CONFIG.organization;
    document.getElementById("kop-instansi-nama").innerText = org.name || "APACA CONSULTING";
    document.getElementById("kop-instansi-sub").innerText = org.subTitle || "Psychometric & Educational Assessment Center";
    document.getElementById("kop-instansi-alamat").innerText = org.address || "Makassar, Sulawesi Selatan";
    const logoElem = document.getElementById("kop-logo");
    logoElem.src = org.logoUrl || "../../logo.png";
    logoElem.onerror = () => { logoElem.src = "../../assets/images/logo.png"; };
  }

  // 2. Setup Biodata Peserta
  const user = PATS_AUTH.getSession();
  if (user) {
    document.getElementById("r-nama").innerText = user.nama_lengkap || "Siswa OTM";
    document.getElementById("r-kode").innerText = user.kode_akses || user.kode_kegiatan || "OTM-2026-REG";
    document.getElementById("r-kelas").innerText = user.kelas_jurusan || user.jenis_kelamin || "X / MIPA";
    document.getElementById("r-instansi").innerText = user.asal_instansi || user.sekolah || "SMA Negeri";
    
    if (user.test_info) {
      document.getElementById("r-psikolog-nama").innerText = user.test_info.psikolog_pj || "Dra. Fitriani Rahayu, M.Psi., Psikolog";
      document.getElementById("r-psikolog-sipp").innerText = "SIPP: " + (user.test_info.SIPP || "2026-0819-PSI-01");
    }
  }
  document.getElementById("r-tanggal").innerText = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });

  // 3. Muat Data Evaluasi & Rubrik JSON
  try {
    const resRubrik = await fetch("rubrik.json");
    const rubrikData = await resRubrik.json();

    // Evaluasi Total OTM (3 Pilar)
    const evaluation = Total_Scoring.loadAndEvaluateFromSession();

    if (evaluation.isInvalid) {
      alert(evaluation.message);
      return;
    }

    const { iq_summary, all_fields_ranking: allRanking, pilar1_raw: p1Data, pilar2_raw: p2Data, pilar3_raw: p3Data } = evaluation;

    // 4. Render Hero IQ APACA OTM
    const estimasiIQ = iq_summary?.iq_score || 0;
    const iqCategoryLabel = iq_summary?.category || "-";

    document.getElementById("r-iq-score").innerText = estimasiIQ > 0 ? estimasiIQ : "0";
    document.getElementById("r-iq-category").innerText = iqCategoryLabel;
    
    const iqNormaList = rubrikData.pilar1_kognitif?.norma_iq_apaca_otm || [];
    const iqCategoryObj = iqNormaList.find(k => k.label === iqCategoryLabel);
    document.getElementById("r-iq-desc").innerText = iqCategoryObj ? iqCategoryObj.deskripsi : "Kapasitas kognitif murni dalam menyelesaikan tugas penalaran sains.";

    // 5. Render 10 Bidang ke Tabel Rekomendasi Utama (Section I)
    const top3Body = document.getElementById("top-3-table-body");
    top3Body.innerHTML = allRanking.map((rec, idx) => {
      const gateBadge = rec.gatekeeper_status === "PASS" ? 
        `<span class="badge-status badge-pass">PASS</span>` : 
        `<span class="badge-status badge-locked">LOCKED</span>`;
        
      const rankStatus = idx < 3 ? 
        `<span style="font-weight: 700; color: #059669;">DIREKOMENDASIKAN (TOP ${idx+1})</span>` : 
        `<span style="font-weight: 500; color: #64748b;">TIDAK PRIORITAS</span>`;

      return `
        <tr>
          <td><strong>${idx + 1}</strong></td>
          <td style="text-align: left; font-weight: 700; color: #1e3a8a;">${rec.bidang}</td>
          <td><strong>${rec.skor_total}</strong></td>
          <td>${gateBadge}</td>
          <td>${rec.indeks_intimidasi.toFixed(2)}</td>
          <td>${rankStatus}</td>
        </tr>
      `;
    }).join("");

    // 6. Render Chart.js Combined 3 Pilar (Section II)
    new Chart(document.getElementById('chartOTM').getContext('2d'), {
      type: 'bar',
      data: {
        labels: allRanking.map(r => r.bidang),
        datasets: [
          { label: 'Pilar I: Bakat (50%)', data: allRanking.map(r => r.skor_pilar1_bakat), backgroundColor: '#2563eb' },
          { label: 'Pilar II: Minat (30%)', data: allRanking.map(r => r.skor_pilar2_minat), backgroundColor: '#059669' },
          { label: 'Pilar III: Comfort (20%)', data: allRanking.map(r => r.skor_pilar3_persona), backgroundColor: '#d97706' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { suggestedMin: 0, suggestedMax: 100 } }
      }
    });

    // 7. Render Pilar I Sub-modul Table (Section III)
    const p1Body = document.getElementById("pilar1-table-body");
    const modScores = p1Data?.module_scores || {};

    p1Body.innerHTML = Object.keys(modScores).map(code => {
      const m = modScores[code];
      const modCfg = rubrikData.pilar1_kognitif?.daftar_modul?.[code] || {};
      
      let catLabel = "Cukup";
      if (m.final_score >= 80) catLabel = "Sangat Tinggi";
      else if (m.final_score >= 60) catLabel = "Tinggi";
      else if (m.final_score >= 40) catLabel = "Sedang";
      else catLabel = "Kurang";

      const notesObj = rubrikData.pilar1_kognitif?.catatan_analisis_submodul?.[code] || {};
      const noteText = notesObj[catLabel] || modCfg.fokus || "-";

      return `
        <tr>
          <td><strong>${code}</strong></td>
          <td style="text-align: left; font-weight: 600;">${modCfg.nama || code}</td>
          <td>${m.accuracy_score.toFixed(1)} pts</td>
          <td>${m.speed_score.toFixed(1)} pts</td>
          <td><strong>${m.final_score}</strong></td>
          <td style="text-align: left; font-size: 0.82rem;">${noteText}</td>
        </tr>
      `;
    }).join("");

    // 7b. Render Tabel Gatekeeper Kognitif OSN
    const tbodyGatekeeper = document.getElementById("table-pilar1-gatekeeper");
    tbodyGatekeeper.innerHTML = allRanking.map(rec => {
      const skorBakat = rec.skor_pilar1_bakat;
      const isLolos = skorBakat >= 60;
      const statusBadge = isLolos
        ? `<span class="badge-status badge-pass">LOLOS GATEKEEPER</span>`
        : `<span class="badge-status badge-locked">GUGUR</span>`;
      
      let catKognitif = "Kurang";
      if (skorBakat >= 80) catKognitif = "Sangat Tinggi";
      else if (skorBakat >= 60) catKognitif = "Tinggi";
      else if (skorBakat >= 40) catKognitif = "Cukup";

      const bData = rubrikData.bidang_osn?.[rec.bidang] || {};
      const implikasiAkademis = bData.implikasi_akademis || "-";

      return `
        <tr>
          <td style="font-weight: 700; text-align: left; color:#1e3a8a;">${rec.bidang}</td>
          <td><strong>${skorBakat}</strong></td>
          <td>${catKognitif}</td>
          <td>${statusBadge}</td>
          <td style="text-align: left; font-size: 0.82rem;">${implikasiAkademis}</td>
        </tr>
      `;
    }).join("");

    // 8. Render Pilar II Table (Tabel Minat) (Section IV)
    const p2Body = document.getElementById("pilar2-table-body");
    const p2Pure = p2Data?.pure_scores || {};
    
    const klasterGroup = {
      "Genuine Interest": [],
      "Surface Fan": [],
      "Cross-Disciplinary Synergy": []
    };

    p2Body.innerHTML = allRanking.map(rec => {
      const skorBakat = rec.skor_pilar1_bakat;
      const skorMinat = rec.skor_pilar2_minat;
      
      let catMinat = "Rendah";
      if (skorMinat >= 80) catMinat = "Sangat Tinggi";
      else if (skorMinat >= 60) catMinat = "Tinggi";
      else if (skorMinat >= 40) catMinat = "Sedang";
      
      const bData = rubrikData.bidang_osn?.[rec.bidang] || {};
      const implikasiMotivasi = bData.implikasi_motivasi || "-";
      const pureScore = p2Pure["MIN_" + rec.field_code] || p2Pure[rec.bidang] || 70;

      let klaster = "";
      if (skorBakat >= 60 && skorMinat >= 60) klaster = "Genuine Interest";
      else if (skorBakat < 60 && skorMinat >= 60) klaster = "Surface Fan";
      else if (skorBakat >= 60 && skorMinat < 60) klaster = "Cross-Disciplinary Synergy";
      
      if (klasterGroup[klaster]) klasterGroup[klaster].push(rec.bidang);

      return `
        <tr>
          <td style="text-align: left; font-weight: 600;">${rec.bidang}</td>
          <td>${pureScore} pts</td>
          <td><strong>${skorMinat}</strong></td>
          <td><span class="tag-pill">${catMinat}</span></td>
          <td style="text-align: left; font-size: 0.82rem;">${implikasiMotivasi}</td>
        </tr>
      `;
    }).join("");

    // 8b. Render Tabel Analisis Klaster Diagnostik
    const tbodyKlaster = document.getElementById("table-pilar2-klaster");
    const dataKlasterRubrik = rubrikData.klaster_diagnostik || {};
    const urutanKlaster = ["Genuine Interest", "Surface Fan", "Cross-Disciplinary Synergy"];

    tbodyKlaster.innerHTML = urutanKlaster.map(namaKlaster => {
      const bidangTerkait = klasterGroup[namaKlaster];
      if (!bidangTerkait || bidangTerkait.length === 0) return "";

      const infoKlaster = dataKlasterRubrik[namaKlaster] || {};
      const teksDiag = infoKlaster.diagnostik || "-";
      const teksKons = infoKlaster.konseling || "-";

      return `
        <tr>
          <td style="font-weight: 800; color: #0f172a; text-align: left;">${namaKlaster}</td>
          <td style="text-align: left;">
            ${bidangTerkait.map(b => `<span class="tag-pill" style="margin-bottom:4px;">${b}</span>`).join(" ")}
          </td>
          <td style="text-align: left; font-size: 0.82rem;">${teksDiag}</td>
          <td style="text-align: left; font-size: 0.82rem;">${teksKons}</td>
        </tr>
      `;
    }).join("");

    // 9. Render Pilar III Table (Section V)
    const p3Body = document.getElementById("pilar3-table-body");
    const p3Eval = p3Data?.field_results || {};

    p3Body.innerHTML = allRanking.map(rec => {
      const resKey = Object.keys(p3Eval).find(k => p3Eval[k].field_name === rec.bidang || k === rec.bidang || k === rec.field_code);
      const res = resKey ? p3Eval[resKey] : { score_pilar3: rec.skor_pilar3_persona, intimidation_index: rec.indeks_intimidasi, evaluasi: "-" };
      
      const isBurnout = res.warning_tag || res.intimidation_index < 3.0;
      const warnBadge = isBurnout ? 
        `<span class="badge-status badge-warning">[WARNING: BURNOUT]</span>` : 
        `<span class="badge-status badge-pass">FIT</span>`;

      return `
        <tr>
          <td style="text-align: left; font-weight: 600;">${rec.bidang}</td>
          <td><strong>${res.score_pilar3}</strong></td>
          <td>${res.intimidation_index.toFixed(2)}</td>
          <td>${warnBadge}</td>
          <td style="text-align: left; font-size: 0.82rem;">${res.evaluasi}</td>
        </tr>
      `;
    }).join("");

    // 10. Render Kuadran & Career Projections (Section VI & VII)
    const top1Field = evaluation.top_recommendation?.bidang || "Matematika";
    document.getElementById("kuadran-summary-container").innerHTML = `
      <strong>Top Bidang Siswa: ${top1Field}</strong> berada di <strong>KUADRAN I (High Priority / High ROI)</strong>. Siswa memiliki gabungan Bakat Kognitif murni yang lolos batas minimum (PASS) serta Indeks Intimidasi yang stabil (FIT). Sangat layak dialokasikan anggaran pelatihan eksternal penuh (100% Full Grant).
    `;

    const careerContainer = document.getElementById("career-projection-container");
    const top3List = allRanking.slice(0, 3);

    careerContainer.innerHTML = top3List.map(rec => {
      if (!rec) return "";
      const bData = rubrikData.bidang_osn?.[rec.bidang] || { kuliah: [], karir: [] };

      return `
        <div class="info-box">
          <h5 style="margin:0 0 8px 0; color:#1e3a8a; font-size:0.95rem;">🎯 Proyeksi Bidang ${rec.bidang}</h5>
          <div style="font-size:0.85rem; margin-bottom:6px;"><strong>Proyeksi Program Studi:</strong> ${(bData.kuliah || []).join(", ")}</div>
          <div style="font-size:0.85rem;"><strong>Proyeksi Karir Masa Depan:</strong> ${(bData.karir || []).join(", ")}</div>
        </div>
      `;
    }).join("");

    // 11. Render Action Guidance (Section VIII)
    document.getElementById("rec-guru").innerText = `Fokuskan pembinaan siswa pada bidang ${top1Field}. Alokasikan pelatih eksternal dan modul intensif. Hindari memaksakan siswa pada bidang yang berstatus LOCKED atau memicu Warning Tag Burnout.`;
    document.getElementById("rec-siswa").innerText = `Pertahankan disiplin belajar pada bidang ${top1Field}. Jangan ragu untuk memperdalam alur penalaran dan terus berlatih soal tingkat lanjut.`;
    document.getElementById("rec-ortu").innerText = `Fasilitasi minat dan daya juang putra/putri Anda di bidang ${top1Field}. Berikan dukungan moral dan sarana belajar yang kondusif.`;

  } catch (err) {
    console.error("Gagal memuat data Laporan OTM:", err);
    alert("Terjadi kesalahan saat menyusun berkas Laporan OTM. Pastikan Anda telah menyelesaikan ketiga pilar.");
  }
});
