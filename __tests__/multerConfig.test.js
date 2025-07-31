const multer = require('multer');
const { uploadConfig, handleMulterError } = require('../middleware/multerConfig');

describe('Multer Configuration', () => {
  describe('uploadConfig', () => {
    test('should be a multer instance', () => {
      expect(uploadConfig).toBeDefined();
      expect(typeof uploadConfig).toBe('object');
    });

    test('should have correct configuration', () => {
      // Test by creating a mock file that would trigger size limit
      const mockReq = {};
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const mockNext = jest.fn();

      // Test file size limit by creating a multer error
      const fileSizeError = new multer.MulterError('LIMIT_FILE_SIZE');
      handleMulterError(fileSizeError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'File too large. Maximum size is 10MB',
        code: 'FILE_TOO_LARGE'
      });
    });
  });

  describe('handleMulterError', () => {
    let req, res, next;

    beforeEach(() => {
      req = {};
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      next = jest.fn();
    });

    test('should handle LIMIT_FILE_SIZE error', () => {
      const error = new multer.MulterError('LIMIT_FILE_SIZE');

      handleMulterError(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'File too large. Maximum size is 10MB',
        code: 'FILE_TOO_LARGE'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle LIMIT_FILE_COUNT error', () => {
      const error = new multer.MulterError('LIMIT_FILE_COUNT');

      handleMulterError(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Too many files. Only 1 file allowed',
        code: 'TOO_MANY_FILES'
      });
    });

    test('should handle LIMIT_UNEXPECTED_FILE error', () => {
      const error = new multer.MulterError('LIMIT_UNEXPECTED_FILE');

      handleMulterError(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unexpected file field',
        code: 'UNEXPECTED_FILE'
      });
    });

    test('should handle INVALID_FILE_TYPE error', () => {
      const error = new Error('INVALID_FILE_TYPE');

      handleMulterError(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Only PDF files are allowed',
        code: 'INVALID_FILE_TYPE'
      });
    });

    test('should pass through other errors', () => {
      const error = new Error('Some other error');

      handleMulterError(error, req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});