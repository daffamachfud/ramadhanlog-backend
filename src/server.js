const express = require('express');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');

dotenv.config();
const app = express();
app.use(express.json());

app.use('/api/auth', authRoutes);


const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`🚀 Server berjalan di http://localhost:${PORT}`));
