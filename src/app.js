const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const authRoutes = require("./routes/authRoutes"); // Import authRoutes

const app = express();

// Middleware
app.use(cors({
  origin: "http://localhost:3000", // Izinkan frontend di port 3000 mengakses backend
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true, // Jika ada cookies atau auth header
}));
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

// Gunakan route yang tersedia
app.use("/api/auth", authRoutes); // Semua route di authRoutes akan memiliki prefix "/api/auth"

// Endpoint utama (optional)
app.get("/api", (req, res) => {
  res.json({ message: "API is running!" });
});

module.exports = app;
