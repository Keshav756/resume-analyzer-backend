const PDFExtractor = require("../services/pdfExtractor");
const fs = require("fs").promises;
const path = require("path");

// Mock fs module completely
jest.mock("fs", () => ({
  promises: {
    stat: jest.fn(),
    readFile: jest.fn(),
  },
  readFileSync: jest.fn(),
  existsSync: jest.fn(),
  createReadStream: jest.fn(),
  createWriteStream: jest.fn(),
}));

// Mock pdf-parse
jest.mock("pdf-parse");
const pdfParse = require("pdf-parse");

describe("PDFExtractor", () => {
  let pdfExtractor;
  const mockFilePath = "/test/path/resume.pdf";

  beforeEach(() => {
    pdfExtractor = new PDFExtractor();
    jest.clearAllMocks();
  });

  describe("extractText", () => {
    const mockPdfData = {
      text: "John Doe\nSoftware Engineer\nExperience: 5 years in web development\nSkills: JavaScript, React, Node.js",
      numpages: 1,
      info: {
        Title: "Resume",
        Author: "John Doe",
      },
    };

    beforeEach(() => {
      // Default successful mocks
      fs.stat.mockResolvedValue({ size: 1024 * 1024 }); // 1MB
      fs.readFile.mockResolvedValue(Buffer.from("mock pdf content"));
      pdfParse.mockResolvedValue(mockPdfData);
    });

    it("should successfully extract text from valid PDF", async () => {
      const result = await pdfExtractor.extractText(mockFilePath);

      expect(result.success).toBe(true);
      expect(result.text).toBe(mockPdfData.text);
      expect(result.metadata).toEqual({
        pages: 1,
        info: mockPdfData.info,
        textLength: mockPdfData.text.length,
        wordCount: 14, // Updated to match actual word count
        extractedAt: expect.any(String),
      });
      expect(fs.stat).toHaveBeenCalledWith(mockFilePath);
      expect(fs.readFile).toHaveBeenCalledWith(mockFilePath);
      expect(pdfParse).toHaveBeenCalled();
    });

    it("should handle file too large error", async () => {
      fs.stat.mockResolvedValue({ size: 15 * 1024 * 1024 }); // 15MB

      const result = await pdfExtractor.extractText(mockFilePath);

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("FILE_TOO_LARGE");
      expect(result.error.message).toContain("Maximum size is 10MB");
    });

    it("should handle empty file error", async () => {
      fs.stat.mockResolvedValue({ size: 0 });

      const result = await pdfExtractor.extractText(mockFilePath);

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("EMPTY_FILE");
      expect(result.error.message).toContain("empty");
    });

    it("should handle file not found error", async () => {
      const error = new Error("File not found");
      error.code = "ENOENT";
      fs.stat.mockRejectedValue(error);

      const result = await pdfExtractor.extractText(mockFilePath);

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("FILE_NOT_FOUND");
      expect(result.error.message).toContain("not found");
    });

    it("should handle file access error", async () => {
      const error = new Error("Permission denied");
      error.code = "EACCES";
      fs.stat.mockRejectedValue(error);

      const result = await pdfExtractor.extractText(mockFilePath);

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("FILE_ACCESS_ERROR");
      expect(result.error.message).toContain("Unable to access");
    });

    it("should handle invalid PDF error", async () => {
      pdfParse.mockRejectedValue(new Error("Invalid PDF structure"));

      const result = await pdfExtractor.extractText(mockFilePath);

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("INVALID_PDF");
      expect(result.error.message).toContain("not a valid PDF");
    });

    it("should handle password-protected PDF error", async () => {
      pdfParse.mockRejectedValue(new Error("PDF is password protected"));

      const result = await pdfExtractor.extractText(mockFilePath);

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("PASSWORD_PROTECTED");
      expect(result.error.message).toContain("password-protected");
    });

    it("should handle encrypted PDF error", async () => {
      pdfParse.mockRejectedValue(new Error("PDF is encrypted"));

      const result = await pdfExtractor.extractText(mockFilePath);

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("PASSWORD_PROTECTED");
      expect(result.error.message).toContain("password-protected");
    });
  });

  describe("validateExtractedText", () => {
    it("should validate text with sufficient content", () => {
      const text =
        "John Doe is a software engineer with 5 years of experience in web development.";
      const result = pdfExtractor.validateExtractedText(text);

      expect(result.isValid).toBe(true);
    });

    it("should reject empty text", () => {
      const result = pdfExtractor.validateExtractedText("");

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("No text could be extracted");
    });

    it("should reject null text", () => {
      const result = pdfExtractor.validateExtractedText(null);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("No text could be extracted");
    });

    it("should reject text that is too short", () => {
      const shortText = "John Doe";
      const result = pdfExtractor.validateExtractedText(shortText);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("too short");
      expect(result.error).toContain("8 characters");
    });

    it("should reject text with mostly non-printable characters", () => {
      const garbledText =
        "���������������������������������������������������������";
      const result = pdfExtractor.validateExtractedText(garbledText);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain(
        "corrupted or contains mostly non-readable"
      );
    });

    it("should accept text with some non-printable characters but mostly readable", () => {
      const mixedText =
        "John Doe\nSoftware Engineer\n���\nExperience: 5 years in development";
      const result = pdfExtractor.validateExtractedText(mixedText);

      expect(result.isValid).toBe(true);
    });
  });

  describe("countWords", () => {
    it("should count words correctly", () => {
      const text = "John Doe is a software engineer";
      const count = pdfExtractor.countWords(text);

      expect(count).toBe(6);
    });

    it("should handle multiple spaces", () => {
      const text = "John    Doe   is  a   software    engineer";
      const count = pdfExtractor.countWords(text);

      expect(count).toBe(6);
    });

    it("should handle newlines and tabs", () => {
      const text = "John\nDoe\tis\na\tsoftware\nengineer";
      const count = pdfExtractor.countWords(text);

      expect(count).toBe(6);
    });

    it("should handle empty string", () => {
      const count = pdfExtractor.countWords("");

      expect(count).toBe(0);
    });

    it("should handle string with only whitespace", () => {
      const count = pdfExtractor.countWords("   \n\t  ");

      expect(count).toBe(0);
    });
  });

  describe("handleExtractionError", () => {
    it("should categorize invalid PDF errors", () => {
      const error = new Error("Invalid PDF structure");
      const result = pdfExtractor.handleExtractionError(error, mockFilePath);

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("INVALID_PDF");
      expect(result.error.message).toContain("not a valid PDF");
    });

    it("should categorize password errors", () => {
      const error = new Error("PDF requires password");
      const result = pdfExtractor.handleExtractionError(error, mockFilePath);

      expect(result.error.type).toBe("PASSWORD_PROTECTED");
    });

    it("should categorize file size errors", () => {
      const error = new Error("PDF file too large. Maximum size is 10MB.");
      const result = pdfExtractor.handleExtractionError(error, mockFilePath);

      expect(result.error.type).toBe("FILE_TOO_LARGE");
    });

    it("should categorize empty file errors", () => {
      const error = new Error("PDF file is empty.");
      const result = pdfExtractor.handleExtractionError(error, mockFilePath);

      expect(result.error.type).toBe("EMPTY_FILE");
    });

    it("should categorize insufficient text errors", () => {
      const error = new Error("Extracted text is too short");
      const result = pdfExtractor.handleExtractionError(error, mockFilePath);

      expect(result.error.type).toBe("INSUFFICIENT_TEXT");
    });

    it("should handle generic extraction errors", () => {
      const error = new Error("Unknown parsing error");
      const result = pdfExtractor.handleExtractionError(error, mockFilePath);

      expect(result.error.type).toBe("EXTRACTION_ERROR");
      expect(result.error.message).toBe("Failed to extract text from PDF.");
    });

    it("should include timestamp in error response", () => {
      const error = new Error("Test error");
      const result = pdfExtractor.handleExtractionError(error, mockFilePath);

      expect(result.error.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
      );
    });
  });

  describe("integration scenarios", () => {
    it("should handle PDF with only images (no extractable text)", async () => {
      pdfParse.mockResolvedValue({
        text: "",
        numpages: 1,
        info: {},
      });

      const result = await pdfExtractor.extractText(mockFilePath);

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("INSUFFICIENT_TEXT");
      expect(result.error.message).toContain("No text could be extracted");
    });

    it("should handle PDF with minimal text content", async () => {
      pdfParse.mockResolvedValue({
        text: "Hi",
        numpages: 1,
        info: {},
      });

      const result = await pdfExtractor.extractText(mockFilePath);

      expect(result.success).toBe(false);
      expect(result.error.type).toBe("INSUFFICIENT_TEXT");
      expect(result.error.message).toContain("too short");
    });

    it("should successfully process multi-page PDF", async () => {
      const longText =
        "John Doe\nSoftware Engineer\n\nExperience:\n- 5 years in web development\n- Expert in JavaScript, React, Node.js\n- Led multiple successful projects\n\nEducation:\nBachelor of Computer Science\nUniversity of Technology\n\nSkills:\n- Frontend: React, Vue.js, HTML, CSS\n- Backend: Node.js, Express, MongoDB\n- Tools: Git, Docker, AWS";

      pdfParse.mockResolvedValue({
        text: longText,
        numpages: 2,
        info: {
          Title: "John Doe Resume",
          Author: "John Doe",
        },
      });

      const result = await pdfExtractor.extractText(mockFilePath);

      expect(result.success).toBe(true);
      expect(result.text).toBe(longText);
      expect(result.metadata.pages).toBe(2);
      expect(result.metadata.wordCount).toBeGreaterThan(30);
    });
  });
});
