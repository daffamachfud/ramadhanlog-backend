exports.seed = async function (knex) {
  // Update amalan dengan kolom description dari "Target" di spreadsheet
  const updates = [
    { name: 'Bangun dan wudhu', description: '' },
    { name: 'Sholat sunnah malam', description: 'Minimal 2 rakaat.' },
    { name: 'ISTIGHFAR di Waktu Sahur & Berdoa', description: 'Fokus doa ampunan untuk pribadi, keluarga, dan orang terdekat.' },
    { name: 'SAHUR dalam keadaan suci (ada wudhu)', description: '' },
    { name: 'Menu Sahur', description: 'Air hangat, kurma 3 butir. Untuk makanan, bebas.' },
    { name: 'Stay di masjid sebelum adzan Shubuh', description: 'Berburu doa mustajab ( diantaranya waktu adzan & Iqomah )' },
    { name: 'JAGA WAKTU SYURUQ', description: 'DZIGI + TILAWAH.' },
    { name: 'Sedekah Subuh', description: 'Minimal Rp 2000 / hari' },
    { name: 'Sholat Dhuha', description: 'Minimal 4 rakaat' },
    { name: 'Shalat rawatib', description: 'Menjaga sholat sunnah sebelum dan sesudah sholat wajib.' },
    { name: 'IFTHOR ALA NABI', description: 'Air + 3 butir kurma + buah' },
    { name: 'Sholat Tarawih', description: '11 Rakaat dalam 1 kali pelaksanaan' },
    { name: 'Tilawah minimal', description: '1 juz / Hari' },
    { name: 'Dialog Iman', description: '' },
    { name: 'Tafaqur Harian', description: 'minimal 3 menit / Hari' },
    { name: 'Menulis ILMU & INFORMASI bermanfaat', description: 'minimal 1 paragraf' }
  ];

  for (const update of updates) {
    await knex('amalan').where('name', update.name).update({ description: update.description });
  }
};
