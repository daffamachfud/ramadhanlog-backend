const jwt = require('jsonwebtoken');

const authenticateJWT = (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");

    const token = req.header('Authorization');

    if (!token) {
        return res.status(401).json({ message: "Akses ditolak, token tidak ditemukan" });
    }

    try {
        const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ message: "Token tidak valid" });
    }
};

module.exports = { authenticateJWT };

const verifyToken = (req, res, next) => {
  console.log("verify token res status:", res.status);

  let token = req.header("authorization"); // Coba ambil dari header

  if (!token && req.cookies.token) {
    token = req.cookies.token; // Jika tidak ada di header, ambil dari cookie
  }

  console.log("verify token :", token);

  if (!token) {
    return res.status(401).json({ message: "Akses ditolak" });
  }

  // Pastikan "Bearer " dihapus jika ada
  if (token.startsWith("Bearer ")) {
    token = token.replace("Bearer ", ""); // Menghapus prefix "Bearer "
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded Token:", decoded);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ message: "Token tidak valid" });
  }
};
  
// Middleware untuk memastikan pengguna adalah Murabbi
const checkMurabbi = (req, res, next) => {
    if (req.user.role !== "murabbi") {
      return res.status(403).json({ message: "Akses hanya untuk Murabbi" });
    }
    next();
  };
  
  // ✅ Pastikan ini sudah benar
  module.exports = { verifyToken, checkMurabbi };