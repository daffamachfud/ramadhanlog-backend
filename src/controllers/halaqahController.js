const db = require("../config/db");

// Ambil daftar halaqah yang dimiliki Murabbi beserta jumlah anggota
const getHalaqahByMurabbi = async (req, res) => {
  try {
    const murabbi_id = req.user.id; // Ambil ID murabbi dari token autentikasi

    const halaqahList = await db("halaqah")
      .where("murabbi_id", murabbi_id)
      .leftJoin("relasi_halaqah_tholib", "halaqah.id", "=", "relasi_halaqah_tholib.halaqah_id")
      .select("halaqah.id", "halaqah.name as nama_halaqah", "halaqah.code", "halaqah.code_pengawas")
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

const addHalaqah = async (req, res) => {
    try {
      const { name, code, code_pengawas } = req.body;
      const murabbi_id = req.user.id; // Ambil ID murabbi dari token
  
      if (!name || !code || !code_pengawas) {
        return res.status(400).json({ message: "Nama, kode halaqah dan kode pengawas halaqah wajib diisi" });
      }
  
      // Cek apakah kode halaqah sudah ada
      const existingHalaqah = await db("halaqah").where({ code }).first();
      if (existingHalaqah) {
        return res.status(400).json({ message: "Kode halaqah sudah digunakan" });
      }
  
      // Insert data ke database
      const [newHalaqah] = await db("halaqah")
        .insert({ name, code, murabbi_id, code_pengawas})
        .returning(["id", "name", "code", "murabbi_id", "code_pengawas"]);
  
      res.status(201).json({ message: "Halaqah berhasil ditambahkan", data: newHalaqah });
    } catch (error) {
      console.error("Error adding halaqah:", error);
      res.status(500).json({ message: "Terjadi kesalahan server" });
    }
  };

module.exports = { getHalaqahByMurabbi, addHalaqah };
