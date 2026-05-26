const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * Sanitizes PDF buffer by stripping out leading and trailing garbage bytes
 * (e.g. form boundaries or HTTP padding) that corrupt the XRef offset calculations.
 */
function sanitizePdfBuffer(buffer) {
    const startString = '%PDF-';
    const startIndex = buffer.indexOf(Buffer.from(startString));
    
    const endString = '%%EOF';
    const endIndex = buffer.lastIndexOf(Buffer.from(endString));
    
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        return buffer.slice(startIndex, endIndex + endString.length);
    }
    return buffer;
}

/**
 * Extracts raw text from a document buffer based on its mimetype/extension.
 * Supports PDF and DOCX.
 * 
 * @param {Buffer} fileBuffer - The buffer of the uploaded file.
 * @param {string} mimetype - The MIME type of the file.
 * @param {string} originalname - The original filename.
 * @returns {Promise<string>} The extracted raw text.
 */
async function extractText(fileBuffer, mimetype, originalname) {
    try {
        if (mimetype === 'application/pdf' || originalname.toLowerCase().endsWith('.pdf')) {
            // Try standard parsing first
            try {
                const pdfData = await pdfParse(fileBuffer);
                return pdfData.text;
            } catch (parseErr) {
                console.warn('⚠️ PDF parsing failed on first attempt. Attempting buffer cleanup to fix bad XRef/corruption...');
                const cleanBuffer = sanitizePdfBuffer(fileBuffer);
                const pdfData = await pdfParse(cleanBuffer);
                return pdfData.text;
            }
        } else if (
            mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
            originalname.toLowerCase().endsWith('.docx')
        ) {
            // Extract text from DOCX
            const result = await mammoth.extractRawText({ buffer: fileBuffer });
            return result.value; // The raw text
        } else {
            throw new Error('Unsupported file type. Only PDF and DOCX are allowed.');
        }
    } catch (error) {
        throw new Error(`Text extraction failed: ${error.message}`);
    }
}

module.exports = {
    extractText
};
