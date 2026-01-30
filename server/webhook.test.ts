import { describe, it, expect } from 'vitest';

// Import the function to test (we'll need to export it first)
// For now, we'll duplicate the logic here for testing

function requiresWebSearch(query: string): boolean {
  const realtimeKeywords = [
    '今', '現在', '最新', '今日', '昨日', '今週', '今月', '今年',
    '最近', '新しい', 'リアルタイム',
    'ニュース', '速報', '報道', '発表', 'アナウンス',
    '2024年', '2025年', '2026年', '2027年',
    '誰が', '何が', 'どこが', 'いくら',
    '総理大臣', '大統領', '首相', '社長', 'CEO',
    'イベント', '開催', '予定', 'スケジュール',
    '株価', '為替', 'レート', '価格', '相場',
    '天気', '気温', '予報',
  ];
  
  const lowerQuery = query.toLowerCase();
  
  for (const keyword of realtimeKeywords) {
    if (lowerQuery.includes(keyword.toLowerCase())) {
      return true;
    }
  }
  
  const questionPatterns = [
    /今の.+は[\uff1f？]/,
    /現在の.+は[\uff1f？]/,
    /最新の.+/,
    /いつ.+ですか[\uff1f？]/,
  ];
  
  for (const pattern of questionPatterns) {
    if (pattern.test(query)) {
      return true;
    }
  }
  
  return false;
}

function postProcessAIOutput(text: string): string {
  let result = text;
  
  // Remove Markdown emphasis
  result = result.replace(/\*\*([^*]+)\*\*/g, '$1');
  result = result.replace(/__([^_]+)__/g, '$1');
  
  // Remove unwanted opening phrases
  const openingPhrases = [
    /^承知いたしました[。、\s]*/,
    /^かしこまりました[。、\s]*/,
    /^はい[。、\s]*/,
    /^ありがとうございます[。、\s]*/,
  ];
  
  for (const phrase of openingPhrases) {
    result = result.replace(phrase, '');
  }
  
  // Remove unwanted closing phrases
  const closingPhrases = [
    /[。\s]*何か関連して確認したいことはありますか[？？]?\s*$/,
    /[。\s]*何かご不明な点があれば[、。]?[^。]*[。]?\s*$/,
    /[。\s]*お気軽にお申し付けください[。]?\s*$/,
    /[。\s]*何かあればお知らせください[。]?\s*$/,
    /[。\s]*他にご質問があれば[、。]?[^。]*[。]?\s*$/,
  ];
  
  for (const phrase of closingPhrases) {
    result = result.replace(phrase, '');
  }
  
  return result.trim();
}

describe('requiresWebSearch', () => {
  describe('should return true for queries needing realtime info', () => {
    it('detects "今" keyword', () => {
      expect(requiresWebSearch('今の日本の総理大臣は？')).toBe(true);
    });
    
    it('detects "現在" keyword', () => {
      expect(requiresWebSearch('現在の株価を教えて')).toBe(true);
    });
    
    it('detects "最新" keyword', () => {
      expect(requiresWebSearch('最新のニュースは？')).toBe(true);
    });
    
    it('detects year keywords', () => {
      expect(requiresWebSearch('2026年の予定は？')).toBe(true);
    });
    
    it('detects "総理大臣" keyword', () => {
      expect(requiresWebSearch('総理大臣は誰？')).toBe(true);
    });
    
    it('detects "天気" keyword', () => {
      expect(requiresWebSearch('明日の天気は？')).toBe(true);
    });
    
    it('detects "株価" keyword', () => {
      expect(requiresWebSearch('トヨタの株価')).toBe(true);
    });
  });
  
  describe('should return false for general knowledge queries', () => {
    it('returns false for historical questions', () => {
      expect(requiresWebSearch('第二次世界大戦はいつ終わった？')).toBe(false);
    });
    
    it('returns false for definition questions', () => {
      expect(requiresWebSearch('プログラミングとは何ですか？')).toBe(false);
    });
    
    it('returns false for how-to questions', () => {
      expect(requiresWebSearch('Pythonでリストをソートする方法')).toBe(false);
    });
    
    it('returns false for opinion questions', () => {
      expect(requiresWebSearch('おすすめの本を教えて')).toBe(false);
    });
    
    it('returns false for math questions', () => {
      expect(requiresWebSearch('100の平方根は？')).toBe(false);
    });
  });
});

describe('checkBotMention logic', () => {
  // Test the mention detection logic (simplified version without async)
  function extractMentionFromText(
    text: string,
    entities: Array<{ type: string; offset: number; length: number }>,
    botUsername: string
  ): { isMentioned: boolean; cleanedText: string } {
    for (const entity of entities) {
      if (entity.type === 'mention') {
        const mentionText = text.substring(entity.offset, entity.offset + entity.length);
        if (mentionText.toLowerCase().replace('@', '') === botUsername.toLowerCase()) {
          const cleanedText = (text.substring(0, entity.offset) + text.substring(entity.offset + entity.length)).trim();
          return { isMentioned: true, cleanedText };
        }
      }
    }
    return { isMentioned: false, cleanedText: text };
  }

  it('detects bot mention at start of message', () => {
    const result = extractMentionFromText(
      '@testbot 今の総理大臣は？',
      [{ type: 'mention', offset: 0, length: 8 }],
      'testbot'
    );
    expect(result.isMentioned).toBe(true);
    expect(result.cleanedText).toBe('今の総理大臣は？');
  });

  it('detects bot mention in middle of message', () => {
    // Note: Telegram uses UTF-16 code units for offset/length
    // 'こんにちは ' = 6 characters, '@testbot' starts at offset 6
    const result = extractMentionFromText(
      'こんにちは @testbot 質問です',
      [{ type: 'mention', offset: 6, length: 8 }],
      'testbot'
    );
    expect(result.isMentioned).toBe(true);
    expect(result.cleanedText).toBe('こんにちは  質問です');
  });

  it('ignores mentions of other users', () => {
    const result = extractMentionFromText(
      '@otheruser こんにちは',
      [{ type: 'mention', offset: 0, length: 10 }],
      'testbot'
    );
    expect(result.isMentioned).toBe(false);
    expect(result.cleanedText).toBe('@otheruser こんにちは');
  });

  it('handles message without mentions', () => {
    const result = extractMentionFromText(
      '普通のメッセージ',
      [],
      'testbot'
    );
    expect(result.isMentioned).toBe(false);
    expect(result.cleanedText).toBe('普通のメッセージ');
  });

  it('is case-insensitive for bot username', () => {
    const result = extractMentionFromText(
      '@TestBot 質問',
      [{ type: 'mention', offset: 0, length: 8 }],
      'testbot'
    );
    expect(result.isMentioned).toBe(true);
    expect(result.cleanedText).toBe('質問');
  });
});

describe('postProcessAIOutput', () => {
  describe('removes Markdown emphasis', () => {
    it('removes **bold** markers', () => {
      expect(postProcessAIOutput('これは**重要**です')).toBe('これは重要です');
    });
    
    it('removes __underline__ markers', () => {
      expect(postProcessAIOutput('これは__下線__です')).toBe('これは下線です');
    });
    
    it('handles multiple bold markers', () => {
      expect(postProcessAIOutput('**石破茂**は**総理大臣**です')).toBe('石破茂は総理大臣です');
    });
  });
  
  describe('removes unwanted opening phrases', () => {
    it('removes "承知いたしました"', () => {
      expect(postProcessAIOutput('承知いたしました。回答します。')).toBe('回答します。');
    });
    
    it('removes "かしこまりました"', () => {
      expect(postProcessAIOutput('かしこまりました、お答えします。')).toBe('お答えします。');
    });
  });
  
  describe('removes unwanted closing phrases', () => {
    it('removes "何か関連して確認したいことはありますか？"', () => {
      expect(postProcessAIOutput('石破茂です。何か関連して確認したいことはありますか？')).toBe('石破茂です');
    });
    
    it('removes "お気軽にお申し付けください"', () => {
      expect(postProcessAIOutput('以上です。お気軽にお申し付けください。')).toBe('以上です');
    });
  });
  
  describe('handles combined cases', () => {
    it('removes both markdown and phrases', () => {
      const input = '承知いたしました。現在の日本の総理大臣は**石破茂**です。何か関連して確認したいことはありますか？';
      const expected = '現在の日本の総理大臣は石破茂です';
      expect(postProcessAIOutput(input)).toBe(expected);
    });
  });
});
