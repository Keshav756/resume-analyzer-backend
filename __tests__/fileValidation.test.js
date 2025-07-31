const fs = require('fs');
const path = require('path');
const { validatePDFFile, validatePDFMiddleware } = require('../middleware/fileValidation');

// Create test directory
const testDir = path.join(__dirname, 'test-files');

describe('File Validation', () => {
  beforeAll(() => {
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      const files = fs.readdirSync(testDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(testDir, file));
      });
      fs.rmdirSync(testDir);
    }
  });

  describe('validatePDFFile', () => {
    test('should return true for valid PDF file', async () => {
      // Create a mock PDF file with proper signature
      const validPDFPath = path.join(testDir, 'valid.pdf');
      const pdfContent = Buffer.concat([
        Buffer.from('%PDF-1.4\n'),
        Buffer.from('Some PDF content here'),
        Buffer.from('\n%%EOF')
      ]);
      fs.writeFileSync(validPDFPath, pdfContent);

      const mockFile = { path: validPDFPath };
      const result = await validatePDFFile(mockFile);
      
      expect(result).toBe(true);
    });

    test('should return false for file without PDF signature', async () => {
      // Create a file without PDF signature
      const invalidPath = path.join(testDir, 'invalid.pdf');
      fs.writeFileSync(invalidPath, 'This is not a PDF file');

      const mockFile = { path: invalidPath };
      const result = await validatePDFFile(mockFile);
      
      expect(result).toBe(false);
    });

    test('should return false for empty file', async () => {
      // Create an empty file
      const emptyPath = path.join(testDir, 'empty.pdf');
      fs.writeFileSync(emptyPath, '');

      const mockFile = { path: emptyPath };
      const result = await validatePDFFile(mockFile);
      
      expect(result).toBe(false);
    });

    test('should return false for non-existent file', async () => {
      const mockFile = { path: '/non/existent/file.pdf' };
      const result = await validatePDFFile(mockFile);
      
      expect(result).toBe(false);
    });
  });

  describe('validatePDFMiddleware', () => {
    let req, res, next;

    beforeEach(() => {
      req = {};
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      next = jest.fn();
    });

    test('should return error when no file is uploaded', async () => {
      req.file = null;

      await validatePDFMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'No file uploaded',
        code: 'NO_FILE'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should return error for non-PDF file extension', async () => {
      const testFilePath = path.join(testDir, 'test.txt');
      fs.writeFileSync(testFilePath, 'test content');

      req.file = {
        originalname: 'test.txt',
        path: testFilePath
      };

      await validatePDFMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Only PDF files are allowed',
        code: 'INVALID_FILE_TYPE'
      });
      expect(next).not.toHaveBeenCalled();
      expect(fs.existsSync(testFilePath)).toBe(false); // File should be cleaned up
    });

    test('should return error for invalid PDF content', async () => {
      const invalidPDFPath = path.join(testDir, 'invalid.pdf');
      fs.writeFileSync(invalidPDFPath, 'Not a real PDF');

      req.file = {
        originalname: 'invalid.pdf',
        path: invalidPDFPath
      };

      await validatePDFMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid or corrupted PDF file',
        code: 'INVALID_PDF'
      });
      expect(next).not.toHaveBeenCalled();
      expect(fs.existsSync(invalidPDFPath)).toBe(false); // File should be cleaned up
    });

    test('should call next() for valid PDF file', async () => {
      const validPDFPath = path.join(testDir, 'valid.pdf');
      const pdfContent = Buffer.concat([
        Buffer.from('%PDF-1.4\n'),
        Buffer.from('Valid PDF content'),
        Buffer.from('\n%%EOF')
      ]);
      fs.writeFileSync(validPDFPath, pdfContent);

      req.file = {
        originalname: 'valid.pdf',
        path: validPDFPath
      };

      await validatePDFMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(req.file.validatedAt).toBeDefined();
      expect(typeof req.file.validatedAt).toBe('string');
    });

    test('should handle validation errors gracefully', async () => {
      // Create a file that will cause fs.openSync to fail
      const testFilePath = path.join(testDir, 'error-test.pdf');
      fs.writeFileSync(testFilePath, '%PDF-1.4\ntest');

      req.file = {
        originalname: 'error-test.pdf',
        path: '/invalid/path/that/does/not/exist.pdf' // Use invalid path to trigger error
      };

      await validatePDFMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid or corrupted PDF file',
        code: 'INVALID_PDF'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});