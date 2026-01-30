// Free Web Search using SearXNG public instances
// No API key required

interface SearchResult {
  title: string;
  url: string;
  content: string;
}

interface WebSearchResponse {
  content: string;
  sources: string[];
}

// List of public SearXNG instances (fallback if one fails)
const SEARXNG_INSTANCES = [
  "https://searx.be",
  "https://search.sapti.me",
  "https://searx.tiekoetter.com",
  "https://search.bus-hit.me",
];

export async function searchWeb(query: string): Promise<WebSearchResponse> {
  console.log("[WebSearch] Searching for:", query);
  
  let lastError: Error | null = null;
  
  for (const instance of SEARXNG_INSTANCES) {
    try {
      const url = new URL(`${instance}/search`);
      url.searchParams.set("q", query);
      url.searchParams.set("format", "json");
      url.searchParams.set("language", "ja-JP");
      url.searchParams.set("categories", "general");
      
      console.log("[WebSearch] Trying instance:", instance);
      
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "User-Agent": "TelegramSecretaryBot/1.0",
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.results || data.results.length === 0) {
        console.log("[WebSearch] No results from", instance);
        continue;
      }
      
      // Extract top 5 results
      const results: SearchResult[] = data.results.slice(0, 5).map((r: any) => ({
        title: r.title || "",
        url: r.url || "",
        content: r.content || "",
      }));
      
      // Format results as context
      const content = results
        .map((r, i) => `${i + 1}. ${r.title}\n${r.content}`)
        .join("\n\n");
      
      const sources = results.map(r => r.url).filter(Boolean);
      
      console.log("[WebSearch] Success! Found", results.length, "results");
      
      return { content, sources };
    } catch (error) {
      console.error("[WebSearch] Failed with", instance, ":", error);
      lastError = error as Error;
      continue;
    }
  }
  
  // If all instances failed, try DuckDuckGo HTML scraping as fallback
  try {
    console.log("[WebSearch] Trying DuckDuckGo HTML fallback...");
    return await searchDuckDuckGoHtml(query);
  } catch (error) {
    console.error("[WebSearch] DuckDuckGo fallback also failed:", error);
  }
  
  throw new Error(`All search instances failed. Last error: ${lastError?.message}`);
}

// Fallback: DuckDuckGo HTML scraping (less reliable but works without API)
async function searchDuckDuckGoHtml(query: string): Promise<WebSearchResponse> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html",
    },
    signal: AbortSignal.timeout(10000),
  });
  
  if (!response.ok) {
    throw new Error(`DuckDuckGo HTTP ${response.status}`);
  }
  
  const html = await response.text();
  
  // Simple regex extraction of results
  const resultPattern = /<a class="result__a" href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([^<]+)<\/a>/g;
  const results: SearchResult[] = [];
  let match;
  
  while ((match = resultPattern.exec(html)) !== null && results.length < 5) {
    results.push({
      url: match[1],
      title: match[2].trim(),
      content: match[3].trim(),
    });
  }
  
  if (results.length === 0) {
    // Try alternative pattern
    const altPattern = /<a rel="nofollow" class="result__a" href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
    while ((match = altPattern.exec(html)) !== null && results.length < 5) {
      results.push({
        url: match[1],
        title: match[2].trim(),
        content: "",
      });
    }
  }
  
  const content = results
    .map((r, i) => `${i + 1}. ${r.title}${r.content ? "\n" + r.content : ""}`)
    .join("\n\n");
  
  const sources = results.map(r => r.url).filter(Boolean);
  
  return { content, sources };
}
