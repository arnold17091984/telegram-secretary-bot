/**
 * Gemini API integration for image generation
 * Uses the @google/genai package for generating images
 */

import { GoogleGenAI } from "@google/genai";

interface GeminiImageGenerationOptions {
  prompt: string;
  model?: string;
  referenceImage?: {
    data: string; // Base64 encoded image data
    mimeType: string;
  };
}

interface GeminiImageResult {
  success: boolean;
  imageData?: string; // Base64 encoded image data
  mimeType?: string;
  text?: string;
  error?: string;
}

/**
 * Generate an image using Gemini API
 * @param apiKey - Gemini API key
 * @param options - Image generation options
 * @returns Generated image data or error
 */
export async function generateImageWithGemini(
  apiKey: string,
  options: GeminiImageGenerationOptions
): Promise<GeminiImageResult> {
  try {
    if (!apiKey || apiKey.trim() === '') {
      return {
        success: false,
        error: 'Gemini API Keyが設定されていません。',
      };
    }

    const ai = new GoogleGenAI({ apiKey });

    // Use gemini-2.5-flash-image for image generation (Nano Banana)
    const model = options.model || 'gemini-2.5-flash-image';

    console.log(`[Gemini] Generating image with model: ${model}`);
    console.log(`[Gemini] Prompt: ${options.prompt}`);

    console.log(`[Gemini] Calling API...`);
    
    // Build contents based on whether we have a reference image
    let contents: any;
    if (options.referenceImage) {
      console.log(`[Gemini] Using reference image for editing`);
      contents = [
        {
          inlineData: {
            mimeType: options.referenceImage.mimeType,
            data: options.referenceImage.data,
          },
        },
        {
          text: options.prompt,
        },
      ];
    } else {
      contents = options.prompt;
    }
    
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        responseModalities: ['IMAGE', 'TEXT'],
      },
    });

    console.log(`[Gemini] Response received:`, JSON.stringify(response, null, 2).substring(0, 500));

    // Process the response
    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      return {
        success: false,
        error: '画像の生成に失敗しました。応答がありません。',
      };
    }

    const content = candidates[0].content;
    if (!content || !content.parts) {
      return {
        success: false,
        error: '画像の生成に失敗しました。コンテンツがありません。',
      };
    }

    let imageData: string | undefined;
    let mimeType: string | undefined;
    let text: string | undefined;

    for (const part of content.parts) {
      if (part.text) {
        text = part.text;
        console.log(`[Gemini] Text response: ${text}`);
      } else if (part.inlineData) {
        imageData = part.inlineData.data;
        mimeType = part.inlineData.mimeType;
        console.log(`[Gemini] Image received, mimeType: ${mimeType}`);
      }
    }

    if (!imageData) {
      return {
        success: false,
        error: '画像の生成に失敗しました。画像データがありません。',
        text,
      };
    }

    return {
      success: true,
      imageData,
      mimeType: mimeType || 'image/png',
      text,
    };
  } catch (error: any) {
    console.error('[Gemini] Error generating image:', error);
    
    // Handle specific error types
    if (error.message?.includes('API key')) {
      return {
        success: false,
        error: 'Gemini API Keyが無効です。正しいAPIキーを設定してください。',
      };
    }
    
    if (error.message?.includes('quota') || error.message?.includes('rate')) {
      return {
        success: false,
        error: 'APIの利用制限に達しました。しばらく待ってから再試行してください。',
      };
    }
    
    if (error.message?.includes('safety') || error.message?.includes('blocked')) {
      return {
        success: false,
        error: '安全性の理由により画像を生成できませんでした。別のプロンプトをお試しください。',
      };
    }

    return {
      success: false,
      error: `画像生成エラー: ${error.message || 'Unknown error'}`,
    };
  }
}

/**
 * Test Gemini API connection
 * @param apiKey - Gemini API key
 * @returns Connection test result
 */
export async function testGeminiConnection(apiKey: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!apiKey || apiKey.trim() === '') {
      return {
        success: false,
        message: 'API Keyが入力されていません。',
      };
    }

    const ai = new GoogleGenAI({ apiKey });

    // Try a simple text generation to test the API key
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: 'Hello',
    });

    if (response.candidates && response.candidates.length > 0) {
      return {
        success: true,
        message: 'Gemini APIに正常に接続できました。',
      };
    }

    return {
      success: false,
      message: '接続テストに失敗しました。',
    };
  } catch (error: any) {
    console.error('[Gemini] Connection test error:', error);
    
    if (error.message?.includes('API key')) {
      return {
        success: false,
        message: 'API Keyが無効です。',
      };
    }

    return {
      success: false,
      message: `接続エラー: ${error.message || 'Unknown error'}`,
    };
  }
}


// ============================================
// Audio Functions (Speech-to-Text & Text-to-Speech)
// ============================================

interface GeminiAudioTranscriptionOptions {
  audioData: string; // Base64 encoded audio data
  mimeType: string; // e.g., 'audio/ogg', 'audio/mpeg'
  prompt?: string; // Optional prompt for context
}

interface GeminiAudioTranscriptionResult {
  success: boolean;
  text?: string;
  error?: string;
}

interface GeminiTTSOptions {
  text: string;
  voiceName?: string; // Default: 'Kore'
  model?: string; // Default: 'gemini-2.5-flash-preview-tts'
}

interface GeminiTTSResult {
  success: boolean;
  audioData?: string; // Base64 encoded PCM audio data
  error?: string;
}

// Available TTS voices
export const GEMINI_TTS_VOICES = [
  { name: 'Zephyr', description: 'Bright' },
  { name: 'Puck', description: 'Upbeat' },
  { name: 'Charon', description: 'Informative' },
  { name: 'Kore', description: 'Firm' },
  { name: 'Fenrir', description: 'Excitable' },
  { name: 'Leda', description: 'Youthful' },
  { name: 'Orus', description: 'Firm' },
  { name: 'Aoede', description: 'Breezy' },
  { name: 'Callirrhoe', description: 'Easy-going' },
  { name: 'Autonoe', description: 'Bright' },
  { name: 'Enceladus', description: 'Breathy' },
  { name: 'Iapetus', description: 'Clear' },
  { name: 'Umbriel', description: 'Easy-going' },
  { name: 'Algieba', description: 'Smooth' },
  { name: 'Despina', description: 'Smooth' },
  { name: 'Erinome', description: 'Clear' },
  { name: 'Algenib', description: 'Gravelly' },
  { name: 'Rasalgethi', description: 'Informative' },
  { name: 'Laomedeia', description: 'Upbeat' },
  { name: 'Achernar', description: 'Soft' },
  { name: 'Alnilam', description: 'Firm' },
  { name: 'Schedar', description: 'Even' },
  { name: 'Gacrux', description: 'Mature' },
  { name: 'Pulcherrima', description: 'Forward' },
  { name: 'Achird', description: 'Friendly' },
  { name: 'Zubenelgenubi', description: 'Casual' },
  { name: 'Vindemiatrix', description: 'Gentle' },
  { name: 'Sadachbia', description: 'Lively' },
  { name: 'Sadaltager', description: 'Knowledgeable' },
  { name: 'Sulafat', description: 'Warm' },
];

/**
 * Transcribe audio to text using Gemini API
 * @param apiKey - Gemini API key
 * @param options - Audio transcription options
 * @returns Transcribed text or error
 */
export async function transcribeAudioWithGemini(
  apiKey: string,
  options: GeminiAudioTranscriptionOptions
): Promise<GeminiAudioTranscriptionResult> {
  try {
    if (!apiKey || apiKey.trim() === '') {
      return {
        success: false,
        error: 'Gemini API Keyが設定されていません。',
      };
    }

    const ai = new GoogleGenAI({ apiKey });

    // Use gemini-2.5-flash for audio understanding
    const model = 'gemini-2.5-flash';

    console.log(`[Gemini Audio] Transcribing audio with model: ${model}`);
    console.log(`[Gemini Audio] Audio mimeType: ${options.mimeType}`);

    const prompt = options.prompt || 'この音声を日本語で文字起こししてください。音声の内容をそのまま書き起こしてください。';

    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          inlineData: {
            mimeType: options.mimeType,
            data: options.audioData,
          },
        },
        {
          text: prompt,
        },
      ],
    });

    console.log(`[Gemini Audio] Response received`);

    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      return {
        success: false,
        error: '音声の文字起こしに失敗しました。応答がありません。',
      };
    }

    const content = candidates[0].content;
    if (!content || !content.parts) {
      return {
        success: false,
        error: '音声の文字起こしに失敗しました。コンテンツがありません。',
      };
    }

    let text: string | undefined;
    for (const part of content.parts) {
      if (part.text) {
        text = part.text;
        break;
      }
    }

    if (!text) {
      return {
        success: false,
        error: '音声の文字起こしに失敗しました。テキストがありません。',
      };
    }

    console.log(`[Gemini Audio] Transcription: ${text.substring(0, 100)}...`);

    return {
      success: true,
      text,
    };
  } catch (error: any) {
    console.error('[Gemini Audio] Error transcribing audio:', error);
    
    if (error.message?.includes('API key')) {
      return {
        success: false,
        error: 'Gemini API Keyが無効です。',
      };
    }

    return {
      success: false,
      error: `音声認識エラー: ${error.message || 'Unknown error'}`,
    };
  }
}

/**
 * Generate speech from text using Gemini TTS API
 * @param apiKey - Gemini API key
 * @param options - TTS options
 * @returns Generated audio data or error
 */
export async function generateSpeechWithGemini(
  apiKey: string,
  options: GeminiTTSOptions
): Promise<GeminiTTSResult> {
  try {
    if (!apiKey || apiKey.trim() === '') {
      return {
        success: false,
        error: 'Gemini API Keyが設定されていません。',
      };
    }

    const voiceName = options.voiceName || 'Kore';
    const model = options.model || 'gemini-2.5-flash-preview-tts';

    console.log(`[Gemini TTS] Generating speech with model: ${model}`);
    console.log(`[Gemini TTS] Voice: ${voiceName}`);
    console.log(`[Gemini TTS] Text: ${options.text.substring(0, 100)}...`);

    // Use REST API for TTS as the SDK might not fully support TTS yet
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: options.text }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voiceName,
                },
              },
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Gemini TTS] API error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `TTS APIエラー: ${response.status}`,
      };
    }

    const data = await response.json();
    console.log(`[Gemini TTS] Response received`);

    const candidates = data.candidates;
    if (!candidates || candidates.length === 0) {
      return {
        success: false,
        error: '音声の生成に失敗しました。応答がありません。',
      };
    }

    const content = candidates[0].content;
    if (!content || !content.parts) {
      return {
        success: false,
        error: '音声の生成に失敗しました。コンテンツがありません。',
      };
    }

    let audioData: string | undefined;
    for (const part of content.parts) {
      if (part.inlineData && part.inlineData.data) {
        audioData = part.inlineData.data;
        break;
      }
    }

    if (!audioData) {
      return {
        success: false,
        error: '音声の生成に失敗しました。音声データがありません。',
      };
    }

    console.log(`[Gemini TTS] Audio generated successfully`);

    return {
      success: true,
      audioData,
    };
  } catch (error: any) {
    console.error('[Gemini TTS] Error generating speech:', error);
    
    if (error.message?.includes('API key')) {
      return {
        success: false,
        error: 'Gemini API Keyが無効です。',
      };
    }

    return {
      success: false,
      error: `音声合成エラー: ${error.message || 'Unknown error'}`,
    };
  }
}

/**
 * Convert PCM audio data to OGG format for Telegram
 * Telegram requires OGG format for voice messages
 * @param pcmData - Base64 encoded PCM audio data (24kHz, 16-bit, mono)
 * @returns Base64 encoded OGG audio data
 */
export function pcmToWav(pcmData: string): Buffer {
  const pcmBuffer = Buffer.from(pcmData, 'base64');
  
  // WAV header for 24kHz, 16-bit, mono PCM
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;
  const fileSize = 36 + dataSize;

  const header = Buffer.alloc(44);
  
  // RIFF header
  header.write('RIFF', 0);
  header.writeUInt32LE(fileSize, 4);
  header.write('WAVE', 8);
  
  // fmt subchunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size
  header.writeUInt16LE(1, 20); // AudioFormat (PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  
  // data subchunk
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  
  return Buffer.concat([header, pcmBuffer]);
}
