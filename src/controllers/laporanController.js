const db = require("../config/db");
const moment = require("moment-hijri");
moment.locale("in");

// Ambil daftar tholib berdasarkan filter nama/halaqah
exports.getLaporanTholib = async (req, res) => {
  try {
    const { name, halaqah } = req.query;
    const murabbiId = req.user.id;

    let query = db("users as u")
      .join("relasi_halaqah_tholib as rth", "u.id", "rth.tholib_id")
      .join("halaqah as h", "rth.halaqah_id", "h.id")
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
    console.log(`⏰ Data Detail Laporan Tholib`);

    const { tholibId, tanggal } = req.body;
    const cityId = "1219"; // Kode Kota Bandung di API BAW
    console.log(`Paramter Tanggal : `,tanggal);

    // Ubah string menjadi Date dengan memastikan zona waktu Asia/Jakart
    // ✅ Ambil tanggal Masehi hari ini dalam format YYYY-MM-DD
    let todayShalat = new Intl.DateTimeFormat("fr-CA", {
      timeZone: "Asia/Jakarta",
    }).format(new Date());

    // ✅ Ambil waktu sekarang (format HH:mm)
    const currentTime = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23", // Format 24 jam (HH:mm)
    }).format(new Date());

    // 🔹 Ambil waktu Maghrib dari API BAW
    const prayerApiUrl = `https://api.myquran.com/v2/sholat/jadwal/${cityId}/${todayShalat}`;
    let maghribTime;

    try {
      const prayerResponse = await fetch(prayerApiUrl);
      const prayerData = await prayerResponse.json();

      if (prayerData.status) {
        maghribTime = prayerData.data.jadwal.maghrib; // Waktu Maghrib (HH:mm)
      } else {
        console.error("⚠️ Gagal mengambil waktu Maghrib dari API");
        return res
          .status(500)
          .json({ success: false, message: "Gagal mengambil waktu sholat" });
      }
    } catch (error) {
      console.error("⚠️ Error mengambil data waktu sholat:", error);
      return res
        .status(500)
        .json({
          success: false,
          message: "Kesalahan server dalam mengambil waktu sholat",
        });
    }

    console.log(`⏰ Waktu sekarang: ${currentTime}`);
    console.log(`🕌 Waktu Maghrib: ${maghribTime}`);

    // ✅ Tentukan apakah sekarang sudah melewati Maghrib
    const isBeforeMaghrib = currentTime < maghribTime;
    console.log(`⏰ Waktu is before magrib: ${isBeforeMaghrib}`);

    // ✅ Tanggal pencatatan Masehi disesuaikan dengan Maghrib
    let tanggalMasehi = todayShalat;
    if (!isBeforeMaghrib) {
      const besok = new Date(todayMasehi);
      besok.setDate(besok.getDate() + 1);
      tanggalMasehi = besok.toISOString().split("T")[0]; // Format YYYY-MM-DD
    }

    console.log(`📅 Tanggal Masehi yang digunakan: ${tanggalMasehi}`);

    let hijriDate;

    try {
          const prayerResponse = await fetch(prayerApiUrl);
          const prayerData = await prayerResponse.json();
    
          if (prayerData.status === true) {
            const jadwal = prayerData.data.jadwal;
            const maghribTime = jadwal.maghrib; // Contoh: "18:15"
            const maghribDateTime = new Date(`${todayShalat}T${maghribTime}:00`);
    
            const now = new Date();
            let hijriDate;
    
            // 🔹 Jika sekarang masih sebelum Maghrib, gunakan tanggal hijriah hari ini
            if (now < maghribDateTime) {
              hijriDate = moment().format("iD iMMMM iYYYY") + " H";
            } else {
              hijriDate = moment().add(1, "days").format("iD iMMMM iYYYY") + " H";
            }
    
            console.log(`📅 Tanggal Hijriah: ${hijriDate}`);
          } else {
            console.error("⚠️ Gagal mengambil waktu sholat:", prayerData);
          }
        } catch (error) {
          console.error("⚠️ Error mengambil data waktu sholat:", error);
        }

    const laporan = await db("amalan as a")
      .select(
        "a.id as amalan_id",
        "a.name as nama_amalan",
        "a.type as type",
        "a.description as description",
        "ah.nilai as nilai",
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
          .andOn("ah.tanggal", "=", db.raw("?", [tanggalMasehi]));
      })
      .orderBy("a.order_number", "asc");

    console.log("Query result:", laporan);
    return res.json({ data: laporan, hijriDate: hijriDate });
  } catch (error) {
    console.error("Error get detail laporan tholib:", error);
    res.status(500).json({
      message: "Terjadi kesalahan saat mengambil detail laporan tholib",
      error: error.message,
    });
  }
};
