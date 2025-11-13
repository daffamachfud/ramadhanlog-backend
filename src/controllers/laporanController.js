const db = require("../config/db");
const moment = require("moment-hijri");
moment.locale("in");

const HIJRI_MONTH_VARIANTS = {
  "Muharram": ["Muharram", "Muharam"],
  Safar: ["Safar"],
  "Rabiul Awal": [
    "Rabiul Awal",
    "Rabiul Awwal",
    "Rabi'ul Awal",
    "Rabi al-Awwal",
  ],
  "Rabiul Akhir": [
    "Rabiul Akhir",
    "Rabiul Tsani",
    "Rabiul Thani",
    "Rabi'ul Akhir",
    "Rabi al-Thani",
  ],
  "Jumadil Awal": [
    "Jumadil Awal",
    "Jumadil Awwal",
    "Jumadil",
    "Jumada al-Awwal",
    "Jumadil Ula",
  ],
  "Jumadil Akhir": [
    "Jumadil Akhir",
    "Jumadil Tsani",
    "Jumadil Thani",
    "Jumada al-Akhirah",
    "Jumadil Ukhra",
  ],
  Rajab: ["Rajab"],
  Syaban: ["Syaban", "Sya'ban", "Sha'ban"],
  Ramadhan: ["Ramadhan", "Ramadan", "Ramazan"],
  Syawal: ["Syawal", "Syawwal", "Shawwal"],
  Zulkaidah: ["Zulkaidah", "Dzulqaidah", "Zulqaidah", "Zulqa'dah"],
  Zulhijjah: ["Zulhijjah", "Dzulhijjah", "Zulhijah", "Dzulhijah"],
};

const HIJRI_MONTH_ALIAS = Object.entries(HIJRI_MONTH_VARIANTS).reduce(
  (acc, [canonical, variants]) => {
    variants.forEach((variant) => {
      acc[variant.toLowerCase()] = canonical;
    });
    return acc;
  },
  {}
);

const normalizeHijriMonth = (month = "") => {
  if (!month) return month;
  const found = HIJRI_MONTH_ALIAS[month.toLowerCase()];
  return found || month;
};

const buildHijriDateVariants = (day, month, year) => {
  if (!month || !year) return [];
  const variants = new Set();
  const monthVariants = HIJRI_MONTH_VARIANTS[month] || [month];
  monthVariants.forEach((variantMonth) => {
    const base = `${day} ${variantMonth} ${year}`.trim();
    variants.add(base);
    variants.add(`${base} H`.trim());
  });
  return Array.from(variants);
};

const parseHijriDateSafe = (
  rawDate = "",
  { defaultDay = 1, defaultMonth = "", defaultYear = "" } = {}
) => {
  const cleaned = (rawDate || "").replace(" H", "").trim();
  const tokens = cleaned.split(" ").filter(Boolean);

  let day = tokens.length ? parseInt(tokens[0], 10) : parseInt(defaultDay, 10);
  if (Number.isNaN(day) || !day) {
    day = parseInt(defaultDay, 10) || 1;
  }

  let yearCandidate = tokens.length ? tokens[tokens.length - 1] : defaultYear;
  let year = parseInt(yearCandidate, 10);
  if (Number.isNaN(year) || !year) {
    year = parseInt(defaultYear, 10) || defaultYear || "";
  }
  year = `${year}`.trim();

  let monthTokens = tokens.slice(1, tokens.length - 1);
  if (!monthTokens.length && tokens.length >= 2) {
    monthTokens = tokens.slice(1);
  }
  let monthRaw = monthTokens.join(" ").trim();
  if (!monthRaw) {
    monthRaw = defaultMonth || "";
  }
  const month = normalizeHijriMonth(monthRaw);
  const formatted = [day, month, year].filter(Boolean).join(" ").trim();
  const variants = buildHijriDateVariants(day, month, year);

  return {
    day,
    month,
    year,
    formatted,
    variants,
  };
};

const buildMonthDayVariants = (month, year, maxDay = 30) => {
  if (!month || !year) return [];
  const variants = new Set();
  const monthVariants = HIJRI_MONTH_VARIANTS[month] || [month];
  for (let i = 1; i <= maxDay; i++) {
    monthVariants.forEach((variantMonth) => {
      const base = `${i} ${variantMonth} ${year}`.trim();
      variants.add(base);
      variants.add(`${base} H`.trim());
    });
  }
  return Array.from(variants);
};

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
    const {
      month: hijriMonth,
      year: hijriYear,
      formatted: hijriTodayCanonical,
    } = parseHijriDateSafe(hijriDateToday);
    const fullHijriRange = Array.from({ length: 30 }, (_, i) => `${i + 1} ${hijriMonth} ${hijriYear}`);
    const monthDayVariants = buildMonthDayVariants(hijriMonth, hijriYear);

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
    const amalanDataQuery = db("amalan_harian")
      .whereIn("user_id", tholibIds)
      .andWhere("status", true)
      .select("user_id", "hijri_date")
      .groupBy("user_id", "hijri_date")
      .count("* as total");

    if (monthDayVariants.length > 0) {
      amalanDataQuery.whereIn("hijri_date", monthDayVariants);
    } else {
      amalanDataQuery.andWhere("hijri_date", "like", `% ${hijriMonth} ${hijriYear}`);
    }

    const amalanData = await amalanDataQuery;

    const aggregatedAmalan = {};
    amalanData.forEach((row) => {
      const key = row.user_id;
      const { formatted } = parseHijriDateSafe(row.hijri_date);
      const canonicalDate = formatted || row.hijri_date;
      if (!aggregatedAmalan[key]) aggregatedAmalan[key] = {};
      aggregatedAmalan[key][canonicalDate] = parseInt(row.total, 10);
    });

    // 4. Susun hasil akhir per tholib
    const laporan = tholibList.map((tholib) => {
      const dataPerHari = fullHijriRange.map((tanggal) => ({
        name: tanggal,
        value: aggregatedAmalan[tholib.id]?.[tanggal] || 0,
      }));

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
    let hijriCurrentDate,
      hijriCurrentDay,
      hijriCurrentMonth,
      hijriCurrentYear,
      hijriCurrentVariants;

    try {
      const hijriResponse = await fetch(hijriApiUrl);
      const hijriData = await hijriResponse.json();

      if (hijriData.status === true) {
        const fullHijriDate = hijriData.data.date[1]; // "6 Syawal 1446 H"
        const parsedCurrent = parseHijriDateSafe(fullHijriDate);
        hijriCurrentDate = parsedCurrent.formatted;
        hijriCurrentDay = parsedCurrent.day;
        hijriCurrentMonth = parsedCurrent.month;
        hijriCurrentYear = parsedCurrent.year;
        hijriCurrentVariants = buildMonthDayVariants(
          hijriCurrentMonth,
          hijriCurrentYear
        );

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
    const selectedParsed = parseHijriDateSafe(tanggal, {
      defaultDay: hijriCurrentDay,
      defaultMonth: hijriCurrentMonth,
      defaultYear: hijriCurrentYear,
    });
    const selectedHijriDate = selectedParsed.formatted;
    const selectedHijriVariants = selectedParsed.variants;
    console.log("Selected date query : ", selectedHijriDate);

    // 🔹 Buat rentang tanggal dinamis berdasarkan hari saat ini
    const fullDateRange = [];
    for (let i = 1; i <= 30; i++) {
      fullDateRange.push(`${i} ${hijriCurrentMonth} ${hijriCurrentYear}`);
    }
    const monthDayVariants =
      hijriCurrentVariants && hijriCurrentVariants.length
        ? hijriCurrentVariants
        : buildMonthDayVariants(hijriCurrentMonth, hijriCurrentYear);

    // 🔹 Ambil data amalan harian
    const results = await db("amalan_harian")
      .select("hijri_date", db.raw("COUNT(*) as total"))
      .where({ user_id: tholibId, status: true })
      .modify((qb) => {
        if (monthDayVariants && monthDayVariants.length) {
          qb.whereIn("hijri_date", monthDayVariants);
        } else {
          qb.andWhere(
            "hijri_date",
            "like",
            `% ${hijriCurrentMonth} ${hijriCurrentYear}`
          );
        }
      })
      .groupBy("hijri_date")
      .orderBy("hijri_date", "asc");

      //Syawal
    const resultsSyawalQuery = db("amalan_harian")
    .join("amalan", "amalan.id", "amalan_harian.amalan_id")
    .select("amalan_harian.hijri_date", db.raw("COUNT(*) as total"))
    .where({
      "amalan_harian.user_id": tholibId,
      "amalan_harian.status": true,
      "amalan.name": "Puasa Syawal 1446H",
    })
    .groupBy("amalan_harian.hijri_date")
    .orderBy("amalan_harian.hijri_date", "asc");

    if (monthDayVariants && monthDayVariants.length) {
      resultsSyawalQuery.whereIn("amalan_harian.hijri_date", monthDayVariants);
    }

    const resultsSyawal = await resultsSyawalQuery;

    const syawalAggregated = {};
    resultsSyawal.forEach((row) => {
      const { formatted } = parseHijriDateSafe(row.hijri_date, {
        defaultMonth: hijriCurrentMonth,
        defaultYear: hijriCurrentYear,
      });
      const key = formatted || row.hijri_date;
      syawalAggregated[key] =
        (syawalAggregated[key] || 0) + parseInt(row.total, 10);
    });

    const laporan = fullDateRange.map((date) => ({
      hijri_date: date,
      total: syawalAggregated[date] || 0,
    }));

    // 🔹 Ambil daftar amalan untuk tanggal yang dipilih
    const amalanList = await db("amalan as a")
      .select(
        "a.id as amalan_id",
        "a.name as nama_amalan",
        "a.description as deskripsi",
        db.raw("COALESCE(ah.status, false) as status")
      )
      .leftJoin("amalan_harian as ah", function () {
        this.on("a.id", "=", "ah.amalan_id").andOnVal(
          "ah.user_id",
          tholibId
        );
      })
      .where("a.status", "active")
      .whereIn("a.type", ["checklist", "dropdown"])
      .modify((qb) => {
        if (selectedHijriVariants && selectedHijriVariants.length) {
          qb.andWhere(function () {
            this.whereNull("ah.hijri_date").orWhereIn(
              "ah.hijri_date",
              selectedHijriVariants
            );
          });
        } else {
          qb.andWhere(function () {
            this.whereNull("ah.hijri_date").orWhere(
              "ah.hijri_date",
              selectedHijriDate
            );
          });
        }
      })
      .orderBy("ah.status", "asc");

    // 🔹 Format button dates
    const buttonDates = Array.from({ length: hijriCurrentDay }, (_, i) => {
      return `${i + 1} ${hijriCurrentMonth} ${hijriCurrentYear}`;
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
    console.log("========= 📊 getAmalanLaporanTholib =========");

    const { tanggal, tanggal_day, tanggal_month, tanggal_year } = req.body;
    const tholibId = req.user.id;
    console.log("🔑 User ID:", tholibId);
    console.log("📩 Payload | tanggal:", tanggal || "-", "| split:", {
      day: tanggal_day || "-",
      month: tanggal_month || "-",
      year: tanggal_year || "-",
    });

    // ✅ Ambil tanggal Hijriah dari API MyQuran (adj=-1)
    let hijriCurrentDate = "";
    let hijriDateList = [];

    let canonicalMonth = "";
    let canonicalYear = "";
    let canonicalDay = 1;
    let hijriDateVariantsList = [];

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
      const parsedCurrent = parseHijriDateSafe(hijriDateString);
      hijriCurrentDate = parsedCurrent.formatted;
      canonicalDay = parsedCurrent.day;
      canonicalMonth = parsedCurrent.month;
      canonicalYear = parsedCurrent.year;

      hijriDateList = Array.from({ length: 30 }, (_, i) => `${i + 1} ${canonicalMonth} ${canonicalYear}`);
      hijriDateVariantsList = buildMonthDayVariants(canonicalMonth, canonicalYear);

      console.log("📅 Tanggal Hijriah Hari Ini:", hijriCurrentDate);
    } catch (error) {
      console.error("❌ Gagal mengambil tanggal Hijriah:", error.message);
      return res.status(500).json({
        success: false,
        message: "Gagal mengambil tanggal Hijriah dari API",
      });
    }

    // ✅ Gunakan tanggal dari user (kalau ada), atau default ke tanggal Hijriah hari ini
    let selectedDateInput = tanggal;
    if (!selectedDateInput && tanggal_day && tanggal_month && tanggal_year) {
      selectedDateInput = `${tanggal_day} ${tanggal_month} ${tanggal_year}`;
    }

    const selectedParsed = parseHijriDateSafe(selectedDateInput, {
      defaultDay: canonicalDay,
      defaultMonth: canonicalMonth,
      defaultYear: canonicalYear,
    });
    const selectedHijriDate = selectedParsed.formatted || hijriCurrentDate;
    const selectedHijriVariants = selectedParsed.variants;
    console.log("🎯 Tanggal digunakan (kanonik):", selectedHijriDate);
    console.log("🎯 Variasi tanggal dicari:", selectedHijriVariants);

    // 🔍 Ambil amalan harian (hanya yang status true) berdasarkan user dan rentang 30 hari terakhir
  
  //Ramadhan
    const results = await db("amalan_harian")
      .select("hijri_date", db.raw("COUNT(*) as total"))
      .where({ user_id: tholibId, status: true })
      .modify((qb) => {
        if (hijriDateVariantsList && hijriDateVariantsList.length) {
          qb.whereIn("hijri_date", hijriDateVariantsList);
        } else {
          qb.whereIn("hijri_date", hijriDateList);
        }
      })
      .groupBy("hijri_date")
      .orderBy("hijri_date", "asc");

      //Syawal
    // Gunakan hasil umum (results) untuk seluruh amalan aktif
    const aggregatedCounts = {};
    results.forEach((row) => {
      const { formatted } = parseHijriDateSafe(row.hijri_date, {
        defaultMonth: canonicalMonth,
        defaultYear: canonicalYear,
      });
      const key = formatted || row.hijri_date;
      aggregatedCounts[key] =
        (aggregatedCounts[key] || 0) + parseInt(row.total, 10);
    });

    // 🔁 Mapping data berdasarkan 30 hari terakhir (0 jika tidak ada)
    const laporan = hijriDateList.map((date) => ({
      hijri_date: date,
      total: aggregatedCounts[date] || 0,
    }));

    // 🔍 Ambil daftar amalan dan status berdasarkan selectedHijriDate
    const amalanList = await db("amalan as a")
      .select(
        "a.id as amalan_id",
        "a.name as nama_amalan",
        "a.description as deskripsi",
        db.raw("COALESCE(ah.status, false) as status")
      )
      .leftJoin("amalan_harian as ah", function () {
        this.on("a.id", "=", "ah.amalan_id").andOnVal(
          "ah.user_id",
          tholibId
        );
      })
      .where("a.status", "active")
      .whereIn("a.type", ["checklist", "dropdown"])
      .modify((qb) => {
        if (selectedHijriVariants && selectedHijriVariants.length) {
          qb.andWhere(function () {
            this.whereNull("ah.hijri_date").orWhereIn(
              "ah.hijri_date",
              selectedHijriVariants
            );
          });
        } else {
          qb.andWhere(function () {
            this.whereNull("ah.hijri_date").orWhere(
              "ah.hijri_date",
              selectedHijriDate
            );
          });
        }
      })
      .orderBy("ah.status", "asc");

    // 🔍 Ambil nama user
    const user = await db("users").where("id", tholibId).select("name").first();
    const name = user ? user.name : null;

    // 🔢 Ambil angka tanggal dari hijriCurrentDate (misal: 5 Syawal -> 5)
    const hijriCurrentDay = canonicalDay || 1;

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

    console.log("📤 Ringkasan Response:", {
      hijri_current_date: response.hijri_current_date,
      selected_date: response.selected_date,
      total_amalan: response.amalan_list.length,
      button_dates: response.button_dates,
    });
    console.log("📤 Contoh amalan", response.amalan_list);
    console.log("========= ✅ getAmalanLaporanTholib Selesai =========");
    return res.json(response);
  } catch (error) {
    console.error("❌ Error get detail laporan tholib:", error);
    return res.status(500).json({
      message: "Terjadi kesalahan saat mengambil detail laporan tholib",
      error: error.message,
    });
  }
};
