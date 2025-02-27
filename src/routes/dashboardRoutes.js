const express = require("express");
const {
  getDashboardMurabbi,
  getDashboardTholib,
  getDashboardPengawas,
  getDashboardMurabbiReported,
  getDashboardMurabbiUnreported,
  getDashboardPengawasReported,
  getDashboardPengawasUnreported,
} = require("../controllers/dashboardController"); // ✅ Pastikan import benar
const {
  verifyToken,
  checkMurabbi,
  checkTholib,
} = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/murabbi", verifyToken, checkMurabbi, getDashboardMurabbi);
router.get("/tholib", verifyToken, checkTholib, getDashboardTholib);
router.get("/pengawas", verifyToken, checkMurabbi, getDashboardPengawas);
router.get(
  "/murabbi/reported",
  verifyToken,
  checkMurabbi,
  getDashboardMurabbiReported
);
router.get(
  "/murabbi/unreported",
  verifyToken,
  checkMurabbi,
  getDashboardMurabbiUnreported
);
router.get(
  "/pengawas/reported",
  verifyToken,
  checkMurabbi,
  getDashboardPengawasReported
);
router.get(
  "/pengawas/unreported",
  verifyToken,
  checkMurabbi,
  getDashboardPengawasUnreported
);

module.exports = router;
