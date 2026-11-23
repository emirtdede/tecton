/**
 * rag.js
 *
 * Offline retrieval over the bundled knowledge corpus (BM25, no model, no
 * network). The assistant uses it in two ways:
 *
 *   - with a local LLM: the top chunks become the grounding context, so the
 *     model answers from Tecton's own manual instead of hallucinating;
 *   - without a model: `extractiveAnswer()` still returns a useful reply made
 *     of the best-matching passages, with citations.
 *
 * Turkish matching needs two extras: case folding for dotted/dotless i and
 * diacritic folding so "santiye" finds "şantiye". Both are handled by
 * `fold()` before tokenising.
 */

const { DOC_CHUNKS } = require('./knowledge');

const K1 = 1.5;
const B = 0.75;

const TR_FOLD = {
  ç: 'c', ğ: 'g', ı: 'i', İ: 'i', ö: 'o', ş: 's', ü: 'u',
  Ç: 'c', Ğ: 'g', Ö: 'o', Ş: 's', Ü: 'u',
};

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'can',
  'could', 'did', 'do', 'does', 'for', 'from', 'had', 'has', 'have', 'how',
  'i', 'if', 'in', 'into', 'is', 'it', 'its', 'me', 'my', 'not', 'of', 'on',
  'or', 'our', 'should', 'so', 'than', 'that', 'the', 'their', 'them', 'then',
  'there', 'these', 'they', 'this', 'to', 'was', 'we', 'were', 'what', 'when',
  'where', 'which', 'who', 'why', 'will', 'with', 'would', 'you', 'your',
  'bir', 've', 'ile', 'için', 'olan', 'olarak', 'bu', 'şu', 'da', 'de',
  'ne', 'nasıl', 'nedir', 'mi', 'mı', 'mu', 'mü', 'ben', 'benim',
  'nerede', 'hangi', 'neden', 'çok', 'daha', 'gibi', 'var', 'yok', 'ise',
].map((word) => fold(word)));

/**
 * Very light singular folding. A full stemmer would be overkill for a corpus
 * this size, but without it "backups" misses the "backup" title and the wrong
 * section wins.
 */
function normalize(token) {
  if (token.length > 4 && token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) {
    return token.slice(0, -1);
  }
  return token;
}

function fold(value) {
  return String(value || '')
    .replace(/[çğıİöşüÇĞÖŞÜ]/g, (char) => TR_FOLD[char] || char)
    .toLowerCase();
}

function tokenize(value) {
  return fold(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
    .map(normalize);
}

function buildIndex(chunks) {
  const docs = chunks.map((chunk) => {
    const title = `${chunk.titleTr} ${chunk.titleEn}`;
    const tags = (chunk.tags || []).join(' ');
    const body = `${chunk.bodyTr} ${chunk.bodyEn} ${chunk.category}`;
    // Titles and tags are repeated so an exact topic match outranks a body hit.
    const tokens = [
      ...tokenize(title), ...tokenize(title),
      ...tokenize(tags), ...tokenize(tags),
      ...tokenize(body),
    ];
    const tf = new Map();
    for (const token of tokens) tf.set(token, (tf.get(token) || 0) + 1);
    return { chunk, tf, length: tokens.length };
  });

  const df = new Map();
  for (const doc of docs) {
    for (const token of doc.tf.keys()) df.set(token, (df.get(token) || 0) + 1);
  }
  const avgLength = docs.reduce((sum, doc) => sum + doc.length, 0) / (docs.length || 1);
  return { docs, df, avgLength, size: docs.length };
}

const INDEX = buildIndex(DOC_CHUNKS);

/**
 * @param {string} query
 * @param {{limit?: number, locale?: string, minScore?: number}} [options]
 * @returns {Array<{id:string, category:string, title:string, body:string, score:number}>}
 */
function search(query, options = {}) {
  const limit = Math.max(1, Math.min(10, options.limit || 4));
  const tokens = tokenize(query);
  if (!tokens.length) return [];
  const isTr = String(options.locale || '').toLowerCase().startsWith('tr');

  const scored = INDEX.docs.map((doc) => {
    let score = 0;
    for (const token of tokens) {
      const tf = doc.tf.get(token);
      if (!tf) continue;
      const df = INDEX.df.get(token) || 0;
      const idf = Math.log(1 + (INDEX.size - df + 0.5) / (df + 0.5));
      const norm = tf * (K1 + 1) / (tf + K1 * (1 - B + B * (doc.length / INDEX.avgLength)));
      score += idf * norm;
    }
    return { doc, score };
  });

  const minScore = typeof options.minScore === 'number' ? options.minScore : 0.15;
  return scored
    .filter((entry) => entry.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ doc, score }) => ({
      id: doc.chunk.id,
      category: doc.chunk.category,
      title: isTr ? doc.chunk.titleTr : doc.chunk.titleEn,
      body: isTr ? doc.chunk.bodyTr : doc.chunk.bodyEn,
      score: Math.round(score * 1000) / 1000,
    }));
}

function extractiveAnswer(query, options = {}) {
  const isTr = String(options.locale || '').toLowerCase().startsWith('tr');
  const hits = search(query, { ...options, limit: options.limit || 3 });
  if (!hits.length) {
    return {
      answer: isTr
        ? 'Bu konuda yerel bilgi tabanında bir kayıt bulamadım. Soruyu farklı sözcüklerle deneyebilir veya Belgeler sayfasına bakabilirsiniz.'
        : 'I could not find this topic in the local knowledge base. Try different words or open the Documentation page.',
      citations: [],
      grounded: false,
    };
  }
  const answer = hits.map((hit, index) => `${hit.body} [${index + 1}]`).join('\n\n');
  return {
    answer,
    citations: hits.map((hit, index) => ({ index: index + 1, id: hit.id, title: hit.title })),
    grounded: true,
  };
}

function contextForPrompt(query, options = {}) {
  const hits = search(query, { ...options, limit: options.limit || 4 });
  if (!hits.length) return { text: '', citations: [] };
  const text = hits
    .map((hit, index) => `[${index + 1}] ${hit.title}\n${hit.body}`)
    .join('\n\n');
  return {
    text,
    citations: hits.map((hit, index) => ({ index: index + 1, id: hit.id, title: hit.title })),
  };
}

function stats() {
  const categories = new Map();
  for (const chunk of DOC_CHUNKS) {
    categories.set(chunk.category, (categories.get(chunk.category) || 0) + 1);
  }
  return {
    documents: DOC_CHUNKS.length,
    terms: INDEX.df.size,
    categories: Object.fromEntries(categories),
  };
}

module.exports = { search, extractiveAnswer, contextForPrompt, stats, tokenize, fold };
