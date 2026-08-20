import { MemoryTtlCache } from '../src/cache.js'

describe('MemoryTtlCache 단위 테스트', () => {
    test('캐시 저장 및 조회 기본 동작', () => {
        const cache = new MemoryTtlCache({ defaultTtlMs: 1000 })
        cache.set('key1', { data: 'test' })

        expect(cache.get('key1')).toEqual({ data: 'test' })
        expect(cache.get('key2')).toBeUndefined()
    })

    test('TTL 만료 시 캐시 무효화', async () => {
        const cache = new MemoryTtlCache({ defaultTtlMs: 50 })
        cache.set('key1', 'temp_value', 50)

        expect(cache.get('key1')).toBe('temp_value')

        await new Promise(resolve => setTimeout(resolve, 70))
        expect(cache.get('key1')).toBeUndefined()
    })

    test('최대 항목 수(maxEntries) 초과 시 FIFO 방출', () => {
        const cache = new MemoryTtlCache({ maxEntries: 2, defaultTtlMs: 10000 })
        cache.set('a', 1)
        cache.set('b', 2)
        cache.set('c', 3)

        expect(cache.get('a')).toBeUndefined()
        expect(cache.get('b')).toBe(2)
        expect(cache.get('c')).toBe(3)
        expect(cache.size).toBe(2)
    })

    test('캐시 삭제 및 초기화(clear)', () => {
        const cache = new MemoryTtlCache()
        cache.set('x', 10)
        cache.set('y', 20)

        expect(cache.delete('x')).toBe(true)
        expect(cache.get('x')).toBeUndefined()

        cache.clear()
        expect(cache.size).toBe(0)
    })
})
