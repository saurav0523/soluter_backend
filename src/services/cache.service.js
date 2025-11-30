// Simple in-memory cache for frequently accessed queries
// Can be replaced with Redis for production

class CacheService {
  constructor(maxSize = 1000, ttl = 3600000) { // 1 hour default TTL
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.accessOrder = new Map(); // For LRU eviction
  }

  generateKey(prefix, ...args) {
    return `${prefix}:${JSON.stringify(args)}`;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    // Check if expired
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      return null;
    }

    // Update access order for LRU
    this.accessOrder.set(key, Date.now());
    return item.value;
  }

  set(key, value, customTTL = null) {
    // Evict if cache is full (LRU)
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

    // Find least recently used
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

  // Cache query results
  cacheQuery(question, documentId, result) {
    const key = this.generateKey('query', question, documentId);
    this.set(key, result, 1800000); // 30 minutes for query results
  }

  getCachedQuery(question, documentId) {
    const key = this.generateKey('query', question, documentId);
    return this.get(key);
  }

  // Cache embeddings (longer TTL since they don't change)
  cacheEmbedding(text, embedding) {
    const key = this.generateKey('embedding', text);
    this.set(key, embedding, 86400000); // 24 hours
  }

  getCachedEmbedding(text) {
    const key = this.generateKey('embedding', text);
    return this.get(key);
  }
}

// Singleton instance
const cacheService = new CacheService();

export default cacheService;

