const { v4: uuidv4 } = require("uuid");

const CATEGORY_NAME = "Amalan Pemanasan Ramadhan";

const PEMANASAN_AMALAN = [
  {
    name: "3 RAKAAT sebelum tidur",
    type: "dropdown",
    description:
      "Catat jumlah rakaat sunnah sebelum tidur untuk menjaga konsistensi qiyam awal malam.",
    options: ["Tidak melakukan", "1 rakaat", "2 rakaat", "3 rakaat"],
  },
  {
    name: "Bangun sebelum adzan Shubuh",
    type: "checklist",
    description: "Checklist sederhana: tandai jika sudah bangun sebelum adzan Shubuh.",
  },
  {
    name: "5 waktu di Masjid",
    type: "dropdown",
    description: "Pantau seberapa banyak shalat wajib yang ditunaikan di masjid tiap hari.",
    options: ["Tidak melakukan", "1-2 kali", "3-4 kali", "5 kali (lengkap)"],
  },
  {
    name: "Dzikir pagi",
    type: "checklist",
    description: "Checklist untuk memastikan rangkaian dzikir pagi sudah ditunaikan.",
  },
  {
    name: "Tilawah 5 lembar (minimal)",
    type: "dropdown",
    description: "Rekam capaian tilawah harian minimal 5 lembar.",
    options: ["0 lembar", "≤5 lembar", "6-10 lembar", ">10 lembar"],
  },
  {
    name: "Sedekah Shubuh",
    type: "checklist",
    description: "Checklist sedekah setelah Subuh sebagai pemanasan keberkahan Ramadhan.",
  },
  {
    name: "Dhuha 4 Rakaat",
    type: "dropdown",
    description: "Catat jumlah rakaat dhuha untuk melihat progres istiqamah.",
    options: ["Tidak dhuha", "2 rakaat", "4 rakaat", ">4 rakaat"],
  },
  {
    name: "Rawatib 12 Rakaat",
    type: "dropdown",
    description: "Pantau kelengkapan paket shalat rawatib tiap hari.",
    options: ["Tidak melakukan", "≤6 rakaat", "10 rakaat", "12 rakaat lengkap"],
  },
  {
    name: "Menulis faidah bermanfaat",
    type: "checklist",
    description: "Checklist untuk mengabadikan satu faidah/insight setiap hari.",
  },
  {
    name: "Jasadiyah 30 menit (3x sepekan)",
    type: "dropdown",
    description:
      "Aktivitas fisik minimal 30 menit; targetnya tiga kali sepekan untuk kebugaran.",
    options: ["Tidak melakukan", "<30 menit", "≥30 menit"],
  },
];

exports.seed = async function (knex) {
  // Pastikan kategori induk tersedia
  let category = await knex("amalan").where({ name: CATEGORY_NAME }).first();
  let categoryId = category ? category.id : uuidv4();

  if (!category) {
    await knex("amalan").insert({
      id: categoryId,
      name: CATEGORY_NAME,
      description: "Kumpulan amalan pemanasan khusus menjelang Ramadhan.",
      type: "kategori",
      options: null,
      order_number: 800,
      parent_id: null,
      status: "active",
      is_for_all_halaqah: true,
    });
  }

  for (let index = 0; index < PEMANASAN_AMALAN.length; index++) {
    const item = PEMANASAN_AMALAN[index];
    const exists = await knex("amalan").where({ name: item.name }).first();

    if (exists) {
      continue; // Tidak mengubah amalan yang sudah ada
    }

    await knex("amalan").insert({
      id: uuidv4(),
      name: item.name,
      description: item.description,
      type: item.type,
      options: item.options ? JSON.stringify(item.options) : null,
      order_number: 801 + index,
      parent_id: categoryId,
      status: "active",
      is_for_all_halaqah: true,
    });
  }
};
