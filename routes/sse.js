const express = require('express');
const sseManager = require('../services/sseManager');
const sessionManager = require('../services/sessionManager');
const eventBroadcaster = require('../services/eventBroadcaster');

const router = express.Router();

// Allowed frontend origins
const allowedOrigins = [
  'http://localhost:5173',
  'https://extraordinary-dieffenbachia-757a4c.netlify.app'
];

/**
 * GET /api/events/:sessionId
 * Establish SSE connection for real-time updates
 */
router.get('/events/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const origin = req.headers.origin;

  // ✅ CORS Handling for SSE
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    return res.status(403).json({
      error: 'CORS Error: Origin not allowed',
      code: 'CORS_NOT_ALLOWED'
    });
  }

  // ✅ Proper SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // ✅ Important: flush the headers
  res.flushHeaders();

  // ✅ Validate session ID
  if (!sessionId || typeof sessionId !== 'string') {
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'Invalid session ID' })}\n\n`);
    res.end();
    return;
  }

  // ✅ Check session existence
  const session = sessionManager.getSession(sessionId);
  if (!session) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'Session not found' })}\n\n`);
    res.end();
    return;
  }

  // ✅ Register the SSE connection
  const connected = sseManager.createConnection(sessionId, res);
  if (!connected) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'SSE connection failed' })}\n\n`);
    res.end();
    return;
  }

  // ✅ Broadcast current session status or completed results
  if (session.status === 'completed' && session.feedback) {
    sseManager.broadcastToSession(sessionId, 'analysis.completed', {
      status: 'completed',
      message: 'Analysis completed successfully',
      stage: 'analysis',
      feedback: session.feedback,
      completedAt: session.completedAt || new Date().toISOString()
    });
  } else {
    sseManager.broadcastToSession(sessionId, 'session.status', {
      status: session.status,
      message: `Current status: ${session.status}`,
      sessionData: {
        sessionId: session.sessionId,
        status: session.status,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt
      }
    });
  }

  // Extend session timeout since user is listening
  sessionManager.extendSession(sessionId);

  console.log(`✅ SSE connection established for session: ${sessionId}`);

  // Handle client disconnect
  req.on('close', () => {
    console.log(`❌ SSE connection closed for session: ${sessionId}`);
    sseManager.removeClient(sessionId, res);
  });
});

/**
 * GET /api/events/:sessionId/status
 * Get current session status (non-SSE)
 */
router.get('/events/:sessionId/status', (req, res) => {
  const { sessionId } = req.params;

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({
      error: 'Invalid session ID',
      code: 'INVALID_SESSION_ID'
    });
  }

  const session = sessionManager.getSession(sessionId);
  if (!session) {
    return res.status(404).json({
      error: 'Session not found',
      code: 'SESSION_NOT_FOUND'
    });
  }

  res.json({
    success: true,
    sessionId: session.sessionId,
    status: session.status,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    hasActiveConnections: sseManager.getConnectionCount(sessionId) > 0,
    retryCount: session.retryCount || 0
  });
});

/**
 * POST /api/events/:sessionId/retry
 */
router.post('/events/:sessionId/retry', (req, res) => {
  const { sessionId } = req.params;

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({
      error: 'Invalid session ID',
      code: 'INVALID_SESSION_ID'
    });
  }

  const session = sessionManager.getSession(sessionId);
  if (!session) {
    return res.status(404).json({
      error: 'Session not found',
      code: 'SESSION_NOT_FOUND'
    });
  }

  if (session.status !== 'error') {
    return res.status(400).json({
      error: 'Session is not in error state',
      code: 'INVALID_SESSION_STATE'
    });
  }

  const newRetryCount = (session.retryCount || 0) + 1;
  if (newRetryCount > 3) {
    return res.status(400).json({
      error: 'Maximum retry attempts exceeded',
      code: 'MAX_RETRIES_EXCEEDED'
    });
  }

  sessionManager.updateSession(sessionId, {
    status: 'retrying',
    retryCount: newRetryCount,
    lastError: null
  });

  eventBroadcaster.broadcastRetryStarted(sessionId, newRetryCount);

  res.json({
    success: true,
    message: 'Retry initiated',
    sessionId,
    retryCount: newRetryCount
  });

  console.log(`🔁 Retry initiated for session ${sessionId}, attempt ${newRetryCount}`);
});

/**
 * DELETE /api/events/:sessionId
 */
router.delete('/events/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({
      error: 'Invalid session ID',
      code: 'INVALID_SESSION_ID'
    });
  }

  sseManager.closeSessionConnections(sessionId);

  res.json({
    success: true,
    message: 'SSE connections closed',
    sessionId
  });

  console.log(`❌ SSE connections closed for session: ${sessionId}`);
});

/**
 * GET /api/sse/stats
 */
router.get('/sse/stats', (req, res) => {
  try {
    const stats = {
      sse: sseManager.getStats(),
      sessions: sessionManager.getStats(),
      broadcaster: eventBroadcaster.getStats()
    };

    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting SSE stats:', error);
    res.status(500).json({
      error: 'Failed to get SSE statistics',
      code: 'STATS_ERROR'
    });
  }
});

module.exports = router;
