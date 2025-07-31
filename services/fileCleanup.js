const fs = require('fs');
const path = require('path');

/**
 * Service for managing temporary file cleanup
 */
class FileCleanupService {
  constructor() {
    this.uploadsDir = path.join(__dirname, '../uploads');
    this.cleanupInterval = 5 * 60 * 1000; // 5 minute in milliseconds
    this.maxFileAge = 10 * 60 * 1000; // 10 minute in milliseconds
    
    // Start automatic cleanup
    this.startAutomaticCleanup();
  }

  /**
   * Delete a specific file
   * @param {string} filePath - Path to the file to delete
   * @returns {Promise<boolean>} - True if deleted successfully
   */
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

  /**
   * Clean up old files in the uploads directory
   * @returns {Promise<number>} - Number of files deleted
   */
  async cleanupOldFiles() {
    try {
      if (!fs.existsSync(this.uploadsDir)) {
        return 0;
      }

      const files = fs.readdirSync(this.uploadsDir);
      let deletedCount = 0;
      const now = Date.now();

      for (const file of files) {
        // Skip .gitkeep and other hidden files
        if (file.startsWith('.')) {
          continue;
        }

        const filePath = path.join(this.uploadsDir, file);
        
        try {
          const stats = fs.statSync(filePath);
          const fileAge = now - stats.mtime.getTime();

          // Delete files older than maxFileAge
          if (fileAge > this.maxFileAge) {
            await this.deleteFile(filePath);
            deletedCount++;
          }
        } catch (error) {
          console.error(`Error checking file ${filePath}:`, error);
        }
      }

      if (deletedCount > 0) {
        console.log(`Cleaned up ${deletedCount} old files`);
      }

      return deletedCount;
    } catch (error) {
      console.error('Error during file cleanup:', error);
      return 0;
    }
  }

  /**
   * Start automatic cleanup process
   */
  startAutomaticCleanup() {
    // Run cleanup immediately
    this.cleanupOldFiles();

    // Set up interval for regular cleanup
    setInterval(() => {
      this.cleanupOldFiles();
    }, this.cleanupInterval);

    console.log(`File cleanup service started. Cleanup interval: ${this.cleanupInterval / 1000}s`);
  }

  /**
   * Clean up file after processing is complete
   * @param {string} sessionId - Session ID associated with the file
   * @param {string} filePath - Path to the file to clean up
   * @param {number} delay - Delay in milliseconds before cleanup (default: 5 minutes)
   */
  scheduleCleanup(sessionId, filePath, delay = 5 * 60 * 1000) {
    setTimeout(async () => {
      await this.deleteFile(filePath);
      console.log(`Scheduled cleanup completed for session ${sessionId}`);
    }, delay);
  }

  /**
   * Get upload directory statistics
   * @returns {Object} - Directory statistics
   */
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

// Create singleton instance
const fileCleanupService = new FileCleanupService();

module.exports = fileCleanupService;