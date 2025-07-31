const fs = require('fs');
const path = require('path');

/**
 * Validates PDF file format and integrity
 * @param {Object} file - Multer file object
 * @returns {Promise<boolean>} - True if valid PDF, false otherwise
 */
async function validatePDFFile(file) {
  try {
    // Check if file exists
    if (!fs.existsSync(file.path)) {
      return false;
    }

    // Read first few bytes to check PDF signature
    const buffer = Buffer.alloc(8);
    const fd = fs.openSync(file.path, 'r');
    fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);

    // PDF files should start with %PDF-
    const pdfSignature = buffer.toString('ascii', 0, 5);
    if (pdfSignature !== '%PDF-') {
      return false;
    }

    // Check file size (should be > 0 and within limits)
    const stats = fs.statSync(file.path);
    if (stats.size === 0) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('PDF validation error:', error);
    return false;
  }
}

/**
 * Middleware to validate uploaded PDF files
 */
const validatePDFMiddleware = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        code: 'NO_FILE'
      });
    }

    // Validate file extension
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    if (fileExtension !== '.pdf') {
      // Clean up uploaded file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        error: 'Only PDF files are allowed',
        code: 'INVALID_FILE_TYPE'
      });
    }

    // Validate PDF format and integrity
    const isValidPDF = await validatePDFFile(req.file);
    if (!isValidPDF) {
      // Clean up invalid file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        error: 'Invalid or corrupted PDF file',
        code: 'INVALID_PDF'
      });
    }

    // Add validation timestamp to file object
    req.file.validatedAt = new Date().toISOString();
    next();
  } catch (error) {
    console.error('File validation middleware error:', error);
    
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      error: 'File validation failed',
      code: 'VALIDATION_ERROR'
    });
  }
};

module.exports = {
  validatePDFFile,
  validatePDFMiddleware
};