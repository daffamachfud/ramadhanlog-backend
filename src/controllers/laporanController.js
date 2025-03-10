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
    const { nama } = req.query;
    const pengawasId = req.user.id;

    let query = db("users as u")
      .join("relasi_halaqah_tholib as rth", "u.id", "rth.tholib_id")
      .join("halaqah as h", "rth.halaqah_id", "h.id")
      .where("h.pengawas_id", pengawasId)
      .select("u.id", "u.name", "h.name as halaqah");

    // Filter jika nama tholib diberikan
    console.log("parameter laporan nama:",nama)
    if (nama) {
      query = query.where("u.name", "like", `%${nama}%`);
    }

    const laporan = await query;

    console.log("hasil laporan backend:",laporan)


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
    let hijriDate;
    let hijriDateForDb;

    try {
      const prayerResponse = await fetch(prayerApiUrl);
      const prayerData = await prayerResponse.json();

      if (prayerData.status) {
        const jadwal = prayerData.data.jadwal;
        const maghribTime = jadwal.maghrib; // Contoh: "18:15"
        const maghribDateTime = new Date(`${todayShalat}T${maghribTime}:00`);
        const now = new Date();
        // 🔹 Jika sekarang masih sebelum Maghrib, gunakan tanggal hijriah hari ini
        if (now < maghribDateTime) {
          hijriDate = moment().format("iD iMMMM iYYYY") + " H";
          hijriDateForDb = moment().format("iD iMMMM iYYYY");
        } else {
          hijriDate = moment().add(1, "days").format("iD iMMMM iYYYY") + " H";
          hijriDateForDb = moment().add(1, "days").format("iD iMMMM iYYYY");
        }

        console.log(`📅 Tanggal Hijriah: ${hijriDate}`);
        console.log(`📅 Tanggal Hijriah DB: ${hijriDateForDb}`);
        
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
      const besok = new Date(todayShalat);
      besok.setDate(besok.getDate() + 1);
      tanggalMasehi = besok.toISOString().split("T")[0]; // Format YYYY-MM-DD
    }

    console.log(`📅 Tanggal Masehi yang digunakan: ${tanggalMasehi}`);
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
          .andOn("ah.hijri_date", "=", db.raw("?", [tanggal]));
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

exports.getDetailLaporanTholibMingguan = async (req, res) => {
  try {
    console.log("📊 Mengambil laporan mingguan Tholib...");

    const { tholibId } = req.body;

    // 🔹 Ambil tahun Hijriah terbaru
    let latestHijriYear = moment().format("iYYYY");

    // 🔹 Paksa tanggal menjadi 1 Ramadhan tahun ini
    let startHijriDate = `1 Ramadhan 1446`;
    let endHijriDate = `7 Ramadhan 1446`;

    console.log(`🔹 Rentang Tanggal Hijriah: ${startHijriDate} - ${endHijriDate}`);

    // 🔹 Ambil total amalan per hari dari database
    const results = await db("amalan_harian")
      .select("hijri_date", db.raw("COUNT(*) as total"))
      .where({ user_id: tholibId, status: true })
      .andWhereBetween("hijri_date", [startHijriDate, endHijriDate])
      .groupBy("hijri_date")
      .orderBy("hijri_date", "asc");

    console.log("📊 Hasil Mingguan:", results);

    // 🔹 Format ulang hasil agar semua tanggal dari 1-7 Ramadhan selalu ada
    let summary = [
      { name: "1 Ramadhan", value: 0 },
      { name: "2 Ramadhan", value: 0 },
      { name: "3 Ramadhan", value: 0 },
      { name: "4 Ramadhan", value: 0 },
      { name: "5 Ramadhan", value: 0 },
      { name: "6 Ramadhan", value: 0 },
      { name: "7 Ramadhan", value: 0 },
    ];
    
    // Update nilai berdasarkan hasil API
    results.forEach(item => {
      let hijriWithoutYear = item.hijri_date.split(" ").slice(0, 2).join(" "); // "X Ramadhan"
      let found = summary.find(s => s.name === hijriWithoutYear);
      if (found) found.value = item.total;
    });

    console.log("📊 Ringkasan Mingguan:", summary);

    // 🔹 Ambil semua amalan dan statusnya dalam rentang 1-7 Ramadhan
    const amalanResults = await db("amalan as a")
      .select(
        "a.id as amalan_id",
        "a.name as nama_amalan",
        "a.type as type",
        "a.description as description",
        "ah.nilai as nilai",
        "ah.hijri_date as hijri_date",
        db.raw(`
          CASE 
            WHEN ah.status IS NULL THEN false
            ELSE ah.status
          END as status
        `)
      )
      .leftJoin("amalan_harian as ah", function () {
        this.on("a.id", "=", "ah.amalan_id").andOn("ah.user_id", "=", db.raw("?", [tholibId]));
      })
      .whereBetween("ah.hijri_date", [startHijriDate, endHijriDate])
      .orderBy("a.order_number", "asc");

    console.log("📊 Data Amalan:", amalanResults);

    // 🔹 Format data agar setiap hari memiliki daftar amalan yang sama
    let amalanPerHari = {
      "1 Ramadhan": [],
      "2 Ramadhan": [],
      "3 Ramadhan": [],
      "4 Ramadhan": [],
      "5 Ramadhan": [],
      "6 Ramadhan": [],
      "7 Ramadhan": [],
    };

    // **Update berdasarkan hasil API**
    amalanResults.forEach(item => {
      let hijriWithoutYear = item.hijri_date.split(" ").slice(0, 2).join(" "); // "X Ramadhan"

      if (amalanPerHari[hijriWithoutYear]) {
        amalanPerHari[hijriWithoutYear].push(item);
      }
    });

    // **Jika ada tanggal yang kosong, isi dengan daftar amalan default**
    for (let date in amalanPerHari) {
      if (amalanPerHari[date].length === 0) {
        amalanPerHari[date] = amalanResults
          .filter(a => a.hijri_date === `${date} 1446`) // Tetap pakai filter
          .map(a => ({
            ...a,
            nilai: a.nilai || null,
            status: a.status || false,
          }));

        // **Jika masih kosong, ambil default dari tabel amalan**
        if (amalanPerHari[date].length === 0) {
          amalanPerHari[date] = await db("amalan")
            .select("id as amalan_id", "name as nama_amalan", "type", "description")
            .orderBy("order_number", "asc")
            .then((amalanList) =>
              amalanList.map((a) => ({
                ...a,
                hijri_date: `${date} 1446`,
                nilai: null,
                status: false,
              }))
            );
        }
      }
    }

    return res.json({ ringkasan_mingguan: summary, amalan: amalanPerHari });
  } catch (error) {
    console.error("⚠️ Error getDetailLaporanTholibMingguan:", error);
    res.status(500).json({
      message: "Terjadi kesalahan saat mengambil laporan mingguan",
      error: error.message,
    });
  }
};
