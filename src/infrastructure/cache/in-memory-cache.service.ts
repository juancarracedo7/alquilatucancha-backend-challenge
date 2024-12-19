import { Injectable } from '@nestjs/common';

interface CacheEntry {
  data: any;
  timestamp: number;
}

@Injectable()
export class InMemoryCacheService {
  private cache = new Map<string, CacheEntry>();
  private ttl = 60 * 1000; // TTL de 1 minuto, ajusta según necesidad

  set(key: string, value: any) {
    this.cache.set(key, { data: value, timestamp: Date.now() });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }
    // Verificar TTL
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }
}
