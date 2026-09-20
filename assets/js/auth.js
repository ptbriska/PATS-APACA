/* ==========================================================================
   PATS PORTAL - AUTHENTICATION MODULE (assets/js/auth.js)
   Sistem Verifikasi Double-Track (Hybrid Auth):
   - Track 1 (VIP): Token Khusus Ujian dari file local soal.json (Bypass GAS)
   - Track 2 (Eceran): Google Apps Script API (Spreadsheet Real-time Check)
   ========================================================================== */

const PATS_AUTH = {
  // Endpoint Web App Google Apps Script
  GAS_AUTH_ENDPOINT: "https://script.google.com/macros/s/AKfycbxhJ29sqa5M92O6Xfh1UOo1W7TfKh8BiM2BEnaGtgCPMG4OcBLX7C1rGCTrVtn4au6_/exec",
  
  // Key Penyimpanan SessionStorage
  SESSION_KEY: "pats_user_session",

  /**
   * Verifikasi Double-Track (Hybrid)
   * @param {string} namaLengkap - Nama Lengkap Peserta
   * @param {string} kodeInput - Kode Akses Spreadsheet ATAU Token Ujian VIP
   * @param {string} currentTestCode - Kode Modul Tes saat ini (misal: KA1, KS7, KU4)
   * @param {string} vipTokenFromSoalJson - Token khusus ujian dari file soal.json lokal (Opsional)
   * @returns {Promise<{success: boolean, message: string, data?: object}>}
   */
  async verifyParticipant(namaLengkap, kodeInput, currentTestCode, vipTokenFromSoalJson = "") {
    try {
      const inputNama = (namaLengkap || "").trim();
      const inputKode = (kodeInput || "").trim();

      if (!inputNama || !inputKode) {
        return { success: false, message: "Nama Lengkap dan Kode Akses / Token wajib diisi!" };
      }

      // =========================================================================
      // TRACK 1: JALUR VIP / KOLEKTIF (Token Ujian melekat di soal.json)
      // =========================================================================
      if (vipTokenFromSoalJson && inputKode.toUpperCase() === vipTokenFromSoalJson.trim().toUpperCase()) {
        const vipUserData = {
          nama_lengkap: inputNama,
          kode_akses: "VIP-" + currentTestCode,
          jenis_kelamin: "-",
          asal_daerah: "Jalur Kolektif/VIP",
          asal_instansi: "Peserta Kolektif/VIP",
          modul_diizinkan: [currentTestCode],
          is_vip: true
        };

        // Simpan ke Sesi Browser
        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(vipUserData));
        return { 
          success: true, 
          message: "Login Berhasil via Token VIP Kolektif!", 
          data: vipUserData 
        };
      }

      // =========================================================================
      // TRACK 2: JALUR ECERAN / INDIVIDUAL (Verifikasi Real-time ke GAS API)
      // =========================================================================
      const endpoint = `${this.GAS_AUTH_ENDPOINT}?nama=${encodeURIComponent(inputNama)}&kode=${encodeURIComponent(inputKode)}&testCode=${encodeURIComponent(currentTestCode)}`;
      
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error("Gagal terhubung ke server verifikasi API.");

      const result = await response.json();

      if (result.status === "SUCCESS") {
        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(result.user));
        return { 
          success: true, 
          message: result.message || "Verifikasi berhasil!", 
          data: result.user 
        };
      } else {
        return { 
          success: false, 
          message: result.message || "Kombinasi Nama Lengkap atau Kode Akses tidak valid." 
        };
      }

    } catch (error) {
      console.error("Auth Error:", error);
      return { 
        success: false, 
        message: "Terjadi kesalahan sistem atau masalah koneksi internet saat memverifikasi data." 
      };
    }
  },

  /**
   * Memeriksa apakah peserta memiliki sesi aktif
   * @returns {object|null} Data profil peserta jika login, null jika belum
   */
  getSession() {
    const sessionData = sessionStorage.getItem(this.SESSION_KEY);
    return sessionData ? JSON.parse(sessionData) : null;
  },

  /**
   * Proteksi Halaman CBT (Garda Depan)
   * Mengarahkan kembali ke index.html jika belum login atau tidak punya akses
   * @param {string} currentTestCode - Kode Modul Tes saat ini
   */
  protectCbtPage(currentTestCode) {
    const user = this.getSession();
    if (!user) {
      alert("Sesi pengerjaan tidak ditemukan. Silakan login terlebih dahulu!");
      window.location.href = "index.html";
      return null;
    }

    const allowedList = user.modul_diizinkan || [];
    if (!allowedList.includes(currentTestCode) && !allowedList.includes("ALL")) {
      alert("Akses ditolak! Anda tidak terdaftar untuk modul tes " + currentTestCode);
      window.location.href = "index.html";
      return null;
    }

    return user;
  },

  /**
   * Menghapus sesi login peserta
   */
  logout() {
    sessionStorage.removeItem(this.SESSION_KEY);
  }
};
