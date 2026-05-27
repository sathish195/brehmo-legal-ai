// backend/src/models/Clause.js
const mongoose = require('mongoose');

const ClauseSchema = new mongoose.Schema({
  document_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
  clause_number: String,
  clause_title: String,
  clause_type: String,
  full_text: String,
  risk_score: Number,
  risk_level: String,
  position: Number,
  word_count: Number,
  reason: String,
  triggered_constraints: [String],
  constraint_detail: String,
});

module.exports = mongoose.model('Clause', ClauseSchema);
