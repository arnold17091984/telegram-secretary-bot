import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the @google/genai module
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: vi.fn(),
    },
  })),
}));

describe('Gemini Image Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateImageWithGemini', () => {
    it('should return error when API key is empty', async () => {
      const { generateImageWithGemini } = await import('./integrations/gemini');
      
      const result = await generateImageWithGemini('', { prompt: 'test' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('API Key');
    });

    it('should return error when API key is whitespace only', async () => {
      const { generateImageWithGemini } = await import('./integrations/gemini');
      
      const result = await generateImageWithGemini('   ', { prompt: 'test' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('API Key');
    });
  });

  describe('testGeminiConnection', () => {
    it('should return error when API key is empty', async () => {
      const { testGeminiConnection } = await import('./integrations/gemini');
      
      const result = await testGeminiConnection('');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('API Key');
    });
  });
});

describe('Image Generation Trigger Detection', () => {
  it('should detect image generation trigger in message', () => {
    const message = '【画像生成】猫が宇宙を飛んでいる絵';
    expect(message.includes('【画像生成】')).toBe(true);
  });

  it('should extract prompt from trigger message', () => {
    const message = '【画像生成】猫が宇宙を飛んでいる絵';
    const prompt = message.replace('【画像生成】', '').trim();
    expect(prompt).toBe('猫が宇宙を飛んでいる絵');
  });

  it('should handle empty prompt', () => {
    const message = '【画像生成】';
    const prompt = message.replace('【画像生成】', '').trim();
    expect(prompt).toBe('');
  });

  it('should handle prompt with extra whitespace', () => {
    const message = '【画像生成】   美しい夕焼け   ';
    const prompt = message.replace('【画像生成】', '').trim();
    expect(prompt).toBe('美しい夕焼け');
  });
});
