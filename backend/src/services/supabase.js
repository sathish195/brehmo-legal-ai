require('dotenv').config();
const mongoose = require('mongoose');

// Load models
const Constraint = require('../models/Constraint');
const Document = require('../models/Document');
const Clause = require('../models/Clause');
const Comparison = require('../models/Comparison');

/**
 * Fetch all active firm constraints
 */
async function getConstraints() {
  try {
    return await Constraint.find({ active: true }).lean();
  } catch (err) {
    console.warn('⚠️ Database query failed. Returning hardcoded constraints. Error:', err.message);
    return [
      { code: 'C-010', description: 'Liability Cap', rule_detail: 'Liability must be capped at maximum 2x contract value' },
      { code: 'C-011', description: 'Non-solicitation / Non-compete', rule_detail: 'Non-solicitation / non-compete maximum 12 months' },
      { code: 'C-012', description: 'IP Clauses', rule_detail: 'IP clauses must carve out pre-existing IP' }
    ];
  }
}

/**
 * Save a new document to the database
 */
async function saveDocument(filename, rawText, version = 1) {
  try {
    const doc = new Document({ filename, raw_text: rawText, version });
    return await doc.save();
  } catch (err) {
    console.warn('⚠️ Database query failed. Returning mock document to keep app running. Error:', err.message);
    return { id: 'mock-doc-id-' + Date.now(), filename, version, raw_text: rawText };
  }
}

/**
 * Save extracted clauses for a document
 */
async function saveClauses(documentId, clauses) {
  try {
    const clauseDocs = clauses.map(c => ({
      document_id: documentId,
      clause_number: c.clause_number,
      clause_title: c.clause_title,
      clause_type: c.clause_type,
      full_text: c.full_text,
      risk_score: c.risk_score,
      risk_level: c.risk_level,
      position: c.position,
      word_count: c.word_count,
      reason: c.reason,
      triggered_constraints: c.triggered_constraints,
      constraint_detail: c.constraint_detail
    }));
    const inserted = await Clause.insertMany(clauseDocs);
    return inserted;
  } catch (err) {
    console.warn('⚠️ Database query failed. Returning mock clauses. Error:', err.message);
    return clauses.map((c, i) => ({
      id: 'mock-clause-' + i,
      ...c,
      reason: c.reason,
      triggered_constraints: c.triggered_constraints,
      constraint_detail: c.constraint_detail
    }));
  }
}

/**
 * Save the results of a comparison between two documents
 */
async function saveComparison(docV1Id, docV2Id, resultsJson, netRiskDelta) {
  try {
    const comp = new Comparison({
      doc_v1_id: docV1Id,
      doc_v2_id: docV2Id,
      results_json: JSON.stringify(resultsJson),
      net_risk_delta: netRiskDelta
    });
    return await comp.save();
  } catch (err) {
    console.warn('⚠️ Database query failed. Returning mock comparison. Error:', err.message);
    return { id: 'mock-comp-' + Date.now(), doc_v1_id: docV1Id, doc_v2_id: docV2Id };
  }
}

/**
 * List all uploaded documents
 */
async function getDocuments() {
  try {
    return await Document.find().select('id filename version created_at').lean();
  } catch (err) {
    throw new Error(`Failed to fetch documents: ${err.message}`);
  }
}

/**
 * Get a specific comparison by ID with joined document details
 */
async function getComparison(id) {
  try {
    const comp = await Comparison.findById(id)
      .populate('doc_v1_id', 'filename version')
      .populate('doc_v2_id', 'filename version')
      .lean();
    if (!comp) throw new Error('Comparison not found');
    return comp;
  } catch (err) {
    throw new Error(`Failed to fetch comparison: ${err.message}`);
  }
}

module.exports = {
  getConstraints,
  saveDocument,
  saveClauses,
  saveComparison,
  getDocuments,
  getComparison
};

