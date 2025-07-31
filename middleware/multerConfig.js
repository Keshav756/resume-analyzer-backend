const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp and random suffix
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `resume-${uniqueSuffix}-${sanitizedOriginalName}`);
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  // Check MIME type
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('INVALID_FILE_TYPE'), false);
  }
};

// Multer configuration
const uploadConfig = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1, // Only allow 1 file at a time
    fields: 5, // Limit number of fields
    fieldSize: 1024 * 1024 // 1MB field size limit
  },
  fileFilter: fileFilter
});

// Error handler for multer errors
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    let errorMessage = 'File upload error';
    let errorCode = 'UPLOAD_ERROR';

    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        errorMessage = 'File too large. Maximum size is 10MB';
        errorCode = 'FILE_TOO_LARGE';
        break;
      case 'LIMIT_FILE_COUNT':
        errorMessage = 'Too many files. Only 1 file allowed';
        errorCode = 'TOO_MANY_FILES';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        errorMessage = 'Unexpected file field';
        errorCode = 'UNEXPECTED_FILE';
        break;
      case 'LIMIT_FIELD_COUNT':
        errorMessage = 'Too many fields';
        errorCode = 'TOO_MANY_FIELDS';
        break;
      case 'LIMIT_FIELD_SIZE':
        errorMessage = 'Field size too large';
        errorCode = 'FIELD_TOO_LARGE';
        break;
    }

    return res.status(400).json({
      error: errorMessage,
      code: errorCode
    });
  }

  if (error.message === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      error: 'Only PDF files are allowed',
      code: 'INVALID_FILE_TYPE'
    });
  }

  // Pass other errors to the next error handler
  next(error);
};

module.exports = {
  uploadConfig,
  handleMulterError
};