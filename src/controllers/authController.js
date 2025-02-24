const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const knex = require('../db/knex');  // Sesuaikan dengan konfigurasi knex

const register = async (req, res) => {
    try {
        const { name, email, password, role} = req.body; // ✅ Set default "tholib" jika tidak ada

        // Cek apakah email sudah digunakan
        const existingUser = await knex('users').where({ email }).first();
        if (existingUser) {
            return res.status(400).json({ message: "Email sudah terdaftar" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user ke database
        const [newUser] = await knex('users')
            .insert({
                name,
                email,
                password: hashedPassword,
                role,  // ✅ Pastikan role tidak null
            })
            .returning(['id', 'name', 'email', 'role']);

        res.status(201).json({ message: "Registrasi berhasil", user: newUser });
    } catch (error) {
        console.error("Error register:", error);
        res.status(500).json({ message: "Terjadi kesalahan server" });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Cek apakah user ada
        const user = await knex('users').where({ email }).first();
        if (!user) {
            return res.status(401).json({ message: "Email atau password salah" });
        }

        // Cek password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Email atau password salah" });
        }

        // Buat token JWT
        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({ message: "Login berhasil", token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Terjadi kesalahan server" });
    }
};

module.exports = { register, login };
