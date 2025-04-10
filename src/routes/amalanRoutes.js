const express = require("express");
const { verifyToken } = require("../middlewares/authMiddleware");
const {
  catatAmalanHarian,
  getAllAmalan,
  getAmalanHarian,
  getAllAmalanForMurabbi,
  addAmalanByMurabbi,
  updateAmalanStatus,
  getAmalanById
} = require("../controllers/amalanController");

const router = express.Router();

// Endpoint untuk mencatat amalan harian
router.post("/amalan-harian", verifyToken, catatAmalanHarian);
router.get("/get", verifyToken, getAllAmalan);
router.get("/harian", verifyToken, getAmalanHarian);
router.get("/get-amalan-for-murabbi", verifyToken, getAllAmalanForMurabbi);
router.post("/add", verifyToken, addAmalanByMurabbi);
router.post("/update-status", verifyToken, updateAmalanStatus);
router.get("/:id", verifyToken, getAmalanById); // <-- Tambahan penting!

module.exports = router;
