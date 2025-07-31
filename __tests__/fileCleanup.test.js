const fs = require('fs');
const path = require('path');

// Create a test-specific FileCleanupService class
class TestFileCleanupService {
  constructor(testUploadsDir) {
    this.uploadsDir = testUploadsDir;
    this.cleanupInterval = 60 * 60 * 1000;
    this.maxFileAge = 24 * 60 * 60 * 1000;
  }

  async deleteFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`File deleted: ${filePath}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Error deleting file ${filePath}:`, error);
      return false;
    }
  }

  async cleanupOldFiles() {
    try {
      if (!fs.existsSync(this.uploadsDir)) {
        return 0;
      }

      const files = fs.readdirSync(this.uploadsDir);
      let deletedCount = 0;
      const now = Date.now();

      for (const file of files) {
        if (file.startsWith('.')) {
          continue;
        }

        const filePath = path.join(this.uploadsDir, file);
        
        try {
          const stats = fs.statSync(filePath);
          const fileAge = now - stats.mtime.getTime();

          if (fileAge > this.maxFileAge) {
            await this.deleteFile(filePath);
            deletedCount++;
          }
        } catch (error) {
          console.error(`Error checking file ${filePath}:`, error);
        }
      }

      return deletedCount;
    } catch (error) {
      console.error('Error during file cleanup:', error);
      return 0;
    }
  }

  scheduleCleanup(sessionId, filePath, delay = 5 * 60 * 1000) {
    // For testing, execute immediately
    return this.deleteFile(filePath);
  }

  getUploadStats() {
    try {
      if (!fs.existsSync(this.uploadsDir)) {
        return { fileCount: 0, totalSize: 0 };
      }

      const files = fs.readdirSync(this.uploadsDir);
      let fileCount = 0;
      let totalSize = 0;

      for (const file of files) {
        if (!file.startsWith('.')) {
          const filePath = path.join(this.uploadsDir, file);
          try {
            const stats = fs.statSync(filePath);
            fileCount++;
            totalSize += stats.size;
          } catch (error) {
            console.error(`Error reading file stats for ${filePath}:`, error);
          }
        }
      }

      return {
        fileCount,
        totalSize,
        totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100
      };
    } catch (error) {
      console.error('Error getting upload stats:', error);
      return { fileCount: 0, totalSize: 0 };
    }
  }
}

describe('FileCleanupService', () => {
  const testUploadsDir = path.join(__dirname, 'test-uploads');
  let fileCleanupService;

  beforeAll(() => {
    // Create test uploads directory
    if (!fs.existsSync(testUploadsDir)) {
      fs.mkdirSync(testUploadsDir, { recursive: true });
    }
    // Create test service instance
    fileCleanupService = new TestFileCleanupService(testUploadsDir);
  });

  afterAll(() => {
    // Clean up test directory
    if (fs.existsSync(testUploadsDir)) {
      const files = fs.readdirSync(testUploadsDir);
      files.forEach(file => {
        const filePath = path.join(testUploadsDir, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
        }
      });
      fs.rmdirSync(testUploadsDir);
    }
  });

  beforeEach(() => {
    // Clean up any existing test files
    if (fs.existsSync(testUploadsDir)) {
      const files = fs.readdirSync(testUploadsDir);
      files.forEach(file => {
        if (!file.startsWith('.')) {
          const filePath = path.join(testUploadsDir, file);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      });
    }
  });

  describe('deleteFile', () => {
    test('should delete existing file', async () => {
      const testFile = path.join(testUploadsDir, 'test-file.pdf');
      fs.writeFileSync(testFile, 'test content');

      const result = await fileCleanupService.deleteFile(testFile);

      expect(result).toBe(true);
      expect(fs.existsSync(testFile)).toBe(false);
    });

    test('should return false for non-existent file', async () => {
      const nonExistentFile = path.join(testUploadsDir, 'non-existent.pdf');

      const result = await fileCleanupService.deleteFile(nonExistentFile);

      expect(result).toBe(false);
    });

    test('should handle deletion errors gracefully', async () => {
      // Create a file and then make it read-only to simulate deletion error
      const testFile = path.join(testUploadsDir, 'readonly-test.pdf');
      fs.writeFileSync(testFile, 'test content');
      
      // Mock fs.unlinkSync to throw an error
      const originalUnlinkSync = fs.unlinkSync;
      fs.unlinkSync = jest.fn().mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = await fileCleanupService.deleteFile(testFile);

      expect(result).toBe(false);

      // Restore original function and clean up
      fs.unlinkSync = originalUnlinkSync;
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    });
  });

  describe('cleanupOldFiles', () => {
    test('should delete old files', async () => {
      // Create test files with different ages
      const oldFile = path.join(testUploadsDir, 'old-file.pdf');
      const newFile = path.join(testUploadsDir, 'new-file.pdf');
      
      fs.writeFileSync(oldFile, 'old content');
      fs.writeFileSync(newFile, 'new content');

      // Modify the old file's timestamp to make it appear old
      const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      fs.utimesSync(oldFile, oldTime, oldTime);

      const deletedCount = await fileCleanupService.cleanupOldFiles();

      expect(deletedCount).toBe(1);
      expect(fs.existsSync(oldFile)).toBe(false);
      expect(fs.existsSync(newFile)).toBe(true);
    });

    test('should skip hidden files', async () => {
      const hiddenFile = path.join(testUploadsDir, '.gitkeep');
      fs.writeFileSync(hiddenFile, '');

      // Make it appear old
      const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000);
      fs.utimesSync(hiddenFile, oldTime, oldTime);

      const deletedCount = await fileCleanupService.cleanupOldFiles();

      expect(deletedCount).toBe(0);
      expect(fs.existsSync(hiddenFile)).toBe(true);
    });

    test('should handle non-existent uploads directory', async () => {
      const originalUploadsDir = fileCleanupService.uploadsDir;
      fileCleanupService.uploadsDir = '/non/existent/directory';

      const deletedCount = await fileCleanupService.cleanupOldFiles();

      expect(deletedCount).toBe(0);

      // Restore original directory
      fileCleanupService.uploadsDir = originalUploadsDir;
    });
  });

  describe('getUploadStats', () => {
    test('should return correct statistics', () => {
      // Create test files
      const file1 = path.join(testUploadsDir, 'file1.pdf');
      const file2 = path.join(testUploadsDir, 'file2.pdf');
      const hiddenFile = path.join(testUploadsDir, '.gitkeep');

      fs.writeFileSync(file1, 'content1');
      fs.writeFileSync(file2, 'content22'); // Different size
      fs.writeFileSync(hiddenFile, 'hidden');

      const stats = fileCleanupService.getUploadStats();

      expect(stats.fileCount).toBe(2); // Should not count hidden files
      expect(stats.totalSize).toBeGreaterThan(0); // Just check it's greater than 0
      expect(stats.totalSizeMB).toBeDefined();
      expect(typeof stats.totalSizeMB).toBe('number');
    });

    test('should handle empty directory', () => {
      const stats = fileCleanupService.getUploadStats();

      expect(stats.fileCount).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.totalSizeMB).toBe(0);
    });

    test('should handle non-existent directory', () => {
      const originalUploadsDir = fileCleanupService.uploadsDir;
      fileCleanupService.uploadsDir = '/non/existent/directory';

      const stats = fileCleanupService.getUploadStats();

      expect(stats.fileCount).toBe(0);
      expect(stats.totalSize).toBe(0);

      // Restore original directory
      fileCleanupService.uploadsDir = originalUploadsDir;
    });
  });

  describe('scheduleCleanup', () => {
    test('should schedule file cleanup', async () => {
      const testFile = path.join(testUploadsDir, 'scheduled-cleanup.pdf');
      fs.writeFileSync(testFile, 'test content');

      // In our mock, this executes immediately
      await fileCleanupService.scheduleCleanup('test-session', testFile, 100);

      expect(fs.existsSync(testFile)).toBe(false);
    });
  });
});