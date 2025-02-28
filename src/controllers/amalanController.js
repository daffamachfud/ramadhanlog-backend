const db = require("../config/db");

// Fungsi untuk mencatat amalan harian
const catatAmalanHarian = async (req, res) => {
  try {
    const user_id = req.user.id; // Ambil ID user dari token JWT
    const { amalan } = req.body; // Ambil daftar amalan dari request

    console.log("User dari token:", req.user);
    console.log("result user id = ", user_id);

    if (!amalan || !Array.isArray(amalan) || amalan.length === 0) {
      return res.status(400).json({ message: "Daftar amalan tidak boleh kosong" });
    }

    const today = new Date().toISOString().split("T")[0];

    // Ambil ID amalan berdasarkan ID yang dikirim frontend
    const amalanIds = amalan.map((item) => item.id); // Ambil daftar ID dari request
    const amalanList = await db("amalan")
      .whereIn("id", amalanIds) // Cari berdasarkan ID, bukan nama
      .select("id", "name");

    if (amalanList.length === 0) {
      return res.status(404).json({ message: "Amalan tidak ditemukan" });
    }

    for (const amalanItem of amalan) {
      const { id, nilai } = amalanItem; // Ambil ID dan nilai dari request

      // Cek apakah amalan ini ada dalam daftar amalan di database
      const amalanExists = amalanList.find((a) => a.id === id);
      if (!amalanExists) {
        console.log(`Amalan dengan ID ${id} tidak ditemukan di database.`);
        continue; // Lewati jika amalan tidak ditemukan
      }

      // Cek apakah data sudah ada
      const existingAmalan = await db("amalan_harian")
        .where({
          user_id,
          amalan_id: id,
          tanggal: today,
        })
        .first();

      if (!existingAmalan) {
        // Jika belum ada, insert data baru dengan nilai yang dikirim
        await db("amalan_harian").insert({
          user_id,
          amalan_id: id,
          tanggal: today,
          status: true, // ✅ Amalan sudah dilakukan
          nilai: nilai || "", // Simpan nilai dari frontend, jika tidak ada isi dengan string kosong
        });
      } else {
        console.log(
          `Amalan dengan ID ${id} sudah ada, tidak perlu insert ulang.`
        );
      }
    }

    res.status(201).json({ message: "Amalan harian berhasil dicatat" });
  } catch (error) {
    console.error("Error mencatat amalan harian:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server" });
  }
};

const getAllAmalan = async (req, res) => {
  try {
    const amalanList = await db("amalan")
      .select("id", "name as nama", "description", "type", "options","parent_id")
      .orderBy("order_number", "asc");

    return res.json({
      success: true,
      data: amalanList,
    });
  } catch (error) {
    console.error("Error fetching amalan:", error);
    return res
      .status(500)
      .json({ success: false, message: "Gagal mengambil data amalan" });
  }
};

const getAmalanHarian = async (req, res) => {
  try {
    const userId = req.user.id; // Ambil user ID dari token JWT
    const today = new Date().toISOString().split("T")[0]; // Format: YYYY-MM-DD

    // ✅ Ambil semua amalan yang ada di database
    const daftarAmalan = await db("amalan")
      .select("id", "name", "description","type","options","parent_id")
      .orderBy("order_number", "asc");

    // ✅ Ambil amalan yang sudah dicatat user hari ini
    const amalanHarian = await db("amalan_harian")
      .select("amalan_id", "nilai")
      .where("user_id", userId)
      .andWhere("tanggal", today);

    // Ubah ke format lebih mudah untuk dicocokkan
    const amalanDicatat = {};
    amalanHarian.forEach((item) => {
      amalanDicatat[item.amalan_id] = item.nilai || ""; // Simpan nilai
    });

    /// Gabungkan semua amalan, tandai yang sudah dicatat, dan tambahkan nilai dropdown jika ada
    const hasil = daftarAmalan.map((item) => ({
      id: item.id,
      nama: item.name,
      description: item.description,
      type: item.type,
      options: item.options,
      parentId: item.parent_id,
      done: amalanDicatat[item.id] !== undefined, // ✅ Jika ada di amalan_harian, berarti sudah dicatat
      nilai: amalanDicatat[item.id] || "" // ✅ Ambil nilai dropdown jika ada
    }));

    res.json({
      success: true,
      data: hasil,
    });
  } catch (error) {
    console.error("Error mengambil amalan harian:", error);
    res
      .status(500)
      .json({ success: false, message: "Gagal mengambil amalan harian" });
  }
};

module.exports = { catatAmalanHarian, getAllAmalan, getAmalanHarian };
