const { v4: uuidv4 } = require('uuid');

exports.seed = async function (knex) {
  // Hapus semua data sebelum insert untuk menghindari duplikasi
  await knex('amalan_harian').del();
  await knex('amalan').del();
  await knex('halaqah').del();
  await knex('users').del();

  const murabbiId = uuidv4();
  const tholibId = uuidv4();
  const halaqahId = uuidv4();

  // Insert data pengguna (Murabbi dan Tholib)
  await knex('users').insert([
    {
      id: murabbiId,
      name: 'Murabbi Satu',
      email: 'murabbi1@example.com',
      password: 'hashedpassword',
      role: 'murabbi',
    },
    {
      id: tholibId,
      name: 'Tholib Satu',
      email: 'tholib1@example.com',
      password: 'hashedpassword',
      role: 'tholib',
    },
  ]);

  // Insert data halaqah
  await knex('halaqah').insert([
    {
      id: halaqahId,
      name: 'Halaqah Haizum',
      code: 'HAL123',
      murabbi_id: murabbiId,
    },
  ]);

  // Insert daftar amalan
  await knex('amalan').insert([
    { id: uuidv4(), name: 'Bangun + wudhu' },
    { id: uuidv4(), name: 'Sholat Sunnah (Bebas Rakaat) minimal 2 Rakaat' },
    { id: uuidv4(), name: 'ISTIGHFAR di Waktu Sahur' },
    { id: uuidv4(), name: 'SAHUR dalam keadaan suci (ada wudhu)' },
    { id: uuidv4(), name: 'Menu Sahur (air hangat+ kurma 3 butir) & makanan bebas' },
    { id: uuidv4(), name: 'Stay di Masjid sebelum adzan Shubuh' },
    { id: uuidv4(), name: 'JAGA WAKTU SYURUQ (DZIKIR + TILAWAH)' },
    { id: uuidv4(), name: 'SEDEKAH SHUBUH MINIMAL Rp 2000 / hari' },
    { id: uuidv4(), name: 'Sholat Dhuha minimal 4 Rakaat' },
    { id: uuidv4(), name: 'Qobliyyah Dzuhur 4 + Ba\'diyah 2 rakaat' },
    { id: uuidv4(), name: 'IFTHOR ALA NABI (Air + 3 butir kurma + buah)' },
    { id: uuidv4(), name: 'Ba\'diyah maghrib & Isya (masing-masing 2 rakaat)' },
    { id: uuidv4(), name: 'Sholat Tarawih (11 Rakaat) dalam 1 kali pelaksanaan' },
    { id: uuidv4(), name: 'Tilawah minimal 1 juz / Hari' },
    { id: uuidv4(), name: 'Dialog Iman' },
    { id: uuidv4(), name: 'Tafaqur Harian (minimal 3 menit / Hari)' },
    { id: uuidv4(), name: 'Menulis ILMU & INFORMASI bermanfaat (minimal 1 paragraf)' },
  ]);

};
