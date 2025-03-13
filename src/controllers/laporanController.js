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
    console.log(`⏰ Mengambil Data Detail Laporan Tholib`);

    const { tholibId, tanggal } = req.body;
    const cityId = "1219"; // Kode Kota Bandung di API BAW

    console.log("hasil id nya : ", tholibId);
    console.log("hasil date nya : ", tanggal);

    // ✅ Ambil tanggal Masehi hari ini dalam format YYYY-MM-DD
    let todayShalat = new Intl.DateTimeFormat("fr-CA", {
      timeZone: "Asia/Jakarta",
    }).format(new Date());

    // 🔹 Ambil waktu Maghrib dari API BAW
    const prayerApiUrl = `https://api.myquran.com/v2/sholat/jadwal/${cityId}/${todayShalat}`;
    let hijriCurrentDate;
    let hijriCurrentDay;

    try {
      const prayerResponse = await fetch(prayerApiUrl);
      const prayerData = await prayerResponse.json();

      if (prayerData.status) {
        const jadwal = prayerData.data.jadwal;
        const maghribTime = jadwal.maghrib;
        const maghribDateTime = new Date(`${todayShalat}T${maghribTime}:00`);
        const now = new Date();

        // 🔹 Jika sekarang masih sebelum Maghrib, gunakan tanggal Hijriah hari ini
        if (now < maghribDateTime) {
          hijriCurrentDate = moment().format("iD iMMMM iYYYY") + " H";
        } else {
          hijriCurrentDate =
            moment().add(1, "days").format("iD iMMMM iYYYY") + " H";
        }

        hijriCurrentDay = parseInt(hijriCurrentDate.split(" ")[0]); // Ambil angka tanggal, contoh: 13
        console.log(`📅 Tanggal Hijriah Saat Ini: ${hijriCurrentDate}`);
      } else {
        console.error("⚠️ Gagal mengambil waktu Maghrib dari API");
        return res
          .status(500)
          .json({ success: false, message: "Gagal mengambil waktu sholat" });
      }
    } catch (error) {
      console.error("⚠️ Error mengambil data waktu sholat:", error);
      return res.status(500).json({
        success: false,
        message: "Kesalahan server dalam mengambil waktu sholat",
      });
    }

    // ✅ Gunakan tanggal yang dipilih atau default ke tanggal Hijriah saat ini
    const selectedHijriDate = tanggal || hijriCurrentDate;
    console.log("Selected date : ", selectedHijriDate);

    // 🔹 Hilangkan "H" di akhir hanya untuk query
    let selectedHijriDateQuery = selectedHijriDate.replace(/H$/, "").trim();
    console.log("Selected date query : ", selectedHijriDateQuery);

    if (!selectedHijriDateQuery.match(/\d{4}$/)) {
      selectedHijriDateQuery += " 1446";
  }

    // 🔹 **Hitung rentang data untuk 30 hari Ramadhan**
    const fullDateRange = [];
    for (let i = 1; i <= 30; i++) {
      fullDateRange.push(`${i} Ramadhan 1446`);
    }

// 🔹 Query database untuk mendapatkan amalan harian
const results = await db("amalan_harian")
  .select("hijri_date", db.raw("COUNT(*) as total"))
  .where({ user_id: tholibId, status: true })
  .groupBy("hijri_date")
  .orderBy("hijri_date", "asc");

// 🔹 Urutkan hasil berdasarkan tanggal Hijriah
const sortedResults = results.sort((a, b) => {
  return (
    parseInt(a.hijri_date.split(" ")[0]) -
    parseInt(b.hijri_date.split(" ")[0])
  );
});

// 🔹 Mapping data ke dalam array lengkap (1 - 30 Ramadhan)
const laporan = fullDateRange.map((date) => {
  const existingData = sortedResults.find((row) => row.hijri_date === date);
  return {
    hijri_date: date,
    total: existingData ? parseInt(existingData.total) : 0, // Jika tidak ada data, set total = 0
  };
});

console.log("🔥 Data Amalan untuk 30 Hari Ramadhan:", laporan);

    // 🔹 Ambil daftar amalan berdasarkan tanggal yang dipilih
    const amalanList = await db("amalan as a")
      .select(
        "a.id as amalan_id",
        "a.name as nama_amalan",
        "a.description as deskripsi",
        db.raw("COALESCE(ah.status, false) as status") // 🔥 Ubah NULL jadi false
      )
      .leftJoin("amalan_harian as ah", function () {
        this.on("a.id", "=", "ah.amalan_id")
          .andOnVal("ah.user_id", tholibId) // Pakai andOnVal biar langsung nilai
          .andOnVal("ah.hijri_date", selectedHijriDateQuery);
      })
      .orderBy("ah.status", "asc");

    const result = await db("amalan_harian")
      .select("status")
      .where("user_id", "=", "49c22b3c-9504-41ae-8a10-ce187a7c9829")
      .andWhere("hijri_date", "=", selectedHijriDateQuery); // Sesuaikan dengan format yang benar di DB

    console.log("🔥 Data status dari DB:", result);

    // 🔹 Format response untuk frontend
    const response = {
      hijri_current_date: hijriCurrentDate, // Tanggal Hijriah saat ini
      selected_date: selectedHijriDate, // Tanggal yang dipilih
      line_chart: laporan.map((item) => ({
        name: `${item.hijri_date}`,
        value: item.total,
      })),
      button_dates: Array.from(
        { length: hijriCurrentDay },
        (_, i) => `${i + 1} Ramadhan`
      ),
      amalan_list: amalanList.map((amalan) => ({
        nama_amalan: amalan.nama_amalan,
        description: amalan.deskripsi, // ✅ Kirim deskripsi ke frontend
        status: amalan.status === true ? true : false, // ✅ Boolean status
      })),
    };

    const groupedAmalan = {};
    response.amalan_list.forEach((amalan) => {
      // Hapus jumlah rakaat untuk mendapatkan kategori utama
      let key = amalan.nama_amalan.replace(/\(\d+ rakaat\)/, "").trim();

      // Jika kategori belum ada, tambahkan langsung
      if (!groupedAmalan[key]) {
        groupedAmalan[key] = amalan;
      } else {
        // Jika sudah ada dan salah satu `status`-nya true, prioritaskan yang `true`
        if (amalan.status) {
          groupedAmalan[key] = amalan;
        }
      }
    });

    // 🔹 Konversi kembali ke array, sambil menghapus "Shalat Rawatib"
response.amalan_list = Object.values(groupedAmalan).filter(
  (amalan) => amalan.nama_amalan !== "Shalat Rawatib"
);
    

    console.log("📊 Data Response:", response);
    return res.json(response);
  } catch (error) {
    console.error("❌ Error get detail laporan tholib:", error);
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

exports.getAmalanLaporanTholib = async (req, res) => {
  try {
    console.log(`⏰ Mengambil Data Detail Laporan Tholib`);

    const { tanggal } = req.body;
    const tholibId = req.user.id;
    const cityId = "1219"; // Kode Kota Bandung di API BAW

    console.log("hasil id nya : ", tholibId);
    console.log("hasil date nya : ", tanggal);

    // ✅ Ambil tanggal Masehi hari ini dalam format YYYY-MM-DD
    let todayShalat = new Intl.DateTimeFormat("fr-CA", {
      timeZone: "Asia/Jakarta",
    }).format(new Date());

    // 🔹 Ambil waktu Maghrib dari API BAW
    const prayerApiUrl = `https://api.myquran.com/v2/sholat/jadwal/${cityId}/${todayShalat}`;
    let hijriCurrentDate;
    let hijriCurrentDay;

    try {
      const prayerResponse = await fetch(prayerApiUrl);
      const prayerData = await prayerResponse.json();

      if (prayerData.status) {
        const jadwal = prayerData.data.jadwal;
        const maghribTime = jadwal.maghrib;
        const maghribDateTime = new Date(`${todayShalat}T${maghribTime}:00`);
        const now = new Date();

        // 🔹 Jika sekarang masih sebelum Maghrib, gunakan tanggal Hijriah hari ini
        if (now < maghribDateTime) {
          hijriCurrentDate = moment().format("iD iMMMM iYYYY") + " H";
        } else {
          hijriCurrentDate =
            moment().add(1, "days").format("iD iMMMM iYYYY") + " H";
        }

        hijriCurrentDay = parseInt(hijriCurrentDate.split(" ")[0]); // Ambil angka tanggal, contoh: 13
        console.log(`📅 Tanggal Hijriah Saat Ini: ${hijriCurrentDate}`);
      } else {
        console.error("⚠️ Gagal mengambil waktu Maghrib dari API");
        return res
          .status(500)
          .json({ success: false, message: "Gagal mengambil waktu sholat" });
      }
    } catch (error) {
      console.error("⚠️ Error mengambil data waktu sholat:", error);
      return res.status(500).json({
        success: false,
        message: "Kesalahan server dalam mengambil waktu sholat",
      });
    }

    // ✅ Gunakan tanggal yang dipilih atau default ke tanggal Hijriah saat ini
    const selectedHijriDate = tanggal || hijriCurrentDate;
    console.log("Selected date : ", selectedHijriDate);

    // 🔹 Hilangkan "H" di akhir hanya untuk query
    let selectedHijriDateQuery = selectedHijriDate.replace(/H$/, "").trim();
    console.log("Selected date query : ", selectedHijriDateQuery);

    if (!selectedHijriDateQuery.match(/\d{4}$/)) {
      selectedHijriDateQuery += " 1446";
    }

    // 🔹 **Hitung rentang data untuk 30 hari Ramadhan**
    const fullDateRange = [];
    for (let i = 1; i <= 30; i++) {
      fullDateRange.push(`${i} Ramadhan 1446`);
    }

    // 🔹 Query database untuk mendapatkan amalan harian
    const results = await db("amalan_harian")
      .select("hijri_date", db.raw("COUNT(*) as total"))
      .where({ user_id: tholibId, status: true })
      .groupBy("hijri_date")
      .orderBy("hijri_date", "asc");

    // 🔹 Urutkan hasil berdasarkan tanggal Hijriah
    const sortedResults = results.sort((a, b) => {
      return (
        parseInt(a.hijri_date.split(" ")[0]) -
        parseInt(b.hijri_date.split(" ")[0])
      );
    });

    // 🔹 Mapping data ke dalam array lengkap (1 - 30 Ramadhan)
    const laporan = fullDateRange.map((date) => {
      const existingData = sortedResults.find((row) => row.hijri_date === date);
      return {
        hijri_date: date,
        total: existingData ? parseInt(existingData.total) : 0, // Jika tidak ada data, set total = 0
      };
    });

    console.log("🔥 Data Amalan untuk 30 Hari Ramadhan:", laporan);

    // 🔹 Ambil daftar amalan berdasarkan tanggal yang dipilih
    const amalanList = await db("amalan as a")
      .select(
        "a.id as amalan_id",
        "a.name as nama_amalan",
        "a.description as deskripsi",
        db.raw("COALESCE(ah.status, false) as status") // 🔥 Ubah NULL jadi false
      )
      .leftJoin("amalan_harian as ah", function () {
        this.on("a.id", "=", "ah.amalan_id")
          .andOnVal("ah.user_id", tholibId) // Pakai andOnVal biar langsung nilai
          .andOnVal("ah.hijri_date", selectedHijriDateQuery);
      })
      .orderBy("ah.status", "asc");

    const result = await db("amalan_harian")
      .select("status")
      .where("user_id", "=", "49c22b3c-9504-41ae-8a10-ce187a7c9829")
      .andWhere("hijri_date", "=", selectedHijriDateQuery); // Sesuaikan dengan format yang benar di DB

    console.log("🔥 Data status dari DB:", result);

    const user = await db("users").where("id", tholibId).select("name").first(); // Mengambil satu baris data

    const name = user ? user.name : null; // Mengambil nama atau null jika tidak ditemukan

    // 🔹 Format response untuk frontend
    const response = {
      hijri_current_date: hijriCurrentDate, // Tanggal Hijriah saat ini
      selected_date: selectedHijriDate, // Tanggal yang dipilih
      line_chart: laporan.map((item) => ({
        name: `${item.hijri_date}`,
        value: item.total,
      })),
      button_dates: Array.from(
        { length: hijriCurrentDay },
        (_, i) => `${i + 1} Ramadhan`
      ),
      amalan_list: amalanList.map((amalan) => ({
        nama_amalan: amalan.nama_amalan,
        description: amalan.deskripsi, // ✅ Kirim deskripsi ke frontend
        status: amalan.status === true ? true : false, // ✅ Boolean status
      })),
      name: name,
    };

    const groupedAmalan = {};
    response.amalan_list.forEach((amalan) => {
      // Hapus jumlah rakaat untuk mendapatkan kategori utama
      let key = amalan.nama_amalan.replace(/\(\d+ rakaat\)/, "").trim();

      // Jika kategori belum ada, tambahkan langsung
      if (!groupedAmalan[key]) {
        groupedAmalan[key] = amalan;
      } else {
        // Jika sudah ada dan salah satu `status`-nya true, prioritaskan yang `true`
        if (amalan.status) {
          groupedAmalan[key] = amalan;
        }
      }
    });

    // 🔹 Konversi kembali ke array, sambil menghapus "Shalat Rawatib"
    response.amalan_list = Object.values(groupedAmalan).filter(
      (amalan) => amalan.nama_amalan !== "Shalat Rawatib"
    );

    console.log("📊 Data Response:", response);
    return res.json(response);
  } catch (error) {
    console.error("❌ Error get detail laporan tholib:", error);
    res.status(500).json({
      message: "Terjadi kesalahan saat mengambil detail laporan tholib",
      error: error.message,
    });
  }
};
