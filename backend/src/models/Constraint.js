// backend/src/models/Constraint.js
const mongoose = require('mongoose');

const ConstraintSchema = new mongoose.Schema({
  code: String,
  description: String,
  rule_detail: String,
  active: { type: Boolean, default: true },
});

module.exports = mongoose.model('Constraint', ConstraintSchema);
