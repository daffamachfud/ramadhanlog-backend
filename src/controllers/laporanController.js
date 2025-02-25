const db = require("../config/db");

// Ambil daftar tholib berdasarkan filter nama/halaqah
exports.getLaporanTholib = async (req, res) => {
  try {
    const { name, halaqah } = req.query;

    let query = db("users as u")
    .join("relasi_halaqah_tholib as rth", "u.id", "rth.tholib_id")
    .join("halaqah as h", "rth.halaqah_id", "h.id")
    .where("u.role", "tholib")
    .select("u.id", "u.name", "h.name as halaqah");

    const values = [];

   // Filter jika nama tholib diberikan
   if (name) {
    query = query.where("u.name", "like", `%${name}%`);
  }

  // Filter jika halaqah diberikan
  if (halaqah) {
    query = query.where("h.name", "like", `%${halaqah}%`);
  }

    const laporan = await query;

    res.json(laporan);
  } catch (error) {
    console.error("Error get laporan tholib:", error);
    res.status(500).json({
      message: "Terjadi kesalahan saat mengambil data laporan tholib",
      error: error.message,
    });
  }
};

// Ambil detail amalan tholib berdasarkan ID
exports.getDetailLaporanTholib = async (req, res) => {
  try {
    const { tholibId, tanggal } = req.body; // Ambil dari body request

    console.log("Body Tholib ID:", tholibId);
    console.log("Body Tanggal:", tanggal);
    // Pastikan query menggunakan await agar tidak menghasilkan Promise
    const laporan = await db("amalan_harian as ah")
    .select(
      "ah.id",
      "ah.tanggal",
      "a.name as nama_amalan",
      "ah.status"
    )
    .innerJoin("amalan as a", "ah.amalan_id", "a.id")
    .where("ah.user_id", tholibId)
    .andWhere("ah.tanggal", tanggal)
    .orderBy("ah.tanggal", "asc");
    
    console.log("Query result:", laporan);
    return res.json({ data: laporan });
  } catch (error) {
    console.error("Error get detail laporan tholib:", error);
    res.status(500).json({
      message: "Terjadi kesalahan saat mengambil detail laporan tholib",
      error: error.message,
    });
  }
};
