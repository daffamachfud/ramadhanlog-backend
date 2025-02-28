exports.seed = async function (knex) {
  // Hapus data lama untuk menghindari duplikasi
  await knex('amalan').del();

  // Insert amalan utama terlebih dahulu untuk mendapatkan ID
  const insertedAmalan = await knex('amalan')
    .insert({
      id: knex.raw('uuid_generate_v4()'),
      name: 'Shalat Rawatib',
      order_number: 10,
      type: 'checklist',
      options: null,
      parent_id: null
    })
    .returning('*'); // Mengembalikan seluruh data, termasuk 'id'

  const shalatRawatibId = insertedAmalan[0].id; // Ambil ID yang benar dari hasil insert

  // Insert daftar amalan utama + sub-amalan Shalat Rawatib
  await knex('amalan').insert([
    { id: knex.raw('uuid_generate_v4()'), name: 'Bangun dan wudhu', order_number: 1, type: 'checklist', options: null },
    { id: knex.raw('uuid_generate_v4()'), name: 'Sholat sunnah malam', order_number: 2, type: 'dropdown', options: JSON.stringify(["2 rakaat", "4 rakaat", "6 rakaat", "8 rakaat", "Tidak Shalat", "Sedang Halangan"]) },
    { id: knex.raw('uuid_generate_v4()'), name: 'ISTIGHFAR di Waktu Sahur & Berdoa', order_number: 3, type: 'checklist', options: null },
    { id: knex.raw('uuid_generate_v4()'), name: 'SAHUR dalam keadaan suci (ada wudhu)', order_number: 4, type: 'checklist', options: null },
    { id: knex.raw('uuid_generate_v4()'), name: 'Menu Sahur', order_number: 5, type: 'checklist', options: null },
    { id: knex.raw('uuid_generate_v4()'), name: 'Stay di masjid sebelum adzan Shubuh', order_number: 6, type: 'checklist', options: null },
    { id: knex.raw('uuid_generate_v4()'), name: 'JAGA WAKTU SYURUQ', order_number: 7, type: 'dropdown', options: JSON.stringify(["All in (Stay, Dzikir, Tilawah)", "Dzikir dan Tilawah (Keluar Masjid)", "Tidak Melakukan"]) },
    { id: knex.raw('uuid_generate_v4()'), name: 'SEDEKAH SHUBUH', order_number: 8, type: 'checklist', options: null },
    { id: knex.raw('uuid_generate_v4()'), name: 'Sholat Dhuha', order_number: 9, type: 'dropdown', options: JSON.stringify(["4 rakaat", "6 rakaat", "8 rakaat", "Tidak Shalat", "Sedang Halangan"]) },

    // Sub-amalan Shalat Rawatib dengan parent_id yang valid
    { id: knex.raw('uuid_generate_v4()'), name: 'Qobliyah Subuh (2 rakaat)', order_number: 11, type: 'checklist', options: null, parent_id: shalatRawatibId },
    { id: knex.raw('uuid_generate_v4()'), name: 'Qobliyah Dzuhur (4 rakaat)', order_number: 12, type: 'checklist', options: null, parent_id: shalatRawatibId },
    { id: knex.raw('uuid_generate_v4()'), name: 'Ba\'da Dzuhur (2 rakaat)', order_number: 13, type: 'checklist', options: null, parent_id: shalatRawatibId },
    { id: knex.raw('uuid_generate_v4()'), name: 'Ba\'da Maghrib (2 rakaat)', order_number: 14, type: 'checklist', options: null, parent_id: shalatRawatibId },
    { id: knex.raw('uuid_generate_v4()'), name: 'Ba\'da Isya (2 rakaat)', order_number: 15, type: 'checklist', options: null, parent_id: shalatRawatibId },

    { id: knex.raw('uuid_generate_v4()'), name: 'IFTHOR ALA NABI', order_number: 16, type: 'checklist', options: null },
    { id: knex.raw('uuid_generate_v4()'), name: 'Sholat Tarawih', order_number: 17, type: 'checklist', options: null },
    { id: knex.raw('uuid_generate_v4()'), name: 'Tilawah minimal', order_number: 18, type: 'checklist', options: null },
    { id: knex.raw('uuid_generate_v4()'), name: 'Dialog Iman', order_number: 19, type: 'checklist', options: null },
    { id: knex.raw('uuid_generate_v4()'), name: 'Tafaqur Harian', order_number: 20, type: 'checklist', options: null },
    { id: knex.raw('uuid_generate_v4()'), name: 'Menulis ILMU & INFORMASI bermanfaat', order_number: 21, type: 'checklist', options: null }
  ]);
};
