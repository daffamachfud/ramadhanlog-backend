const db = require('./db');
const bcrypt = require('bcrypt');

(async () => {
  try {
    console.log('🚀 Memulai proses seeding data...');

    // Cek apakah sudah ada data di tabel users
    const existingUsers = await db('users').select('*');
    if (existingUsers.length > 0) {
      console.log('⚠️ Data users sudah ada, tidak perlu seeding.');
    } else {
      // Hash password
      const hashedPassword = await bcrypt.hash('12345678', 10);

      // Insert data dummy
      await db('users').insert([
        { name: 'Admin', email: 'admin@example.com', password: hashedPassword },
        { name: 'User1', email: 'user1@example.com', password: hashedPassword },
      ]);

      console.log('✅ Seeding data users selesai!');
    }
  } catch (error) {
    console.error('❌ Error saat seeding data:', error);
  } finally {
    await db.destroy();
    console.log('🔚 Koneksi database ditutup.');
  }
})();
