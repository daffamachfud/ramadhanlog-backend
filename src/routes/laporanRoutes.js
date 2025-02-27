const express = require("express");
const {
  getLaporanTholib,
  getLaporanTholibByPengawas,
  getDetailLaporanTholib,
} = require("../controllers/laporanController");
const { verifyToken } = require("../middlewares/authMiddleware");

const router = express.Router();

// Ambil daftar tholib berdasarkan filter nama/halaqah
router.get("/", verifyToken, getLaporanTholib);
router.get("/pengawas",verifyToken, getLaporanTholibByPengawas)

// Ambil detail amalan tholib berdasarkan ID tholib
router.post("/detail", verifyToken, getDetailLaporanTholib);

module.exports = router;
