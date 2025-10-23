const db = require("../config/db");

const createPost = async (req, res) => {
    // gunakan kolom sesuai schema: user_id, author_name, status
    const { title, content, status } = req.body;
    const user_id = req.user.id; // diasumsikan sudah lewat verifyToken

    if (!title || !content) {
      return res.status(400).json({ message: "Judul dan konten wajib diisi" });
    }

    try {
      // ambil nama author dari tabel users
      const author = await db('users').where({ id: user_id }).first('name');
      if (!author) {
        return res.status(404).json({ message: 'User author tidak ditemukan' });
      }

      const payload = {
        title,
        content,
        user_id,
        author_name: author.name,
      };
      if (typeof status === 'string' && status.length) {
        payload.status = status; // optional, default di DB 'published'
      }

      const [post] = await db('posts')
        .insert(payload)
        .returning('*');
  
      res.status(201).json(post);
    } catch (error) {
      console.error("Gagal membuat post:", error);
      res.status(500).json({ message: "Terjadi kesalahan server" });
    }
  };

  const getAllPosts = async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
  
    try {
        console.log("📌 Get All Feed");
      const posts = await db("posts")
        .select(
          "posts.*",
        )
        .orderBy("posts.created_at", "desc")
        .limit(limit)
        .offset(offset);
  
        console.log("Hasil Post : ",posts);
      res.json(posts);
    } catch (error) {
      console.error("Gagal mengambil post:", error);
      res.status(500).json({ message: "Terjadi kesalahan server" });
    }
  };

  const getPostById = async (req, res) => {
    const { id } = req.params;
  
    try {
      const post = await db("posts")
        .select("posts.*", "users.name as author_name")
        .leftJoin("users", "posts.user_id", "users.id")
        .where("posts.id", id)
        .first();
  
      if (!post) {
        return res.status(404).json({ message: "Post tidak ditemukan" });
      }
  
      // Ambil komentar (nested 1 level untuk awal)
      const comments = await db("comments")
        .select("comments.*", "users.name as author_name")
        .leftJoin("users", "comments.user_id", "users.id")
        .where("comments.post_id", id)
        .orderBy("comments.created_at", "asc");
  
      // Strukturkan komentar nested
      const map = {};
      const roots = [];
  
      comments.forEach((comment) => {
        map[comment.id] = { ...comment, replies: [] };
      });
  
      comments.forEach((comment) => {
        if (comment.parent_id) {
          map[comment.parent_id]?.replies.push(map[comment.id]);
        } else {
          roots.push(map[comment.id]);
        }
      });
  
      res.json({ post, comments: roots });
    } catch (error) {
      console.error("Gagal mengambil post:", error);
      res.status(500).json({ message: "Terjadi kesalahan server" });
    }
  };

  const addComment = async (req, res) => {
    const { post_id, content, parent_id = null } = req.body;
    const user_id = req.user.id;
  
    if (!post_id || !content) {
      return res.status(400).json({ message: "Post dan konten komentar wajib diisi" });
    }
  
    try {
      const [comment] = await db("comments")
        .insert({
          post_id,
          content,
          author_id: user_id,
          parent_id,
        })
        .returning("*");
  
      res.status(201).json(comment);
    } catch (error) {
      console.error("Gagal menambah komentar:", error);
      res.status(500).json({ message: "Terjadi kesalahan server" });
    }
  };

  const toggleLike = async (req, res) => {
    const { post_id } = req.body;
    const user_id = req.user.id;
  
    try {
      const existing = await db("likes").where({ post_id, user_id }).first();
  
      if (existing) {
        await db("likes").where({ post_id, user_id }).del();
        return res.json({ liked: false });
      } else {
        await db("likes").insert({ post_id, user_id });
        return res.json({ liked: true });
      }
    } catch (error) {
      console.error("Gagal like/unlike:", error);
      res.status(500).json({ message: "Terjadi kesalahan server" });
    }
  };

  // Edit post
const editPost = async (req, res) => {
    const { id } = req.params;
    const { title, content, type, media_url } = req.body;
    const user_id = req.user.id;
  
    try {
      // Cek apakah post milik user yang sedang login
      const post = await db("posts").where({ id }).first();
      if (!post) {
        return res.status(404).json({ message: "Post tidak ditemukan" });
      }
      if (post.user_id !== user_id) {
        return res.status(403).json({ message: "Tidak diizinkan mengedit post ini" });
      }
  
      await db("posts")
        .where({ id })
        .update({ title, content, type, media_url, updated_at: db.fn.now() });
  
      res.json({ message: "Post berhasil diperbarui" });
    } catch (error) {
      console.error("Gagal update post:", error);
      res.status(500).json({ message: "Terjadi kesalahan server" });
    }
  };
  
  // Hapus post
  const deletePost = async (req, res) => {
    const { id } = req.params;
    const user_id = req.user.id;
  
    try {
      const post = await db("posts").where({ id }).first();
      if (!post) {
        return res.status(404).json({ message: "Post tidak ditemukan" });
      }
      if (post.user_id !== user_id) {
        return res.status(403).json({ message: "Tidak diizinkan menghapus post ini" });
      }
  
      // Hapus komentar dan like terlebih dahulu
      await db("likes").where({ post_id: id }).del();
      await db("comments").where({ post_id: id }).del();
  
      // Hapus post
      await db("posts").where({ id }).del();
  
      res.json({ message: "Post berhasil dihapus" });
    } catch (error) {
      console.error("Gagal hapus post:", error);
      res.status(500).json({ message: "Terjadi kesalahan server" });
    }
  };

  module.exports = {
    createPost,
    getAllPosts,
    getPostById,
    addComment,
    toggleLike,
    editPost,
    deletePost
  };
