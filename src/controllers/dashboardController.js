const db = require("../db/knex");
const moment = require("moment-hijri");
moment.locale("en");

const HIJRI_MONTH_VARIANTS = {
  "Jumadil Awal": ["Jumadil Awal", "Jumadil Awwal", "Jumada al-Awwal", "Jumadil Ula"],
  "Jumadil Akhir": ["Jumadil Akhir", "Jumadil Tsani", "Jumadil Thani", "Jumada al-Akhirah"],
  "Rabiul Awal": ["Rabiul Awal", "Rabiul Awwal", "Rabi'ul Awal"],
  "Rabiul Akhir": ["Rabiul Akhir", "Rabiul Tsani", "Rabi'ul Akhir"],
};

const normalizeHijriMonth = (month = "") => {
  const lower = month.toLowerCase();
  for (const [canonical, variants] of Object.entries(HIJRI_MONTH_VARIANTS)) {
    if (variants.some((v) => v.toLowerCase() === lower)) {
      return canonical;
    }
  }
  return month;
};

const buildHijriDateVariants = (day = "", month = "", year = "") => {
  const variants = new Set();
  const normalizedMonth = normalizeHijriMonth(month);
  variants.add(`${day} ${normalizedMonth} ${year}`.trim());

  const monthVariants = Object.entries(HIJRI_MONTH_VARIANTS).find(
    ([canonical]) => canonical === normalizedMonth
  );
  if (monthVariants) {
    const [, names] = monthVariants;
    names.forEach((name) => variants.add(`${day} ${name} ${year}`.trim()));
  }

  variants.add(`${day} ${normalizedMonth} ${year}`.replace(` ${year}`, "").trim());
  return Array.from(variants).filter(Boolean);
};

const parseHijriDate = (rawDate = "") => {
  const cleaned = rawDate.replace(" H", "").trim();
  const parts = cleaned.split(" ").filter(Boolean);

  if (parts.length === 0) {
    return { day: "", month: "", year: "", formatted: "", variants: [] };
  }

  const day = parts.shift();
  const year = parts.pop() || "";
  const month = parts.join(" ").trim();
  const normalized = `${day} ${normalizeHijriMonth(month)} ${year}`.trim();
  const variants = buildHijriDateVariants(day, month, year);

  return { day, month: normalizeHijriMonth(month), year, formatted: normalized, variants };
};

const collapseSpaces = (value = "") => value.replace(/\s+/g, " ").trim();

const buildHijriDateMatchSet = (variants = [], canonical = "") => {
  const set = new Set();
  const addVariant = (v = "") => {
    if (!v) return;
    const collapsed = collapseSpaces(v.replace(/ H$/i, ""));
    if (collapsed) {
      set.add(collapsed);
      set.add(`${collapsed} H`);
    }
  };

  variants.forEach(addVariant);
  addVariant(canonical);

  return Array.from(set).filter(Boolean);
};

const getDashboardMurabbi = async (req, res) => {
  try {
    const murabbiId = req.user.id; // Ambil ID murabbi dari token JWT
    const cityId = "1219"; // Kode Kota Bandung di API BAW

    console.log(`⏰ Get Dashboard Murabbi`);

    // ✅ Ambil tanggal Masehi hari ini dalam format YYYY-MM-DD
    let todayMasehi = new Intl.DateTimeFormat("fr-CA", {
      timeZone: "Asia/Jakarta",
    }).format(new Date());

    console.log(`📅 Tanggal Masehi: ${todayMasehi}`);

    // 🔹 Ambil data waktu sholat & Hijriah dari API Quran
    const hijriApiUrl = `https://api.myquran.com/v2/cal/hijr?adj=-1`;
    const prayerApiUrl = `https://api.myquran.com/v2/sholat/jadwal/${cityId}/${todayMasehi}`;

    let prayerTimes = {};
    let hijriDate = "";
    let hijriDateForDb = "";
    let hijriDateMatchSet = [];
    let hijriDateVariants = [];

    try {
      const [hijriResponse, prayerResponse] = await Promise.all([
        fetch(hijriApiUrl),
        fetch(prayerApiUrl),
      ]);

      if (!hijriResponse.ok) throw new Error("Gagal mengambil data Hijriah");
      if (!prayerResponse.ok)
        throw new Error("Gagal mengambil data waktu sholat");

      const hijriData = await hijriResponse.json();
      const prayerData = await prayerResponse.json();

      if (hijriData.status && prayerData.status) {
        hijriDate = hijriData.data.date[1]; // Contoh: "30 Ramadhan 1446 H"
        // 🔁 Dinamis ambil nilai untuk DB
        const { formatted } = parseHijriDate(hijriDate);
        hijriDateForDb = formatted;

        console.log(`📅 Tanggal Hijriah dari API: ${hijriDate}`);
        console.log(`📅 Tanggal Hijriah untuk DB: ${hijriDateForDb}`);

        const jadwal = prayerData.data.jadwal;
        prayerTimes = {
          Subuh: jadwal.subuh,
          Terbit: jadwal.terbit,
          Dzuhur: jadwal.dzuhur,
          Ashar: jadwal.ashar,
          Maghrib: jadwal.maghrib,
          Isya: jadwal.isya,
          HijriDate: hijriDate,
        };

        console.log(`🕌 Waktu Sholat:`, prayerTimes);
      } else {
        console.error("⚠️ Gagal mengambil data Hijriah atau waktu sholat.");
        return res
          .status(500)
          .json({ success: false, message: "Gagal mengambil data dari API." });
      }
    } catch (error) {
      console.error("⚠️ Error mengambil data dari API:", error.message);
      return res.status(500).json({ success: false, message: error.message });
    }

    // 1️⃣ Ambil semua tholib yang tergabung dalam halaqah murabbi
    const tholibs = await db("users")
      .join(
        "relasi_halaqah_tholib",
        "users.id",
        "=",
        "relasi_halaqah_tholib.tholib_id"
      )
      .join("halaqah", "relasi_halaqah_tholib.halaqah_id", "=", "halaqah.id")
      .where("halaqah.murabbi_id", murabbiId)
      .select(
        "users.id",
        "users.name",
        "halaqah.id as halaqah_id",
        "halaqah.name"
      );

    const totalTholib = tholibs.length;
    const tholibIds = tholibs.map((t) => t.id);

    if (totalTholib === 0) {
      return res.json({
        success: true,
        data: {
          totalTholib: 0,
          reportedTholib: 0,
          unreportedTholib: 0,
          tholibReports: [],
          prayerTimes: {},
        },
      });
    }

    // 2️⃣ Hitung jumlah tholib yang sudah submit amalan harian
    const reportedTholibs = await db("amalan_harian")
      .distinct("user_id")
      .whereIn("user_id", tholibIds)
      .andWhere("hijri_date", hijriDateForDb);

    const reportedCount = reportedTholibs.length;

    // 3️⃣ Hitung jumlah tholib yang belum laporan
    const unreportedCount = totalTholib - reportedCount;

    const tholibReports = await db("users")
      .join(
        "relasi_halaqah_tholib",
        "users.id",
        "=",
        "relasi_halaqah_tholib.tholib_id"
      )
      .join("halaqah", "relasi_halaqah_tholib.halaqah_id", "=", "halaqah.id")
      .whereIn(
        "users.id",
        reportedTholibs.map((t) => t.user_id)
      )
      .select(
        "users.id",
        "users.name as user_name", // Alias untuk membedakan dengan halaqah
        "halaqah.name as nama_halaqah" // Alias untuk membedakan dengan users.name
      );

    // ✅ LOG FINAL SEBELUM RESPONSE
    const responseData = {
      success: true,
      data: {
        totalTholib,
        reportedTholib: reportedCount,
        unreportedTholib: unreportedCount,
        tholibReports,
        prayerTimes,
      },
    };

    console.log("🚀 Final Response:", JSON.stringify(responseData, null, 2));

    return res.json(responseData);
  } catch (error) {
    console.error("❌ Error fetching dashboard data:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

const getDashboardPengawas = async (req, res) => {
  try {
    const pengawasId = req.user.id; // Ambil ID pengawas dari token JWT
    const cityId = "1219"; // Kode Kota Bandung di API BAW

    console.log(`⏰ Dashboard Pengawas`);

    // ✅ Ambil tanggal Masehi hari ini dalam format YYYY-MM-DD
    let todayMasehi = new Intl.DateTimeFormat("fr-CA", {
      timeZone: "Asia/Jakarta",
    }).format(new Date());

    console.log(`📅 Tanggal Masehi: ${todayMasehi}`);

    // 🔹 Ambil data waktu sholat & Hijriah dari API Quran
    const hijriApiUrl = `https://api.myquran.com/v2/cal/hijr?adj=-1`;
    const prayerApiUrl = `https://api.myquran.com/v2/sholat/jadwal/${cityId}/${todayMasehi}`;

    let prayerTimes = {};
    let hijriDate = "";
    let hijriDateForDb = "";

    try {
      const [hijriResponse, prayerResponse] = await Promise.all([
        fetch(hijriApiUrl),
        fetch(prayerApiUrl),
      ]);

      if (!hijriResponse.ok) throw new Error("Gagal mengambil data Hijriah");
      if (!prayerResponse.ok)
        throw new Error("Gagal mengambil data waktu sholat");

      const hijriData = await hijriResponse.json();
      const prayerData = await prayerResponse.json();

      if (hijriData.status && prayerData.status) {
        hijriDate = hijriData.data.date[1]; // Contoh: "5 Syawal 1446 H"

        // 🔁 Dinamis ambil nilai untuk DB
        const { formatted, variants } = parseHijriDate(hijriDate);
        hijriDateForDb = formatted;
        hijriDateVariants = variants;
        hijriDateMatchSet = buildHijriDateMatchSet(variants, formatted);

        console.log(`📅 Tanggal Hijriah dari API: ${hijriDate}`);
        console.log(`📅 Tanggal Hijriah untuk DB: ${hijriDateForDb}`);
        if (hijriDateVariants?.length) {
          console.log(`📅 Variasi hijri_date untuk query:`, hijriDateVariants);
        }
        if (hijriDateMatchSet?.length) {
          console.log(`📅 Set hijri_date yang dipakai whereIn:`, hijriDateMatchSet);
        }

        const jadwal = prayerData.data.jadwal;
        prayerTimes = {
          Subuh: jadwal.subuh,
          Terbit: jadwal.terbit,
          Dzuhur: jadwal.dzuhur,
          Ashar: jadwal.ashar,
          Maghrib: jadwal.maghrib,
          Isya: jadwal.isya,
          HijriDate: hijriDate,
        };

        console.log(`🕌 Waktu Sholat:`, prayerTimes);
      } else {
        console.error("⚠️ Gagal mengambil data Hijriah atau waktu sholat.");
        return res
          .status(500)
          .json({ success: false, message: "Gagal mengambil data dari API." });
      }
    } catch (error) {
      console.error("⚠️ Error mengambil data dari API:", error.message);
      return res.status(500).json({ success: false, message: error.message });
    }

    // 1️⃣ Ambil semua anggota halaqah yang diawasi oleh pengawas
    const anggota = await db("users")
      .join(
        "relasi_halaqah_tholib",
        "users.id",
        "=",
        "relasi_halaqah_tholib.tholib_id"
      )
      .join("halaqah", "relasi_halaqah_tholib.halaqah_id", "=", "halaqah.id")
      .where("halaqah.pengawas_id", pengawasId)
      .select(
        "users.id",
        "users.name",
        "users.role",
        "halaqah.id as halaqah_id",
        "halaqah.name as nama_halaqah"
      );

    const totalAnggota = anggota.length;
    const anggotaIds = anggota.map((t) => t.id);

    if (totalAnggota === 0) {
      return res.json({
        success: true,
        data: {
          totalAnggota: 0,
          reportedAnggota: 0,
          unreportedAnggota: 0,
          anggotaReports: [],
          prayerTimes: {},
        },
      });
    }

    console.log("🔍 Pengawas dashboard -> query hijri_date", {
      hijriDateRaw: hijriDate,
      hijriDateForDb,
      hijriDateMatchSet,
      totalAnggota,
      sampleAnggotaIds: anggotaIds.slice(0, 10),
    });

    // 2️⃣ Hitung jumlah anggota yang sudah submit amalan harian
    const reportedQuery = db("amalan_harian")
      .distinct("user_id")
      .whereIn("user_id", anggotaIds);

    if (hijriDateMatchSet && hijriDateMatchSet.length > 0) {
      reportedQuery.whereIn("hijri_date", hijriDateMatchSet);
    } else {
      reportedQuery.andWhere("hijri_date", hijriDateForDb);
    }

    const reportedAnggota = await reportedQuery;

    const reportedCount = reportedAnggota.length;
    console.log("📈 Hasil query reported/unreported", {
      hijriDateForDb,
      hijriDateVariants,
      hijriDateMatchSet,
      reportedCount,
      unreportedEst: totalAnggota - reportedCount,
    });

    // 3️⃣ Hitung jumlah anggota yang belum laporan
    const unreportedCount = totalAnggota - reportedCount;

    // 4️⃣ Ambil daftar anggota yang sudah laporan
    const anggotaReports = await db("users")
      .whereIn(
        "id",
        reportedAnggota.map((t) => t.user_id)
      )
      .select("id", "name as user_name", "role");

    // ✅ LOG FINAL SEBELUM RESPONSE
    const responseData = {
      success: true,
      data: {
        totalAnggota,
        reportedAnggota: reportedCount,
        unreportedAnggota: unreportedCount,
        anggotaReports,
        prayerTimes,
      },
    };

    console.log("🚀 Final Response:", JSON.stringify(responseData, null, 2));

    return res.json(responseData);
  } catch (error) {
    console.error("❌ Error fetching dashboard data:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

const getDashboardTholib = async (req, res) => {
  try {
    const tholibId = req.user.id;
    const cityId = "1219"; // Kode Kota Bandung di API BAW

    console.log(`⏰ Get Dashboard Tholib`);

    let todayMasehi = new Intl.DateTimeFormat("fr-CA", {
      timeZone: "Asia/Jakarta",
    }).format(new Date());

    console.log(`📅 Tanggal Masehi: ${todayMasehi}`);

    const hijriApiUrl = `https://api.myquran.com/v2/cal/hijr?adj=-1`;
    const prayerApiUrl = `https://api.myquran.com/v2/sholat/jadwal/${cityId}/${todayMasehi}`;

    let hijriDate = "";
    let hijriDateForDb = "";
    let prayerTimes = {};
    let hijriYear = "";
    let hijriMonth = ""; // ✅ tambahkan variabel global untuk bulan Hijriah
    let hijriDateVariants = [];

    try {
      const [hijriResponse, prayerResponse] = await Promise.all([
        fetch(hijriApiUrl),
        fetch(prayerApiUrl),
      ]);

      if (!hijriResponse.ok) throw new Error("Gagal mengambil data Hijriah");
      if (!prayerResponse.ok)
        throw new Error("Gagal mengambil data waktu sholat");

      const hijriData = await hijriResponse.json();
      const prayerData = await prayerResponse.json();

      if (hijriData.status && prayerData.status) {
        hijriDate = hijriData.data.date[1];
        const { formatted, month, year, variants } = parseHijriDate(hijriDate);
        hijriDateForDb = formatted;
        hijriMonth = month; // ✅ simpan di variabel luar
        hijriYear = year;
        hijriDateVariants = variants;

        console.log(`📅 Tanggal Hijriah dari API: ${hijriDate}`);
        console.log(`📅 Tanggal Hijriah untuk DB: ${hijriDateForDb}`);

        const jadwal = prayerData.data.jadwal;
        prayerTimes = {
          Subuh: jadwal.subuh,
          Terbit: jadwal.terbit,
          Dzuhur: jadwal.dzuhur,
          Ashar: jadwal.ashar,
          Maghrib: jadwal.maghrib,
          Isya: jadwal.isya,
          HijriDate: hijriDate, // ✅ Ditambahkan kembali ke dalam prayerTimes
        };

        console.log(`🕌 Waktu Sholat:`, prayerTimes);
      } else {
        console.error("⚠️ Gagal mengambil data Hijriah atau Sholat.");
        return res
          .status(500)
          .json({
            success: false,
            message: "Gagal mengambil data waktu sholat atau Hijriah.",
          });
      }
    } catch (error) {
      console.error("⚠️ Error mengambil data dari API:", error.message);
      return res.status(500).json({ success: false, message: error.message });
    }

    // Dinamis: gunakan amalan aktif sesuai halaqah/user
    // 1) Ambil halaqah user (jika ada)
    const rel = await db('relasi_halaqah_tholib').where({ tholib_id: tholibId }).first();
    const halaqahId = rel ? rel.halaqah_id : null;

    // 2) Ambil daftar amalan aktif untuk user/halaqah
    let activeQuery = db('amalan')
      .select('id', 'name', 'type')
      .where({ status: 'active' })
      .whereIn('type', ['checklist', 'dropdown']);
    if (halaqahId) {
      activeQuery = activeQuery.andWhere(function () {
        this.where('is_for_all_halaqah', true)
          .orWhereIn('id', db('amalan_halaqah').where({ halaqah_id: halaqahId }).select('amalan_id'));
      });
    } else {
      activeQuery = activeQuery.andWhere('is_for_all_halaqah', true);
    }
    const activeAmalan = await activeQuery.orderBy('order_number', 'asc');
    const activeAmalanIds = activeAmalan.map((a) => a.id);

    // 3) Ringkasan harian: completed vs total aktif
    const completedTodayQuery = db('amalan_harian')
      .where({ user_id: tholibId, status: true });

    if (hijriDateVariants && hijriDateVariants.length > 0) {
      completedTodayQuery.whereIn('hijri_date', hijriDateVariants);
    } else {
      completedTodayQuery.andWhere('hijri_date', hijriDateForDb);
    }

    const [{ total: completedTodayStr }] = await completedTodayQuery
      .whereIn('amalan_id', activeAmalanIds)
      .count('* as total');
    const completedToday = parseInt(completedTodayStr, 10) || 0;
    const totalActive = activeAmalan.length;
    const percentage = (totalActive > 0 ? ((completedToday / totalActive) * 100).toFixed(2) : '0.00') + '%';

    const ringkasanHarian = {
      date: hijriDate,
      completed: completedToday,
      total: totalActive,
      percentage,
    };

    // 4) Line chart bulan berjalan (hanya amalan aktif)
    const fullDateRange = [];
    const dateVariantMap = new Map();
    const monthVariantSet = new Set();
    for (let i = 1; i <= 30; i++) {
      const canonicalDate = `${i} ${hijriMonth} ${hijriYear}`;
      fullDateRange.push(canonicalDate);
      const { variants } = parseHijriDate(canonicalDate);
      const dateVariants = variants.length ? variants : [canonicalDate];
      dateVariantMap.set(canonicalDate, dateVariants);
      dateVariants.forEach((variant) => monthVariantSet.add(variant));
    }

    const resultsActiveQuery = db('amalan_harian')
      .select('hijri_date', db.raw('COUNT(*) as total'))
      .where({ user_id: tholibId, status: true })
      .whereIn('amalan_id', activeAmalanIds)
      .groupBy('hijri_date')
      .orderBy('hijri_date', 'asc');

    if (monthVariantSet.size > 0) {
      resultsActiveQuery.whereIn('hijri_date', Array.from(monthVariantSet));
    } else {
      resultsActiveQuery.andWhere('hijri_date', 'like', `% ${hijriMonth} ${hijriYear}`);
    }

    const resultsActive = await resultsActiveQuery;

    const aggregatedByCanonicalDate = {};
    resultsActive.forEach((row) => {
      const { formatted } = parseHijriDate(row.hijri_date);
      const key = formatted || row.hijri_date;
      aggregatedByCanonicalDate[key] =
        (aggregatedByCanonicalDate[key] || 0) + parseInt(row.total, 10);
    });

    const dataPerminggu = fullDateRange.map((date) => {
      const total = aggregatedByCanonicalDate[date] || 0;
      return { hijri_date: date, total };
    });

    // 5) Status amalan (hanya yang aktif)
    const completedAmalanQuery = db('amalan_harian')
      .where({ user_id: tholibId, status: true });

    if (hijriDateVariants && hijriDateVariants.length > 0) {
      completedAmalanQuery.whereIn('hijri_date', hijriDateVariants);
    } else {
      completedAmalanQuery.andWhere('hijri_date', hijriDateForDb);
    }

    const completedAmalan = await completedAmalanQuery.pluck('amalan_id');
    const completed = activeAmalan.filter((a) => completedAmalan.includes(a.id));
    const notCompleted = activeAmalan.filter((a) => !completedAmalan.includes(a.id));
    const statusAmalan = { completed: completed.map((a) => a.name), notCompleted: notCompleted.map((a) => a.name) };

    const responseData = {
      ringkasanHarian,
      line_chart: dataPerminggu.map((it) => ({ name: `${it.hijri_date}`, value: it.total })),
      statusAmalan,
      prayerTimes,
    };

    console.log('🚀 Final Response:', JSON.stringify(responseData, null, 2));

    res.json(responseData);
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

const getDashboardMurabbiReported = async (req, res) => {
  try {
    const murabbiId = req.user.id; // Ambil ID murabbi dari token JWT
    const cityId = "1219"; // Kode Kota Bandung di API BAW

    console.log(`⏰ Get Dashboard Murabbi Reported`);

    // ✅ Ambil tanggal Masehi hari ini dalam format YYYY-MM-DD
    let todayMasehi = new Intl.DateTimeFormat("fr-CA", {
      timeZone: "Asia/Jakarta",
    }).format(new Date());

    // ✅ Ambil waktu sekarang (format HH:mm)
    const currentTime = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23", // Format 24 jam (HH:mm)
    }).format(new Date());

    // 🔹 Ambil waktu sholat dan tanggal Hijriah dari API terbaru
    const prayerApiUrl = `https://api.myquran.com/v2/sholat/jadwal/${cityId}/${todayMasehi}`;
    let maghribTime;
    let hijriDateForDb;

    try {
      const prayerResponse = await fetch(prayerApiUrl);
      const prayerData = await prayerResponse.json();

      if (prayerData.status === true) {
        const jadwal = prayerData.data.jadwal;
        maghribTime = jadwal.maghrib; // Contoh: "18:15"

        // Ambil tanggal Hijriah langsung dari API
        hijriDateForDb = `${jadwal.tanggal_hijriah} ${jadwal.bulan_hijriah} ${jadwal.tahun_hijriah}`;

        console.log(`📅 Tanggal Hijriah DB: ${hijriDateForDb}`);
      } else {
        console.error("⚠️ Gagal mengambil waktu sholat dari API");
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

    console.log(`⏰ Waktu sekarang: ${currentTime}`);
    console.log(`🕌 Waktu Maghrib: ${maghribTime}`);

    // ✅ Tentukan apakah sekarang sudah melewati Maghrib
    const isBeforeMaghrib = currentTime < maghribTime;

    // ✅ Tanggal pencatatan Masehi disesuaikan dengan Maghrib
    let tanggalMasehi = todayMasehi;
    if (!isBeforeMaghrib) {
      const besok = new Date(todayMasehi);
      besok.setDate(besok.getDate() + 1);
      tanggalMasehi = besok.toISOString().split("T")[0]; // Format YYYY-MM-DD
    }

    // 🔹 Ambil tanggal Hijriah dari API MyQuran
    const hijriApiUrl = `https://api.myquran.com/v2/cal/hijr?adj=-1`;

    try {
      const hijriResponse = await fetch(hijriApiUrl);
      const hijriData = await hijriResponse.json();

      if (hijriData.status === true) {
        hijriDateForDb = hijriData.data.date[1].replace(" H", ""); // "30 Ramadhan 1446 H"

        console.log(`📅 Tanggal Hijriah yang digunakan: ${hijriDateForDb}`);
      } else {
        console.error("⚠️ Gagal mengambil tanggal Hijriah dari API MyQuran");
        return res
          .status(500)
          .json({ success: false, message: "Gagal mengambil tanggal Hijriah" });
      }
    } catch (error) {
      console.error("⚠️ Error mengambil data tanggal Hijriah:", error);
      return res.status(500).json({
        success: false,
        message: "Kesalahan server dalam mengambil tanggal Hijriah",
      });
    }
    // 1. Ambil semua tholib yang tergabung dalam halaqah murabbi
    const tholibs = await db("users")
      .join(
        "relasi_halaqah_tholib",
        "users.id",
        "=",
        "relasi_halaqah_tholib.tholib_id"
      )
      .join("halaqah", "relasi_halaqah_tholib.halaqah_id", "=", "halaqah.id")
      .where("halaqah.murabbi_id", murabbiId)
      .select(
        "users.id",
        "users.name",
        "halaqah.id as halaqah_id",
        "halaqah.name as nama_halaqah"
      );

    const totalTholib = tholibs.length;
    const tholibIds = tholibs.map((t) => t.id);

    if (totalTholib === 0) {
      return res.json({
        success: true,
        data: {
          totalTholib: 0,
          reportedTholib: 0,
          unreportedTholib: 0,
          tholibReports: [],
        },
      });
    }

    // 2. Ambil semua tholib yang sudah laporan hari ini
    const reportedTholibs = await db("amalan_harian")
      .select("user_id")
      .count("* as total_amalan")
      .whereIn("user_id", tholibIds)
      .andWhere("hijri_date", hijriDateForDb)
      .andWhere("status", true)
      .groupBy("user_id");

    const reportedCount = reportedTholibs.length;

    // 3. Gabungkan data tholib yang sudah laporan dengan data halaqah
    const tholibReports = reportedTholibs.map((reported) => {
      const tholibData = tholibs.find((t) => t.id === reported.user_id);
      return {
        id: reported.user_id,
        name: tholibData?.name || "Unknown",
        nama_halaqah: tholibData?.nama_halaqah || "Unknown",
        halaqah_id: tholibData?.halaqah_id || null,
        total_amalan: reported.total_amalan, // Jumlah amalan yang dicatat oleh tholib hari ini
      };
    });

    return res.json({
      success: true,
      data: {
        totalTholib,
        reportedTholib: reportedCount,
        tholibReports,
        hijriDate: hijriDateForDb,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

const getDashboardPengawasReported = async (req, res) => {
  try {
    console.log(`⏰ Data Dashboard Pengawas Reported`);

    const pengawasId = req.user.id; // Ambil ID pengawas dari token JWT
    const cityId = "1219"; // Kode Kota Bandung di API BAW

    // ✅ Ambil tanggal Masehi hari ini dalam format YYYY-MM-DD
    let todayMasehi = new Intl.DateTimeFormat("fr-CA", {
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
    const prayerApiUrl = `https://api.myquran.com/v2/sholat/jadwal/${cityId}/${todayMasehi}`;
    let maghribTime;
    let hijriDateForDb;

    try {
      const prayerResponse = await fetch(prayerApiUrl);
      const prayerData = await prayerResponse.json();

      if (prayerData.status === true) {
        const jadwal = prayerData.data.jadwal;
        maghribTime = jadwal.maghrib; // Contoh: "18:15"
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

    console.log(`⏰ Waktu sekarang: ${currentTime}`);
    console.log(`🕌 Waktu Maghrib: ${maghribTime}`);

    // ✅ Tentukan apakah sekarang sudah melewati Maghrib
    const isBeforeMaghrib = currentTime < maghribTime;

    // ✅ Tanggal pencatatan Masehi disesuaikan dengan Maghrib
    let tanggalMasehi = todayMasehi;
    if (!isBeforeMaghrib) {
      const besok = new Date(todayMasehi);
      besok.setDate(besok.getDate() + 1);
      tanggalMasehi = besok.toISOString().split("T")[0]; // Format YYYY-MM-DD
    }

    // 🔹 Ambil tanggal Hijriah dari API MyQuran
    const hijriApiUrl = `https://api.myquran.com/v2/cal/hijr?adj=-1`;

    try {
      const hijriResponse = await fetch(hijriApiUrl);
      const hijriData = await hijriResponse.json();

      if (hijriData.status === true) {
        hijriDateForDb = hijriData.data.date[1].replace(" H", ""); // "30 Ramadhan 1446 H"

        console.log(`📅 Tanggal Hijriah yang digunakan: ${hijriDateForDb}`);
      } else {
        console.error("⚠️ Gagal mengambil tanggal Hijriah dari API MyQuran");
        return res
          .status(500)
          .json({ success: false, message: "Gagal mengambil tanggal Hijriah" });
      }
    } catch (error) {
      console.error("⚠️ Error mengambil data tanggal Hijriah:", error);
      return res.status(500).json({
        success: false,
        message: "Kesalahan server dalam mengambil tanggal Hijriah",
      });
    }

    // 1️⃣ Ambil semua tholib yang tergabung dalam halaqah pengawas
    const tholibs = await db("users")
      .join(
        "relasi_halaqah_tholib",
        "users.id",
        "=",
        "relasi_halaqah_tholib.tholib_id"
      )
      .join("halaqah", "relasi_halaqah_tholib.halaqah_id", "=", "halaqah.id")
      .where("halaqah.pengawas_id", pengawasId)
      .select(
        "users.id",
        "users.name",
        "halaqah.id as halaqah_id",
        "halaqah.name as nama_halaqah"
      );

    const totalTholib = tholibs.length;
    const tholibIds = tholibs.map((t) => t.id);

    if (totalTholib === 0) {
      return res.json({
        success: true,
        data: {
          totalTholib: 0,
          reportedTholib: 0,
          tholibReports: [],
        },
      });
    }

    // 2️⃣ Ambil semua tholib yang sudah laporan berdasarkan tanggal Hijriah
    const reportedTholibs = await db("amalan_harian")
      .select("user_id")
      .count("* as total_amalan")
      .whereIn("user_id", tholibIds)
      .andWhere("hijri_date", hijriDateForDb)
      .andWhere("status", true)
      .groupBy("user_id");

    const reportedCount = reportedTholibs.length;

    // 3️⃣ Gabungkan data tholib yang sudah laporan dengan data halaqah
    const tholibReports = reportedTholibs.map((reported) => {
      const tholibData = tholibs.find((t) => t.id === reported.user_id);
      return {
        id: reported.user_id,
        name: tholibData?.name || "Unknown",
        nama_halaqah: tholibData?.nama_halaqah || "Unknown",
        halaqah_id: tholibData?.halaqah_id || null,
        total_amalan: reported.total_amalan, // Jumlah amalan yang dicatat oleh tholib hari ini
      };
    });

    console.log(`📅 Tanggal Masehi yang digunakan: ${tanggalMasehi}`);
    console.log(`📅 Tanggal Hijriah yang digunakan: ${hijriDateForDb}`);

    return res.json({
      success: true,
      data: {
        totalTholib,
        reportedTholib: reportedCount,
        tholibReports,
        hijriDate: hijriDateForDb,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching dashboard data:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

const getDashboardMurabbiUnreported = async (req, res) => {
  try {
    const murabbiId = req.user.id; // Ambil ID murabbi dari token JWT
    const cityId = "1219"; // Kode Kota Bandung di API BAW

    // ✅ Ambil tanggal Masehi hari ini dalam format YYYY-MM-DD
    let todayMasehi = new Intl.DateTimeFormat("fr-CA", {
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
    const prayerApiUrl = `https://api.myquran.com/v2/sholat/jadwal/${cityId}/${todayMasehi}`;
    let maghribTime;
    let hijriDateForDb;

    try {
      const prayerResponse = await fetch(prayerApiUrl);
      const prayerData = await prayerResponse.json();

      if (prayerData.status === true) {
        const jadwal = prayerData.data.jadwal;
        maghribTime = jadwal.maghrib; // Contoh: "18:15"
        console.log(`🕌 Waktu Maghrib: ${maghribTime}`);
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

    // 🔹 Tentukan apakah sekarang sebelum atau sesudah Maghrib
    const now = new Date();
    const maghribDateTime = new Date(`${todayMasehi}T${maghribTime}:00`);
    const isBeforeMaghrib = now < maghribDateTime;

    // 🔹 Ambil Hijri Date dari API MyQuran (adj = -1 untuk zona WIB)
    let hijriDate = "-";

    try {
      const hijriApiUrl = "https://api.myquran.com/v2/cal/hijr/?adj=-1";
      const hijriResponse = await fetch(hijriApiUrl);
      const hijriData = await hijriResponse.json();

      if (hijriData.status === true) {
        // Format: "5 Syawal 1446 H"
        hijriDate = hijriData.data.date[1];
        hijriDateForDb = hijriDate.replace(" H", "");
        console.log(`📅 Hijri Date (for response): ${hijriDate}`);
      } else {
        return res.status(500).json({
          success: false,
          message: "Gagal mengambil tanggal hijriah",
        });
      }
    } catch (error) {
      console.error("⚠️ Error mengambil data tanggal hijriah:", error);
      return res.status(500).json({
        success: false,
        message: "Gagal mengambil tanggal hijriah dari API",
      });
    }

    // ✅ Tanggal pencatatan Masehi disesuaikan dengan Maghrib
    let tanggalMasehi = todayMasehi;
    if (!isBeforeMaghrib) {
      const besok = new Date(todayMasehi);
      besok.setDate(besok.getDate() + 1);
      tanggalMasehi = besok.toISOString().split("T")[0]; // Format YYYY-MM-DD
    }

    console.log(`📅 Tanggal Masehi yang digunakan: ${tanggalMasehi}`);

    // 1. Ambil semua tholib yang tergabung dalam halaqah murabbi
    const tholibs = await db("users")
      .join(
        "relasi_halaqah_tholib",
        "users.id",
        "=",
        "relasi_halaqah_tholib.tholib_id"
      )
      .join("halaqah", "relasi_halaqah_tholib.halaqah_id", "=", "halaqah.id")
      .where("halaqah.murabbi_id", murabbiId)
      .select("users.id", "users.name", "halaqah.name as nama_halaqah");

    if (tholibs.length === 0) {
      return res.json({ success: true, data: [] }); // Tidak ada tholib
    }

    // 2. Ambil ID tholib yang sudah laporan hari ini
    const reportedTholibIds = await db("amalan_harian")
      .select("user_id")
      .whereIn(
        "user_id",
        tholibs.map((t) => t.id)
      )
      .andWhere("hijri_date", hijriDateForDb)
      .groupBy("user_id")
      .pluck("user_id"); // Ambil hanya array ID yang sudah laporan

    // 3. Filter tholib yang belum laporan
    const unreportedTholibs = tholibs.filter(
      (t) => !reportedTholibIds.includes(t.id)
    );

    return res.json({ success: true, data: unreportedTholibs });
  } catch (error) {
    console.error("Error fetching unreported tholib data:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

const getDashboardPengawasUnreported = async (req, res) => {
  try {
    const pengawasId = req.user.id; // Ambil ID murabbi dari token JWT
    const cityId = "1219"; // Kode Kota Bandung di API BAW

    // ✅ Ambil tanggal Masehi hari ini dalam format YYYY-MM-DD
    let todayMasehi = new Intl.DateTimeFormat("fr-CA", {
      timeZone: "Asia/Jakarta",
    }).format(new Date());

    // ✅ Ambil waktu sekarang (format HH:mm)
    const currentTime = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23", // Format 24 jam (HH:mm)
    }).format(new Date());

    console.log(`⏰ Waktu sekarang: ${currentTime}`);

    // 🔹 Ambil waktu Maghrib dari API BAW
    const prayerApiUrl = `https://api.myquran.com/v2/sholat/jadwal/${cityId}/${todayMasehi}`;
    let maghribTime;
    let hijriDateForDb;

    try {
      const prayerResponse = await fetch(prayerApiUrl);
      const prayerData = await prayerResponse.json();

      if (prayerData.status === true) {
        const jadwal = prayerData.data.jadwal;
        maghribTime = jadwal.maghrib; // Contoh: "18:15"
        console.log(`🕌 Waktu Maghrib: ${maghribTime}`);
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

    // 🔹 Tentukan apakah sekarang sebelum atau sesudah Maghrib
    const now = new Date();
    const maghribDateTime = new Date(`${todayMasehi}T${maghribTime}:00`);
    const isBeforeMaghrib = now < maghribDateTime;

    // 🔹 Ambil Hijri Date dari API MyQuran (adj = -1 untuk zona WIB)
    let hijriDate = "-";

    try {
      const hijriApiUrl = "https://api.myquran.com/v2/cal/hijr/?adj=-1";
      const hijriResponse = await fetch(hijriApiUrl);
      const hijriData = await hijriResponse.json();

      if (hijriData.status === true) {
        // Format: "5 Syawal 1446 H"
        hijriDate = hijriData.data.date[1];
        hijriDateForDb = hijriDate.replace(" H", "");
        console.log(`📅 Hijri Date (for response): ${hijriDate}`);
      } else {
        return res.status(500).json({
          success: false,
          message: "Gagal mengambil tanggal hijriah",
        });
      }
    } catch (error) {
      console.error("⚠️ Error mengambil data tanggal hijriah:", error);
      return res.status(500).json({
        success: false,
        message: "Gagal mengambil tanggal hijriah dari API",
      });
    }

    // ✅ Tampilkan tanggal Masehi yang digunakan
    let tanggalMasehi = todayMasehi;
    if (!isBeforeMaghrib) {
      const besok = new Date(todayMasehi);
      besok.setDate(besok.getDate() + 1);
      tanggalMasehi = besok.toISOString().split("T")[0];
    }

    console.log(`📅 Tanggal Masehi yang digunakan: ${tanggalMasehi}`);

    // 1. Ambil semua tholib yang tergabung dalam halaqah murabbi
    const tholibs = await db("users")
      .join(
        "relasi_halaqah_tholib",
        "users.id",
        "=",
        "relasi_halaqah_tholib.tholib_id"
      )
      .join("halaqah", "relasi_halaqah_tholib.halaqah_id", "=", "halaqah.id")
      .where("halaqah.pengawas_id", pengawasId)
      .select("users.id", "users.name", "halaqah.name as nama_halaqah");

    if (tholibs.length === 0) {
      return res.json({ success: true, hijri_date: hijriDate, data: [] });
    }

    // 2. Ambil ID tholib yang sudah laporan hari ini
    const reportedTholibIds = await db("amalan_harian")
      .select("user_id")
      .whereIn(
        "user_id",
        tholibs.map((t) => t.id)
      )
      .andWhere("hijri_date", hijriDateForDb)
      .groupBy("user_id")
      .pluck("user_id");

    // 3. Filter tholib yang belum laporan
    const unreportedTholibs = tholibs.filter(
      (t) => !reportedTholibIds.includes(t.id)
    );

    return res.json({
      success: true,
      hijri_date: hijriDate, // Contoh: "5 Syawal 1446 H"
      data: unreportedTholibs,
    });
  } catch (error) {
    console.error("Error fetching unreported tholib data:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

module.exports = {
  getDashboardMurabbi,
  getDashboardTholib,
  getDashboardPengawas,
  getDashboardMurabbiReported,
  getDashboardMurabbiUnreported,
  getDashboardPengawasReported,
  getDashboardPengawasUnreported,
};
