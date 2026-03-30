const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { transcribeAudio } = require('../controllers/aiController');

const router = express.Router();

const uploadsDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '') || '.webm';
    const safeName = `audio-${Date.now()}${extension}`;
    cb(null, safeName);
  }
});

const upload = multer({ storage });

router.post('/transcribe', upload.single('audio'), transcribeAudio);

module.exports = router;
