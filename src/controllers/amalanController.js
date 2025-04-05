const db = require("../config/db");
const moment = require("moment-hijri");
const fetch = require("node-fetch");
moment.locale("en");

// Fungsi untuk mencatat amalan harian
const catatAmalanHarian = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { amalan, hijriDate } = req.body;

    console.log("Catat Amalan Harian");

    if (!amalan || !Array.isArray(amalan) || amalan.length === 0) {
      return res.status(400).json({ message: "Daftar amalan tidak boleh kosong" });
    }

    if (!hijriDate) {
      return res.status(400).json({ message: "Tanggal Hijriah wajib dikirim dari frontend" });
    }

    // ✅ Pastikan semua waktu menggunakan zona WIB (Asia/Jakarta)
    const formatter = new Intl.DateTimeFormat("fr-CA", { timeZone: "Asia/Jakarta" });
    const tanggalMasehi = formatter.format(new Date()); // Contoh: "2025-03-01"

    // ✅ Konversi tanggal Hijriah ke Masehi

    console.log("📆 Tanggal Masehi (Setelah Fix):", tanggalMasehi);
    console.log("🌙 Tanggal Hijriah:", hijriDate);

    // ✅ Ambil daftar ID amalan yang dikirim dari frontend
    const amalanIds = amalan.map((item) => item.id);
    const amalanList = await db("amalan").whereIn("id", amalanIds).select("id", "name");

    if (amalanList.length === 0) {
      return res.status(404).json({ message: "Amalan tidak ditemukan" });
    }

    for (const amalanItem of amalan) {
      const { id, nilai, done } = amalanItem;
      console.log("📝 Amalan yang dicatat:", amalanItem);

      // ✅ Cek apakah amalan ada di database
      const amalanExists = amalanList.find((a) => a.id === id);
      if (!amalanExists) {
        console.log(`⚠️ Amalan dengan ID ${id} tidak ditemukan di database.`);
        continue;
      }

      // ✅ Normalisasi nilai ke lowercase untuk perbandingan
      const nilaiLower = nilai ? nilai.toLowerCase() : "";
      let updatedStatus = done;

      console.log("📌 Nilai Amalan:", nilaiLower);

      // ✅ Aturan khusus untuk beberapa amalan tertentu
      if (
        (amalanExists.name.toLowerCase() === "sholat sunnah malam" &&
          (nilaiLower === "tidak shalat" || nilaiLower === "")) ||
        (amalanExists.name.toLowerCase() === "jaga waktu syuruq" &&
          (nilaiLower === "tidak melakukan" || nilaiLower === "")) ||
        (amalanExists.name.toLowerCase() === "sholat dhuha" &&
          (nilaiLower === "tidak shalat" || nilaiLower === "")) ||
        amalanExists.name.toLowerCase() === "shalat rawatib"
      ) {
        updatedStatus = false;
      }

      // ✅ Cek apakah data sudah ada untuk tanggal ini
      const existingAmalan = await db("amalan_harian")
        .where({
          user_id,
          amalan_id: id,
          hijri_date: hijriDate, // ✅ Pastikan format hijri_date konsisten
        })
        .first();

      if (!existingAmalan) {
        // ✅ Jika belum ada, insert data baru
        await db("amalan_harian").insert({
          user_id,
          amalan_id: id,
          tanggal: tanggalMasehi,
          hijri_date: hijriDate,
          status: updatedStatus,
          nilai: nilai || "",
        });

        console.log(`✅ Amalan ID ${id} dicatat baru.`);
      } else {
        console.log(`✅ Amalan ID ${id} sudah ada, cek apakah perlu update...`);

        // ✅ Cek apakah status atau nilai berubah
        if (
          existingAmalan.status !== updatedStatus ||
          existingAmalan.nilai.toLowerCase() !== nilaiLower
        ) {
          console.log(`🔄 Update amalan ID ${id}, karena status atau nilai berubah.`);

          await db("amalan_harian")
            .where({
              user_id,
              amalan_id: id,
              hijri_date: hijriDate,
            })
            .update({
              status: updatedStatus,
              nilai: nilai || "",
            });
        } else {
          console.log(`✅ Tidak ada perubahan untuk amalan ID ${id}, tetap menggunakan data lama.`);
        }
      }
    }

    res.status(201).json({ message: "Amalan harian berhasil dicatat" });
  } catch (error) {
    console.error("❌ Error mencatat amalan harian:", error);
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
    console.log("📌 Get Amalan Harian");
    console.log("🔍 Mengambil amalan harian dari database...");
    const userId = req.user.id;
    const cityId = "1219"; // Kode Kota Bandung di API BAW

    // Pastikan semua waktu menggunakan zona WIB (Asia/Jakarta)
    const formatter = new Intl.DateTimeFormat("fr-CA", {
      timeZone: "Asia/Jakarta",
    });
    const todayMasehi = formatter.format(new Date());

    console.log("⏰ Tanggal Masehi: ", todayMasehi);

    const now = new Date();
    let currentTime = now.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    });

    // Ambil waktu Maghrib dari API BAW
    const prayerApiUrl = `https://api.myquran.com/v2/sholat/jadwal/${cityId}/${todayMasehi}`;
    let maghribTime;

    try {
      const prayerResponse = await fetch(prayerApiUrl);
      const prayerData = await prayerResponse.json();
      if (prayerData.status) {
        maghribTime = prayerData.data.jadwal.maghrib;
      } else {
        console.error("⚠️ Gagal mengambil waktu Maghrib dari API");
        return res.status(500).json({ success: false, message: "Gagal mengambil waktu sholat" });
      }
    } catch (error) {
      console.error("⚠️ Error mengambil data waktu sholat:", error);
      return res.status(500).json({
        success: false,
        message: "Kesalahan server dalam mengambil waktu sholat",
      });
    }

    console.log(`⏰ Waktu sekarang (string): "${currentTime}"`);
    console.log(`🕌 Waktu Maghrib: ${maghribTime}`);

    currentTime = currentTime.replace(".", ":");
    const [currentHour, currentMinute] = currentTime.split(":").map(Number);
    const [maghribHour, maghribMinute] = maghribTime.split(":").map(Number);
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    const maghribTimeInMinutes = maghribHour * 60 + maghribMinute;
    const isAfterMaghrib = currentTimeInMinutes >= maghribTimeInMinutes;

    console.log(`⏰ Waktu sekarang (menit): ${currentTimeInMinutes}`);
    console.log(`🕌 Waktu Maghrib (menit): ${maghribTimeInMinutes}`);
    console.log(`🔄 Mengambil data kalender Hijriah dari API MyQuran...`);

    let currentHijriDate = "Unknown";

    try {
      const hijriApiUrl = `https://api.myquran.com/v2/cal/hijr/?adj=-1`;
      const calResponse = await fetch(hijriApiUrl);
      const calData = await calResponse.json();

      console.log("✅ Response dari API MyQuran:");
      console.log(JSON.stringify(calData, null, 2));

      if (calData && calData.status && Array.isArray(calData.data.date)) {
        currentHijriDate = calData.data.date[1].replace(" H", "");
        console.log(`📅 currentHijriDate (Acuan Hari Ini): ${currentHijriDate}`);
      } else {
        console.warn("⚠️ Struktur data tidak sesuai ekspektasi:", calData);
      }
    } catch (err) {
      console.error("❌ Error mengambil kalender Hijriah dari API:", err);
    }

    // 🔽 Ambil data amalan harian berdasarkan range 30 hari terakhir dari currentHijriDate
    const hijriTodayMoment = moment(currentHijriDate, "D MMMM YYYY");
    const hijriStartMoment = hijriTodayMoment.clone().subtract(30, "days");

    const hijriStartDate = hijriStartMoment.format("D MMMM YYYY");
    const hijriEndDate = currentHijriDate;

    console.log(`📆 Mengambil amalan dari ${hijriStartDate} hingga ${hijriEndDate}`);

    // Ambil semua amalan
    const daftarAmalan = await db("amalan")
      .select("id", "name", "description", "type", "options", "parent_id")
      .orderBy("order_number", "asc");

    // Ambil amalan harian yang sudah dicatat dalam rentang hijri_date
    const amalanHarian = await db("amalan_harian")
      .select("amalan_id", "status", "nilai", "hijri_date")
      .where("user_id", userId)
      .andWhere("hijri_date", ">=", hijriStartDate)
      .andWhere("hijri_date", "<=", hijriEndDate);

    const amalanDicatat = {};
    amalanHarian.forEach((item) => {
      if (!amalanDicatat[item.hijri_date]) amalanDicatat[item.hijri_date] = {};
      amalanDicatat[item.hijri_date][item.amalan_id] = {
        status: item.status,
        nilai: item.nilai || "",
      };
    });

    const hasil = daftarAmalan.map((item) => ({
      id: item.id,
      nama: item.name,
      description: item.description,
      type: item.type,
      options: item.options,
      parentId: item.parent_id,
      done: amalanDicatat[currentHijriDate]?.[item.id]?.status || false,
      nilai: amalanDicatat[currentHijriDate]?.[item.id]?.nilai || "",
    }));

    res.json({
      success: true,
      hijriDate: currentHijriDate,
      currentHijriDate,
      tanggalMasehi: todayMasehi,
      data: hasil,
    });
  } catch (error) {
    console.error("❌ Error mengambil amalan harian:", error);
    res.status(500).json({ success: false, message: "Gagal mengambil amalan harian" });
  }
};



module.exports = { catatAmalanHarian, getAllAmalan, getAmalanHarian };
