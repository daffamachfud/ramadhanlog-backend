const db = require("../config/db");
const moment = require("moment-hijri");
moment.locale("en");

exports.getRamadhanWrapped = async (req, res) => {
    try {
      const userId = req.user.id; // ID pengguna dari JWT
      const hijriYear = "1446"; // Tahun hijriah target (bisa dibuat dinamis)
      const RAMADHAN_DAYS = 30; // Jumlah hari dalam Ramadhan (bisa 29 atau 30, tergantung tahun)

  
      // 🔹 Ambil total amalan yang dicatat selama Ramadhan
      const totalAmalan = await db("amalan_harian")
        .where("user_id", userId)
        .andWhere("hijri_date", "like", `%${hijriYear}%`)
        .count("* as total");
  
      // 🔹 Ambil amalan yang paling sering dilakukan (Top 3)
      const topAmalan = await db("amalan_harian")
        .select("amalan_id")
        .where("user_id", userId)
        .andWhere("hijri_date", "like", `%${hijriYear}%`)
        .groupBy("amalan_id")
        .orderByRaw("COUNT(amalan_id) DESC")
        .limit(3)
        .count("amalan_id as count");
  
      // 🔹 Ambil nama amalan untuk Top 3
      for (let i = 0; i < topAmalan.length; i++) {
        const amalan = await db("amalan")
          .where("id", topAmalan[i].amalan_id)
          .select("name")
          .first();
        topAmalan[i].name = amalan ? amalan.name : "Unknown";
      }
  
      // 🔹 Hitung persentase pencapaian target amalan
      const completedAmalan = await db("amalan_harian")
        .where("user_id", userId)
        .andWhere("hijri_date", "like", `%${hijriYear}%`)
        .andWhere("status", true)
        .count("* as completed");
  
      const completionRate = totalAmalan[0].total
        ? (completedAmalan[0].completed / totalAmalan[0].total) * 100
        : 0;
  
      // 🔹 Cari hari dengan pencatatan terbanyak & terendah
      const activityByDay = await db("amalan_harian")
        .select("hijri_date")
        .where("user_id", userId)
        .andWhere("hijri_date", "like", `%${hijriYear}%`)
        .groupBy("hijri_date")
        .orderByRaw("COUNT(hijri_date) DESC")
        .count("hijri_date as count");
  
      const mostActiveDay = activityByDay.length > 0 ? activityByDay[0] : null;
      const leastActiveDay = activityByDay.length > 0 ? activityByDay[activityByDay.length - 1] : null;
  
      // 🔹 Hitung jumlah hari dengan laporan (reportedDays)
    const reportedDays = activityByDay.length;

    // 🔹 Hitung jumlah hari tanpa laporan (missedDays)
    const missedDays = RAMADHAN_DAYS - reportedDays;


      // 🔹 Kirim response
      return res.json({
        success: true,
        data: {
          totalAmalan: totalAmalan[0].total,
          topAmalan,
          completionRate: completionRate.toFixed(2) + "%",
          mostActiveDay,
          leastActiveDay,
          reportedDays, // 🔹 Ditambahkan ke response
          missedDays, // 🔹 Ditambahkan ke response
        },
      });
    } catch (error) {
      console.error("❌ Error fetching Ramadhan Wrapped:", error);
      return res.status(500).json({ success: false, message: "Server Error" });
    }
  };
