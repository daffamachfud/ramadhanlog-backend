const db = require("../config/db");

// Fungsi untuk mencatat amalan harian
const catatAmalanHarian = async (req, res) => {
    try {
      const user_id = req.user.id; // Ambil ID user dari token JWT
      const { amalan } = req.body; // Ambil daftar amalan dari request

      console.log("User dari token:", req.user);

      console.log('result user id = ',user_id)
  
      if (!amalan || !Array.isArray(amalan) || amalan.length === 0) {
        return res.status(400).json({ message: "Daftar amalan tidak boleh kosong" });
      }
  
      const today = new Date().toISOString().split("T")[0];
  
      // Ambil ID amalan berdasarkan nama yang dikirim frontend
      const amalanList = await db("amalan").whereIn("name", amalan).select("id");
  
      if (amalanList.length === 0) {
        return res.status(404).json({ message: "Amalan tidak ditemukan" });
      }
  
      // Siapkan data untuk disimpan di tabel amalan_harian
      const amalanHarianData = amalanList.map((amalanItem) => ({
        user_id,
        amalan_id: amalanItem.id,
        tanggal: today,
        status: true, // ✅ Amalan sudah dilakukan (karena dicentang)
      }));
  
      // Masukkan ke database
      await db("amalan_harian").insert(amalanHarianData);
  
      res.status(201).json({ message: "Amalan harian berhasil dicatat" });
    } catch (error) {
      console.error("Error mencatat amalan harian:", error);
      res.status(500).json({ message: "Terjadi kesalahan pada server" });
    }
  };

const getAllAmalan = async (req, res) => {
    try {
      const amalanList = await db("amalan").select("id", "name as nama", "description");
  
      return res.json({
        success: true,
        data: amalanList,
      });
    } catch (error) {
      console.error("Error fetching amalan:", error);
      return res.status(500).json({ success: false, message: "Gagal mengambil data amalan" });
    }
  };

  const getAmalanHarian = async (req, res) => {
    try {
      const userId = req.user.id; // Ambil user ID dari token JWT
      const today = new Date().toISOString().split("T")[0]; // Format: YYYY-MM-DD
  
      // ✅ Ambil semua amalan yang ada di database
      const daftarAmalan = await db("amalan").select("id", "name");
  
      // ✅ Ambil amalan yang sudah dicatat user hari ini
      const amalanHarian = await db("amalan_harian")
        .select("amalan_id")
        .where("user_id", userId)
        .andWhere("tanggal", today);
  
      // Ubah ke format lebih mudah untuk dicocokkan
      const amalanDicatat = new Set(amalanHarian.map((item) => item.amalan_id));
  
      // Gabungkan semua amalan, tandai yang sudah dicatat
      const hasil = daftarAmalan.map((item) => ({
        id: item.id,
        nama: item.name,
        done: amalanDicatat.has(item.id), // ✅ Jika ada di amalan_harian, berarti sudah dicatat
      }));
  
      res.json({
        success: true,
        data: hasil,
      });
    } catch (error) {
      console.error("Error mengambil amalan harian:", error);
      res.status(500).json({ success: false, message: "Gagal mengambil amalan harian" });
    }
  };



module.exports = { catatAmalanHarian, getAllAmalan , getAmalanHarian};