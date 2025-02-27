const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const knex = require('../db/knex');  // Sesuaikan dengan konfigurasi knex
const db = require('../config/db'); // Pastikan path benar sesuai struktur proyek

const register = async (req, res) => {
    try {
        const { name, email, password, halaqahCode, role } = req.body;

        // Cek apakah email sudah terdaftar
        const existingUser = await knex("users").where({ email }).first();
        if (existingUser) {
            return res.status(400).json({ message: "Email sudah terdaftar" });
        }

        // Jika yang daftar adalah Murabbi, langsung proses tanpa perlu cek kode halaqah
        if (role === "murabbi") {
            const hashedPassword = await bcrypt.hash(password, 10);
            const [newUser] = await knex("users")
                .insert({
                    name,
                    email,
                    password: hashedPassword,
                    role: "murabbi",
                })
                .returning(["id", "name", "email", "role"]);

            return res.status(201).json({ message: "Registrasi Murabbi berhasil", user: newUser });
        }

        // Validasi kode halaqah jika bukan Murabbi
        if (!halaqahCode) {
            return res.status(400).json({ message: "Kode halaqah diperlukan untuk Tholib atau Pengawas" });
        }

        const halaqah = await knex("halaqah")
            .where("code", halaqahCode)
            .orWhere("code_pengawas", halaqahCode)
            .first();

        if (!halaqah) {
            return res.status(404).json({ message: "Kode halaqah tidak valid" });
        }

        // Tentukan role berdasarkan kode yang dimasukkan
        let finalRole = halaqahCode === halaqah.code_pengawas ? "pengawas" : "tholib";

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user ke database
        const [newUser] = await knex("users")
            .insert({
                name,
                email,
                password: hashedPassword,
                role: finalRole,
            })
            .returning(["id", "name", "email", "role"]);

        // Jika Tholib, simpan relasi ke tabel `relasi_halaqah_tholib`
        if (finalRole === "tholib" || finalRole === "pengawas") {
            await knex("relasi_halaqah_tholib").insert({
                tholib_id: newUser.id,
                halaqah_id: halaqah.id,
            });
        }

        // Jika Pengawas, set sebagai pengawas utama jika belum ada
        if (finalRole === "pengawas" && !halaqah.pengawas_id) {
            await knex("halaqah")
                .where("id", halaqah.id)
                .update({ pengawas_id: newUser.id });
        }

        res.status(201).json({ message: "Registrasi berhasil", user: newUser });
    } catch (error) {
        console.error("Error register:", error);
        res.status(500).json({ message: error.message || "Terjadi kesalahan server" });
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
