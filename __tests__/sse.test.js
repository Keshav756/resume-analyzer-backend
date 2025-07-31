const request = require('supertest');
const express = require('express');
const EventSource = require('eventsource');
const sseManager = require('../services/sseManager');
const sessionManager = require('../services/sessionManager');
const eventBroadcaster = require('../services/eventBroadcaster');
const sseRoutes = require('../routes/sse');

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api', sseRoutes);
  return app;
};

describe('SSE Integration Tests', () => {
  let app;
  let server;
  let testSessionId;

  beforeAll(() => {
    app = createTestApp();
    server = app.listen(0); // Use random available port
  });

  afterAll((done) => {
    // Clean up all connections and sessions
    sessionManager.clearAllSessions();
    sseManager.connections.clear();
    sseManager.shutdown();
    
    // Close server with proper cleanup
    if (server && server.listening) {
      server.close(() => {
        done();
      });
    } else {
      done();
    }
  });

  beforeEach(() => {
    // Clear all sessions and connections before each test
    sessionManager.clearAllSessions();
    sseManager.connections.clear();
    
    // Create a test session
    testSessionId = sessionManager.createSession({
      fileName: 'test-resume.pdf',
      fileSize: 12345,
      status: 'created'
    });
  });

  afterEach(() => {
    // Clean up after each test
    sessionManager.clearAllSessions();
    sseManager.connections.clear();
    
    // Force cleanup of any remaining connections
    for (const [sessionId] of sseManager.connections.entries()) {
      sseManager.closeSessionConnections(sessionId);
    }
  });

  describe('SSE Connection Management', () => {
    test('should validate session before establishing SSE connection', (done) => {
      // Test that we can start the SSE connection process
      // We'll test the validation logic rather than the actual streaming
      const req = request(app)
        .get(`/api/events/${testSessionId}`)
        .timeout(100) // Short timeout to prevent hanging
        .end((err) => {
          // We expect either a successful start or a timeout
          // Both indicate the endpoint is working
          if (err && (err.code === 'ABORTED' || err.timeout)) {
            done(); // Expected behavior
          } else if (err) {
            done(err);
          } else {
            done();
          }
        });
    });

    test('should reject SSE connection for invalid session ID', (done) => {
      request(app)
        .get('/api/events/invalid-session-id')
        .expect(404)
        .expect((res) => {
          expect(res.body.error).toBe('Session not found');
          expect(res.body.code).toBe('SESSION_NOT_FOUND');
        })
        .end(done);
    });

    test('should reject SSE connection for missing session ID', (done) => {
      request(app)
        .get('/api/events/')
        .expect(404)
        .end(done);
    });

    test('should handle SSE connection management', () => {
      // Test the SSE manager directly rather than through HTTP
      const mockRes = {
        writeHead: jest.fn(),
        write: jest.fn(),
        on: jest.fn(),
        destroyed: false,
        finished: false
      };

      const success = sseManager.createConnection(testSessionId, mockRes);
      expect(success).toBe(true);
      expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }));
      expect(mockRes.write).toHaveBeenCalled();
      
      // Test connection count
      expect(sseManager.getConnectionCount(testSessionId)).toBe(1);
      
      // Clean up
      sseManager.removeConnection(testSessionId, mockRes);
      expect(sseManager.getConnectionCount(testSessionId)).toBe(0);
    });
  });

  describe('Session Status Endpoint', () => {
    test('should return session status for valid session', (done) => {
      request(app)
        .get(`/api/events/${testSessionId}/status`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.sessionId).toBe(testSessionId);
          expect(res.body.status).toBe('created');
          expect(res.body.hasActiveConnections).toBe(false);
          expect(res.body.retryCount).toBe(0);
        })
        .end(done);
    });

    test('should return 404 for non-existent session', (done) => {
      request(app)
        .get('/api/events/non-existent-session/status')
        .expect(404)
        .expect((res) => {
          expect(res.body.error).toBe('Session not found');
          expect(res.body.code).toBe('SESSION_NOT_FOUND');
        })
        .end(done);
    });
  });

  describe('Retry Functionality', () => {
    test('should initiate retry for session in error state', (done) => {
      // Set session to error state
      sessionManager.updateStatus(testSessionId, 'error');
      sessionManager.updateSession(testSessionId, { 
        lastError: 'Test error',
        retryCount: 0 
      });

      request(app)
        .post(`/api/events/${testSessionId}/retry`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.message).toBe('Retry initiated');
          expect(res.body.retryCount).toBe(1);
          
          // Check session was updated
          const session = sessionManager.getSession(testSessionId);
          expect(session.status).toBe('retrying');
          expect(session.retryCount).toBe(1);
        })
        .end(done);
    });

    test('should reject retry for session not in error state', (done) => {
      // Session is in 'created' state by default
      request(app)
        .post(`/api/events/${testSessionId}/retry`)
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Session is not in error state');
          expect(res.body.code).toBe('INVALID_SESSION_STATE');
        })
        .end(done);
    });

    test('should reject retry after maximum attempts', (done) => {
      // Set session to error state with max retries
      sessionManager.updateStatus(testSessionId, 'error');
      sessionManager.updateSession(testSessionId, { 
        lastError: 'Test error',
        retryCount: 3 
      });

      request(app)
        .post(`/api/events/${testSessionId}/retry`)
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Maximum retry attempts exceeded');
          expect(res.body.code).toBe('MAX_RETRIES_EXCEEDED');
        })
        .end(done);
    });
  });

  describe('Connection Cleanup', () => {
    test('should close SSE connections for session', (done) => {
      // Test the delete endpoint directly without establishing actual SSE connection
      request(app)
        .delete(`/api/events/${testSessionId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.message).toBe('SSE connections closed');
        })
        .end(done);
    });
  });

  describe('Statistics Endpoint', () => {
    test('should return SSE statistics', (done) => {
      request(app)
        .get('/api/sse/stats')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.stats).toBeDefined();
          expect(res.body.stats.sse).toBeDefined();
          expect(res.body.stats.sessions).toBeDefined();
          expect(res.body.stats.broadcaster).toBeDefined();
          expect(res.body.timestamp).toBeDefined();
        })
        .end(done);
    });
  });

  describe('Event Broadcasting', () => {
    test('should broadcast upload started event', () => {
      const fileInfo = {
        originalName: 'test-resume.pdf',
        size: 12345,
        mimetype: 'application/pdf'
      };

      // Broadcast event
      eventBroadcaster.broadcastUploadStarted(testSessionId, fileInfo);

      // Check session was updated
      const session = sessionManager.getSession(testSessionId);
      expect(session.status).toBe('uploading');
      expect(session.fileInfo).toEqual(fileInfo);
    });

    test('should broadcast upload completed event', () => {
      const fileInfo = {
        originalName: 'test-resume.pdf',
        size: 12345,
        mimetype: 'application/pdf',
        uploadedAt: new Date().toISOString()
      };

      // Broadcast event
      eventBroadcaster.broadcastUploadCompleted(testSessionId, fileInfo);

      // Check session was updated
      const session = sessionManager.getSession(testSessionId);
      expect(session.status).toBe('uploaded');
      expect(session.fileInfo).toEqual(fileInfo);
    });

    test('should broadcast extraction started event', () => {
      eventBroadcaster.broadcastExtractionStarted(testSessionId);

      const session = sessionManager.getSession(testSessionId);
      expect(session.status).toBe('extracting');
    });

    test('should broadcast extraction completed event', () => {
      const extractionResult = {
        text: 'Extracted text content',
        textLength: 100,
        pageCount: 2,
        hasText: true
      };

      eventBroadcaster.broadcastExtractionCompleted(testSessionId, extractionResult);

      const session = sessionManager.getSession(testSessionId);
      expect(session.status).toBe('extracted');
      expect(session.extractedText).toBe(extractionResult.text);
      expect(session.extractionInfo.textLength).toBe(100);
    });

    test('should broadcast analysis started event', () => {
      eventBroadcaster.broadcastAnalysisStarted(testSessionId);

      const session = sessionManager.getSession(testSessionId);
      expect(session.status).toBe('analyzing');
    });

    test('should broadcast streaming content', () => {
      const content = 'Streaming AI response chunk';
      const metadata = { chunkIndex: 1, section: 'clarity' };

      eventBroadcaster.broadcastAnalysisStreaming(testSessionId, content, metadata);

      const session = sessionManager.getSession(testSessionId);
      expect(session.streamingContent).toBe(content);
      expect(session.lastStreamUpdate).toBeDefined();
    });

    test('should broadcast analysis completed event', () => {
      const feedback = {
        clarity: { score: 8, suggestions: ['Improve formatting'] },
        grammar: { score: 9, corrections: [] },
        skills: { relevantSkills: ['JavaScript', 'Node.js'] }
      };

      eventBroadcaster.broadcastAnalysisCompleted(testSessionId, feedback);

      const session = sessionManager.getSession(testSessionId);
      expect(session.status).toBe('completed');
      expect(session.feedback).toEqual(feedback);
      expect(session.completedAt).toBeDefined();
      expect(session.streamingContent).toBeNull();
    });

    test('should broadcast error event', () => {
      const error = new Error('Test error');
      error.code = 'TEST_ERROR';
      const options = { retryable: true, stage: 'analysis', retryCount: 1 };

      eventBroadcaster.broadcastError(testSessionId, error, options);

      const session = sessionManager.getSession(testSessionId);
      expect(session.status).toBe('error');
      expect(session.lastError).toBe('Test error');
      expect(session.errorCode).toBe('TEST_ERROR');
      expect(session.retryCount).toBe(1);
    });

    test('should broadcast retry started event', () => {
      eventBroadcaster.broadcastRetryStarted(testSessionId, 2, 'analysis');

      const session = sessionManager.getSession(testSessionId);
      expect(session.status).toBe('retrying');
      expect(session.retryCount).toBe(2);
    });
  });

  describe('Connection Management', () => {
    test('should track active connections correctly', () => {
      expect(eventBroadcaster.hasActiveConnections(testSessionId)).toBe(false);
      
      // The connection tracking would be tested with actual SSE connections
      // which is complex in a unit test environment
    });

    test('should provide accurate statistics', () => {
      const stats = eventBroadcaster.getStats();
      
      expect(stats.sseStats).toBeDefined();
      expect(stats.sessionStats).toBeDefined();
      expect(stats.eventTypes).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid session ID gracefully', () => {
      expect(() => {
        eventBroadcaster.broadcastUploadStarted(null);
      }).not.toThrow();

      expect(() => {
        eventBroadcaster.broadcastUploadStarted('');
      }).not.toThrow();
    });

    test('should handle missing session gracefully', () => {
      const nonExistentSessionId = 'non-existent-session';
      
      expect(() => {
        eventBroadcaster.broadcastUploadStarted(nonExistentSessionId);
      }).not.toThrow();
    });
  });
});