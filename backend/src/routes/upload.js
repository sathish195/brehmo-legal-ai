const express = require('express');
const multer = require('multer');
const { extractText } = require('../services/extractor');
const { chunkDocument } = require('../services/chunker');
const { scoreClauseRisk } = require('../services/scorer');
const db = require('../services/supabase');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/upload - Upload single doc, extract + chunk + score
router.post('/upload', upload.single('document'), async (req, res) => {
    console.log("req.file", req.file);

    try {
        if (!req.file) return res.status(400).json({ error: 'No document uploaded' });


        // 1. Extract Text
        const rawText = await extractText(req.file.buffer, req.file.mimetype, req.file.originalname);
        // console.log("req.file", rawText);

        // 2. Save Document to Supabase
        const document = await db.saveDocument(req.file.originalname, rawText, 1);
        // console.log(document, "document-----------");


        // 3. Chunk Clauses
        let clauses = chunkDocument(rawText);

        // 4. Score Clauses via Claude
        const constraints = await db.getConstraints();
        console.log(constraints, "rules-----------------");

        // Scoring in parallel to save time
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

        // 5. Save Clauses to Supabase
        const savedClauses = await db.saveClauses(document.id, clauses);

        res.json({
            message: 'Document uploaded and processed successfully',
            document,
            clauses: savedClauses
        });
    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/documents - List uploaded documents
router.get('/documents', async (req, res) => {
    try {
        const docs = await db.getDocuments();
        res.json(docs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
