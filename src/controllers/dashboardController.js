const db = require("../db/knex");

const getDashboardMurabbi = async (req, res) => {
  try {
    const murabbiId = req.user.id; // Ambil ID murabbi dari token JWT
    const today = new Date().toISOString().split("T")[0];

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
      .andWhere("tanggal", today);

    const reportedCount = reportedTholibs.length;

    // 3. Ambil ID amalan tilawah dari tabel amalan
    const tilawahAmalan = await db("amalan")
      .where("name", "Tilawah minimal 1 juz / Hari")
      .first();

    let avgTilawah = 0;
    if (tilawahAmalan) {
      const tilawahData = await db("amalan_harian")
        .where("tanggal", today)
        .andWhere("amalan_id", tilawahAmalan.id)
        .whereIn("user_id", tholibIds);

      const totalTilawah = tilawahData.length; // Asumsinya setiap entri tilawah == 1 juz
      avgTilawah = reportedCount ? totalTilawah / reportedCount : 0;
    }

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

     // 4️⃣ AMBIL DATA WAKTU SHOLAT (API Kemenag RI)
    // **🔹 Ambil data waktu sholat dari API BAW untuk Bandung (ID: 1219)**
    const cityId = "1219"; 
    const todayShalat = new Intl.DateTimeFormat("fr-CA", { timeZone: "Asia/Jakarta" })
      .format(new Date()); // Format YYYY-MM-DD
    const prayerApiUrl = `https://api.myquran.com/v2/sholat/jadwal/${cityId}/${todayShalat}`;

    console.log("api prayer : ",prayerApiUrl)

    let prayerTimes = {};

    try {
      const prayerResponse = await fetch(prayerApiUrl);
      const prayerData = await prayerResponse.json();

      if (prayerData.status === true) {
        const jadwal = prayerData.data.jadwal;
        prayerTimes = {
          Subuh: jadwal.subuh,
          Dzuhur: jadwal.dzuhur,
          Ashar: jadwal.ashar,
          Maghrib: jadwal.maghrib,
          Isya: jadwal.isya,
        };
      } else {
        console.error("⚠️ Gagal mengambil waktu sholat:", prayerData);
      }
    } catch (error) {
      console.error("⚠️ Error mengambil data waktu sholat:", error);
    }  

    return res.json({
      success: true,
      data: {
        totalTholib,
        reportedTholib: reportedCount,
        avgTilawah,
        unreportedTholib: unreportedCount,
        tholibReports,
        prayerTimes
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
    const today = new Date().toISOString().split("T")[0];

    // 1. Ambil semua anggota halaqah yang diawasi oleh pengawas (tholib & pengawas)
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
          prayerTimes
        },
      });
    }

    // 2. Hitung jumlah anggota yang sudah submit amalan harian
    const reportedAnggota = await db("amalan_harian")
      .distinct("user_id")
      .whereIn("user_id", anggotaIds)
      .andWhere("tanggal", today);

    const reportedCount = reportedAnggota.length;

    // 3. Ambil ID amalan tilawah dari tabel amalan
    const tilawahAmalan = await db("amalan")
      .where("name", "Tilawah minimal 1 juz / Hari")
      .first();

    let avgTilawah = 0;
    if (tilawahAmalan) {
      const tilawahData = await db("amalan_harian")
        .where("tanggal", today)
        .andWhere("amalan_id", tilawahAmalan.id)
        .whereIn("user_id", anggotaIds);

      const totalTilawah = tilawahData.length; // Asumsinya setiap entri tilawah == 1 juz
      avgTilawah = reportedCount ? totalTilawah / reportedCount : 0;
    }

    // 4. Hitung jumlah anggota yang belum laporan
    const unreportedCount = totalAnggota - reportedCount;

    // 5. Ambil daftar anggota yang sudah laporan
    const anggotaReports = await db("users")
      .whereIn(
        "id",
        reportedAnggota.map((t) => t.user_id)
      )
      .select("id", "name as user_name", "role");

      // 4️⃣ AMBIL DATA WAKTU SHOLAT (API Kemenag RI)
    // **🔹 Ambil data waktu sholat dari API BAW untuk Bandung (ID: 1219)**
    const cityId = "1219"; 
    const todayShalat = new Intl.DateTimeFormat("fr-CA", { timeZone: "Asia/Jakarta" })
      .format(new Date()); // Format YYYY-MM-DD
    const prayerApiUrl = `https://api.myquran.com/v2/sholat/jadwal/${cityId}/${todayShalat}`;

    console.log("api prayer : ",prayerApiUrl)

    let prayerTimes = {};

    try {
      const prayerResponse = await fetch(prayerApiUrl);
      const prayerData = await prayerResponse.json();

      if (prayerData.status === true) {
        const jadwal = prayerData.data.jadwal;
        prayerTimes = {
          Subuh: jadwal.subuh,
          Dzuhur: jadwal.dzuhur,
          Ashar: jadwal.ashar,
          Maghrib: jadwal.maghrib,
          Isya: jadwal.isya,
        };
      } else {
        console.error("⚠️ Gagal mengambil waktu sholat:", prayerData);
      }
    } catch (error) {
      console.error("⚠️ Error mengambil data waktu sholat:", error);
    }

    return res.json({
      success: true,
      data: {
        totalAnggota,
        reportedAnggota: reportedCount,
        avgTilawah,
        unreportedAnggota: unreportedCount,
        anggotaReports,
        prayerTimes
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};


const getDashboardTholib = async (req, res) => {
  try {
    const tholibId = req.user.id; // Ambil ID murabbi dari token JWT
    const today = new Date().toISOString().split("T")[0];

    console.log("tanggal :",today)

    // 1️⃣ RINGKASAN HARIAN
    const [{ total }] = await db("amalan_harian")
      .where({ user_id: tholibId, tanggal: today, status: true })
      .count("* as total");

    const totalAmalan = 17;
    const percentage = ((total / totalAmalan) * 100).toFixed(2) + "%";

    const ringkasanHarian = {
      date: today,
      completed: parseInt(total),
      total: totalAmalan,
      percentage,
    };

    // 2️⃣ DATA PERMINGGU
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Set ke hari Minggu

    const results = await db("amalan_harian")
      .select(db.raw("to_char(tanggal, 'FMDay') as hari, COUNT(*) as total"))
      .where({ user_id: tholibId, status: true })
      .andWhere("tanggal", ">=", startOfWeek.toISOString().split("T")[0])
      .groupByRaw("to_char(tanggal, 'FMDay')");

    const hariMapping = {
      Monday: "Senin",
      Tuesday: "Selasa",
      Wednesday: "Rabu",
      Thursday: "Kamis",
      Friday: "Jumat",
      Saturday: "Sabtu",
      Sunday: "Ahad",
    };
    // Urutan hari dalam Bahasa Indonesia
    const hariList = [
      "Senin",
      "Selasa",
      "Rabu",
      "Kamis",
      "Jumat",
      "Sabtu",
      "Ahad",
    ];
    const dataPerminggu = hariList.map((hari) => {
      const result = results.find(
        (item) => hariMapping[item.hari.trim()] === hari
      );
      return { name: hari, value: result ? parseInt(result.total) : 0 };
    });
    // 3️⃣ STATUS AMALAN
    const allAmalan = await db("amalan").select("id", "name").orderBy('order_number', 'asc');
    const completedAmalan = await db("amalan_harian")
      .where({ user_id: tholibId, tanggal: today, status: true })
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

    // 4️⃣ AMBIL DATA WAKTU SHOLAT (API Kemenag RI)
    // **🔹 Ambil data waktu sholat dari API BAW untuk Bandung (ID: 1219)**
    const cityId = "1219"; 
    const todayShalat = new Intl.DateTimeFormat("fr-CA", { timeZone: "Asia/Jakarta" })
      .format(new Date()); // Format YYYY-MM-DD
    const prayerApiUrl = `https://api.myquran.com/v2/sholat/jadwal/${cityId}/${todayShalat}`;

    console.log("api prayer : ",prayerApiUrl)

    let prayerTimes = {};

    try {
      const prayerResponse = await fetch(prayerApiUrl);
      const prayerData = await prayerResponse.json();

      if (prayerData.status === true) {
        const jadwal = prayerData.data.jadwal;
        prayerTimes = {
          Subuh: jadwal.subuh,
          Dzuhur: jadwal.dzuhur,
          Ashar: jadwal.ashar,
          Maghrib: jadwal.maghrib,
          Isya: jadwal.isya,
        };
      } else {
        console.error("⚠️ Gagal mengambil waktu sholat:", prayerData);
      }
    } catch (error) {
      console.error("⚠️ Error mengambil data waktu sholat:", error);
    }

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
    const today = new Date().toISOString().split("T")[0];

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
      .andWhere("tanggal", today)
      .andWhere("status",true)
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
    const pengawasId = req.user.id; // Ambil ID murabbi dari token JWT
    const today = new Date().toISOString().split("T")[0];

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
      .andWhere("tanggal", today)
      .andWhere("status",true)
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

const getDashboardMurabbiUnreported = async (req, res) => {
  try {
    const murabbiId = req.user.id; // Ambil ID murabbi dari token JWT
    const today = new Date().toISOString().split("T")[0];

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
      .andWhere("tanggal", today)
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
    const today = new Date().toISOString().split("T")[0];

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
      .andWhere("tanggal", today)
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
