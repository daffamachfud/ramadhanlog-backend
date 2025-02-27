const db = require("../config/db");

// Ambil daftar tholib berdasarkan filter nama/halaqah
exports.getLaporanTholib = async (req, res) => {
  try {
    const { name, halaqah } = req.query;
    const murabbiId = req.user.id;
    
    let query = db("users as u")
    .join("relasi_halaqah_tholib as rth", "u.id", "rth.tholib_id")
    .join("halaqah as h", "rth.halaqah_id", "h.id")
    .where("u.role", "tholib")
    .where("h.murabbi_id", murabbiId) 
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

exports.getLaporanTholibByPengawas = async (req, res) => {
  try {
    const { name } = req.query;
    const pengawasId = req.user.id;
    
    let query = db("users as u")
    .join("relasi_halaqah_tholib as rth", "u.id", "rth.tholib_id")
    .join("halaqah as h", "rth.halaqah_id", "h.id")
    .where("h.pengawas_id", pengawasId) 
    .select("u.id", "u.name", "h.name as halaqah");

    const values = [];

   // Filter jika nama tholib diberikan
   if (name) {
    query = query.where("u.name", "like", `%${name}%`);
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
    const { tholibId, tanggal } = req.body;

    console.log("Body Tholib ID:", tholibId);
    console.log("Body Tanggal:", tanggal);

    const laporan = await db("amalan as a")
      .select(
        "a.id as amalan_id",
        "a.name as nama_amalan",
        "ah.id as laporan_id",
        "ah.tanggal",
        db.raw(`
          CASE 
            WHEN ah.status IS NULL THEN false
            ELSE ah.status
          END as status
        `) // Jika NULL, jadikan false (boolean)
      )
      .leftJoin("amalan_harian as ah", function () {
        this.on("a.id", "=", "ah.amalan_id")
          .andOn("ah.user_id", "=", db.raw("?", [tholibId]))
          .andOn("ah.tanggal", "=", db.raw("?", [tanggal]));
      })
      .orderBy("a.id", "asc");

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

