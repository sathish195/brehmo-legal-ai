// backend/src/models/Document.js
const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  raw_text: { type: String, required: true },
  version: { type: Number, default: 1 },
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Document', DocumentSchema);
