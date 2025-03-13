const express = require("express");
const {
  getLaporanTholib,
  getLaporanTholibByPengawas,
  getDetailLaporanTholib,
  getDetailLaporanTholibMingguan,
  getAmalanLaporanTholib,
} = require("../controllers/laporanController");
const { verifyToken } = require("../middlewares/authMiddleware");

const router = express.Router();

// Ambil daftar tholib berdasarkan filter nama/halaqah
router.get("/", verifyToken, getLaporanTholib);
router.get("/pengawas",verifyToken, getLaporanTholibByPengawas)

// Ambil detail amalan tholib berdasarkan ID tholib
router.post("/detail", verifyToken, getDetailLaporanTholib);
router.post("/tholib", verifyToken, getAmalanLaporanTholib);
router.post("/detail/week", verifyToken, getDetailLaporanTholibMingguan)

module.exports = router;
