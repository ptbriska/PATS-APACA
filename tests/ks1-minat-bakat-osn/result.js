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
    
    if(user.test_info) {
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

    const p1Data = JSON.parse(sessionStorage.getItem("pats_pilar1_results") || "{}");
    const p2Data = JSON.parse(sessionStorage.getItem("pats_pilar2_results") || "{}");
    const p3Data = JSON.parse(sessionStorage.getItem("pats_pilar3_results") || "{}");
    const allRanking = evaluation.all_fields_ranking || [];

    // 4. Render Hero IQ APACA OTM (Multi-tier Fallback)
    let estimasiIQ = 0;
    let iqCategoryLabel = "-";
    
    if (evaluation.iq_summary && evaluation.iq_summary.iq_score) {
        estimasiIQ = evaluation.iq_summary.iq_score;
        iqCategoryLabel = evaluation.iq_summary.category;
    } 
    else if (p1Data && p1Data.iq_result && p1Data.iq_result.iq_score) {
        estimasiIQ = p1Data.iq_result.iq_score;
        iqCategoryLabel = p1Data.iq_result.category;
    }
    else if (p1Data && p1Data.module_scores) {
        const modScores = p1Data.module_scores;
        const keys = Object.keys(modScores);
        if (keys.length > 0) {
            let sum = 0;
            keys.forEach(k => sum += (modScores[k].final_score || 0));
            const avg = sum / keys.length;
            estimasiIQ = Math.min(160, Math.max(0, Math.round(avg * 1.6)));
            if (estimasiIQ >= 130) iqCategoryLabel = "Sangat Superior / Genius";
            else if (estimasiIQ >= 120) iqCategoryLabel = "Superior";
            else if (estimasiIQ >= 110) iqCategoryLabel = "Rata-Rata Tinggi";
            else if (estimasiIQ >= 90) iqCategoryLabel = "Rata-Rata";
            else if (estimasiIQ >= 80) iqCategoryLabel = "Rata-Rata Rendah";
            else iqCategoryLabel = "Batas Bawah";
        }
    }

    document.getElementById("r-iq-score").innerText = estimasiIQ > 0 ? estimasiIQ : "0";
    document.getElementById("r-iq-category").innerText = iqCategoryLabel;
    
    const iqCategoryObj = (rubrikData.pilar1_kognitif?.norma_iq_apaca_otm?.kategori || []).find(k => k.label === iqCategoryLabel);
    document.getElementById("r-iq-desc").innerText = iqCategoryObj ? iqCategoryObj.deskripsi : "Kapasitas kognitif murni dalam menyelesaikan tugas penalaran sains.";

    // 5. Render 10 Bidang ke Tabel Rekomendasi Utama
    const top3Body = document.getElementById("top-3-table-body");
    top3Body.innerHTML = "";

    allRanking.forEach((rec, idx) => {
      const tr = document.createElement("tr");
      const gateBadge = rec.gatekeeper_status === "PASS" ? 
        `<span class="badge-status badge-pass">PASS</span>` : 
        `<span class="badge-status badge-locked">LOCKED</span>`;
        
      const rankStatus = idx < 3 ? 
        `<span style="font-weight: 700; color: #059669;">DIREKOMENDASIKAN (TOP ${idx+1})</span>` : 
        `<span style="font-weight: 500; color: #64748b;">TIDAK PRIORITAS</span>`;

      tr.innerHTML = `
        <td><strong>${idx + 1}</strong></td>
        <td style="text-align: left; font-weight: 700; color: #1e3a8a;">${rec.bidang}</td>
        <td><strong>${rec.skor_total}</strong></td>
        <td>${gateBadge}</td>
        <td>${rec.indeks_intimidasi.toFixed(2)}</td>
        <td>${rankStatus}</td>
      `;
      top3Body.appendChild(tr);
    });

    // 6. Render Chart.js Combined 3 Pilar
    const chartLabels = allRanking.map(r => r.bidang);
    const p1Scores = allRanking.map(r => r.skor_pilar1_bakat);
    const p2Scores = allRanking.map(r => r.skor_pilar2_minat);
    const p3Scores = allRanking.map(r => r.skor_pilar3_persona);

    new Chart(document.getElementById('chartOTM').getContext('2d'), {
      type: 'bar',
      data: {
        labels: chartLabels,
        datasets: [
          { label: 'Pilar I: Bakat (50%)', data: p1Scores, backgroundColor: '#2563eb' },
          { label: 'Pilar II: Minat (30%)', data: p2Scores, backgroundColor: '#059669' },
          { label: 'Pilar III: Comfort (20%)', data: p3Scores, backgroundColor: '#d97706' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { suggestedMin: 0, suggestedMax: 100 } }
      }
    });

    // 7. Render Pilar I Sub-modul Table
    const p1Body = document.getElementById("pilar1-table-body");
    p1Body.innerHTML = "";
    const modScores = p1Data.module_scores || {};

    Object.keys(modScores).forEach(code => {
      const m = modScores[code];
      const modCfg = rubrikData.pilar1_kognitif?.daftar_modul?.[code] || {};
      let catLabel = "Sedang";
      if (m.final_score >= 80) catLabel = "Sangat Tinggi";
      else if (m.final_score >= 60) catLabel = "Tinggi";
      else if (m.final_score >= 40) catLabel = "Cukup";
      else catLabel = "Kurang";

      const notesObj = rubrikData.pilar1_kognitif?.catatan_analisis_submodul?.[code] || {};
      const noteText = notesObj[catLabel] || modCfg.fokus || "-";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${code}</strong></td>
        <td style="text-align: left; font-weight: 600;">${modCfg.nama || code}</td>
        <td>${m.accuracy_score.toFixed(1)} pts</td>
        <td>${m.speed_score.toFixed(1)} pts</td>
        <td><strong>${m.final_score}</strong></td>
        <td style="text-align: left; font-size: 0.82rem;">${noteText}</td>
      `;
      p1Body.appendChild(tr);
    });

    // 7b. Render Tabel Gatekeeper Kognitif OSN
    const tbodyGatekeeper = document.getElementById("table-pilar1-gatekeeper");
    tbodyGatekeeper.innerHTML = "";
    
    allRanking.forEach(rec => {
      const skorBakat = rec.skor_pilar1_bakat;
      const isLolos = skorBakat >= 60;
      const statusBadge = isLolos
        ? `<span class="badge-status badge-pass">LOLOS GATEKEEPER</span>`
        : `<span class="badge-status badge-locked">GUGUR</span>`;
      
      let catKognitif = "Kurang";
      if (skorBakat >= 80) catKognitif = "Sangat Tinggi";
      else if (skorBakat >= 60) catKognitif = "Tinggi";
      else if (skorBakat >= 40) catKognitif = "Cukup";

      let rubrikBidang = {};
      if(rubrikData.bidang_osn) {
         const key = Object.keys(rubrikData.bidang_osn).find(k => rubrikData.bidang_osn[k].nama_bidang === rec.bidang);
         rubrikBidang = key ? rubrikData.bidang_osn[key] : (rubrikData.bidang_osn[rec.bidang] || {});
      }
      const implikasiAkademis = rubrikBidang.implikasi_akademis || "-";

      tbodyGatekeeper.innerHTML += `
        <tr>
          <td style="font-weight: 700; text-align: left; color:#1e3a8a;">${rec.bidang}</td>
          <td><strong>${skorBakat}</strong></td>
          <td>${catKognitif}</td>
          <td>${statusBadge}</td>
          <td style="text-align: left; font-size: 0.82rem;">${implikasiAkademis}</td>
        </tr>
      `;
    });

    // 8. Render Pilar II Table (Tabel Minat)
    const p2Body = document.getElementById("pilar2-table-body");
    p2Body.innerHTML = "";
    const p2Pure = p2Data.pure_scores || {};
    
    const klasterGroup = {
      "Genuine Interest": [],
      "Surface Fan": [],
      "Cross-Disciplinary Synergy": []
    };

    allRanking.forEach(rec => {
       const skorBakat = rec.skor_pilar1_bakat;
       const skorMinat = rec.skor_pilar2_minat;
       
       let catMinat = "Rendah";
       if (skorMinat >= 80) catMinat = "Sangat Tinggi";
       else if (skorMinat >= 60) catMinat = "Tinggi";
       else if (skorMinat >= 40) catMinat = "Sedang";
       
       let rubrikBidang = {};
       if(rubrikData.bidang_osn) {
          const key = Object.keys(rubrikData.bidang_osn).find(k => rubrikData.bidang_osn[k].nama_bidang === rec.bidang);
          rubrikBidang = key ? rubrikData.bidang_osn[key] : (rubrikData.bidang_osn[rec.bidang] || {});
       }
       const implikasiMotivasi = rubrikBidang.implikasi_motivasi || "-";
       const pureScore = p2Pure["MIN_" + rec.bidang] || p2Pure[rec.bidang] || 70;

       p2Body.innerHTML += `
        <tr>
          <td style="text-align: left; font-weight: 600;">${rec.bidang}</td>
          <td>${pureScore} pts</td>
          <td><strong>${skorMinat}</strong></td>
          <td><span class="tag-pill">${catMinat}</span></td>
          <td style="text-align: left; font-size: 0.82rem;">${implikasiMotivasi}</td>
        </tr>
       `;

       let klaster = "";
       if (skorBakat >= 60 && skorMinat >= 60) klaster = "Genuine Interest";
       else if (skorBakat < 60 && skorMinat >= 60) klaster = "Surface Fan";
       else if (skorBakat >= 60 && skorMinat < 60) klaster = "Cross-Disciplinary Synergy";
       else klaster = "Lainnya";
       
       if(klasterGroup[klaster]) klasterGroup[klaster].push(rec.bidang);
    });

    // 8c. Render Tabel Analisis Klaster Diagnostik
    const tbodyKlaster = document.getElementById("table-pilar2-klaster");
    tbodyKlaster.innerHTML = "";
    const dataKlasterRubrik = rubrikData.klaster_diagnostik || {};
    const urutanKlaster = ["Genuine Interest", "Surface Fan", "Cross-Disciplinary Synergy"];

    urutanKlaster.forEach(namaKlaster => {
      const bidangTerkait = klasterGroup[namaKlaster];
      if (bidangTerkait && bidangTerkait.length > 0) {
        const infoKlaster = dataKlasterRubrik[namaKlaster] || {};
        const teksDiag = infoKlaster.diagnostik || infoKlaster.informasi_diagnostik || "-";
        const teksKons = infoKlaster.konseling || infoKlaster.tindakan_konseling || "-";
        
        tbodyKlaster.innerHTML += `
          <tr>
            <td style="font-weight: 800; color: #0f172a; text-align: left;">${namaKlaster}</td>
            <td style="text-align: left;">
              ${bidangTerkait.map(b => `<span class="tag-pill" style="margin-bottom:4px;">${b}</span>`).join(" ")}
            </td>
            <td style="text-align: left; font-size: 0.82rem;">${teksDiag}</td>
            <td style="text-align: left; font-size: 0.82rem;">${teksKons}</td>
          </tr>
        `;
      }
    });

    // 9. Render Pilar III Table
    const p3Body = document.getElementById("pilar3-table-body");
    p3Body.innerHTML = "";
    const p3Eval = p3Data.field_results || {};

    allRanking.forEach(rec => {
      const resKey = Object.keys(p3Eval).find(k => p3Eval[k].field_name === rec.bidang || k === rec.bidang);
      const res = resKey ? p3Eval[resKey] : { score_pilar3: rec.skor_pilar3_persona, intimidation_index: rec.indeks_intimidasi, evaluasi: "-" };
      
      const warnBadge = (res.warning_tag || res.intimidation_index > 3) ? 
        `<span class="badge-status badge-warning">[WARNING: BURNOUT]</span>` : 
        `<span class="badge-status badge-pass">FIT</span>`;

      p3Body.innerHTML += `
        <tr>
          <td style="text-align: left; font-weight: 600;">${rec.bidang}</td>
          <td><strong>${res.score_pilar3}</strong></td>
          <td>${res.intimidation_index.toFixed(2)}</td>
          <td>${warnBadge}</td>
          <td style="text-align: left; font-size: 0.82rem;">${res.evaluasi}</td>
        </tr>
      `;
    });

    // 10. Render Kuadran & Career Projections
    const top1Field = evaluation.top_recommendation.bidang;
    const kuadranText = `<strong>Top Bidang Siswa: ${top1Field}</strong> berada di <strong>KUADRAN I (High Priority / High ROI)</strong>. Siswa memiliki gabungan Bakat Kognitif murni yang lolos batas minimum (PASS) serta Indeks Intimidasi yang stabil (FIT). Sangat layak dialokasikan anggaran pelatihan eksternal penuh (100% Full Grant).`;
    document.getElementById("kuadran-summary-container").innerHTML = kuadranText;

    const careerContainer = document.getElementById("career-projection-container");
    careerContainer.innerHTML = "";

    const top3List = allRanking.slice(0, 3);
    top3List.forEach(rec => {
      if (!rec) return;
      const bKey = Object.keys(rubrikData.bidang_osn || {}).find(k => rubrikData.bidang_osn[k].nama_bidang === rec.bidang) || rec.bidang;
      const proj = rubrikData.proyeksi_karir ? (rubrikData.proyeksi_karir[bKey] || rubrikData.proyeksi_karir[rec.bidang] || { kuliah: [], karir: [] }) : { kuliah: [], karir: [] };
      
      const box = document.createElement("div");
      box.className = "info-box";
      box.innerHTML = `
        <h5 style="margin:0 0 8px 0; color:#1e3a8a; font-size:0.95rem;">🎯 Proyeksi Bidang ${rec.bidang}</h5>
        <div style="font-size:0.85rem; margin-bottom:6px;"><strong>Proyeksi Program Studi:</strong> ${(proj.kuliah || []).join(", ")}</div>
        <div style="font-size:0.85rem;"><strong>Proyeksi Karir Masa Depan:</strong> ${(proj.karir || []).join(", ")}</div>
      `;
      careerContainer.appendChild(box);
    });

    // 11. Render Action Guidance
    document.getElementById("rec-guru").innerText = `Fokuskan pembinaan siswa pada bidang ${top1Field}. Alokasikan pelatih eksternal dan modul intensif. Hindari memaksakan siswa pada bidang yang berstatus LOCKED atau memicu Warning Tag Burnout.`;
    document.getElementById("rec-siswa").innerText = `Pertahankan disiplin belajar pada bidang ${top1Field}. Jangan ragu untuk memperdalam alur penalaran dan terus berlatih soal tingkat lanjut.`;
    document.getElementById("rec-ortu").innerText = `Fasilitasi minat dan daya juang putra/putri Anda di bidang ${top1Field}. Berikan dukungan moral dan sarana belajar yang kondusif.`;

  } catch (err) {
    console.error("Gagal memuat data Laporan OTM:", err);
    alert("Terjadi kesalahan saat menyusun berkas Laporan OTM. Pastikan Anda telah menyelesaikan ketiga pilar.");
  }
});
