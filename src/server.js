const express = require('express');
const dotenv = require('dotenv');
const cors = require("cors");
const authRoutes = require('./routes/auth');
const dashboardRoutes = require("./routes/dashboardRoutes");
const amalanRoutes = require("./routes/amalanRoutes");
const halaqahRoutes = require("./routes/halaqahRoutes");
const laporanRoutes = require("./routes/laporanRoutes");


dotenv.config();
const app = express();

app.use(cors({
    origin: "http://localhost:3000", // Izinkan frontend di port 3000 mengakses backend
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true, // Jika ada cookies atau auth header
}));

app.use(express.json());

app.get("/", (req, res) => {
    res.send("RamadhanLog Backend Running!");
});
app.get("/api", (req, res) => {
    res.json({ message: "API is running!" });
  });
app.use('/api/auth', authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/amalan", amalanRoutes)
app.use("/api/halaqah", halaqahRoutes)
app.use("/api/laporan-tholib", laporanRoutes);


const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`🚀 Server berjalan di http://localhost:${PORT}`));
