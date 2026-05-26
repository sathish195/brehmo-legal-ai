const { pipeline } = require('@xenova/transformers');
const Diff = require('diff');

let extractor = null;

// Lazy load the embedding model for semantic matching
async function getExtractor() {
    if (!extractor) {
        extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    return extractor;
}

// Generate normalized sentence embeddings
async function getEmbedding(text) {
    const ext = await getExtractor();
    const output = await ext(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
}

// Helper to compute Cosine Similarity of normalized vectors (Dot Product)
function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
    }
    return dotProduct;
}

/**
 * Compare clauses from Version 1 against Version 2.
 * Handles Level 1 (Number matching) and Level 2 (Semantic matching).
 * 
 * @param {Array} v1Clauses - Old clauses
 * @param {Array} v2Clauses - New clauses
 * @returns {Promise<Object>} The comparison results
 */
async function compareDocuments(v1Clauses, v2Clauses) {
    const results = [];
    const unmatchedV1 = [];
    const unmatchedV2 = [];

    let v1TotalRisk = 0;
    let v2TotalRisk = 0;

    // LEVEL 1: Exact clause number match
    for (const c1 of v1Clauses) {
        // Find matching clauses in v2 by exact number
        const c2s = v2Clauses.filter(c => c.clause_number === c1.clause_number);
        
        if (c2s.length === 1) {
            // Found exact 1-to-1 match by number
            const c2 = c2s[0];
            const diffResult = compareClausePair(c1, c2);
            results.push(diffResult);
            c2.matched = true; // Mark as handled
        } else {
            // No match by number, or ambiguous multiple matches
            unmatchedV1.push(c1);
        }
        v1TotalRisk += (c1.risk_score || 0);
    }

    // Accumulate risk and find unmatched for V2
    v2Clauses.forEach(c2 => {
        v2TotalRisk += (c2.risk_score || 0);
        if (!c2.matched) {
            unmatchedV2.push(c2);
        }
    });

    // LEVEL 2: Semantic matching for the rest
    // This catches situations like Clause 8 splitting into 8 and 8A
    const v2Embeddings = [];
    for (const c2 of unmatchedV2) {
        v2Embeddings.push({
            clause: c2,
            embedding: await getEmbedding(c2.full_text)
        });
    }

    for (const c1 of unmatchedV1) {
        const c1Embedding = await getEmbedding(c1.full_text);
        
        const semanticMatches = [];
        for (const v2Obj of v2Embeddings) {
            const sim = cosineSimilarity(c1Embedding, v2Obj.embedding);
            // Threshold for semantic match is 0.85 as requested
            if (sim >= 0.85) {
                semanticMatches.push({ clause: v2Obj.clause, sim });
            }
        }

        if (semanticMatches.length > 0) {
            // Special Case: 1 to Many matching
            // Match BOTH/ALL to the old clause semantically, DO NOT report as removed
            for (const match of semanticMatches) {
                const diffResult = compareClausePair(c1, match.clause);
                diffResult.notes = `Matched semantically (${(match.sim * 100).toFixed(1)}% match)`;
                results.push(diffResult);
                match.clause.matched = true;
            }
        } else {
            // No match found -> Clause was REMOVED
            results.push({
                status: 'REMOVED',
                v1_clause: c1,
                v2_clause: null,
                diff: [{ removed: true, value: c1.full_text }],
                risk_delta: 'DECREASED' // Removing a clause technically drops its risk
            });
        }
    }

    // Any remaining unmatched V2 clauses are ADDED
    for (const c2 of unmatchedV2) {
        if (!c2.matched) {
            results.push({
                status: 'ADDED',
                v1_clause: null,
                v2_clause: c2,
                diff: [{ added: true, value: c2.full_text }],
                risk_delta: 'INCREASED' // Adding a clause introduces its risk
            });
        }
    }

    // Calculate Net Risk Delta
    let netRiskDelta = 'NEUTRAL';
    if (v2TotalRisk > v1TotalRisk) netRiskDelta = 'INCREASED';
    else if (v2TotalRisk < v1TotalRisk) netRiskDelta = 'DECREASED';

    return {
        clause_results: results,
        net_risk_delta: netRiskDelta,
        v1_total_risk: v1TotalRisk,
        v2_total_risk: v2TotalRisk
    };
}

/**
 * Compare text and risk between two linked clauses
 */
function compareClausePair(c1, c2) {
    const isTextSame = c1.full_text === c2.full_text;
    
    // Perform word-level diff using the 'diff' npm package
    const diff = isTextSame ? null : Diff.diffWordsWithSpace(c1.full_text, c2.full_text);
    
    const status = isTextSame ? 'UNCHANGED' : 'MODIFIED';
    
    // Calculate risk delta for this specific clause pair
    let riskDelta = 'NEUTRAL';
    const s1 = c1.risk_score || 0;
    const s2 = c2.risk_score || 0;
    
    if (s2 > s1) riskDelta = 'INCREASED';
    else if (s2 < s1) riskDelta = 'DECREASED';

    return {
        status,
        v1_clause: c1,
        v2_clause: c2,
        diff,
        risk_delta: riskDelta
    };
}

module.exports = {
    compareDocuments
};
