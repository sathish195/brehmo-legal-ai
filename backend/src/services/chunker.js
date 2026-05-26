/**
 * Universal legal clause chunker
 * Uses regex patterns to identify clause boundaries and keep sub-clauses intact.
 */

function chunkDocument(rawText) {
    const lines = rawText.split('\n');
    const clauses = [];
    let currentClause = null;
    let position = 1;

    // Regex patterns for legal boundaries
    // 1. Keyword Headings: "ARTICLE IV", "CLAUSE 8", "SCHEDULE A"
    const keywordRegex = /^(ARTICLE|CLAUSE|SECTION|SCHEDULE)\s+([A-Z0-9IVX]+)[\s\-:]*(.*)/i;

    // 2. Numbered clauses: "1.", "1.1", "5.2.1"
    // Requires a space after the number to avoid matching random decimals like "1.5%"
    const numberedRegex = /^(\d+(?:\.\d+)*)\.?\s+(.+)/;

    // 3. Uppercase titles: "REPRESENTATIONS AND WARRANTIES"
    const uppercaseRegex = /^([A-Z][A-Z\s&,]{4,})$/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        let isNewClause = false;
        let number = null;
        let title = null;

        const kwMatch = line.match(keywordRegex);
        const numMatch = line.match(numberedRegex);
        const upMatch = line.match(uppercaseRegex);

        if (kwMatch) {
            isNewClause = true;
            number = `${kwMatch[1].toUpperCase()} ${kwMatch[2]}`.trim();
            title = kwMatch[3].trim() || number;
        } else if (numMatch) {
            isNewClause = true;
            number = numMatch[1];
            // Infer title from the first sentence or phrase
            title = numMatch[2].split('.')[0].trim();
        } else if (upMatch) {
            isNewClause = true;
            number = `SEC-${position}`;
            title = upMatch[1].trim();
        }

        if (isNewClause) {
            if (currentClause) {
                clauses.push(currentClause);
            }
            currentClause = {
                clause_number: number,
                clause_title: title,
                clause_type: guessClauseType(title),
                full_text: line,
                word_count: 0,
                position: position++
            };
        } else {
            // Sub-clauses like (a), (i), bullet points naturally fall here
            // keeping them WITH the parent clause as requested.
            if (currentClause) {
                currentClause.full_text += '\n' + line;
            } else {
                currentClause = {
                    clause_number: 'Intro',
                    clause_title: 'Introduction',
                    clause_type: 'other',
                    full_text: line,
                    word_count: 0,
                    position: position++
                };
            }
        }
    }

    if (currentClause) {
        clauses.push(currentClause);
    }

    // Post-process to calculate word count
    clauses.forEach(c => {
        // split by whitespace to get accurate word count
        c.word_count = c.full_text.split(/\s+/).filter(Boolean).length;

        // Default truncation for very long titles guessed from first sentence
        if (c.clause_title.length > 100) {
            c.clause_title = c.clause_title.substring(0, 97) + '...';
        }
    });

    return clauses;
}

/**
 * Heuristic to categorize clauses based on title keywords
 */
function guessClauseType(title) {
    const t = title.toLowerCase();
    if (t.includes('liab') || t.includes('indemn') || t.includes('damag')) return 'liability';
    if (t.includes('defin') || t.includes('interpret')) return 'definition';
    if (t.includes('oblig') || t.includes('respons') || t.includes('duti')) return 'obligation';
    if (t.includes('intellectual') || t.includes('ip') || t.includes('prop')) return 'ip';
    if (t.includes('terminat') || t.includes('term ') || t.includes('expir')) return 'termination';
    if (t.includes('confiden') || t.includes('nda') || t.includes('secre')) return 'confidentiality';
    if (t.includes('disput') || t.includes('law') || t.includes('jurisdic') || t.includes('arbitrat')) return 'dispute resolution';
    if (t.includes('pay') || t.includes('fee') || t.includes('compens')) return 'payment';
    return 'other';
}

module.exports = {
    chunkDocument,
    guessClauseType
};
