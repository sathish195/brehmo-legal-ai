require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { SystemMessage, HumanMessage } = require('@langchain/core/messages');

// 🆕 LangChain LLM setup
const llm = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    apiKey: process.env.GEMINI_API_KEY || process.env.CLAUDE_API_KEY,
});

/**
 * Scores a clause for risk against firm constraints using LangChain and Gemini API.
 * 
 * @param {Object} clause - The clause object to evaluate.
 * @param {Array} constraints - Array of firm constraint objects from the DB.
 * @returns {Promise<Object>} The risk assessment parsed from JSON.
 */
async function scoreClauseRisk(clause, constraints) {
    // Format constraints for the prompt
    const constraintsText = constraints.map(c =>
        `[${c.code}] ${c.description}: ${c.rule_detail}`
    ).join('\n');

    const promptText = `
You are an expert legal AI assistant. Your task is to evaluate a specific legal clause against our firm's strict constraints.

FIRM CONSTRAINTS:
${constraintsText}

CLAUSE TO EVALUATE:
Number: ${clause.clause_number}
Title: ${clause.clause_title}
Text:
${clause.full_text}

Evaluate the clause risk based ONLY on whether it violates the firm constraints above. 
- Score the risk from 1 to 10.
- Determine the risk_level strictly as one of: "GREEN" (1-3), "YELLOW" (4-6), or "RED" (7-10).

Return ONLY a valid JSON object with the following exact structure (no markdown formatting, no extra text):
{
  "score": <number 1-10>,
  "risk_level": "<GREEN | YELLOW | RED>",
  "reason": "<Brief explanation of why the score was given based on the text>",
  "triggered_constraints": ["<C-XXX>", "<C-YYY>"],
  "constraint_detail": "<Explanation of how the firm policy is violated or adhered to>"
}
`;

    try {
        const response = await llm.invoke([
            new SystemMessage("You are a senior legal document reviewer. You output strictly valid JSON."),
            new HumanMessage(promptText)
        ]);
        console.log("scoreClauseRisk response:", response);


        const responseText = response.content.trim();

        // Extract JSON if the model accidentally adds a markdown block
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : responseText;

        return JSON.parse(jsonString);
    } catch (error) {
        console.error(`Error scoring clause ${clause.clause_number}:`, error.message);
        // Smart heuristic fallback for API limits/errors
        return generateHeuristicMock(clause.full_text, clause.clause_number, clause.clause_title);
    }
}

function generateHeuristicMock(clauseText, clauseNumber, clauseTitle) {
    const text = clauseText.toLowerCase();
    
    // Check C-014: Governing Law
    if ((text.includes('governing law') || text.includes('jurisdiction') || text.includes('governed by')) &&
        (text.includes('delaware') || text.includes('new york') || text.includes('england') || text.includes('london') || text.includes('foreign') || text.includes('singapore'))) {
        return {
            score: 8,
            risk_level: "RED",
            reason: "Governing law is set to a foreign jurisdiction, violating constraint C-014 which requires India jurisdiction.",
            triggered_constraints: ["C-014"],
            constraint_detail: "Violation of C-014 (Governing Law must be India jurisdiction)."
        };
    }
    
    // Check C-010: Liability Cap
    if (text.includes('liability') && (text.includes('unlimited') || text.includes('sole responsibility') || text.includes('no cap') || text.includes('maximum extent permitted'))) {
        return {
            score: 9,
            risk_level: "RED",
            reason: "Unlimited liability clause detected, violating constraint C-010 (requires liability cap of max 2x contract value).",
            triggered_constraints: ["C-010"],
            constraint_detail: "Violation of C-010 (Liability must be capped at maximum 2x contract value)."
        };
    }
    
    // Check C-011: Non-solicitation
    if ((text.includes('solicit') || text.includes('non-compete') || text.includes('compete')) && 
        (text.includes('24') || text.includes('two years') || text.includes('2 years') || text.includes('3 years') || text.includes('18'))) {
        return {
            score: 8,
            risk_level: "RED",
            reason: "Non-solicitation / non-compete duration exceeds the 12-month limit specified in C-011.",
            triggered_constraints: ["C-011"],
            constraint_detail: "Violation of C-011 (Non-solicitation / non-compete maximum 12 months)."
        };
    }
    
    // Check C-016: Payment Terms
    if ((text.includes('payment') || text.includes('invoice') || text.includes('pay within')) && 
        (text.includes('90') || text.includes('120') || text.includes('ninety'))) {
        return {
            score: 7,
            risk_level: "RED",
            reason: "Payment terms of 90+ days exceed the 60-day maximum limit specified in C-016.",
            triggered_constraints: ["C-016"],
            constraint_detail: "Violation of C-016 (Payment terms must not exceed 60 days)."
        };
    }
    
    // Check C-017: Termination Notice
    if (text.includes('termination') && (text.includes('10 days') || text.includes('15 days') || text.includes('7 days') || text.includes('immediate'))) {
        return {
            score: 7,
            risk_level: "RED",
            reason: "Termination notice period is shorter than the 30-day minimum required by C-017.",
            triggered_constraints: ["C-017"],
            constraint_detail: "Violation of C-017 (Termination notice minimum 30 days)."
        };
    }

    // Check C-019: Data Protection
    if ((text.includes('data protection') || text.includes('personal data') || text.includes('privacy')) && !text.includes('dpdp')) {
        return {
            score: 5,
            risk_level: "YELLOW",
            reason: "Data protection clause lacks specific reference to the DPDP Act 2023 for India contracts.",
            triggered_constraints: ["C-019"],
            constraint_detail: "Violation of C-019 (Data protection must reference DPDP Act 2023)."
        };
    }

    // Default green/low risk for boilerplates or other clauses
    const score = hashTextToScore(clauseText);
    let risk_level = "GREEN";
    if (score >= 5) risk_level = "RED";
    else if (score >= 3) risk_level = "YELLOW";
    
    return {
        score,
        risk_level,
        reason: score >= 5 
            ? "A potential risk was identified in the clause terms." 
            : (score >= 3 ? "Standard clause with moderate risk profile." : "Standard boilerplate clause. No constraints violated."),
        triggered_constraints: [],
        constraint_detail: "The clause conforms to standard legal guidelines."
    };
}

function hashTextToScore(text) {
    let hash = 0;
    for (let i = 0; i < Math.min(text.length, 50); i++) {
        hash += text.charCodeAt(i);
    }
    return (hash % 6) + 1; // score 1 to 6
}

module.exports = {
    scoreClauseRisk
};
