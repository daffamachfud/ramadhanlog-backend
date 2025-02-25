const db = require("../config/db");

// Ambil daftar halaqah yang dimiliki Murabbi beserta jumlah anggota
const getHalaqahByMurabbi = async (req, res) => {
  try {
    const murabbi_id = req.user.id; // Ambil ID murabbi dari token autentikasi

    const halaqahList = await db("halaqah")
      .where("murabbi_id", murabbi_id)
      .leftJoin("relasi_halaqah_tholib", "halaqah.id", "=", "relasi_halaqah_tholib.halaqah_id")
      .select("halaqah.id", "halaqah.name as nama_halaqah", "halaqah.code")
      .count("relasi_halaqah_tholib.tholib_id as jumlah_anggota")
      .groupBy("halaqah.id");

    res.json({
      success: true,
      data: halaqahList,
    });
  } catch (error) {
    console.error("Gagal mengambil data halaqah:", error);
    res.status(500).json({ success: false, message: "Terjadi kesalahan server" });
  }
};

module.exports = { getHalaqahByMurabbi };
