import { CacheStore } from './types.js'

/**
 * 캐시 저장소 내부의 개별 캐시 엔트리 구조입니다.
 */
interface CacheEntry<T> {
    value: T
    expiresAt: number
}

/**
 * MemoryTtlCache 인스턴스 초기화 옵션입니다.
 */
export interface MemoryTtlCacheOptions {
    /** 기본 캐시 만료 시간 (밀리초, 기본값: 60,000ms / 1분) */
    defaultTtlMs?: number
    /** 최대 보관 엔트리 개수 (기본값: 500개) */
    maxEntries?: number
}

/**
 * TTL(Time-To-Live) 기반의 기본 인메모리 캐시 저장소 구현체입니다.
 */
export class MemoryTtlCache implements CacheStore {
    private store: Map<string, CacheEntry<any>>
    private defaultTtlMs: number
    private maxEntries: number

    /**
     * @param options - 캐시 옵션 설정
     */
    constructor(options?: MemoryTtlCacheOptions) {
        this.store = new Map()
        this.defaultTtlMs = options?.defaultTtlMs ?? 60 * 1000
        this.maxEntries = options?.maxEntries ?? 500
    }

    /**
     * 캐시된 값을 가져옵니다. 만료된 경우 자동으로 삭제되고 undefined를 반환합니다.
     * @param key - 캐시 키
     * @returns 캐시된 데이터 또는 undefined
     */
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

    /**
     * 특정 키로 값을 캐시에 저장합니다.
     * 최대 엔트리 수를 초과할 경우 가장 오래된 항목(FIFO)을 제거합니다.
     * @param key - 캐시 키
     * @param value - 저장할 값
     * @param ttlMs - 유효 시간 (밀리초, 미지정 시 defaultTtlMs 사용)
     */
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

    /**
     * 특정 캐시 키를 삭제합니다.
     * @param key - 삭제할 캐시 키
     * @returns 삭제 성공 여부
     */
    delete(key: string): boolean {
        return this.store.delete(key)
    }

    /**
     * 캐시 내 모든 엔트리를 비웁니다.
     */
    clear(): void {
        this.store.clear()
    }

    /**
     * 현재 캐시에 보관 중인 유효 엔트리 수를 반환합니다. (만료된 엔트리 정리 포함)
     */
    get size(): number {
        this.cleanupExpired()
        return this.store.size
    }

    /**
     * 만료된 캐시 엔트리들을 일괄 정리합니다.
     */
    private cleanupExpired(): void {
        const now = Date.now()
        for (const [key, entry] of this.store.entries()) {
            if (now > entry.expiresAt) {
                this.store.delete(key)
            }
        }
    }
}
