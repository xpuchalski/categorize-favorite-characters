function decodeScrapedUrl(rawUrl) {
  return rawUrl
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&')
    .replace(/\\u0026/g, '&');
}

function scoreCandidate(url, queryTokens) {
  const lowerUrl = url.toLowerCase();
  let score = 0;

  for (const token of queryTokens) {
    if (token && lowerUrl.includes(token)) score += 2;
  }

  if (lowerUrl.includes('fanart') || lowerUrl.includes('artwork') || lowerUrl.includes('illustration')) {
    score += 4;
  }

  if (lowerUrl.includes('preview') || lowerUrl.includes('thumbnail') || lowerUrl.includes('avatar')) {
    score -= 2;
  }

  return score;
}

function extractImageCandidates(html, query) {
  const patterns = [
    /"murl":"(https?:\/\/[^\"]+)"/g,
    /murl&quot;:&quot;(https?:\/\/[^\"&]+?)&quot;/g,
    /"imgurl":"(https?:\/\/[^\"]+)"/g,
  ];

  const queryTokens = query
    .toLowerCase()
    .split(/\s+/)
    .map(part => part.trim())
    .filter(Boolean)
    .slice(0, 6);

  const blockedExt = /\.(svg)$/i;
  const seen = new Set();
  const found = [];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;

    while ((match = pattern.exec(html)) !== null) {
      const candidate = decodeScrapedUrl(match[1] || '');
      if (!candidate || seen.has(candidate) || blockedExt.test(candidate)) continue;

      seen.add(candidate);
      found.push({
        url: candidate,
        score: scoreCandidate(candidate, queryTokens),
      });

      if (found.length >= 50) break;
    }

    if (found.length >= 50) break;
  }

  found.sort((a, b) => b.score - a.score);
  return found.slice(0, 8).map(item => item.url);
}

module.exports = async (req, res) => {
  const query = req.query?.q;

  if (typeof query !== 'string' || !query.trim()) {
    res.status(400).json({ error: 'Missing search query' });
    return;
  }

  try {
    const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      res.status(502).json({ error: 'Image search provider unavailable' });
      return;
    }

    const html = await response.text();
    const candidates = extractImageCandidates(html, query);

    if (!candidates.length) {
      res.status(404).json({ error: 'No image found from scraped results' });
      return;
    }

    res.status(200).json({ imageUrl: candidates[0], candidates });
  } catch {
    res.status(500).json({ error: 'Unexpected error while searching images' });
  }
};
