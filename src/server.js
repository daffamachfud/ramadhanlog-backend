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

const allowedOrigins = [
    'http://localhost:3000',
    'https://haizumapp.com',
    'http://haizumapp.com',
    'https://www.haizumapp.com',
    'http://www.haizumapp.com'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true
}));

app.use(express.json());

app.listen(5001, () => {
    console.log("RamadhanLog Backend Running on port 5001");
});
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


const PORT = process.env.PORT || 5002;
app.listen(PORT, () => console.log(`🚀 Server berjalan di http://localhost:${PORT}`));
