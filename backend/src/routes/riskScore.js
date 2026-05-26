const express = require('express');
const db = require('../services/supabase');

const router = express.Router();

// GET /api/constraints - List all firm constraint nodes
router.get('/constraints', async (req, res) => {
    try {
        const constraints = await db.getConstraints();
        res.json(constraints);
    } catch (error) {
        console.error('Constraints Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
