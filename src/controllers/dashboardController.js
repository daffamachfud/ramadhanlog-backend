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
    let prayerTimes = {};
    let hijriDate;
    let hijriDateForDb;

    const todayShalat = new Intl.DateTimeFormat("fr-CA", {
      timeZone: "Asia/Jakarta",
    }).format(new Date()); // Format YYYY-MM-DD

    try {
      const prayerResponse = await fetch(prayerApiUrl);
      const prayerData = await prayerResponse.json();

      if (prayerData.status === true) {
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

        prayerTimes = {
          Subuh: jadwal.subuh,
          Dzuhur: jadwal.dzuhur,
          Ashar: jadwal.ashar,
          Maghrib: jadwal.maghrib,
          Isya: jadwal.isya,
          HijriDate: hijriDate,
        };
      } else {
        console.error("⚠️ Gagal mengambil waktu sholat:", prayerData);
      }
    } catch (error) {
      console.error("⚠️ Error mengambil data waktu sholat:", error);
    }

    console.log(`⏰ Waktu sekarang: ${currentTime}`);
    console.log(`🕌 Waktu Maghrib: ${maghribTime}`);

    const isBeforeMaghrib = currentTime < maghribTime;
    console.log(`⏰ Waktu is before magrib: ${isBeforeMaghrib}`);

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
          avgTilawah: 0,
          unreportedTholib: 0,
          tholibReports: [],
        },
      });
    }

    // 2. Hitung jumlah tholib yang sudah submit amalan harian
    const reportedTholibs = await db("amalan_harian")
      .distinct("user_id")
      .whereIn("user_id", tholibIds)
      .andWhere("hijri_date", hijriDateForDb);

    const reportedCount = reportedTholibs.length;

    // 4. Hitung jumlah tholib yang belum laporan
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

    return res.json({
      success: true,
      data: {
        totalTholib,
        reportedTholib: reportedCount,
        unreportedTholib: unreportedCount,
        tholibReports,
        prayerTimes,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
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
    let prayerTimes = {};
    let hijriDate;
    let hijriDateForDb;

    const todayShalat = new Intl.DateTimeFormat("fr-CA", {
      timeZone: "Asia/Jakarta",
    }).format(new Date()); // Format YYYY-MM-DD
    
    try {
      const prayerResponse = await fetch(prayerApiUrl);
      const prayerData = await prayerResponse.json();

      if (prayerData.status === true) {
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

        prayerTimes = {
          Subuh: jadwal.subuh,
          Dzuhur: jadwal.dzuhur,
          Ashar: jadwal.ashar,
          Maghrib: jadwal.maghrib,
          Isya: jadwal.isya,
          HijriDate: hijriDate,
        };
      } else {
        console.error("⚠️ Gagal mengambil waktu sholat:", prayerData);
      }
    } catch (error) {
      console.error("⚠️ Error mengambil data waktu sholat:", error);
    }

    console.log(`⏰ Waktu sekarang: ${currentTime}`);
    console.log(`🕌 Waktu Maghrib: ${maghribTime}`);

    // ✅ Tentukan apakah sekarang sudah melewati Maghrib
    const isBeforeMaghrib = currentTime < maghribTime;
    console.log(`🕌 Is Before Magrib`);

    // ✅ Tanggal pencatatan Masehi disesuaikan dengan Maghrib
    let tanggalMasehi = todayMasehi;
    if (!isBeforeMaghrib) {
      const besok = new Date(todayMasehi);
      besok.setDate(besok.getDate() + 1);
      tanggalMasehi = besok.toISOString().split("T")[0]; // Format YYYY-MM-DD
    }

    console.log(`📅 Tanggal Masehi yang digunakan: ${tanggalMasehi}`);

    // 1️⃣ Ambil semua anggota halaqah yang diawasi oleh pengawas (tholib & pengawas)
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
          avgTilawah: 0,
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

    // 4️⃣ Hitung jumlah anggota yang belum laporan
    const unreportedCount = totalAnggota - reportedCount;

    // 5️⃣ Ambil daftar anggota yang sudah laporan
    const anggotaReports = await db("users")
      .whereIn(
        "id",
        reportedAnggota.map((t) => t.user_id)
      )
      .select("id", "name as user_name", "role");

    return res.json({
      success: true,
      data: {
        totalAnggota,
        reportedAnggota: reportedCount,
        unreportedAnggota: unreportedCount,
        anggotaReports,
        prayerTimes,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching dashboard data:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

const getDashboardTholib = async (req, res) => {
  try {
    const tholibId = req.user.id; // Ambil ID murabbi dari token JWT
    const cityId = "1219"; // Kode Kota Bandung di API BAW

    console.log(`⏰ Get Dashboard Tholib`);

    // ✅ Ambil tanggal Masehi hari ini dalam format YYYY-MM-DD
    let todayMasehi = new Intl.DateTimeFormat("fr-CA", {
      timeZone: "Asia/Jakarta",
    }).format(new Date());

    // 🔹 Ambil waktu Maghrib dari API BAW
    const prayerApiUrl = `https://api.myquran.com/v2/sholat/jadwal/${cityId}/${todayMasehi}`;

    let maghribTime;
    let prayerTimes = {};
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

        console.log(`⏰ Waktu sekarang: ${now}`);
        console.log(`🕌 Waktu Maghrib: ${maghribDateTime}`);

        // 🔹 Jika sekarang masih sebelum Maghrib, gunakan tanggal hijriah hari ini

        if (now < maghribDateTime) {
          hijriDate = moment().format("iD iMMMM iYYYY") + " H";
          hijriDateForDb = moment().format("iD iMMMM iYYYY");
        } else {
          hijriDate = moment().add(1, "days").format("iD iMMMM iYYYY") + " H";
          hijriDateForDb = moment().add(1, "days").format("iD iMMMM iYYYY");
        }

        console.log(`⏰ Waktu is before magrib: ${now < maghribDateTime}`);
        console.log(`📅 Tanggal Hijriah: ${hijriDate}`);
        console.log(`📅 Tanggal Hijriah DB: ${hijriDateForDb}`);

        prayerTimes = {
          Subuh: jadwal.subuh,
          Terbit: jadwal.terbit,
          Dzuhur: jadwal.dzuhur,
          Ashar: jadwal.ashar,
          Maghrib: jadwal.maghrib,
          Isya: jadwal.isya,
          HijriDate: hijriDate,
        };
      } else {
        console.error("⚠️ Gagal mengambil waktu sholat:", prayerData);
      }
    } catch (error) {
      console.error("⚠️ Error mengambil data waktu sholat:", error);
    }

    // 1️⃣ RINGKASAN HARIAN
    const [{ total }] = await db("amalan_harian")
      .where({ user_id: tholibId, hijri_date: hijriDateForDb, status: true })
      .count("* as total");

    const totalAmalan = 21;
    const percentage = ((total / totalAmalan) * 100).toFixed(2) + "%";

    const ringkasanHarian = {
      date: hijriDate,
      completed: parseInt(total),
      total: totalAmalan,
      percentage,
    };

    // 2️⃣ DATA PERMINGGU (berdasarkan Hijri Date)

    // Ambil 7 hari terakhir dari hijri_date
    const results = await db("amalan_harian")
      .select("hijri_date", db.raw("COUNT(*) as total"))
      .where({ user_id: tholibId, status: true })
      .groupBy("hijri_date")
      .orderBy("hijri_date", "asc"); // Urutkan berdasarkan hijri_date

    const dataPerminggu = results
      .filter((item) => parseInt(item.total) > 0)
      .map((item) => {
        const hijriParts = item.hijri_date.split(" "); // Pisahkan "1 Ramadhan 1446"
        const hijriWithoutYear = `${hijriParts[0]} ${hijriParts[1]}`; // Ambil "1 Ramadhan"

        return {
          name: hijriWithoutYear,
          value: parseInt(item.total),
        };
      });

   
    console.log("📊 Data Perminggu (Hijri):", dataPerminggu);

    // 3️⃣ STATUS AMALAN
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

    // 🔥 RESPONSE FINAL
    res.json({
      ringkasanHarian,
      dataPerminggu,
      statusAmalan,
      prayerTimes, // Tambahkan waktu sholat ke response
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

const getDashboardMurabbiReported = async (req, res) => {
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
          avgTilawah: 0,
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

    // 1️⃣ Ambil semua tholib yang tergabung dalam halaqah murabbi
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

    // 2️⃣ Ambil semua tholib yang sudah laporan berdasarkan tanggal setelah Maghrib
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
    console.log(`📅 Tanggal Hijri yang digunakan: ${hijriDate}`);

    return res.json({
      success: true,
      data: {
        totalTholib,
        reportedTholib: reportedCount,
        tholibReports,
        hijriDate: hijriDate,
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
