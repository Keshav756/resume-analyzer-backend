const sseManager = require('./sseManager');
const sessionManager = require('./sessionManager');

/**
 * Event Broadcasting Service
 * Handles broadcasting session updates through SSE connections
 */
class EventBroadcaster {
  constructor() {
    this.eventTypes = {
      UPLOAD_STARTED: 'upload.started',
      UPLOAD_COMPLETED: 'upload.completed',
      EXTRACTION_STARTED: 'extraction.started',
      EXTRACTION_COMPLETED: 'extraction.completed',
      ANALYSIS_STARTED: 'analysis.started',
      ANALYSIS_STREAMING: 'analysis.streaming',
      ANALYSIS_COMPLETED: 'analysis.completed',
      ERROR_OCCURRED: 'error.occurred',
      RETRY_STARTED: 'retry.started',
      SESSION_UPDATED: 'session.updated'
    };
  }

  /**
   * Broadcast upload started event
   * @param {string} sessionId - Session ID
   * @param {Object} fileInfo - File information
   */
  broadcastUploadStarted(sessionId, fileInfo = {}) {
    const eventData = {
      status: 'uploading',
      message: 'File upload started',
      fileInfo: {
        name: fileInfo.originalName || fileInfo.name,
        size: fileInfo.size,
        type: fileInfo.mimetype || fileInfo.type
      }
    };

    // Update session status
    sessionManager.updateStatus(sessionId, 'uploading');
    sessionManager.updateSession(sessionId, { fileInfo });

    // Broadcast event
    sseManager.broadcastToSession(sessionId, this.eventTypes.UPLOAD_STARTED, eventData);
    
    console.log(`Broadcast: Upload started for session ${sessionId}`);
  }

  /**
   * Broadcast upload completed event
   * @param {string} sessionId - Session ID
   * @param {Object} fileInfo - File information
   */
  broadcastUploadCompleted(sessionId, fileInfo = {}) {
    const eventData = {
      status: 'uploaded',
      message: 'File uploaded successfully',
      fileInfo: {
        name: fileInfo.originalName || fileInfo.name,
        size: fileInfo.size,
        type: fileInfo.mimetype || fileInfo.type,
        uploadedAt: fileInfo.uploadedAt || new Date().toISOString()
      }
    };

    // Update session status
    sessionManager.updateStatus(sessionId, 'uploaded');
    sessionManager.updateSession(sessionId, { 
      fileInfo,
      uploadedAt: new Date()
    });

    // Broadcast event
    sseManager.broadcastToSession(sessionId, this.eventTypes.UPLOAD_COMPLETED, eventData);
    
    console.log(`Broadcast: Upload completed for session ${sessionId}`);
  }

  /**
   * Broadcast text extraction started event
   * @param {string} sessionId - Session ID
   */
  broadcastExtractionStarted(sessionId) {
    const eventData = {
      status: 'extracting',
      message: 'Extracting text from PDF...',
      stage: 'extraction'
    };

    // Update session status
    sessionManager.updateStatus(sessionId, 'extracting');

    // Broadcast event
    sseManager.broadcastToSession(sessionId, this.eventTypes.EXTRACTION_STARTED, eventData);
    
    console.log(`Broadcast: Text extraction started for session ${sessionId}`);
  }

  /**
   * Broadcast text extraction completed event
   * @param {string} sessionId - Session ID
   * @param {Object} extractionResult - Extraction result
   */
  broadcastExtractionCompleted(sessionId, extractionResult = {}) {
    const eventData = {
      status: 'extracted',
      message: 'Text extraction completed',
      stage: 'extraction',
      extractionInfo: {
        textLength: extractionResult.textLength || 0,
        pageCount: extractionResult.pageCount || 0,
        hasText: extractionResult.hasText || false
      }
    };

    // Update session status
    sessionManager.updateStatus(sessionId, 'extracted');
    sessionManager.updateSession(sessionId, { 
      extractedText: extractionResult.text,
      extractionInfo: eventData.extractionInfo
    });

    // Broadcast event
    sseManager.broadcastToSession(sessionId, this.eventTypes.EXTRACTION_COMPLETED, eventData);
    
    console.log(`Broadcast: Text extraction completed for session ${sessionId}`);
  }

  /**
   * Broadcast AI analysis started event
   * @param {string} sessionId - Session ID
   */
  broadcastAnalysisStarted(sessionId) {
    const eventData = {
      status: 'analyzing',
      message: 'AI analysis started...',
      stage: 'analysis'
    };

    // Update session status
    sessionManager.updateStatus(sessionId, 'analyzing');

    // Broadcast event
    sseManager.broadcastToSession(sessionId, this.eventTypes.ANALYSIS_STARTED, eventData);
    
    console.log(`Broadcast: AI analysis started for session ${sessionId}`);
  }

  /**
   * Broadcast streaming AI content
   * @param {string} sessionId - Session ID
   * @param {string} content - Streaming content chunk
   * @param {Object} metadata - Additional metadata
   */
  broadcastAnalysisStreaming(sessionId, content, metadata = {}) {
    const eventData = {
      status: 'streaming',
      message: 'Receiving AI feedback...',
      stage: 'analysis',
      content: content,
      metadata: {
        chunkIndex: metadata.chunkIndex || 0,
        isComplete: metadata.isComplete || false,
        section: metadata.section || 'general'
      }
    };

    // Update session with streaming content
    const session = sessionManager.getSession(sessionId);
    if (session) {
      const currentContent = session.streamingContent || '';
      sessionManager.updateSession(sessionId, {
        streamingContent: currentContent + content,
        lastStreamUpdate: new Date()
      });
    }

    // Broadcast event
    sseManager.broadcastToSession(sessionId, this.eventTypes.ANALYSIS_STREAMING, eventData);
  }

  /**
   * Broadcast AI analysis completed event
   * @param {string} sessionId - Session ID
   * @param {Object} feedback - Complete feedback object
   */
  broadcastAnalysisCompleted(sessionId, feedback = {}) {
    const eventData = {
      status: 'completed',
      message: 'AI analysis completed successfully',
      stage: 'analysis',
      feedback: feedback,
      completedAt: new Date().toISOString()
    };

    // Update session status
    sessionManager.updateStatus(sessionId, 'completed');
    sessionManager.updateSession(sessionId, { 
      feedback,
      completedAt: new Date(),
      streamingContent: null // Clear streaming content
    });

    // Broadcast event
    sseManager.broadcastToSession(sessionId, this.eventTypes.ANALYSIS_COMPLETED, eventData);
    
    console.log(`Broadcast: AI analysis completed for session ${sessionId}`);
  }

  /**
   * Broadcast error event
   * @param {string} sessionId - Session ID
   * @param {Error|string} error - Error object or message
   * @param {Object} options - Error options
   */
  broadcastError(sessionId, error, options = {}) {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorCode = error.code || options.code || 'UNKNOWN_ERROR';
    
    const eventData = {
      status: 'error',
      message: errorMessage,
      error: {
        code: errorCode,
        message: errorMessage,
        retryable: options.retryable !== false,
        stage: options.stage || 'unknown'
      },
      retryCount: options.retryCount || 0
    };

    // Update session status
    sessionManager.updateStatus(sessionId, 'error');
    sessionManager.updateSession(sessionId, { 
      lastError: errorMessage,
      errorCode: errorCode,
      retryCount: options.retryCount || 0
    });

    // Broadcast event
    sseManager.broadcastToSession(sessionId, this.eventTypes.ERROR_OCCURRED, eventData);
    
    console.log(`Broadcast: Error occurred for session ${sessionId}: ${errorMessage}`);
  }

  /**
   * Broadcast retry started event
   * @param {string} sessionId - Session ID
   * @param {number} retryCount - Current retry attempt
   * @param {string} stage - Stage being retried
   */
  broadcastRetryStarted(sessionId, retryCount, stage = 'analysis') {
    const eventData = {
      status: 'retrying',
      message: `Retrying ${stage}... (Attempt ${retryCount})`,
      retryInfo: {
        attempt: retryCount,
        stage: stage,
        maxAttempts: 3
      }
    };

    // Update session
    sessionManager.updateSession(sessionId, { 
      retryCount,
      status: 'retrying'
    });

    // Broadcast event
    sseManager.broadcastToSession(sessionId, this.eventTypes.RETRY_STARTED, eventData);
    
    console.log(`Broadcast: Retry started for session ${sessionId}, attempt ${retryCount}`);
  }

  /**
   * Broadcast general session update
   * @param {string} sessionId - Session ID
   * @param {Object} updateData - Update data
   */
  broadcastSessionUpdate(sessionId, updateData = {}) {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      console.warn(`Cannot broadcast session update: session ${sessionId} not found`);
      return;
    }

    const eventData = {
      status: session.status,
      message: updateData.message || 'Session updated',
      sessionData: {
        sessionId: session.sessionId,
        status: session.status,
        updatedAt: session.updatedAt,
        ...updateData
      }
    };

    // Broadcast event
    sseManager.broadcastToSession(sessionId, this.eventTypes.SESSION_UPDATED, eventData);
  }

  /**
   * Get available event types
   * @returns {Object} - Event types object
   */
  getEventTypes() {
    return { ...this.eventTypes };
  }

  /**
   * Check if session has active SSE connections
   * @param {string} sessionId - Session ID
   * @returns {boolean} - True if session has active connections
   */
  hasActiveConnections(sessionId) {
    return sseManager.getConnectionCount(sessionId) > 0;
  }

  /**
   * Get broadcasting statistics
   * @returns {Object} - Statistics object
   */
  getStats() {
    return {
      sseStats: sseManager.getStats(),
      sessionStats: sessionManager.getStats(),
      eventTypes: Object.keys(this.eventTypes).length
    };
  }
}

// Create singleton instance
const eventBroadcaster = new EventBroadcaster();

module.exports = eventBroadcaster;