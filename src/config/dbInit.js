const db = require('./db');

(async () => {
  try {
    console.log('🚀 Memulai pengecekan tabel...');

    const exists = await db.schema.hasTable('users');
    if (exists) {
      console.log('⚠️ Tabel `users` sudah ada. Menghapus sebelum membuat ulang...');
      await db.schema.dropTable('users');
    }

    console.log('🔹 Membuat tabel `users`...');
    await db.schema.createTable('users', (table) => {
      table.increments('id').primary();
      table.string('name', 255).notNullable();
      table.string('email', 255).unique().notNullable();
      table.string('password', 255).notNullable();
      table.timestamps(true, true);
    });

    console.log('✅ Tabel `users` berhasil dibuat!');
  } catch (error) {
    console.error('❌ Error membuat tabel:', error);
  } finally {
    await db.destroy();
    console.log('🔚 Koneksi database ditutup.');
  }
})();
