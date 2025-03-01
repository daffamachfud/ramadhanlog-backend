const db = require("../config/db");
const moment = require("moment-hijri");
const fetch = require("node-fetch");
moment.locale("en");

// Fungsi untuk mencatat amalan harian
const catatAmalanHarian = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { amalan } = req.body;

    console.log("User dari token:", req.user);
    console.log("result user id = ", user_id);

    if (!amalan || !Array.isArray(amalan) || amalan.length === 0) {
      return res.status(400).json({ message: "Daftar amalan tidak boleh kosong" });
    }

    // ✅ Ambil waktu saat ini di zona WIB (Asia/Jakarta)
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("fr-CA", { timeZone: "Asia/Jakarta" });

    // ✅ Format tanggal hari ini (YYYY-MM-DD)
    let today = formatter.format(now);

    // ✅ Ambil jam dan menit saat ini (Format: HH:mm)
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = `${currentHour.toString().padStart(2, "0")}:${currentMinute.toString().padStart(2, "0")}`;

    console.log("🕰️ Waktu sekarang:", currentTime);

    // ✅ Ambil waktu Maghrib dari API waktu sholat BAW (Bandung ID: 1219)
    const cityId = "1219";
    const prayerApiUrl = `https://api.myquran.com/v2/sholat/jadwal/${cityId}/${today}`;

    console.log("🌎 API Waktu Sholat:", prayerApiUrl);

    let maghribTime = "18:00"; // Default jika gagal mengambil API

    try {
      const prayerResponse = await fetch(prayerApiUrl);
      const prayerData = await prayerResponse.json();

      if (prayerData.status === true) {
        const jadwal = prayerData.data.jadwal;
        maghribTime = jadwal.maghrib; // Contoh: "18:15"
      } else {
        console.error("⚠️ Gagal mengambil waktu sholat:", prayerData);
      }
    } catch (error) {
      console.error("⚠️ Error mengambil data waktu sholat:", error);
    }

    console.log("🌅 Waktu Maghrib dari API:", maghribTime);

    // ✅ Jika waktu sekarang lebih dari Maghrib, gunakan tanggal besok
    if (currentTime >= maghribTime) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      today = formatter.format(tomorrow);
      console.log("🌙 Sudah lewat Maghrib, gunakan tanggal besok:", today);
    }

    // ✅ Ambil daftar ID amalan dari request
    const amalanIds = amalan.map((item) => item.id);
    const amalanList = await db("amalan")
      .whereIn("id", amalanIds)
      .select("id", "name");

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

      // ✅ Cek apakah data sudah ada untuk tanggal ini
      const existingAmalan = await db("amalan_harian")
        .where({
          user_id,
          amalan_id: id,
          tanggal: today,
        })
        .first();

      // ✅ Normalisasi nilai ke lowercase
      const nilaiLower = nilai ? nilai.toLowerCase() : "";
      let updatedStatus = done;

      console.log("📌 Nilai Amalan:", nilaiLower);

      // ✅ Aturan khusus untuk beberapa amalan tertentu
      if (
        (amalanExists.name.toLowerCase() === "sholat sunnah malam" && (nilaiLower === "tidak shalat" || nilaiLower === "")) ||
        (amalanExists.name.toLowerCase() === "jaga waktu syuruq" && (nilaiLower === "tidak melakukan" || nilaiLower === "")) ||
        (amalanExists.name.toLowerCase() === "sholat dhuha" && (nilaiLower === "tidak shalat" || nilaiLower === "")) ||
        (amalanExists.name.toLowerCase() === "shalat rawatib")
      ) {
        updatedStatus = false;
      }

      if (!existingAmalan) {
        // ✅ Jika belum ada, insert data baru
        await db("amalan_harian").insert({
          user_id,
          amalan_id: id,
          tanggal: today,
          status: updatedStatus,
          nilai: nilai || "",
        });
      } else {
        console.log(`✅ Amalan ID ${id} sudah ada, cek apakah perlu update...`);

        // ✅ Cek apakah status atau nilai berubah
        if (existingAmalan.status !== updatedStatus || existingAmalan.nilai.toLowerCase() !== nilaiLower) {
          console.log(`🔄 Update amalan ID ${id}, karena status atau nilai berubah.`);

          await db("amalan_harian")
            .where({
              user_id,
              amalan_id: id,
              tanggal: today,
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
    const userId = req.user.id;
    const cityId = "1219"; // Kode Kota Bandung di API BAW

    // ✅ Ambil tanggal Masehi hari ini dalam format YYYY-MM-DD (zona WIB)
    const formatter = new Intl.DateTimeFormat("fr-CA", { timeZone: "Asia/Jakarta" });
    const todayMasehi = formatter.format(new Date()); // Contoh: "2025-03-01"

    // ✅ Ambil waktu sekarang (jam:menit) dalam zona WIB
    const currentHour = new Date().getHours();
    const currentMinute = new Date().getMinutes();
    const currentTime = `${currentHour.toString().padStart(2, "0")}:${currentMinute.toString().padStart(2, "0")}`;
    
    // ✅ Ambil waktu Maghrib dari API BAW
    const prayerApiUrl = `https://api.myquran.com/v2/sholat/jadwal/${cityId}/${todayMasehi}`;
    let maghribTime;

    try {
      const prayerResponse = await fetch(prayerApiUrl);
      const prayerData = await prayerResponse.json();

      if (prayerData.status) {
        maghribTime = prayerData.data.jadwal.maghrib; // Contoh: "18:15"
      } else {
        console.error("⚠️ Gagal mengambil waktu Maghrib dari API");
        return res.status(500).json({ success: false, message: "Gagal mengambil waktu sholat" });
      }
    } catch (error) {
      console.error("⚠️ Error mengambil data waktu sholat:", error);
      return res.status(500).json({ success: false, message: "Kesalahan server dalam mengambil waktu sholat" });
    }

    console.log(`⏰ Waktu sekarang: ${currentTime}`);
    console.log(`🕌 Waktu Maghrib: ${maghribTime}`);

    // ✅ Tentukan apakah sekarang sudah melewati Maghrib
    const [currentHourNum, currentMinuteNum] = currentTime.split(":").map(Number);
    const [maghribHourNum, maghribMinuteNum] = maghribTime.split(":").map(Number);

    const isAfterMaghrib = 
      currentHourNum > maghribHourNum || 
      (currentHourNum === maghribHourNum && currentMinuteNum >= maghribMinuteNum);

    // ✅ Jika sudah lewat Maghrib, gunakan tanggal Masehi besok
    let tanggalMasehi = todayMasehi;
    if (isAfterMaghrib) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tanggalMasehi = formatter.format(tomorrow);
    }

    // ✅ Tentukan tanggal Hijriah yang sesuai
    let hijriDate = moment(tanggalMasehi, "YYYY-MM-DD").format("iD iMMMM iYYYY") + " H";
    if (isAfterMaghrib) {
          hijriDate = moment(todayMasehi, "YYYY-MM-DD").add(1, "days").format("iD iMMMM iYYYY") + " H";
    }
    
    console.log(`📅 Tanggal Masehi: ${tanggalMasehi}`);
    console.log(`📅 Tanggal Hijriah: ${hijriDate}`);

    // ✅ Ambil semua amalan
    const daftarAmalan = await db("amalan")
      .select("id", "name", "description", "type", "options", "parent_id")
      .orderBy("order_number", "asc");

    // ✅ Ambil amalan yang sudah dicatat user berdasarkan tanggal yang benar
    const amalanHarian = await db("amalan_harian")
      .select("amalan_id", "status", "nilai")
      .where("user_id", userId)
      .andWhere("tanggal", tanggalMasehi);

    // Ubah hasil menjadi objek untuk pencocokan cepat
    const amalanDicatat = {};
    amalanHarian.forEach((item) => {
      amalanDicatat[item.amalan_id] = {
        status: item.status,
        nilai: item.nilai || "",
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
      done: amalanDicatat[item.id] ? amalanDicatat[item.id].status : false,
      nilai: amalanDicatat[item.id] ? amalanDicatat[item.id].nilai : "",
    }));

    res.json({
      success: true,
      hijriDate,    // ✅ Tanggal Hijriah sesuai waktu Maghrib
      tanggalMasehi, // ✅ Tanggal Masehi juga berubah setelah Maghrib
      data: hasil,
    });
  } catch (error) {
    console.error("❌ Error mengambil amalan harian:", error);
    res.status(500).json({ success: false, message: "Gagal mengambil amalan harian" });
  }
};

module.exports = { catatAmalanHarian, getAllAmalan, getAmalanHarian };
