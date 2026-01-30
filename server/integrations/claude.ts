/**
 * Claude API direct integration
 * This module provides direct access to Anthropic Claude API using user-provided API keys
 */

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeTool {
  name: string;
  description: string;
  input_schema: {
    type: string;
    properties: Record<string, {
      type: string;
      description: string;
    }>;
    required: string[];
  };
}

export interface ClaudeRequest {
  model: string;
  messages: ClaudeMessage[];
  system?: string;
  temperature?: number;
  max_tokens: number;
  tools?: ClaudeTool[];
  tool_choice?: { type: 'tool'; name: string } | { type: 'auto' } | { type: 'any' };
}

export interface ClaudeToolUse {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface ClaudeTextContent {
  type: 'text';
  text: string;
}

export type ClaudeContentBlock = ClaudeTextContent | ClaudeToolUse;

export interface ClaudeResponse {
  id: string;
  type: string;
  role: string;
  content: ClaudeContentBlock[];
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Call Claude API directly with user-provided API key
 */
export async function callClaude(
  apiKey: string,
  request: ClaudeRequest
): Promise<ClaudeResponse> {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('Claude API Key is required');
  }

  console.log('[Claude] Calling API endpoint: https://api.anthropic.com/v1/messages');
  console.log('[Claude] API Key prefix:', apiKey.substring(0, 20) + '...');
  console.log('[Claude] API Key length:', apiKey.length);
  console.log('[Claude] Request model:', request.model);
  console.log('[Claude] Request system prompt:', request.system?.substring(0, 100) + '...');
  console.log('[Claude] Request messages:', JSON.stringify(request.messages, null, 2));
  console.log('[Claude] Request temperature:', request.temperature);
  console.log('[Claude] Request max_tokens:', request.max_tokens);
  if (request.tools) {
    console.log('[Claude] Request tools:', JSON.stringify(request.tools, null, 2));
  }

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
  } catch (fetchError: any) {
    clearTimeout(timeoutId);
    if (fetchError.name === 'AbortError') {
      console.error('[Claude] API call timed out after 60 seconds');
      throw new Error('Claude API call timed out. Please try again.');
    }
    console.error('[Claude] Network error:', fetchError.message);
    throw new Error(`Claude API network error: ${fetchError.message}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Claude] API call failed:', response.status, response.statusText, errorText);
    throw new Error(
      `Claude API call failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  const result = (await response.json()) as ClaudeResponse;
  console.log('[Claude] API response received:', {
    id: result.id,
    model: result.model,
    contentLength: result.content.find(c => c.type === 'text')?.text?.length || 0,
    hasToolUse: result.content.some(c => c.type === 'tool_use'),
    usage: result.usage,
  });
  
  return result;
}
