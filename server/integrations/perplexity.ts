// Perplexity API Integration for Web Search
// Uses Perplexity's sonar model for real-time web search

export interface PerplexitySearchResult {
  content: string;
  citations: string[];
}

export async function searchWithPerplexity(
  apiKey: string,
  query: string
): Promise<PerplexitySearchResult> {
  const url = "https://api.perplexity.ai/chat/completions";
  
  console.log("[Perplexity] Starting web search for:", query);
  console.log("[Perplexity] API Key prefix:", apiKey.substring(0, 10) + "...");
  
  const requestBody = {
    model: "sonar", // Web search model
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant that provides accurate, up-to-date information based on web search results. Always include specific dates, names, and facts from your search. Respond in Japanese."
      },
      {
        role: "user",
        content: query
      }
    ],
    temperature: 0.2,
    max_tokens: 1000,
    return_citations: true,
    search_recency_filter: "day" // Focus on recent results
  };
  
  console.log("[Perplexity] Request body:", JSON.stringify(requestBody, null, 2));
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log("[Perplexity] Response status:", response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Perplexity] API error:", response.status, errorText);
      throw new Error(`Perplexity API error: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    console.log("[Perplexity] Response received");
    
    const content = data.choices?.[0]?.message?.content || "";
    const citations = data.citations || [];
    
    console.log("[Perplexity] Content preview:", content.substring(0, 100) + "...");
    console.log("[Perplexity] Citations count:", citations.length);
    
    return {
      content,
      citations
    };
  } catch (error) {
    console.error("[Perplexity] Request failed:", error);
    throw error;
  }
}
