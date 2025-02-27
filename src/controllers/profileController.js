const db = require("../config/db");

  exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id; // Ambil ID murabbi dari token JWT

    // 1. Ambil semua tholib yang tergabung dalam halaqah murabbi
    const data = await db("users")
      .where("id", userId)
      .select("users.id", "users.name", "users.email","users.role")
      .first(); // Ambil satu hasil sebagai object

      if (!data) return res.status(404).json({ message: "User tidak ditemukan" });
        res.json(data);
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};