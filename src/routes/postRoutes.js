const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middlewares/authMiddleware");
const {
  createPost,
  getAllPosts,
  getPostById,
  addComment,
  editPost,
  deletePost,
  toggleLike,
} = require("../controllers/postController");

// Create post
router.post("/posts", verifyToken, createPost);

// Get all posts (pagination/infinite scroll)
router.get("/posts", verifyToken, getAllPosts);

// Get post by ID (with nested comments)
router.get("/posts/:id", verifyToken, getPostById);

// Add comment
router.post("/comments", verifyToken, addComment);

// Like/unlike post
router.post("/likes", verifyToken, toggleLike);

// Edit post
router.put("/posts/:id", verifyToken, editPost);

// Hapus post
router.delete("/posts/:id", verifyToken, deletePost);

module.exports = router;