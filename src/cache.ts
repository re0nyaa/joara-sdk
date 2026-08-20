import { CacheStore } from './types.js'

interface CacheEntry<T> {
    value: T
    expiresAt: number
}

export interface MemoryTtlCacheOptions {
    defaultTtlMs?: number
    maxEntries?: number
}

export class MemoryTtlCache implements CacheStore {
    private store: Map<string, CacheEntry<any>>
    private defaultTtlMs: number
    private maxEntries: number

    constructor(options?: MemoryTtlCacheOptions) {
        this.store = new Map()
        this.defaultTtlMs = options?.defaultTtlMs ?? 60 * 1000
        this.maxEntries = options?.maxEntries ?? 500
    }

    get<T>(key: string): T | undefined {
        const entry = this.store.get(key)
        if (!entry) {
            return undefined
        }

        if (Date.now() > entry.expiresAt) {
            this.store.delete(key)
            return undefined
        }

        return entry.value as T
    }

    set<T>(key: string, value: T, ttlMs?: number): void {
        const ttl = ttlMs ?? this.defaultTtlMs
        const expiresAt = Date.now() + ttl

        if (this.store.size >= this.maxEntries && !this.store.has(key)) {
            const firstKey = this.store.keys().next().value
            if (firstKey) {
                this.store.delete(firstKey)
            }
        }

        this.store.set(key, { value, expiresAt })
    }

    delete(key: string): boolean {
        return this.store.delete(key)
    }

    clear(): void {
        this.store.clear()
    }

    get size(): number {
        this.cleanupExpired()
        return this.store.size
    }

    private cleanupExpired(): void {
        const now = Date.now()
        for (const [key, entry] of this.store.entries()) {
            if (now > entry.expiresAt) {
                this.store.delete(key)
            }
        }
    }
}
