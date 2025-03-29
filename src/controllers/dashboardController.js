const db = require("../db/knex");
const moment = require("moment-hijri");
moment.locale("en");

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
    const hijriApiUrl = `https://api.myquran.com/v2/cal/hijr?adj=0`;
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
      if (!prayerResponse.ok) throw new Error("Gagal mengambil data waktu sholat");

      const hijriData = await hijriResponse.json();
      const prayerData = await prayerResponse.json();

      if (hijriData.status && prayerData.status) {
        hijriDate = hijriData.data.date[1]; // Contoh: "30 Ramadhan 1446 H"
        hijriDateForDb = `${hijriData.data.num[4]} Ramadhan ${hijriData.data.num[6]}`; // Format untuk database

        console.log(`📅 Tanggal Hijriah dari API: ${hijriDate}`);
        console.log(`📅 Tanggal Hijriah untuk DB: ${hijriDateForDb}`);

        const jadwal = prayerData.data.jadwal;
        prayerTimes = {
          Subuh: jadwal.subuh,
          Dzuhur: jadwal.dzuhur,
          Ashar: jadwal.ashar,
          Maghrib: jadwal.maghrib,
          Isya: jadwal.isya,
          HijriDate: hijriDate,
        };

        console.log(`🕌 Waktu Sholat:`, prayerTimes);
      } else {
        console.error("⚠️ Gagal mengambil data Hijriah atau waktu sholat.");
        return res.status(500).json({ success: false, message: "Gagal mengambil data dari API." });
      }
    } catch (error) {
      console.error("⚠️ Error mengambil data dari API:", error.message);
      return res.status(500).json({ success: false, message: error.message });
    }

    // 1️⃣ Ambil semua tholib yang tergabung dalam halaqah murabbi
    const tholibs = await db("users")
      .join("relasi_halaqah_tholib", "users.id", "=", "relasi_halaqah_tholib.tholib_id")
      .join("halaqah", "relasi_halaqah_tholib.halaqah_id", "=", "halaqah.id")
      .where("halaqah.murabbi_id", murabbiId)
      .select("users.id", "users.name", "halaqah.id as halaqah_id", "halaqah.name");

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
      .join("relasi_halaqah_tholib", "users.id", "=", "relasi_halaqah_tholib.tholib_id")
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
    const hijriApiUrl = `https://api.myquran.com/v2/cal/hijr?adj=0`;
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
      if (!prayerResponse.ok) throw new Error("Gagal mengambil data waktu sholat");

      const hijriData = await hijriResponse.json();
      const prayerData = await prayerResponse.json();

      if (hijriData.status && prayerData.status) {
        hijriDate = hijriData.data.date[1]; // Contoh: "30 Ramadhan 1446 H"
        hijriDateForDb = `${hijriData.data.num[4]} Ramadhan ${hijriData.data.num[6]}`; // Format untuk database

        console.log(`📅 Tanggal Hijriah dari API: ${hijriDate}`);
        console.log(`📅 Tanggal Hijriah untuk DB: ${hijriDateForDb}`);

        const jadwal = prayerData.data.jadwal;
        prayerTimes = {
          Subuh: jadwal.subuh,
          Dzuhur: jadwal.dzuhur,
          Ashar: jadwal.ashar,
          Maghrib: jadwal.maghrib,
          Isya: jadwal.isya,
          HijriDate: hijriDate,
        };

        console.log(`🕌 Waktu Sholat:`, prayerTimes);
      } else {
        console.error("⚠️ Gagal mengambil data Hijriah atau waktu sholat.");
        return res.status(500).json({ success: false, message: "Gagal mengambil data dari API." });
      }
    } catch (error) {
      console.error("⚠️ Error mengambil data dari API:", error.message);
      return res.status(500).json({ success: false, message: error.message });
    }

    // 1️⃣ Ambil semua anggota halaqah yang diawasi oleh pengawas
    const anggota = await db("users")
      .join("relasi_halaqah_tholib", "users.id", "=", "relasi_halaqah_tholib.tholib_id")
      .join("halaqah", "relasi_halaqah_tholib.halaqah_id", "=", "halaqah.id")
      .where("halaqah.pengawas_id", pengawasId)
      .select("users.id", "users.name", "users.role", "halaqah.id as halaqah_id", "halaqah.name as nama_halaqah");

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

    // 2️⃣ Hitung jumlah anggota yang sudah submit amalan harian
    const reportedAnggota = await db("amalan_harian")
      .distinct("user_id")
      .whereIn("user_id", anggotaIds)
      .andWhere("hijri_date", hijriDateForDb);

    const reportedCount = reportedAnggota.length;

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

    const hijriApiUrl = `https://api.myquran.com/v2/cal/hijr?adj=0`;
    const prayerApiUrl = `https://api.myquran.com/v2/sholat/jadwal/${cityId}/${todayMasehi}`;

    let hijriDate = "";
    let hijriDateForDb = "";
    let prayerTimes = {};
    let hijriYear = "";

    try {
      const [hijriResponse, prayerResponse] = await Promise.all([
        fetch(hijriApiUrl),
        fetch(prayerApiUrl),
      ]);

      if (!hijriResponse.ok) throw new Error("Gagal mengambil data Hijriah");
      if (!prayerResponse.ok) throw new Error("Gagal mengambil data waktu sholat");

      const hijriData = await hijriResponse.json();
      const prayerData = await prayerResponse.json();

      if (hijriData.status && prayerData.status) {
        hijriDate = hijriData.data.date[1];
        hijriDateForDb = `${hijriData.data.num[4]} Ramadhan ${hijriData.data.num[6]}`;
        hijriYear = hijriData.data.num[6];

        console.log(`📅 Tanggal Hijriah dari API: ${hijriDate}`);
        console.log(`📅 Tanggal Hijriah untuk DB: ${hijriDateForDb}`);

        const jadwal = prayerData.data.jadwal;
        prayerTimes = {
          Subuh: jadwal.subuh,
          Dzuhur: jadwal.dzuhur,
          Ashar: jadwal.ashar,
          Maghrib: jadwal.maghrib,
          Isya: jadwal.isya,
          HijriDate: hijriDate, // ✅ Ditambahkan kembali ke dalam prayerTimes
        };

        console.log(`🕌 Waktu Sholat:`, prayerTimes);
      } else {
        console.error("⚠️ Gagal mengambil data Hijriah atau Sholat.");
        return res.status(500).json({ success: false, message: "Gagal mengambil data waktu sholat atau Hijriah." });
      }
    } catch (error) {
      console.error("⚠️ Error mengambil data dari API:", error.message);
      return res.status(500).json({ success: false, message: error.message });
    }

    const [{ total }] = await db("amalan_harian")
      .where({ user_id: tholibId, hijri_date: hijriDateForDb, status: true })
      .count("* as total");

    console.log(`✅ Total Amalan Hari Ini: ${total}`);

    const totalAmalan = 20;
    const percentage = ((total / totalAmalan) * 100).toFixed(2) + "%";

    const ringkasanHarian = {
      date: hijriDate,
      completed: parseInt(total),
      total: totalAmalan,
      percentage,
    };

    console.log(`📊 Ringkasan Harian:`, ringkasanHarian);

    const fullDateRange = [];
    for (let i = 1; i <= 30; i++) {
      fullDateRange.push(`${i} Ramadhan ${hijriYear}`);
    }

    const results = await db("amalan_harian")
      .select("hijri_date", db.raw("COUNT(*) as total"))
      .where({ user_id: tholibId, status: true })
      .groupBy("hijri_date")
      .orderBy("hijri_date", "asc");

    const dataPerminggu = fullDateRange.map((date) => {
      const existingData = results.find((row) => row.hijri_date === date);
      return {
        hijri_date: date,
        total: existingData ? parseInt(existingData.total) : 0,
      };
    });

    console.log("📊 Data Perminggu (Hijri):", dataPerminggu);

    const allAmalan = await db("amalan")
      .select("id", "name")
      .orderBy("order_number", "asc");
    const completedAmalan = await db("amalan_harian")
      .where({ user_id: tholibId, hijri_date: hijriDateForDb, status: true })
      .pluck("amalan_id");

    const completed = allAmalan.filter((amalan) =>
      completedAmalan.includes(amalan.id)
    );
    const notCompleted = allAmalan.filter(
      (amalan) => !completedAmalan.includes(amalan.id)
    );

    const statusAmalan = {
      completed: completed.map((a) => a.name),
      notCompleted: notCompleted.map((a) => a.name),
    };

    console.log(`📌 Amalan Selesai:`, statusAmalan.completed);
    console.log(`📌 Amalan Belum Selesai:`, statusAmalan.notCompleted);

    const responseData = {
      ringkasanHarian,
      line_chart: dataPerminggu.map((item) => ({
        name: `${item.hijri_date}`,
        value: item.total,
      })),
      statusAmalan,
      prayerTimes, // ✅ `HijriDate` sudah ada di dalam objek ini
    };

    // ✅ LOG AKHIR SEBELUM RESPONSE
    console.log("🚀 Final Response:", JSON.stringify(responseData, null, 2));

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
    const hijriApiUrl = `https://api.myquran.com/v2/cal/hijr?adj=0`;

    try {
      const hijriResponse = await fetch(hijriApiUrl);
      const hijriData = await hijriResponse.json();

      if (hijriData.status === true) {
        hijriDateForDb = hijriData.data.date[1]; // "30 Ramadhan 1446 H"

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
    let hijriDate;
    let hijriDateForDb;

    try {
      const prayerResponse = await fetch(prayerApiUrl);
      const prayerData = await prayerResponse.json();

      if (prayerData.status === true) {
        const jadwal = prayerData.data.jadwal;
        const maghribTime = jadwal.maghrib; // Contoh: "18:15"
        const maghribDateTime = new Date(`${todayMasehi}T${maghribTime}:00`);

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
    let hijriDate;
    let hijriDateForDb;

    try {
      const prayerResponse = await fetch(prayerApiUrl);
      const prayerData = await prayerResponse.json();

      if (prayerData.status === true) {
        const jadwal = prayerData.data.jadwal;
        const maghribTime = jadwal.maghrib; // Contoh: "18:15"
        const maghribDateTime = new Date(`${todayMasehi}T${maghribTime}:00`);

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
      }  else {
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
      .where("halaqah.pengawas_id", pengawasId)
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

module.exports = {
  getDashboardMurabbi,
  getDashboardTholib,
  getDashboardPengawas,
  getDashboardMurabbiReported,
  getDashboardMurabbiUnreported,
  getDashboardPengawasReported,
  getDashboardPengawasUnreported,
};
