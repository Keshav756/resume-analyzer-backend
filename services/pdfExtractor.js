const pdfParse = require('pdf-parse');
const fs = require('fs').promises;

/**
 * PDF Text Extraction Service
 * Handles PDF text extraction with comprehensive error handling
 */
class PDFExtractor {
  constructor() {
    this.minTextLength = 50; // Minimum characters for meaningful content
    this.maxFileSize = 10 * 1024 * 1024; // 10MB limit
  }

  /**
   * Extract text from PDF file
   * @param {string} filePath - Path to the PDF file
   * @returns {Promise<Object>} - Extraction result with text and metadata
   */
  async extractText(filePath) {
    try {
      // Validate file exists and get stats
      const stats = await fs.stat(filePath);
      
      if (stats.size > this.maxFileSize) {
        throw new Error('PDF file too large. Maximum size is 10MB.');
      }

      if (stats.size === 0) {
        throw new Error('PDF file is empty.');
      }

      // Read the PDF file
      const dataBuffer = await fs.readFile(filePath);
      
      // Parse PDF with options
      const options = {
        // Preserve whitespace and formatting where possible
        normalizeWhitespace: false,
        // Don't render pages as images
        disableCombineTextItems: false
      };

      const data = await pdfParse(dataBuffer, options);
      
      // Validate extracted content
      const extractedText = data.text.trim();
      const validationResult = this.validateExtractedText(extractedText);
      
      if (!validationResult.isValid) {
        throw new Error(validationResult.error);
      }

      return {
        success: true,
        text: extractedText,
        metadata: {
          pages: data.numpages,
          info: data.info,
          textLength: extractedText.length,
          wordCount: this.countWords(extractedText),
          extractedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      return this.handleExtractionError(error, filePath);
    }
  }

  /**
   * Validate that extracted text is meaningful
   * @param {string} text - Extracted text to validate
   * @returns {Object} - Validation result
   */
  validateExtractedText(text) {
    if (!text || text.length === 0) {
      return {
        isValid: false,
        error: 'No text could be extracted from the PDF. The file may contain only images or be corrupted.'
      };
    }

    if (text.length < this.minTextLength) {
      return {
        isValid: false,
        error: `Extracted text is too short (${text.length} characters). The PDF may contain mostly images or have very little text content.`
      };
    }

    // Check if text contains mostly non-printable or garbled characters
    const printableChars = text.replace(/[^\x20-\x7E\s]/g, '').length;
    const printableRatio = printableChars / text.length;
    
    if (printableRatio < 0.7) {
      return {
        isValid: false,
        error: 'Extracted text appears to be corrupted or contains mostly non-readable characters.'
      };
    }

    return { isValid: true };
  }

  /**
   * Count words in text
   * @param {string} text - Text to count words in
   * @returns {number} - Word count
   */
  countWords(text) {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Handle extraction errors with specific error types
   * @param {Error} error - The error that occurred
   * @param {string} filePath - Path to the file that failed
   * @returns {Object} - Formatted error response
   */
  handleExtractionError(error, filePath) {
    let errorType = 'EXTRACTION_ERROR';
    let userMessage = 'Failed to extract text from PDF.';

    // Categorize different types of errors
    if (error.message.includes('Invalid PDF')) {
      errorType = 'INVALID_PDF';
      userMessage = 'The uploaded file is not a valid PDF or is corrupted.';
    } else if (error.message.includes('password') || error.message.includes('encrypted')) {
      errorType = 'PASSWORD_PROTECTED';
      userMessage = 'This PDF is password-protected. Please upload an unprotected version.';
    } else if (error.message.includes('too large')) {
      errorType = 'FILE_TOO_LARGE';
      userMessage = error.message;
    } else if (error.message.includes('empty')) {
      errorType = 'EMPTY_FILE';
      userMessage = error.message;
    } else if (error.message.includes('images') || error.message.includes('too short')) {
      errorType = 'INSUFFICIENT_TEXT';
      userMessage = error.message;
    } else if (error.code === 'ENOENT') {
      errorType = 'FILE_NOT_FOUND';
      userMessage = 'PDF file not found. Please try uploading again.';
    } else if (error.code === 'EACCES') {
      errorType = 'FILE_ACCESS_ERROR';
      userMessage = 'Unable to access the PDF file. Please try again.';
    }

    console.error(`PDF extraction error for ${filePath}:`, {
      error: error.message,
      type: errorType,
      stack: error.stack
    });

    return {
      success: false,
      error: {
        type: errorType,
        message: userMessage,
        details: error.message,
        timestamp: new Date().toISOString()
      }
    };
  }
}

module.exports = PDFExtractor;