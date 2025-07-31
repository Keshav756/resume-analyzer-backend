const express = require('express');
const GeminiService = require('../services/geminiService');
const sessionManager = require('../services/sessionManager');
const eventBroadcaster = require('../services/eventBroadcaster');

const router = express.Router();

/**
 * POST /api/advanced/analyze
 * Advanced resume analysis with job-specific targeting
 */
router.post('/advanced/analyze', async (req, res) => {
  const { sessionId, resumeText, options = {} } = req.body;
  
  if (!sessionId || !resumeText) {
    return res.status(400).json({
      error: 'Session ID and resume text are required',
      code: 'MISSING_PARAMETERS'
    });
  }

  try {
    // Validate session exists
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    // Initialize Gemini service
    const geminiService = new GeminiService();

    // Start advanced analysis
    res.status(200).json({
      success: true,
      sessionId: sessionId,
      message: 'Advanced analysis started',
      status: 'processing'
    });

    // Run analysis asynchronously
    performAdvancedAnalysis(sessionId, resumeText, options, geminiService);

  } catch (error) {
    console.error('Advanced analysis error:', error);
    res.status(500).json({
      error: 'Failed to start advanced analysis',
      code: 'ADVANCED_ANALYSIS_ERROR'
    });
  }
});

/**
 * Perform advanced analysis with streaming
 */
async function performAdvancedAnalysis(sessionId, resumeText, options, geminiService) {
  try {
    eventBroadcaster.broadcastAnalysisStarted(sessionId, 'advanced');

    const feedback = await geminiService.analyzeResumeAdvanced(
      resumeText,
      options,
      (chunk) => {
        eventBroadcaster.broadcastAnalysisStreaming(sessionId, chunk);
      }
    );

    // Update session with advanced feedback
    sessionManager.updateSession(sessionId, {
      status: 'completed',
      feedback: feedback,
      analysisType: 'advanced',
      completedAt: new Date().toISOString()
    });

    eventBroadcaster.broadcastAnalysisCompleted(sessionId, feedback, 'advanced');

  } catch (error) {
    console.error(`Advanced analysis error for session ${sessionId}:`, error);
    eventBroadcaster.broadcastError(sessionId, error.message, {
      code: 'ADVANCED_ANALYSIS_FAILED',
      stage: 'advanced_analysis',
      retryable: true
    });
  }
}

/**
 * POST /api/advanced/cover-letter
 * Generate cover letter based on resume and job description
 */
router.post('/advanced/cover-letter', async (req, res) => {
  const { resumeText, jobDescription, options = {} } = req.body;
  
  if (!resumeText || !jobDescription) {
    return res.status(400).json({
      error: 'Resume text and job description are required',
      code: 'MISSING_PARAMETERS'
    });
  }

  try {
    const geminiService = new GeminiService();
    
    const coverLetter = await geminiService.generateCoverLetter(
      resumeText,
      jobDescription,
      options
    );

    res.json({
      success: true,
      coverLetter: coverLetter
    });

  } catch (error) {
    console.error('Cover letter generation error:', error);
    res.status(500).json({
      error: 'Failed to generate cover letter',
      code: 'COVER_LETTER_ERROR'
    });
  }
});

/**
 * POST /api/advanced/compare
 * Compare resume against job description
 */
router.post('/advanced/compare', async (req, res) => {
  const { resumeText, jobDescription } = req.body;
  
  if (!resumeText || !jobDescription) {
    return res.status(400).json({
      error: 'Resume text and job description are required',
      code: 'MISSING_PARAMETERS'
    });
  }

  try {
    const geminiService = new GeminiService();
    
    const comparison = await geminiService.compareResumeToJob(
      resumeText,
      jobDescription
    );

    res.json({
      success: true,
      comparison: comparison
    });

  } catch (error) {
    console.error('Resume comparison error:', error);
    res.status(500).json({
      error: 'Failed to compare resume',
      code: 'COMPARISON_ERROR'
    });
  }
});

/**
 * POST /api/advanced/gaps
 * Analyze experience gaps
 */
router.post('/advanced/gaps', async (req, res) => {
  const { resumeText, targetRole } = req.body;
  
  if (!resumeText || !targetRole) {
    return res.status(400).json({
      error: 'Resume text and target role are required',
      code: 'MISSING_PARAMETERS'
    });
  }

  try {
    const geminiService = new GeminiService();
    
    const gapAnalysis = await geminiService.analyzeExperienceGaps(
      resumeText,
      targetRole
    );

    res.json({
      success: true,
      gapAnalysis: gapAnalysis
    });

  } catch (error) {
    console.error('Gap analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze gaps',
      code: 'GAP_ANALYSIS_ERROR'
    });
  }
});

/**
 * POST /api/advanced/interview-questions
 * Generate interview questions
 */
router.post('/advanced/interview-questions', async (req, res) => {
  const { resumeText, jobTitle, options = {} } = req.body;
  
  if (!resumeText || !jobTitle) {
    return res.status(400).json({
      error: 'Resume text and job title are required',
      code: 'MISSING_PARAMETERS'
    });
  }

  try {
    const geminiService = new GeminiService();
    
    const questions = await geminiService.generateInterviewQuestions(
      resumeText,
      jobTitle,
      options
    );

    res.json({
      success: true,
      questions: questions
    });

  } catch (error) {
    console.error('Interview questions generation error:', error);
    res.status(500).json({
      error: 'Failed to generate interview questions',
      code: 'INTERVIEW_QUESTIONS_ERROR'
    });
  }
});

/**
 * POST /api/advanced/format-analysis
 * Analyze resume format
 */
router.post('/advanced/format-analysis', async (req, res) => {
  const { resumeText, targetFormat = 'chronological' } = req.body;
  
  if (!resumeText) {
    return res.status(400).json({
      error: 'Resume text is required',
      code: 'MISSING_PARAMETERS'
    });
  }

  try {
    const geminiService = new GeminiService();
    
    const formatAnalysis = await geminiService.analyzeResumeFormat(
      resumeText,
      targetFormat
    );

    res.json({
      success: true,
      formatAnalysis: formatAnalysis
    });

  } catch (error) {
    console.error('Format analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze format',
      code: 'FORMAT_ANALYSIS_ERROR'
    });
  }
});

/**
 * GET /api/advanced/metrics
 * Get performance metrics
 */
router.get('/advanced/metrics', async (req, res) => {
  try {
    const geminiService = new GeminiService();
    const metrics = geminiService.getPerformanceMetrics();

    res.json({
      success: true,
      metrics: metrics
    });

  } catch (error) {
    console.error('Metrics retrieval error:', error);
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      code: 'METRICS_ERROR'
    });
  }
});

/**
 * POST /api/advanced/satisfaction
 * Record user satisfaction
 */
router.post('/advanced/satisfaction', async (req, res) => {
  const { analysisId, rating, feedback } = req.body;
  
  if (!analysisId || !rating) {
    return res.status(400).json({
      error: 'Analysis ID and rating are required',
      code: 'MISSING_PARAMETERS'
    });
  }

  try {
    const geminiService = new GeminiService();
    geminiService.recordUserSatisfaction(analysisId, rating, feedback);

    res.json({
      success: true,
      message: 'Satisfaction recorded successfully'
    });

  } catch (error) {
    console.error('Satisfaction recording error:', error);
    res.status(500).json({
      error: 'Failed to record satisfaction',
      code: 'SATISFACTION_ERROR'
    });
  }
});

module.exports = router; 