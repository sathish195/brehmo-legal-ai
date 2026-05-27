// backend/src/models/Comparison.js
const mongoose = require('mongoose');

const ComparisonSchema = new mongoose.Schema({
  doc_v1_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
  doc_v2_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
  results_json: String,
  net_risk_delta: Number,
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Comparison', ComparisonSchema);
