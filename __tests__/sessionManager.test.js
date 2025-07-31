const sessionManager = require('../services/sessionManager');

describe('SessionManager', () => {
  beforeEach(() => {
    // Clear all sessions before each test
    sessionManager.clearAllSessions();
    sessionManager.stopCleanupProcess();
  });

  afterEach(() => {
    // Clean up after each test
    sessionManager.clearAllSessions();
    sessionManager.stopCleanupProcess();
  });

  describe('Session Creation', () => {
    test('should create a new session with unique ID', () => {
      const sessionId = sessionManager.createSession();
      
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBeGreaterThan(0);
    });

    test('should create sessions with unique IDs', () => {
      const sessionId1 = sessionManager.createSession();
      const sessionId2 = sessionManager.createSession();
      
      expect(sessionId1).not.toBe(sessionId2);
    });

    test('should create session with initial data', () => {
      const initialData = {
        fileName: 'test.pdf',
        fileSize: 1024,
        customField: 'test'
      };
      
      const sessionId = sessionManager.createSession(initialData);
      const session = sessionManager.getSession(sessionId);
      
      expect(session.fileName).toBe('test.pdf');
      expect(session.fileSize).toBe(1024);
      expect(session.customField).toBe('test');
      expect(session.status).toBe('created');
      expect(session.retryCount).toBe(0);
    });

    test('should set default session properties', () => {
      const sessionId = sessionManager.createSession();
      const session = sessionManager.getSession(sessionId);
      
      expect(session.sessionId).toBe(sessionId);
      expect(session.status).toBe('created');
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.updatedAt).toBeInstanceOf(Date);
      expect(session.expiresAt).toBeInstanceOf(Date);
      expect(session.retryCount).toBe(0);
    });
  });

  describe('Session Retrieval', () => {
    test('should retrieve existing session', () => {
      const sessionId = sessionManager.createSession({ test: 'data' });
      const session = sessionManager.getSession(sessionId);
      
      expect(session).toBeDefined();
      expect(session.sessionId).toBe(sessionId);
      expect(session.test).toBe('data');
    });

    test('should return null for non-existent session', () => {
      const session = sessionManager.getSession('non-existent-id');
      expect(session).toBeNull();
    });

    test('should return null for invalid session ID', () => {
      expect(sessionManager.getSession(null)).toBeNull();
      expect(sessionManager.getSession(undefined)).toBeNull();
      expect(sessionManager.getSession('')).toBeNull();
      expect(sessionManager.getSession(123)).toBeNull();
    });

    test('should return copy of session data to prevent external modifications', () => {
      const sessionId = sessionManager.createSession({ test: 'original' });
      const session = sessionManager.getSession(sessionId);
      
      // Modify the returned session
      session.test = 'modified';
      
      // Original session should remain unchanged
      const originalSession = sessionManager.getSession(sessionId);
      expect(originalSession.test).toBe('original');
    });
  });

  describe('Session Updates', () => {
    test('should update session data', () => {
      const sessionId = sessionManager.createSession({ test: 'original' });
      
      const success = sessionManager.updateSession(sessionId, {
        test: 'updated',
        newField: 'new value'
      });
      
      expect(success).toBe(true);
      
      const session = sessionManager.getSession(sessionId);
      expect(session.test).toBe('updated');
      expect(session.newField).toBe('new value');
      expect(session.updatedAt).toBeInstanceOf(Date);
    });

    test('should not allow sessionId to be overwritten', () => {
      const sessionId = sessionManager.createSession();
      
      sessionManager.updateSession(sessionId, {
        sessionId: 'different-id'
      });
      
      const session = sessionManager.getSession(sessionId);
      expect(session.sessionId).toBe(sessionId);
    });

    test('should return false for non-existent session', () => {
      const success = sessionManager.updateSession('non-existent', { test: 'data' });
      expect(success).toBe(false);
    });

    test('should return false for invalid session ID', () => {
      expect(sessionManager.updateSession(null, { test: 'data' })).toBe(false);
      expect(sessionManager.updateSession(undefined, { test: 'data' })).toBe(false);
      expect(sessionManager.updateSession('', { test: 'data' })).toBe(false);
    });

    test('should update session status', () => {
      const sessionId = sessionManager.createSession();
      
      const success = sessionManager.updateStatus(sessionId, 'processing');
      expect(success).toBe(true);
      
      const session = sessionManager.getSession(sessionId);
      expect(session.status).toBe('processing');
    });
  });

  describe('Session Existence', () => {
    test('should return true for existing session', () => {
      const sessionId = sessionManager.createSession();
      expect(sessionManager.sessionExists(sessionId)).toBe(true);
    });

    test('should return false for non-existent session', () => {
      expect(sessionManager.sessionExists('non-existent')).toBe(false);
    });

    test('should return false for invalid session ID', () => {
      expect(sessionManager.sessionExists(null)).toBe(false);
      expect(sessionManager.sessionExists(undefined)).toBe(false);
      expect(sessionManager.sessionExists('')).toBe(false);
    });
  });

  describe('Session Deletion', () => {
    test('should delete existing session', () => {
      const sessionId = sessionManager.createSession();
      
      const success = sessionManager.deleteSession(sessionId);
      expect(success).toBe(true);
      
      const session = sessionManager.getSession(sessionId);
      expect(session).toBeNull();
    });

    test('should return false for non-existent session', () => {
      const success = sessionManager.deleteSession('non-existent');
      expect(success).toBe(false);
    });

    test('should return false for invalid session ID', () => {
      expect(sessionManager.deleteSession(null)).toBe(false);
      expect(sessionManager.deleteSession(undefined)).toBe(false);
      expect(sessionManager.deleteSession('')).toBe(false);
    });
  });

  describe('Session Expiration', () => {
    test('should return null for expired session', (done) => {
      // Create session with very short expiration
      const sessionId = sessionManager.createSession();
      
      // Manually set expiration to past
      const session = sessionManager.sessions.get(sessionId);
      session.expiresAt = new Date(Date.now() - 1000); // 1 second ago
      
      const retrievedSession = sessionManager.getSession(sessionId);
      expect(retrievedSession).toBeNull();
      done();
    });

    test('should extend session expiration', () => {
      const sessionId = sessionManager.createSession();
      const originalSession = sessionManager.getSession(sessionId);
      const originalExpiration = originalSession.expiresAt;
      
      const success = sessionManager.extendSession(sessionId, 60000); // 1 minute
      expect(success).toBe(true);
      
      const extendedSession = sessionManager.getSession(sessionId);
      expect(extendedSession.expiresAt.getTime()).toBeGreaterThan(originalExpiration.getTime());
    });

    test('should not extend non-existent session', () => {
      const success = sessionManager.extendSession('non-existent');
      expect(success).toBe(false);
    });
  });

  describe('Session Statistics and Management', () => {
    test('should get active sessions', () => {
      const sessionId1 = sessionManager.createSession({ name: 'session1' });
      const sessionId2 = sessionManager.createSession({ name: 'session2' });
      
      const activeSessions = sessionManager.getActiveSessions();
      expect(activeSessions).toHaveLength(2);
      expect(activeSessions.some(s => s.sessionId === sessionId1)).toBe(true);
      expect(activeSessions.some(s => s.sessionId === sessionId2)).toBe(true);
    });

    test('should get session count', () => {
      expect(sessionManager.getSessionCount()).toBe(0);
      
      sessionManager.createSession();
      expect(sessionManager.getSessionCount()).toBe(1);
      
      sessionManager.createSession();
      expect(sessionManager.getSessionCount()).toBe(2);
    });

    test('should get session statistics', () => {
      sessionManager.createSession();
      sessionManager.createSession();
      
      const stats = sessionManager.getStats();
      expect(stats.total).toBe(2);
      expect(stats.active).toBe(2);
      expect(stats.expired).toBe(0);
    });

    test('should clear all sessions', () => {
      sessionManager.createSession();
      sessionManager.createSession();
      
      expect(sessionManager.getSessionCount()).toBe(2);
      
      sessionManager.clearAllSessions();
      expect(sessionManager.getSessionCount()).toBe(0);
    });
  });

  describe('Cleanup Process', () => {
    test('should clean up expired sessions', () => {
      // Create sessions
      const sessionId1 = sessionManager.createSession();
      const sessionId2 = sessionManager.createSession();
      
      // Manually expire one session
      const session1 = sessionManager.sessions.get(sessionId1);
      session1.expiresAt = new Date(Date.now() - 1000);
      
      const cleanedCount = sessionManager.cleanupExpiredSessions();
      expect(cleanedCount).toBe(1);
      
      // Only non-expired session should remain
      expect(sessionManager.sessionExists(sessionId1)).toBe(false);
      expect(sessionManager.sessionExists(sessionId2)).toBe(true);
    });

    test('should start and stop cleanup process', () => {
      sessionManager.startCleanupProcess(100); // Very short interval for testing
      expect(sessionManager.cleanupInterval).toBeDefined();
      
      sessionManager.stopCleanupProcess();
      expect(sessionManager.cleanupInterval).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    test('should handle session with missing expiresAt', () => {
      const sessionId = sessionManager.createSession();
      const session = sessionManager.sessions.get(sessionId);
      delete session.expiresAt;
      
      // Should treat as expired
      expect(sessionManager.getSession(sessionId)).toBeNull();
    });

    test('should handle concurrent operations', () => {
      const sessionId = sessionManager.createSession();
      
      // Simulate concurrent updates
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          Promise.resolve(sessionManager.updateSession(sessionId, { counter: i }))
        );
      }
      
      return Promise.all(promises).then(results => {
        expect(results.every(result => result === true)).toBe(true);
        const session = sessionManager.getSession(sessionId);
        expect(session).toBeDefined();
        expect(typeof session.counter).toBe('number');
      });
    });
  });
});