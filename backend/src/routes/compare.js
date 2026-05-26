const express = require('express');
const multer = require('multer');
const { extractText } = require('../services/extractor');
const { chunkDocument } = require('../services/chunker');
const { scoreClauseRisk } = require('../services/scorer');
const { compareDocuments } = require('../services/comparator');
const db = require('../services/supabase');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Helper to fully process a document in the comparison pipeline
async function processDocument(file, version, constraints) {
    const rawText = await extractText(file.buffer, file.mimetype, file.originalname);
    const document = await db.saveDocument(file.originalname, rawText, version);
    
    let clauses = chunkDocument(rawText);
    clauses = await Promise.all(clauses.map(async c => {
        const risk = await scoreClauseRisk(c, constraints);
        return {
            ...c,
            risk_score: risk.score,
            risk_level: risk.risk_level,
            reason: risk.reason,
            triggered_constraints: risk.triggered_constraints,
            constraint_detail: risk.constraint_detail
        };
    }));
    
    await db.saveClauses(document.id, clauses);
    return { document, clauses };
}

// POST /api/compare - Upload v1 + v2, compare clauses, return diff
router.post('/compare', upload.fields([{ name: 'v1', maxCount: 1 }, { name: 'v2', maxCount: 1 }]), async (req, res) => {
    try {
        if (!req.files || !req.files.v1 || !req.files.v2) {
            return res.status(400).json({ error: 'Please upload both v1 and v2 documents' });
        }

        const constraints = await db.getConstraints();

        // Process both documents concurrently for speed
        const [doc1, doc2] = await Promise.all([
            processDocument(req.files.v1[0], 1, constraints),
            processDocument(req.files.v2[0], 2, constraints)
        ]);

        // Run Semantic & Number comparison
        const comparisonData = await compareDocuments(doc1.clauses, doc2.clauses);

        // Save Comparison Results
        const savedComparison = await db.saveComparison(
            doc1.document.id, 
            doc2.document.id, 
            comparisonData.clause_results, 
            comparisonData.net_risk_delta
        );

        res.json({
            message: 'Comparison complete',
            comparison_id: savedComparison.id,
            v1_document: doc1.document,
            v2_document: doc2.document,
            results: comparisonData
        });
    } catch (error) {
        console.error('Compare Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/comparison/:id - Get comparison results by ID
router.get('/comparison/:id', async (req, res) => {
    try {
        const comparison = await db.getComparison(req.params.id);
        res.json(comparison);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
