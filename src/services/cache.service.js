
class CacheService {
  constructor(maxSize = 1000, ttl = 3600000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.accessOrder = new Map();
  }

  generateKey(prefix, ...args) {
    return `${prefix}:${JSON.stringify(args)}`;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      return null;
    }

    this.accessOrder.set(key, Date.now());
    return item.value;
  }

  set(key, value, customTTL = null) {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const ttl = customTTL || this.ttl;
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
    this.accessOrder.set(key, Date.now());
  }

  evictLRU() {
    if (this.accessOrder.size === 0) return;

    let lruKey = null;
    let lruTime = Infinity;

    for (const [key, time] of this.accessOrder.entries()) {
      if (time < lruTime) {
        lruTime = time;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.accessOrder.delete(lruKey);
    }
  }

  delete(key) {
    this.cache.delete(key);
    this.accessOrder.delete(key);
  }

  clear() {
    this.cache.clear();
    this.accessOrder.clear();
  }

  cacheQuery(question, documentId, result) {
    const key = this.generateKey('query', question, documentId);
    this.set(key, result, 1800000);
  }

  getCachedQuery(question, documentId) {
    const key = this.generateKey('query', question, documentId);
    return this.get(key);
  }

  cacheEmbedding(text, embedding) {
    const key = this.generateKey('embedding', text);
    this.set(key, embedding, 86400000);
  }

  getCachedEmbedding(text) {
    const key = this.generateKey('embedding', text);
    return this.get(key);
  }
}

const cacheService = new CacheService();

export default cacheService;

