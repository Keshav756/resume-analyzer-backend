const GeminiService = require('../services/geminiService');

describe('GeminiService Integration Tests', () => {
  let geminiService;

  beforeAll(() => {
    // Only run integration tests if API key is available
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'test-api-key') {
      console.log('Skipping integration tests - no valid API key');
      return;
    }
    geminiService = new GeminiService();
  });

  describe('Real API Integration', () => {
    // Skip these tests in CI/CD or when no real API key is available
    const skipIntegration = !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'test-api-key';

    (skipIntegration ? it.skip : it)('should analyze a sample resume with streaming', async () => {
      const sampleResume = `
        John Doe
        Software Engineer
        Email: john.doe@email.com
        Phone: (555) 123-4567

        EXPERIENCE
        Senior Software Engineer - Tech Corp (2020-2023)
        - Developed web applications using React and Node.js
        - Led team of 5 developers on major product features
        - Improved application performance by 40%

        Software Engineer - StartupXYZ (2018-2020)
        - Built REST APIs using Express.js and MongoDB
        - Implemented automated testing with Jest
        - Collaborated with cross-functional teams

        EDUCATION
        Bachelor of Science in Computer Science
        University of Technology (2014-2018)

        SKILLS
        JavaScript, React, Node.js, MongoDB, Git, AWS
      `;

      const chunks = [];
      const onChunk = (chunk) => {
        chunks.push(chunk);
      };

      const result = await geminiService.analyzeResumeStreaming(sampleResume, onChunk);

      // Verify streaming worked
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('')).toContain('{');

      // Verify result structure
      expect(result).toHaveProperty('clarity');
      expect(result).toHaveProperty('grammar');
      expect(result).toHaveProperty('skills');
      expect(result).toHaveProperty('improvements');

      // Verify scores are reasonable
      expect(result.clarity.score).toBeGreaterThanOrEqual(1);
      expect(result.clarity.score).toBeLessThanOrEqual(10);
      expect(result.grammar.score).toBeGreaterThanOrEqual(1);
      expect(result.grammar.score).toBeLessThanOrEqual(10);

      // Verify arrays are present
      expect(Array.isArray(result.clarity.suggestions)).toBe(true);
      expect(Array.isArray(result.skills.relevantSkills)).toBe(true);
      expect(Array.isArray(result.improvements)).toBe(true);

      console.log('Sample analysis result:', JSON.stringify(result, null, 2));
    }, 30000); // 30 second timeout for API call

    (skipIntegration ? it.skip : it)('should handle non-streaming analysis', async () => {
      const sampleResume = `
        Jane Smith
        Marketing Manager
        jane.smith@email.com

        EXPERIENCE
        Marketing Manager - Big Company (2019-2023)
        - Managed social media campaigns
        - Increased brand awareness by 25%

        EDUCATION
        MBA in Marketing - Business School (2017-2019)
      `;

      const result = await geminiService.analyzeResume(sampleResume);

      expect(result).toHaveProperty('clarity');
      expect(result).toHaveProperty('grammar');
      expect(result).toHaveProperty('skills');
      expect(result).toHaveProperty('improvements');

      console.log('Non-streaming analysis result:', JSON.stringify(result, null, 2));
    }, 30000);
  });

  describe('Error Handling Integration', () => {
    it('should handle empty resume text gracefully', async () => {
      if (!geminiService) return;

      const result = await geminiService.analyzeResumeStreaming('');

      // Should return fallback or valid structure
      expect(result).toHaveProperty('clarity');
      expect(result).toHaveProperty('grammar');
      expect(result).toHaveProperty('skills');
      expect(result).toHaveProperty('improvements');
    }, 15000);

    it('should handle very short resume text', async () => {
      if (!geminiService) return;

      const result = await geminiService.analyzeResumeStreaming('John Doe');

      expect(result).toHaveProperty('clarity');
      expect(result).toHaveProperty('grammar');
      expect(result).toHaveProperty('skills');
      expect(result).toHaveProperty('improvements');
    }, 15000);
  });
});