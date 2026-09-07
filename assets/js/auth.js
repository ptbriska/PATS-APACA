/* ==========================================================================
   PATS PORTAL - AUTHENTICATION MODULE (auth.js)
   ========================================================================== */

const PATS_AUTH = {
  // Path default database peserta
  DATA_URL: "../../peserta.json",

  /**
   * Memverifikasi Nama Lengkap & Kode Kegiatan peserta
   * @param {string} namaLengkap 
   * @param {string} kodeKegiatan 
   * @returns {Promise<{success: boolean, message: string, data?: object}>}
   */
  async verifyParticipant(namaLengkap, kodeKegiatan) {
    try {
      const response = await fetch(this.DATA_URL);
      if (!response.ok) throw new Error("Gagal memuat database peserta.");

      const participants = await response.json();
      
      // Sanitasi input untuk pencocokan (case-insensitive & trim space)
      const inputNama = namaLengkap.trim().toLowerCase();
      const inputKode = kodeKegiatan.trim().toLowerCase();

      // Pencocokan kombinasi Nama Lengkap + Kode Kegiatan
      const matchedUser = participants.find(p => 
        p.nama_lengkap.trim().toLowerCase() === inputNama &&
        p.kode_kegiatan.trim().toLowerCase() === inputKode
      );

      if (matchedUser) {
        // Simpan data profil ke sessionStorage
        sessionStorage.setItem("pats_user_session", JSON.stringify(matchedUser));
        return { success: true, message: "Verifikasi berhasil!", data: matchedUser };
      } else {
        return { success: false, message: "Nama Lengkap atau Kode Kegiatan tidak ditemukan." };
      }
    } catch (error) {
      console.error("Auth Error:", error);
      return { success: false, message: "Terjadi kesalahan sistem saat memverifikasi data." };
    }
  },

  /**
   * Memeriksa apakah peserta sudah terverifikasi di sesi aktif
   * @returns {object|null} Data peserta jika login, null jika belum
   */
  getSession() {
    const sessionData = sessionStorage.getItem("pats_user_session");
    return sessionData ? JSON.parse(sessionData) : null;
  },

  /**
   * Menghapus sesi login peserta
   */
  logout() {
    sessionStorage.removeItem("pats_user_session");
  }
};
