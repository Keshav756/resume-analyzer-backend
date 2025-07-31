const GeminiService = require('../services/geminiService');

// Mock the Google Generative AI SDK
jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContentStream: jest.fn(),
        generateContent: jest.fn()
      })
    }))
  };
});

describe('GeminiService', () => {
  let geminiService;
  let mockModel;
  let originalEnv;

  beforeAll(() => {
    originalEnv = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'test-api-key';
  });

  afterAll(() => {
    process.env.GEMINI_API_KEY = originalEnv;
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    geminiService = new GeminiService();
    
    // Manually set up the mock model since dynamic import won't work in tests
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const mockGenAI = new GoogleGenerativeAI('test-api-key');
    mockModel = mockGenAI.getGenerativeModel();
    
    // Set the model directly on the service instance for testing
    geminiService.model = mockModel;
    geminiService.genAI = mockGenAI;
  });

  describe('constructor', () => {
    it('should throw error if GEMINI_API_KEY is not provided', () => {
      delete process.env.GEMINI_API_KEY;
      expect(() => new GeminiService()).toThrow('GEMINI_API_KEY environment variable is required');
      process.env.GEMINI_API_KEY = 'test-api-key';
    });

    it('should initialize with correct model configuration', () => {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      expect(GoogleGenerativeAI).toHaveBeenCalledWith('test-api-key');
    });
  });

  describe('createAnalysisPrompt', () => {
    it('should create structured prompt with resume text', () => {
      const resumeText = 'John Doe\nSoftware Engineer\nExperience with JavaScript';
      const prompt = geminiService.createAnalysisPrompt(resumeText);

      expect(prompt).toContain(resumeText);
      expect(prompt).toContain('JSON structure');
      expect(prompt).toContain('clarity');
      expect(prompt).toContain('grammar');
      expect(prompt).toContain('skills');
      expect(prompt).toContain('improvements');
    });

    it('should include specific analysis focus areas', () => {
      const prompt = geminiService.createAnalysisPrompt('test resume');
      
      expect(prompt).toContain('Clarity and formatting');
      expect(prompt).toContain('Grammar and writing quality');
      expect(prompt).toContain('Skills relevance');
      expect(prompt).toContain('Specific improvements');
    });
  });

  describe('analyzeResumeStreaming', () => {
    it('should process streaming response and call onChunk callback', async () => {
      const mockChunks = [
        { text: () => '{"clarity":' },
        { text: () => '{"score":8,' },
        { text: () => '"suggestions":["test"]}}' }
      ];

      const mockStream = {
        stream: (async function* () {
          for (const chunk of mockChunks) {
            yield chunk;
          }
        })()
      };

      mockModel.generateContentStream.mockResolvedValue(mockStream);

      const onChunkMock = jest.fn();
      const resumeText = 'Test resume content';

      await geminiService.analyzeResumeStreaming(resumeText, onChunkMock);

      expect(mockModel.generateContentStream).toHaveBeenCalledWith(
        expect.stringContaining(resumeText)
      );
      expect(onChunkMock).toHaveBeenCalledTimes(3);
      expect(onChunkMock).toHaveBeenNthCalledWith(1, '{"clarity":');
      expect(onChunkMock).toHaveBeenNthCalledWith(2, '{"score":8,');
      expect(onChunkMock).toHaveBeenNthCalledWith(3, '"suggestions":["test"]}}');
    });

    it('should handle streaming without onChunk callback', async () => {
      const mockChunks = [
        { text: () => '{"clarity":{"score":8,"suggestions":[],"strengths":[],"weaknesses":[]},' },
        { text: () => '"grammar":{"score":7,"corrections":[],"improvements":[]},' },
        { text: () => '"skills":{"relevantSkills":[],"missingSkills":[],"recommendations":[]},' },
        { text: () => '"improvements":[]}' }
      ];

      const mockStream = {
        stream: (async function* () {
          for (const chunk of mockChunks) {
            yield chunk;
          }
        })()
      };

      mockModel.generateContentStream.mockResolvedValue(mockStream);

      const result = await geminiService.analyzeResumeStreaming('test resume');

      expect(result).toHaveProperty('clarity');
      expect(result).toHaveProperty('grammar');
      expect(result).toHaveProperty('skills');
      expect(result).toHaveProperty('improvements');
    });

    it('should throw error when API call fails', async () => {
      mockModel.generateContentStream.mockRejectedValue(new Error('API Error'));

      await expect(
        geminiService.analyzeResumeStreaming('test resume')
      ).rejects.toThrow('AI analysis failed: API Error');
    });
  });

  describe('parseResponse', () => {
    it('should parse valid JSON response correctly', () => {
      const validResponse = `{
        "clarity": {
          "score": 8,
          "suggestions": ["Improve header formatting"],
          "strengths": ["Clear structure"],
          "weaknesses": ["Missing contact info"]
        },
        "grammar": {
          "score": 9,
          "corrections": ["Fix typo in line 3"],
          "improvements": ["Use active voice"]
        },
        "skills": {
          "relevantSkills": ["JavaScript", "React"],
          "missingSkills": ["TypeScript"],
          "recommendations": ["Add cloud experience"]
        },
        "improvements": [
          {
            "category": "formatting",
            "priority": "high",
            "suggestion": "Use consistent bullet points",
            "example": "• Instead of - or *"
          }
        ]
      }`;

      const result = geminiService.parseResponse(validResponse);

      expect(result.clarity.score).toBe(8);
      expect(result.grammar.score).toBe(9);
      expect(result.skills.relevantSkills).toEqual(['JavaScript', 'React']);
      expect(result.improvements).toHaveLength(1);
      expect(result.improvements[0].priority).toBe('high');
    });

    it('should extract JSON from response with extra text', () => {
      const responseWithExtra = `Here is the analysis:
      {
        "clarity": {"score": 7, "suggestions": [], "strengths": [], "weaknesses": []},
        "grammar": {"score": 8, "corrections": [], "improvements": []},
        "skills": {"relevantSkills": [], "missingSkills": [], "recommendations": []},
        "improvements": []
      }
      That completes the analysis.`;

      const result = geminiService.parseResponse(responseWithExtra);

      expect(result.clarity.score).toBe(7);
      expect(result.grammar.score).toBe(8);
    });

    it('should return fallback feedback for invalid JSON', () => {
      const invalidResponse = 'This is not valid JSON';

      const result = geminiService.parseResponse(invalidResponse);

      expect(result).toHaveProperty('clarity');
      expect(result).toHaveProperty('grammar');
      expect(result).toHaveProperty('skills');
      expect(result).toHaveProperty('improvements');
      expect(result.clarity.score).toBe(5);
      expect(result.improvements[0].suggestion).toContain('Analysis failed');
    });

    it('should return fallback feedback for malformed JSON structure', () => {
      const malformedResponse = '{"invalid": "structure"}';

      const result = geminiService.parseResponse(malformedResponse);

      expect(result).toHaveProperty('clarity');
      expect(result.clarity.suggestions[0]).toContain('Unable to analyze');
    });
  });

  describe('validateFeedbackStructure', () => {
    it('should validate correct feedback structure', () => {
      const validFeedback = {
        clarity: { score: 8, suggestions: [], strengths: [], weaknesses: [] },
        grammar: { score: 7, corrections: [], improvements: [] },
        skills: { relevantSkills: [], missingSkills: [], recommendations: [] },
        improvements: []
      };

      expect(() => {
        geminiService.validateFeedbackStructure(validFeedback);
      }).not.toThrow();
    });

    it('should throw error for missing required fields', () => {
      const invalidFeedback = {
        clarity: { score: 8, suggestions: [] }
        // Missing grammar, skills, improvements
      };

      expect(() => {
        geminiService.validateFeedbackStructure(invalidFeedback);
      }).toThrow('Missing required field: grammar');
    });

    it('should throw error for invalid clarity structure', () => {
      const invalidFeedback = {
        clarity: { score: 8 }, // Missing suggestions array
        grammar: { score: 7, corrections: [], improvements: [] },
        skills: { relevantSkills: [], missingSkills: [], recommendations: [] },
        improvements: []
      };

      expect(() => {
        geminiService.validateFeedbackStructure(invalidFeedback);
      }).toThrow('Invalid clarity structure');
    });

    it('should throw error for invalid skills structure', () => {
      const invalidFeedback = {
        clarity: { score: 8, suggestions: [], strengths: [], weaknesses: [] },
        grammar: { score: 7, corrections: [], improvements: [] },
        skills: { relevantSkills: 'not an array' }, // Should be array
        improvements: []
      };

      expect(() => {
        geminiService.validateFeedbackStructure(invalidFeedback);
      }).toThrow('Invalid skills structure');
    });
  });

  describe('getFallbackFeedback', () => {
    it('should return properly structured fallback feedback', () => {
      const fallback = geminiService.getFallbackFeedback();

      expect(fallback).toHaveProperty('clarity');
      expect(fallback).toHaveProperty('grammar');
      expect(fallback).toHaveProperty('skills');
      expect(fallback).toHaveProperty('improvements');

      expect(fallback.clarity.score).toBe(5);
      expect(Array.isArray(fallback.clarity.suggestions)).toBe(true);
      expect(Array.isArray(fallback.improvements)).toBe(true);
      expect(fallback.improvements[0]).toHaveProperty('category');
      expect(fallback.improvements[0]).toHaveProperty('priority');
      expect(fallback.improvements[0]).toHaveProperty('suggestion');
      expect(fallback.improvements[0]).toHaveProperty('example');
    });
  });

  describe('analyzeResume', () => {
    it('should call analyzeResumeStreaming without onChunk callback', async () => {
      const mockChunks = [
        { text: () => '{"clarity":{"score":8,"suggestions":[],"strengths":[],"weaknesses":[]},' },
        { text: () => '"grammar":{"score":7,"corrections":[],"improvements":[]},' },
        { text: () => '"skills":{"relevantSkills":[],"missingSkills":[],"recommendations":[]},' },
        { text: () => '"improvements":[]}' }
      ];

      const mockStream = {
        stream: (async function* () {
          for (const chunk of mockChunks) {
            yield chunk;
          }
        })()
      };

      mockModel.generateContentStream.mockResolvedValue(mockStream);

      const result = await geminiService.analyzeResume('test resume');

      expect(result).toHaveProperty('clarity');
      expect(result).toHaveProperty('grammar');
      expect(result).toHaveProperty('skills');
      expect(result).toHaveProperty('improvements');
    });
  });
});