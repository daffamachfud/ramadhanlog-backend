const db = require("../db/knex");

const getDashboardMurabbi = async (req, res) => {
  try {
    const murabbiId = req.user.id; // Ambil ID murabbi dari token JWT
    const today = new Date().toISOString().split("T")[0];

    // 1. Ambil semua tholib yang tergabung dalam halaqah murabbi
    const tholibs = await db("users")
      .join("relasi_halaqah_tholib", "users.id", "=", "relasi_halaqah_tholib.tholib_id")
      .join("halaqah", "relasi_halaqah_tholib.halaqah_id", "=", "halaqah.id")
      .where("halaqah.murabbi_id", murabbiId)
      .select("users.id", "users.name", "halaqah.id as halaqah_id", "halaqah.name");

    const totalTholib = tholibs.length;
    const tholibIds = tholibs.map(t => t.id);

    if (totalTholib === 0) {
      return res.json({
        success: true,
        data: {
          totalTholib: 0,
          reportedTholib: 0,
          avgTilawah: 0,
          unreportedTholib: 0,
          tholibReports: [],
        },
      });
    }

    // 2. Hitung jumlah tholib yang sudah submit amalan harian
    const reportedTholibs = await db("amalan_harian")
      .distinct("user_id")
      .whereIn("user_id", tholibIds)
      .andWhere("tanggal", today);

    const reportedCount = reportedTholibs.length;

    // 3. Ambil ID amalan tilawah dari tabel amalan
    const tilawahAmalan = await db("amalan")
      .where("name", "Tilawah minimal 1 juz / Hari")
      .first();

    let avgTilawah = 0;
    if (tilawahAmalan) {
      const tilawahData = await db("amalan_harian")
        .where("tanggal", today)
        .andWhere("amalan_id", tilawahAmalan.id)
        .whereIn("user_id", tholibIds);

      const totalTilawah = tilawahData.length; // Asumsinya setiap entri tilawah == 1 juz
      avgTilawah = reportedCount ? totalTilawah / reportedCount : 0;
    }

    // 4. Hitung jumlah tholib yang belum laporan
    const unreportedCount = totalTholib - reportedCount;

    const tholibReports = await db("users")
  .join("relasi_halaqah_tholib", "users.id", "=", "relasi_halaqah_tholib.tholib_id")
  .join("halaqah", "relasi_halaqah_tholib.halaqah_id", "=", "halaqah.id")
  .whereIn("users.id", reportedTholibs.map(t => t.user_id))
  .select(
    "users.id",
    "users.name as user_name", // Alias untuk membedakan dengan halaqah
    "halaqah.name as nama_halaqah" // Alias untuk membedakan dengan users.name
  );

    return res.json({
      success: true,
      data: {
        totalTholib,
        reportedTholib: reportedCount,
        avgTilawah,
        unreportedTholib: unreportedCount,
        tholibReports,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

module.exports = { getDashboardMurabbi };
