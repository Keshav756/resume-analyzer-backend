class GeminiService {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    
    this.genAI = null;
    this.model = null;
    this.performanceMetrics = {
      totalAnalyses: 0,
      successfulAnalyses: 0,
      averageResponseTime: 0,
      userSatisfaction: []
    };
    this.initializeAI();
  }

  async initializeAI() {
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      this.model = this.genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: {
          temperature: 0.7,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 8192, // Increased for more comprehensive analysis
        }
      });
    } catch (error) {
      // Handle dynamic import errors (e.g., in test environment)
      if (error.code === 'ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG') {
        console.warn('Dynamic import not supported in test environment, using fallback');
        return;
      }
      throw error;
    }
  }

  /**
   * Enhanced analysis with job-specific targeting
   * @param {string} resumeText - Extracted text from PDF resume
   * @param {Object} options - Analysis options
   * @param {string} options.jobTitle - Target job title
   * @param {string} options.industry - Target industry
   * @param {string} options.jobDescription - Job description for comparison
   * @param {string} options.experienceLevel - Entry, Mid, Senior, Executive
   * @param {Function} onChunk - Callback for streaming chunks
   * @returns {Promise<Object>} Enhanced feedback object
   */
  async analyzeResumeAdvanced(resumeText, options = {}, onChunk) {
    const startTime = Date.now();
    
    try {
      if (!this.model) {
        await this.initializeAI();
      }

      const prompt = this.createAdvancedAnalysisPrompt(resumeText, options);
      const result = await this.model.generateContentStream(prompt);
      
      let fullResponse = '';
      
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullResponse += chunkText;
        
        if (onChunk && typeof onChunk === 'function') {
          onChunk(chunkText);
        }
      }
      
      const feedback = this.parseAdvancedResponse(fullResponse);
      
      // Update performance metrics
      this.updatePerformanceMetrics(Date.now() - startTime, true);
      
      return feedback;
      
    } catch (error) {
      console.error('Error in advanced resume analysis:', error);
      this.updatePerformanceMetrics(Date.now() - startTime, false);
      throw new Error(`Advanced analysis failed: ${error.message}`);
    }
  }

  /**
   * Create advanced analysis prompt with job-specific targeting
   */
  createAdvancedAnalysisPrompt(resumeText, options) {
    const { jobTitle, industry, jobDescription, experienceLevel } = options;
    
    return `You are an expert resume reviewer, career advisor, and ATS optimization specialist. Analyze the following resume with advanced insights.

Resume Text:
${resumeText}

${jobTitle ? `Target Job Title: ${jobTitle}` : ''}
${industry ? `Target Industry: ${industry}` : ''}
${experienceLevel ? `Experience Level: ${experienceLevel}` : ''}
${jobDescription ? `Job Description: ${jobDescription}` : ''}

Provide comprehensive analysis in this JSON structure:

{
  "overallScore": [number from 1-10],
  "atsOptimization": {
    "score": [number from 1-10],
    "keywordMatch": [percentage],
    "missingKeywords": ["keyword1", "keyword2"],
    "suggestedKeywords": ["suggestion1", "suggestion2"],
    "formattingIssues": ["issue1", "issue2"]
  },
  "jobFit": {
    "score": [number from 1-10],
    "alignment": ["strength1", "strength2"],
    "gaps": ["gap1", "gap2"],
    "recommendations": ["rec1", "rec2"]
  },
  "clarity": {
    "score": [number from 1-10],
    "suggestions": ["suggestion1", "suggestion2"],
    "strengths": ["strength1", "strength2"],
    "weaknesses": ["weakness1", "weakness2"]
  },
  "grammar": {
    "score": [number from 1-10],
    "corrections": ["correction1", "correction2"],
    "improvements": ["improvement1", "improvement2"]
  },
  "skills": {
    "relevantSkills": ["skill1", "skill2"],
    "missingSkills": ["missing1", "missing2"],
    "skillGaps": ["gap1", "gap2"],
    "recommendations": ["rec1", "rec2"]
  },
  "experience": {
    "relevance": [number from 1-10],
    "gaps": ["gap1", "gap2"],
    "suggestions": ["suggestion1", "suggestion2"],
    "quantifiedAchievements": ["achievement1", "achievement2"]
  },
  "salaryEstimate": {
    "range": "low-high",
    "confidence": [percentage],
    "factors": ["factor1", "factor2"]
  },
  "improvements": [
    {
      "category": "ats|content|skills|experience|formatting",
      "priority": "high|medium|low",
      "suggestion": "specific suggestion",
      "example": "concrete example",
      "impact": "high|medium|low"
    }
  ],
  "industryInsights": {
    "trends": ["trend1", "trend2"],
    "recommendations": ["rec1", "rec2"],
    "competitorAnalysis": ["insight1", "insight2"]
  }
}

Focus on ATS optimization, job-specific alignment, and industry relevance. Provide only JSON response.`;
  }

  /**
   * Generate cover letter based on resume and job description
   * @param {string} resumeText - Resume content
   * @param {string} jobDescription - Job description
   * @param {Object} options - Cover letter options
   * @returns {Promise<Object>} Generated cover letter
   */
  async generateCoverLetter(resumeText, jobDescription, options = {}) {
    try {
      if (!this.model) {
        await this.initializeAI();
      }

      const prompt = this.createCoverLetterPrompt(resumeText, jobDescription, options);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      return this.parseCoverLetterResponse(text);
      
    } catch (error) {
      console.error('Error generating cover letter:', error);
      throw new Error(`Cover letter generation failed: ${error.message}`);
    }
  }

  /**
   * Create cover letter generation prompt
   */
  createCoverLetterPrompt(resumeText, jobDescription, options) {
    const { tone = 'professional', focus = 'skills', length = 'standard' } = options;
    
    return `Generate a professional cover letter based on the resume and job description.

Resume:
${resumeText}

Job Description:
${jobDescription}

Requirements:
- Tone: ${tone}
- Focus: ${focus}
- Length: ${length}
- Include specific examples from resume
- Address key requirements from job description
- Show enthusiasm and cultural fit

Provide response in JSON format:
{
  "coverLetter": "full cover letter text",
  "keyHighlights": ["highlight1", "highlight2"],
  "addressedRequirements": ["req1", "req2"],
  "tone": "${tone}",
  "wordCount": [number]
}`;
  }

  /**
   * Compare resume against job description
   * @param {string} resumeText - Resume content
   * @param {string} jobDescription - Job description
   * @returns {Promise<Object>} Comparison results
   */
  async compareResumeToJob(resumeText, jobDescription) {
    try {
      if (!this.model) {
        await this.initializeAI();
      }

      const prompt = `Compare this resume against the job description and provide detailed analysis.

Resume:
${resumeText}

Job Description:
${jobDescription}

Provide analysis in JSON format:
{
  "matchScore": [percentage],
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"],
  "missingRequirements": ["req1", "req2"],
  "keywordMatch": {
    "matched": ["keyword1", "keyword2"],
    "missing": ["keyword1", "keyword2"],
    "suggested": ["keyword1", "keyword2"]
  },
  "experienceAlignment": {
    "relevant": ["exp1", "exp2"],
    "missing": ["exp1", "exp2"]
  },
  "recommendations": ["rec1", "rec2"]
}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      return this.parseComparisonResponse(text);
      
    } catch (error) {
      console.error('Error comparing resume to job:', error);
      throw new Error(`Comparison failed: ${error.message}`);
    }
  }

  /**
   * Analyze experience gaps and provide recommendations
   * @param {string} resumeText - Resume content
   * @param {string} targetRole - Target role
   * @returns {Promise<Object>} Gap analysis results
   */
  async analyzeExperienceGaps(resumeText, targetRole) {
    try {
      if (!this.model) {
        await this.initializeAI();
      }

      const prompt = `Analyze experience gaps in this resume for the target role.

Resume:
${resumeText}

Target Role: ${targetRole}

Provide gap analysis in JSON format:
{
  "identifiedGaps": [
    {
      "type": "skill|experience|education",
      "description": "gap description",
      "severity": "high|medium|low",
      "suggestions": ["suggestion1", "suggestion2"],
      "timeline": "estimated time to fill"
    }
  ],
  "recommendations": ["rec1", "rec2"],
  "priorityOrder": ["gap1", "gap2"]
}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      return this.parseGapAnalysisResponse(text);
      
    } catch (error) {
      console.error('Error analyzing experience gaps:', error);
      throw new Error(`Gap analysis failed: ${error.message}`);
    }
  }

  /**
   * Parse advanced response with new structure
   */
  parseAdvancedResponse(response) {
    try {
      let cleanResponse = response.trim();
      const jsonStart = cleanResponse.indexOf('{');
      const jsonEnd = cleanResponse.lastIndexOf('}');
      
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('No valid JSON found in response');
      }
      
      const jsonString = cleanResponse.substring(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(jsonString);
      
      this.validateAdvancedFeedbackStructure(parsed);
      return parsed;
      
    } catch (error) {
      console.error('Error parsing advanced response:', error);
      return this.getAdvancedFallbackFeedback();
    }
  }

  /**
   * Parse cover letter response
   */
  parseCoverLetterResponse(response) {
    try {
      let cleanResponse = response.trim();
      const jsonStart = cleanResponse.indexOf('{');
      const jsonEnd = cleanResponse.lastIndexOf('}');
      
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('No valid JSON found in response');
      }
      
      const jsonString = cleanResponse.substring(jsonStart, jsonEnd + 1);
      return JSON.parse(jsonString);
      
    } catch (error) {
      console.error('Error parsing cover letter response:', error);
      return {
        coverLetter: 'Unable to generate cover letter. Please try again.',
        keyHighlights: [],
        addressedRequirements: [],
        tone: 'professional',
        wordCount: 0
      };
    }
  }

  /**
   * Parse comparison response
   */
  parseComparisonResponse(response) {
    try {
      let cleanResponse = response.trim();
      const jsonStart = cleanResponse.indexOf('{');
      const jsonEnd = cleanResponse.lastIndexOf('}');
      
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('No valid JSON found in response');
      }
      
      const jsonString = cleanResponse.substring(jsonStart, jsonEnd + 1);
      return JSON.parse(jsonString);
      
    } catch (error) {
      console.error('Error parsing comparison response:', error);
      return {
        matchScore: 0,
        strengths: [],
        weaknesses: ['Unable to analyze comparison'],
        missingRequirements: [],
        keywordMatch: { matched: [], missing: [], suggested: [] },
        experienceAlignment: { relevant: [], missing: [] },
        recommendations: ['Please try again']
      };
    }
  }

  /**
   * Parse gap analysis response
   */
  parseGapAnalysisResponse(response) {
    try {
      let cleanResponse = response.trim();
      const jsonStart = cleanResponse.indexOf('{');
      const jsonEnd = cleanResponse.lastIndexOf('}');
      
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('No valid JSON found in response');
      }
      
      const jsonString = cleanResponse.substring(jsonStart, jsonEnd + 1);
      return JSON.parse(jsonString);
      
    } catch (error) {
      console.error('Error parsing gap analysis response:', error);
      return {
        identifiedGaps: [],
        recommendations: ['Unable to analyze gaps'],
        priorityOrder: []
      };
    }
  }

  /**
   * Validate advanced feedback structure
   */
  validateAdvancedFeedbackStructure(feedback) {
    const requiredFields = ['overallScore', 'atsOptimization', 'jobFit', 'clarity', 'grammar', 'skills', 'experience', 'improvements'];
    
    for (const field of requiredFields) {
      if (!feedback[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
  }

  /**
   * Get advanced fallback feedback
   */
  getAdvancedFallbackFeedback() {
    return {
      overallScore: 5,
      atsOptimization: {
        score: 5,
        keywordMatch: 0,
        missingKeywords: [],
        suggestedKeywords: [],
        formattingIssues: ['Unable to analyze']
      },
      jobFit: {
        score: 5,
        alignment: [],
        gaps: [],
        recommendations: ['Unable to analyze']
      },
      clarity: {
        score: 5,
        suggestions: ['Unable to analyze'],
        strengths: [],
        weaknesses: []
      },
      grammar: {
        score: 5,
        corrections: ['Unable to analyze'],
        improvements: []
      },
      skills: {
        relevantSkills: [],
        missingSkills: [],
        skillGaps: [],
        recommendations: ['Unable to analyze']
      },
      experience: {
        relevance: 5,
        gaps: [],
        suggestions: ['Unable to analyze'],
        quantifiedAchievements: []
      },
      salaryEstimate: {
        range: 'Unknown',
        confidence: 0,
        factors: []
      },
      improvements: [
        {
          category: 'content',
          priority: 'medium',
          suggestion: 'Analysis failed - please try again',
          example: 'Ensure your PDF is readable',
          impact: 'medium'
        }
      ],
      industryInsights: {
        trends: [],
        recommendations: [],
        competitorAnalysis: []
      }
    };
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics(responseTime, success) {
    this.performanceMetrics.totalAnalyses++;
    if (success) {
      this.performanceMetrics.successfulAnalyses++;
    }
    
    // Update average response time
    const currentAvg = this.performanceMetrics.averageResponseTime;
    const totalAnalyses = this.performanceMetrics.totalAnalyses;
    this.performanceMetrics.averageResponseTime = 
      (currentAvg * (totalAnalyses - 1) + responseTime) / totalAnalyses;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      successRate: this.performanceMetrics.totalAnalyses > 0 
        ? (this.performanceMetrics.successfulAnalyses / this.performanceMetrics.totalAnalyses * 100).toFixed(2)
        : 0
    };
  }

  /**
   * Record user satisfaction
   */
  recordUserSatisfaction(analysisId, rating, feedback) {
    this.performanceMetrics.userSatisfaction.push({
      analysisId,
      rating,
      feedback,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Create structured prompt for resume analysis (Legacy method)
   * @param {string} resumeText - Extracted text from PDF resume
   * @returns {string} Formatted prompt for AI analysis
   */
  createAnalysisPrompt(resumeText) {
    return `You are an expert resume reviewer and career advisor. Please analyze the following resume and provide comprehensive feedback in the exact JSON format specified below.

Resume Text:
${resumeText}

Please provide your analysis in the following JSON structure:

{
  "clarity": {
    "score": [number from 1-10],
    "suggestions": ["specific suggestion 1", "specific suggestion 2"],
    "strengths": ["strength 1", "strength 2"],
    "weaknesses": ["weakness 1", "weakness 2"]
  },
  "grammar": {
    "score": [number from 1-10],
    "corrections": ["correction 1", "correction 2"],
    "improvements": ["improvement 1", "improvement 2"]
  },
  "skills": {
    "relevantSkills": ["skill 1", "skill 2"],
    "missingSkills": ["missing skill 1", "missing skill 2"],
    "recommendations": ["recommendation 1", "recommendation 2"]
  },
  "improvements": [
    {
      "category": "formatting|content|skills|experience",
      "priority": "high|medium|low",
      "suggestion": "specific actionable suggestion",
      "example": "concrete example of how to implement this suggestion"
    }
  ]
}

Focus on:
1. Clarity and formatting - Is the resume well-structured and easy to read?
2. Grammar and writing quality - Are there any grammatical errors or awkward phrasing?
3. Skills relevance - What skills are highlighted and what might be missing?
4. Specific improvements - Actionable suggestions with examples

Provide only the JSON response, no additional text.`;
  }

  /**
   * Generate interview questions based on resume
   * @param {string} resumeText - Resume content
   * @param {string} jobTitle - Target job title
   * @param {Object} options - Question generation options
   * @returns {Promise<Object>} Generated interview questions
   */
  async generateInterviewQuestions(resumeText, jobTitle, options = {}) {
    try {
      if (!this.model) {
        await this.initializeAI();
      }

      const { difficulty = 'mixed', count = 10, focus = 'general' } = options;
      
      const prompt = `Generate interview questions based on this resume for the target job.

Resume:
${resumeText}

Job Title: ${jobTitle}

Requirements:
- Difficulty: ${difficulty}
- Count: ${count} questions
- Focus: ${focus}
- Mix of behavioral, technical, and situational questions
- Questions should be relevant to the candidate's experience

Provide response in JSON format:
{
  "questions": [
    {
      "question": "question text",
      "type": "behavioral|technical|situational",
      "difficulty": "easy|medium|hard",
      "focus": "experience|skills|problem-solving",
      "expectedAnswer": "brief guidance on what to look for"
    }
  ],
  "summary": "brief summary of question focus areas"
}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      return this.parseInterviewQuestionsResponse(text);
      
    } catch (error) {
      console.error('Error generating interview questions:', error);
      throw new Error(`Interview questions generation failed: ${error.message}`);
    }
  }

  /**
   * Parse interview questions response
   */
  parseInterviewQuestionsResponse(response) {
    try {
      let cleanResponse = response.trim();
      const jsonStart = cleanResponse.indexOf('{');
      const jsonEnd = cleanResponse.lastIndexOf('}');
      
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('No valid JSON found in response');
      }
      
      const jsonString = cleanResponse.substring(jsonStart, jsonEnd + 1);
      return JSON.parse(jsonString);
      
    } catch (error) {
      console.error('Error parsing interview questions response:', error);
      return {
        questions: [],
        summary: 'Unable to generate interview questions'
      };
    }
  }

  /**
   * Analyze resume format and suggest optimizations
   * @param {string} resumeText - Resume content
   * @param {string} targetFormat - Target format (chronological, functional, hybrid)
   * @returns {Promise<Object>} Format analysis results
   */
  async analyzeResumeFormat(resumeText, targetFormat = 'chronological') {
    try {
      if (!this.model) {
        await this.initializeAI();
      }

      const prompt = `Analyze this resume's format and suggest optimizations for ${targetFormat} format.

Resume:
${resumeText}

Target Format: ${targetFormat}

Provide analysis in JSON format:
{
  "currentFormat": "detected format",
  "formatScore": [number from 1-10],
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"],
  "suggestions": [
    {
      "section": "section name",
      "current": "current approach",
      "suggested": "suggested improvement",
      "reason": "why this change helps"
    }
  ],
  "formattingTips": ["tip1", "tip2"],
  "recommendedChanges": ["change1", "change2"]
}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      return this.parseFormatAnalysisResponse(text);
      
    } catch (error) {
      console.error('Error analyzing resume format:', error);
      throw new Error(`Format analysis failed: ${error.message}`);
    }
  }

  /**
   * Parse format analysis response
   */
  parseFormatAnalysisResponse(response) {
    try {
      let cleanResponse = response.trim();
      const jsonStart = cleanResponse.indexOf('{');
      const jsonEnd = cleanResponse.lastIndexOf('}');
      
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('No valid JSON found in response');
      }
      
      const jsonString = cleanResponse.substring(jsonStart, jsonEnd + 1);
      return JSON.parse(jsonString);
      
    } catch (error) {
      console.error('Error parsing format analysis response:', error);
      return {
        currentFormat: 'unknown',
        formatScore: 5,
        strengths: [],
        weaknesses: ['Unable to analyze format'],
        suggestions: [],
        formattingTips: [],
        recommendedChanges: []
      };
    }
  }

  /**
   * Analyze resume with streaming support
   * @param {string} resumeText - Extracted text from PDF resume
   * @param {Function} onChunk - Callback for streaming chunks
   * @returns {Promise<Object>} Parsed feedback object
   */
  async analyzeResumeStreaming(resumeText, onChunk) {
    try {
      // Ensure AI is initialized
      if (!this.model) {
        await this.initializeAI();
      }
      
      const prompt = this.createAnalysisPrompt(resumeText);
      
      // Generate streaming response
      const result = await this.model.generateContentStream(prompt);
      
      let fullResponse = '';
      
      // Process streaming chunks
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullResponse += chunkText;
        
        // Call the chunk callback if provided
        if (onChunk && typeof onChunk === 'function') {
          onChunk(chunkText);
        }
      }
      
      // Parse the complete response
      const feedback = this.parseResponse(fullResponse);
      return feedback;
      
    } catch (error) {
      console.error('Error in Gemini AI analysis:', error);
      throw new Error(`AI analysis failed: ${error.message}`);
    }
  }

  /**
   * Parse AI response into structured feedback object
   * @param {string} response - Raw AI response
   * @returns {Object} Parsed feedback object
   */
  parseResponse(response) {
    try {
      // Clean the response - remove any markdown formatting or extra text
      let cleanResponse = response.trim();
      
      // Find JSON content between curly braces
      const jsonStart = cleanResponse.indexOf('{');
      const jsonEnd = cleanResponse.lastIndexOf('}');
      
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('No valid JSON found in response');
      }
      
      const jsonString = cleanResponse.substring(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(jsonString);
      
      // Validate the structure matches our expected format
      this.validateFeedbackStructure(parsed);
      
      return parsed;
      
    } catch (error) {
      console.error('Error parsing AI response:', error);
      console.error('Raw response:', response);
      
      // Return fallback structure if parsing fails
      return this.getFallbackFeedback();
    }
  }

  /**
   * Validate that feedback object has expected structure
   * @param {Object} feedback - Parsed feedback object
   * @throws {Error} If structure is invalid
   */
  validateFeedbackStructure(feedback) {
    const requiredFields = ['clarity', 'grammar', 'skills', 'improvements'];
    
    for (const field of requiredFields) {
      if (!feedback[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Validate clarity structure
    if (!feedback.clarity.score || !Array.isArray(feedback.clarity.suggestions)) {
      throw new Error('Invalid clarity structure');
    }
    
    // Validate grammar structure
    if (!feedback.grammar.score || !Array.isArray(feedback.grammar.corrections)) {
      throw new Error('Invalid grammar structure');
    }
    
    // Validate skills structure
    if (!Array.isArray(feedback.skills.relevantSkills)) {
      throw new Error('Invalid skills structure');
    }
    
    // Validate improvements structure
    if (!Array.isArray(feedback.improvements)) {
      throw new Error('Invalid improvements structure');
    }
  }

  /**
   * Get fallback feedback structure when parsing fails
   * @returns {Object} Fallback feedback object
   */
  getFallbackFeedback() {
    return {
      clarity: {
        score: 5,
        suggestions: ['Unable to analyze clarity - please try again'],
        strengths: [],
        weaknesses: []
      },
      grammar: {
        score: 5,
        corrections: ['Unable to analyze grammar - please try again'],
        improvements: []
      },
      skills: {
        relevantSkills: [],
        missingSkills: [],
        recommendations: ['Unable to analyze skills - please try again']
      },
      improvements: [
        {
          category: 'content',
          priority: 'medium',
          suggestion: 'Analysis failed - please try uploading your resume again',
          example: 'Ensure your PDF is not password protected and contains readable text'
        }
      ]
    };
  }

  /**
   * Non-streaming analysis method for compatibility
   * @param {string} resumeText - Extracted text from PDF resume
   * @returns {Promise<Object>} Parsed feedback object
   */
  async analyzeResume(resumeText) {
    return this.analyzeResumeStreaming(resumeText);
  }
}

module.exports = GeminiService;