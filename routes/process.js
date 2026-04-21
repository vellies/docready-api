const express = require("express");
const multer = require("multer");
const { processFiles } = require("../controllers/processController");

const router = express.Router();

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/tiff", "image/bmp"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, ALLOWED_TYPES.includes(file.mimetype));
  },
});

router.post("/process", (req, res, next) => {
  upload.array("files", 20)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No valid image files uploaded" });
    }
    next();
  });
}, processFiles);

module.exports = router;
