const db = require("../config/db");

// Fungsi untuk mencatat amalan harian
const catatAmalanHarian = async (req, res) => {
  try {
    const user_id = req.user.id; // Ambil ID user dari token JWT
    const { amalan } = req.body; // Ambil daftar amalan dari request

    console.log("User dari token:", req.user);
    console.log("result user id = ", user_id);

    if (!amalan || !Array.isArray(amalan) || amalan.length === 0) {
      return res
        .status(400)
        .json({ message: "Daftar amalan tidak boleh kosong" });
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
      console.log("amalan ini :", amalanItem);

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
        // ✅ Normalisasi nilai ke lowercase untuk menghindari perbedaan huruf besar/kecil
        const nilaiLower = nilai ? nilai.toLowerCase() : "";

        let updatedStatus = amalanItem.done;
        console.log("amalan ini nilai :", nilaiLower);
        if (
          (amalanExists.name.toLowerCase() === "sholat sunnah malam" && (nilaiLower === "tidak shalat" || nilaiLower === "")) ||
          (amalanExists.name.toLowerCase() === "jaga waktu syuruq" && (nilaiLower === "tidak melakukan" || nilaiLower === "")) ||
          (amalanExists.name.toLowerCase() === "sholat dhuha" && (nilaiLower === "tidak shalat" || nilaiLower === "")) || 
          (amalanExists.name.toLowerCase() === "shalat rawatib")
        ) {
          updatedStatus = false;
        }

        await db("amalan_harian").insert({
          user_id,
          amalan_id: id,
          tanggal: today,
          status: updatedStatus, // ❗ Status berubah sesuai kondisi di atas
          nilai: nilai || "", // Simpan nilai dari frontend, jika tidak ada isi dengan string kosong
        });
      } else {
        console.log(
          `Amalan ID ${id} sudah ada, cek apakah perlu update...`
        );

        // ✅ Normalisasi nilai ke lowercase untuk menghindari perbedaan huruf besar/kecil
        const nilaiLower = nilai ? nilai.toLowerCase() : "";

        // ✅ Tentukan kembali status saat update (untuk menangani perubahan dropdown)
        let updatedStatus = amalanItem.done; // ✅ Ambil dari frontend, bukan dari variabel yang belum ada

        console.log("amalan ini nilai :", nilaiLower);
        console.log("amalan ini nama :", amalanExists.name.toLowerCase());

        if (
          (amalanExists.name.toLowerCase() === "sholat sunnah malam" && (nilaiLower === "tidak shalat" || nilaiLower === "")) ||
          (amalanExists.name.toLowerCase() === "jaga waktu syuruq" && (nilaiLower === "tidak melakukan" || nilaiLower === "")) ||
          (amalanExists.name.toLowerCase() === "sholat dhuha" && (nilaiLower === "tidak shalat" || nilaiLower === "")) || 
          (amalanExists.name.toLowerCase() === "shalat rawatib")
        ) {
          updatedStatus = false;
        }

        // ✅ Cek apakah status atau nilai berbeda dari yang sudah tersimpan
        console.log("updated statusnya : ",updatedStatus)
        console.log("status lamanya : ",existingAmalan.status)

        if (
          existingAmalan.status !== updatedStatus ||
          existingAmalan.nilai.toLowerCase() !== nilaiLower
        ) {
          console.log(
            `🔄 Update amalan ID ${id}, karena status ${updatedStatus} atau nilai berubah ${nilai}.`
          );

          await db("amalan_harian")
            .where({
              user_id,
              amalan_id: id,
              tanggal: today,
            })
            .update({
              status: updatedStatus, // ❗ Update status sesuai kondisi dropdown
              nilai: nilai || "",
            });
        } else {
          console.log(
            `✅ Tidak ada perubahan untuk amalan ID ${id}, tetap menggunakan data lama.`
          );
        }
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
      .select(
        "id",
        "name as nama",
        "description",
        "type",
        "options",
        "parent_id"
      )
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
      .select("id", "name", "description", "type", "options", "parent_id")
      .orderBy("order_number", "asc");

    // ✅ Ambil amalan yang sudah dicatat user hari ini, termasuk status-nya
    const amalanHarian = await db("amalan_harian")
      .select("amalan_id", "status", "nilai")
      .where("user_id", userId)
      .andWhere("tanggal", today);

    // Ubah hasil menjadi objek untuk pencocokan cepat
    const amalanDicatat = {};
    amalanHarian.forEach((item) => {
      amalanDicatat[item.amalan_id] = {
        status: item.status, // ✅ Ambil status dari database
        nilai: item.nilai || "", // ✅ Ambil nilai dropdown jika ada
      };
    });

    // Gabungkan semua amalan, tambahkan status `done` dan `nilai`
    const hasil = daftarAmalan.map((item) => ({
      id: item.id,
      nama: item.name,
      description: item.description,
      type: item.type,
      options: item.options,
      parentId: item.parent_id,
      done: amalanDicatat[item.id] ? amalanDicatat[item.id].status : false, // ✅ Gunakan status dari database
      nilai: amalanDicatat[item.id] ? amalanDicatat[item.id].nilai : "", // ✅ Gunakan nilai dari database
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

module.exports = { catatAmalanHarian, getAllAmalan, getAmalanHarian };
