/**
 * OpenAI API direct integration
 * This module provides direct access to OpenAI API using user-provided API keys
 */

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, {
        type: string;
        description: string;
      }>;
      required: string[];
    };
  };
}

export interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  tools?: OpenAITool[];
  tool_choice?: { type: 'function'; function: { name: string } } | 'auto' | 'none';
}

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Call OpenAI API directly with user-provided API key
 */
export async function callOpenAI(
  apiKey: string,
  request: OpenAIRequest
): Promise<OpenAIResponse> {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('OpenAI API Key is required');
  }

  console.log('[OpenAI] Calling API endpoint: https://api.openai.com/v1/chat/completions');
  console.log('[OpenAI] Request model:', request.model);
  console.log('[OpenAI] Request messages:', JSON.stringify(request.messages, null, 2));
  console.log('[OpenAI] Request temperature:', request.temperature);
  console.log('[OpenAI] Request max_tokens:', request.max_tokens);
  if (request.tools) {
    console.log('[OpenAI] Request tools:', JSON.stringify(request.tools, null, 2));
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[OpenAI] API call failed:', response.status, response.statusText, errorText);
    throw new Error(
      `OpenAI API call failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  const result = (await response.json()) as OpenAIResponse;
  console.log('[OpenAI] API response received:', {
    id: result.id,
    model: result.model,
    contentLength: result.choices[0]?.message?.content?.length || 0,
    toolCalls: result.choices[0]?.message?.tool_calls?.length || 0,
    usage: result.usage,
  });
  
  return result;
}
