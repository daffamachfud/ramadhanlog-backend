const db = require("../config/db");
const moment = require("moment-hijri");
moment.locale("in");

// Ambil daftar tholib berdasarkan filter nama/halaqah
exports.getLaporanTholib = async (req, res) => {
  try {
    const { name, halaqah } = req.query;
    const murabbiId = req.user.id;

    // 1. Ambil tanggal hijriah hari ini dari API eksternal
    const hijriApiUrl = `https://api.myquran.com/v2/cal/hijr?adj=-1`;

    const hijriRes = await fetch(hijriApiUrl);
    const hijriData = await hijriRes.json();

    if (!hijriData.status) {
      return res.status(500).json({ message: "Gagal mengambil tanggal hijriah" });
    }

    const hijriDateToday = hijriData.data.date[1];
    const [, hijriMonth, hijriYear] = hijriDateToday.split(" ");
    const fullHijriRange = Array.from({ length: 30 }, (_, i) => `${i + 1} ${hijriMonth} ${hijriYear}`);

    // 2. Ambil data tholib yang ada di halaqah user ini
    let query = db("users as u")
      .join("relasi_halaqah_tholib as rth", "u.id", "rth.tholib_id")
      .join("halaqah as h", "rth.halaqah_id", "h.id")
      .where("h.murabbi_id", murabbiId)
      .select("u.id", "u.name", "h.name as halaqah");

    if (name) {
      query = query.where("u.name", "like", `%${name}%`);
    }

    if (halaqah) {
      query = query.where("h.name", "like", `%${halaqah}%`);
    }

    const tholibList = await query;

    // 3. Ambil seluruh data amalan_harian untuk tholib yang ditemukan, dalam bulan hijriah saat ini
    const tholibIds = tholibList.map((t) => t.id);
    const bulanPattern = `%${hijriMonth} ${hijriYear}`; // contoh: %Syawal 1446

    const amalanData = await db("amalan_harian")
    .whereIn("user_id", tholibIds)
    .andWhere("hijri_date", "like", bulanPattern)
    .andWhere("status", true) // ✅ hanya ambil yang sudah dicentang
    .select("user_id", "hijri_date")
    .groupBy("user_id", "hijri_date")
    .count("* as total");

    // 4. Susun hasil akhir per tholib
    const laporan = tholibList.map((tholib) => {
      const dataPerHari = fullHijriRange.map((tanggal) => {
        const item = amalanData.find(
          (a) => a.user_id === tholib.id && a.hijri_date === tanggal
        );
        return {
          name: tanggal,
          value: item ? parseInt(item.total) : 0,
        };
      });

      console.log("hasil laporan tholib amalan : ",dataPerHari)

      return {
        id: tholib.id,
        name: tholib.name,
        halaqah: tholib.halaqah,
        line_chart: dataPerHari,
      };
    });

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
    console.log("hasil id nya : ", tholibId);
    console.log("hasil date nya : ", tanggal);

    // 🔹 Ambil tanggal Hijriah hari ini dari API MyQuran
    const hijriApiUrl = `https://api.myquran.com/v2/cal/hijr/?adj=-1`;
    let hijriCurrentDate, hijriCurrentDay, hijriCurrentMonth, hijriCurrentYear;

    try {
      const hijriResponse = await fetch(hijriApiUrl);
      const hijriData = await hijriResponse.json();

      if (hijriData.status === true) {
        const fullHijriDate = hijriData.data.date[1]; // "6 Syawal 1446 H"
        hijriCurrentDate = fullHijriDate.replace(" H", ""); // "6 Syawal 1446"
        const [day, month, year] = hijriCurrentDate.split(" ");

        hijriCurrentDay = parseInt(day);
        hijriCurrentMonth = month;
        hijriCurrentYear = year;

        console.log(`📅 Tanggal Hijriah Saat Ini: ${hijriCurrentDate}`);
      } else {
        console.error("⚠️ Gagal mengambil tanggal Hijriah dari API");
        return res.status(500).json({
          success: false,
          message: "Gagal mengambil tanggal Hijriah",
        });
      }
    } catch (error) {
      console.error("⚠️ Error mengambil data Hijriah:", error);
      return res.status(500).json({
        success: false,
        message: "Kesalahan server dalam mengambil tanggal Hijriah",
      });
    }

    // ✅ Gunakan tanggal dari request atau fallback ke hari ini
    const selectedHijriDate = tanggal || hijriCurrentDate;
    const selectedHijriDateQuery = selectedHijriDate.replace(" H", "").trim();
    console.log("Selected date query : ", selectedHijriDateQuery);

    // 🔹 Buat rentang tanggal dinamis berdasarkan hari saat ini
    const fullDateRange = [];
    for (let i = 1; i <= 30; i++) {
      fullDateRange.push(`${i} ${hijriCurrentMonth} ${hijriCurrentYear}`);
    }

    // 🔹 Ambil data amalan harian
    const results = await db("amalan_harian")
      .select("hijri_date", db.raw("COUNT(*) as total"))
      .where({ user_id: tholibId, status: true })
      .groupBy("hijri_date")
      .orderBy("hijri_date", "asc");

    const sortedResults = results.sort((a, b) => {
      return (
        parseInt(a.hijri_date.split(" ")[0]) -
        parseInt(b.hijri_date.split(" ")[0])
      );
    });

    const laporan = fullDateRange.map((date) => {
      const existingData = sortedResults.find((row) => row.hijri_date === date);
      return {
        hijri_date: date,
        total: existingData ? parseInt(existingData.total) : 0,
      };
    });

    // 🔹 Ambil daftar amalan untuk tanggal yang dipilih
    const amalanList = await db("amalan as a")
      .select(
        "a.id as amalan_id",
        "a.name as nama_amalan",
        "a.description as deskripsi",
        db.raw("COALESCE(ah.status, false) as status")
      )
      .leftJoin("amalan_harian as ah", function () {
        this.on("a.id", "=", "ah.amalan_id")
          .andOnVal("ah.user_id", tholibId)
          .andOnVal("ah.hijri_date", selectedHijriDateQuery);
      })
      .orderBy("ah.status", "asc");

    // 🔹 Format button dates
    const buttonDates = Array.from({ length: hijriCurrentDay }, (_, i) => {
      return `${i + 1} ${hijriCurrentMonth}`;
    });

    // 🔹 Format final response
    const response = {
      hijri_current_date: hijriCurrentDate,
      selected_date: selectedHijriDate,
      line_chart: laporan.map((item) => ({
        name: item.hijri_date,
        value: item.total,
      })),
      button_dates: buttonDates,
      amalan_list: [],
    };

    // 🔹 Kelompokkan amalan berdasarkan kategori
    const groupedAmalan = {};
    amalanList.forEach((amalan) => {
      let key = amalan.nama_amalan.replace(/\(\d+ rakaat\)/, "").trim();

      if (!groupedAmalan[key]) {
        groupedAmalan[key] = amalan;
      } else {
        if (amalan.status) {
          groupedAmalan[key] = amalan;
        }
      }
    });

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
    console.log("⏰ Mengambil Data Detail Laporan Tholib");

    const { tanggal } = req.body;
    const tholibId = req.user.id;
    console.log("🔍 User ID:", tholibId);
    console.log("📅 Tanggal yang diminta:", tanggal);

    // ✅ Ambil tanggal Hijriah dari API MyQuran (adj=-1)
    let hijriCurrentDate = "";
    let hijriDateList = [];

    try {
      const today = new Date().toISOString().split("T")[0];
      const hijriApi = `https://api.myquran.com/v2/cal/hijr/${today}?adj=-1`;

      const hijriRes = await fetch(hijriApi);
      const hijriData = await hijriRes.json();

      if (!hijriData.status || typeof hijriData.data !== "object") {
        throw new Error("Format data Hijriah dari API tidak sesuai");
      }

      // Ambil data tanggal dari response API
      const hijriDateString = hijriData.data.date[1]; // contoh: "5 Syawal 1446 H"
      hijriCurrentDate = hijriDateString.replace(" H", "").trim(); // "5 Syawal 1446"
      console.log("📅 Tanggal Hijriah Hari Ini:", hijriCurrentDate);

      const currentDay = hijriData.data.num[0]; // angka hari (misal: 5)
      const currentMonth = hijriDateString.split(" ")[1]; // nama bulan hijriah: Syawal
      const currentYear = hijriData.data.num[6]; // tahun hijriah: 1446

      // Buat daftar 30 hari kebelakang (asumsi semua dalam bulan yang sama)
      hijriDateList = Array.from({ length: 30 }, (_, i) => `${i + 1} ${currentMonth} ${currentYear}`);
    } catch (error) {
      console.error("❌ Gagal mengambil tanggal Hijriah:", error.message);
      return res.status(500).json({
        success: false,
        message: "Gagal mengambil tanggal Hijriah dari API",
      });
    }

    // ✅ Gunakan tanggal dari user (kalau ada), atau default ke tanggal Hijriah hari ini
    const selectedHijriDate = tanggal || hijriCurrentDate;
    console.log("📅 Selected date:", selectedHijriDate);

    // Untuk query ke DB, pastikan ada tahun hijriahnya
    let selectedHijriDateQuery = selectedHijriDate.replace(/H$/, "").trim();
    if (!selectedHijriDateQuery.match(/\d{4}$/)) {
      selectedHijriDateQuery += ` ${hijriDateList[0].split(" ")[2]}`; // Tambahkan tahun
    }

    // 🔍 Ambil amalan harian (hanya yang status true) berdasarkan user dan rentang 30 hari terakhir
    const results = await db("amalan_harian")
      .select("hijri_date", db.raw("COUNT(*) as total"))
      .where({ user_id: tholibId, status: true })
      .whereIn("hijri_date", hijriDateList)
      .groupBy("hijri_date")
      .orderBy("hijri_date", "asc");

    // 🔁 Mapping data berdasarkan 30 hari terakhir (0 jika tidak ada)
    const laporan = hijriDateList.map((date) => {
      const existingData = results.find((row) => row.hijri_date === date);
      return {
        hijri_date: date,
        total: existingData ? parseInt(existingData.total) : 0,
      };
    });

    // 🔍 Ambil daftar amalan dan status berdasarkan selectedHijriDate
    const amalanList = await db("amalan as a")
      .select(
        "a.id as amalan_id",
        "a.name as nama_amalan",
        "a.description as deskripsi",
        db.raw("COALESCE(ah.status, false) as status")
      )
      .leftJoin("amalan_harian as ah", function () {
        this.on("a.id", "=", "ah.amalan_id")
          .andOnVal("ah.user_id", tholibId)
          .andOnVal("ah.hijri_date", selectedHijriDateQuery);
      })
      .orderBy("ah.status", "asc");

    // 🔍 Ambil nama user
    const user = await db("users").where("id", tholibId).select("name").first();
    const name = user ? user.name : null;

    // 🔢 Ambil angka tanggal dari hijriCurrentDate (misal: 5 Syawal -> 5)
    const hijriCurrentDay = parseInt(hijriCurrentDate.split(" ")[0]) || 1;

    // 📦 Format final response
    const response = {
      hijri_current_date: hijriCurrentDate,
      selected_date: selectedHijriDate,
      line_chart: laporan.map((item) => ({
        name: item.hijri_date,
        value: item.total,
      })),
      button_dates: hijriDateList.slice(0, hijriCurrentDay),
      amalan_list: [],
      name: name,
    };

    // 🔁 Grouping amalan berdasarkan kategori (hilangkan redundansi rakaat)
    const groupedAmalan = {};
    amalanList.forEach((amalan) => {
      const key = amalan.nama_amalan.replace(/\(\d+ rakaat\)/, "").trim();
      if (!groupedAmalan[key] || amalan.status) {
        groupedAmalan[key] = amalan;
      }
    });

    // ✅ Filter & isi `amalan_list`
    response.amalan_list = Object.values(groupedAmalan)
      .filter((amalan) => amalan.nama_amalan !== "Shalat Rawatib")
      .map((amalan) => ({
        nama_amalan: amalan.nama_amalan,
        description: amalan.deskripsi,
        status: amalan.status === true,
      }));

    console.log("📊 Data Response:", response);
    return res.json(response);
  } catch (error) {
    console.error("❌ Error get detail laporan tholib:", error);
    return res.status(500).json({
      message: "Terjadi kesalahan saat mengambil detail laporan tholib",
      error: error.message,
    });
  }
};



