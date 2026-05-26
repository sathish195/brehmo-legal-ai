require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'mac',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'postgres',
  password: process.env.DB_PASSWORD || '',
  port: parseInt(process.env.DB_PORT || '5432'),
});

// For backward compatibility
const supabase = {};

/**
 * Fetch all active firm constraints
 */
async function getConstraints() {
    try {
        const { rows } = await pool.query('SELECT * FROM constraints WHERE active = $1', [true]);
        return rows;
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
        const { rows } = await pool.query(
            'INSERT INTO documents (filename, raw_text, version) VALUES ($1, $2, $3) RETURNING *',
            [filename, rawText, version]
        );
        return rows[0];
    } catch (err) {
        console.warn('⚠️ Database query failed. Returning mock document to keep app running. Error:', err.message);
        return { id: 'mock-doc-id-' + Date.now(), filename, version, raw_text: rawText };
    }
}

/**
 * Save extracted clauses for a document
 */
async function saveClauses(documentId, clauses) {
    // Map clauses to match the DB schema
    const clausesToInsert = clauses.map(c => ({
        document_id: documentId,
        clause_number: c.clause_number,
        clause_title: c.clause_title,
        clause_type: c.clause_type,
        full_text: c.full_text,
        risk_score: c.risk_score, // from AI scorer
        risk_level: c.risk_level, // from AI scorer
        position: c.position,
        word_count: c.word_count
    }));

    try {
        const insertedRows = [];
        for (let i = 0; i < clausesToInsert.length; i++) {
            const c = clausesToInsert[i];
            const { rows } = await pool.query(
                `INSERT INTO clauses (
                    document_id, clause_number, clause_title, clause_type, 
                    full_text, risk_score, risk_level, position, word_count
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                [
                    c.document_id, c.clause_number, c.clause_title, c.clause_type,
                    c.full_text, c.risk_score, c.risk_level, c.position, c.word_count
                ]
            );
            insertedRows.push({
                ...rows[0],
                reason: clauses[i].reason,
                triggered_constraints: clauses[i].triggered_constraints,
                constraint_detail: clauses[i].constraint_detail
            });
        }
        return insertedRows;
    } catch (err) {
        console.warn('⚠️ Database query failed. Returning mock clauses. Error:', err.message);
        return clausesToInsert.map((c, i) => ({
            id: 'mock-clause-' + i,
            ...c,
            reason: clauses[i].reason,
            triggered_constraints: clauses[i].triggered_constraints,
            constraint_detail: clauses[i].constraint_detail
        }));
    }
}

/**
 * Save the results of a comparison between two documents
 */
async function saveComparison(docV1Id, docV2Id, resultsJson, netRiskDelta) {
    try {
        const { rows } = await pool.query(
            `INSERT INTO comparisons (doc_v1_id, doc_v2_id, results_json, net_risk_delta)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [docV1Id, docV2Id, JSON.stringify(resultsJson), netRiskDelta]
        );
        return rows[0];
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
        const { rows } = await pool.query(
            'SELECT id, filename, version, created_at FROM documents ORDER BY created_at DESC'
        );
        return rows;
    } catch (err) {
        throw new Error(`Failed to fetch documents: ${err.message}`);
    }
}

/**
 * Get a specific comparison by ID with joined document details
 */
async function getComparison(id) {
    try {
        const { rows } = await pool.query(
            `SELECT c.*,
                    json_build_object('filename', d1.filename, 'version', d1.version) as doc_v1,
                    json_build_object('filename', d2.filename, 'version', d2.version) as doc_v2
             FROM comparisons c
             LEFT JOIN documents d1 ON c.doc_v1_id = d1.id
             LEFT JOIN documents d2 ON c.doc_v2_id = d2.id
             WHERE c.id = $1`,
            [id]
        );
        if (rows.length === 0) {
            throw new Error('Comparison not found');
        }
        return rows[0];
    } catch (err) {
        throw new Error(`Failed to fetch comparison: ${err.message}`);
    }
}

module.exports = {
    supabase,
    getConstraints,
    saveDocument,
    saveClauses,
    saveComparison,
    getDocuments,
    getComparison
};
