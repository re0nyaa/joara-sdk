/**
 * 조아라 (Joara) TypeScript 엔터프라이즈 SDK
 *
 * @packageDocumentation
 */

export * from './types.js'
export * from './errors.js'
export * from './cache.js'
export * from './retry.js'
export * from './client.js'
export * from './parser.js'

import { JoaraClient } from './client.js'
import { JoaraTokenParser } from './parser.js'
import { JoaraBook, SearchBookItem } from './types.js'

/**
 * 기본 클라이언트 내보내기 (JoaraClient)
 */
export default JoaraClient

async function runEnterpriseDemo() {
    console.log('======================================================================')
    console.log('  조아라 (Joara) 엔터프라이즈 TypeScript SDK v1.0.0')
    console.log('  (Undici 커넥션 풀 / Full Jitter 재시도 / TTL 캐시 / 스트리밍)')
    console.log('======================================================================\n')

    // 1. 엔터프라이즈 클라이언트 초기화 (캐시 활성화, 재시도 3회, 타임아웃 8초 설정)
    const client = new JoaraClient({
        cache: true,
        cacheTtlMs: 30000,
        maxRetries: 3,
        timeout: 8000,
        interceptors: {
            request: [
                (ctx) => {
                    return ctx
                }
            ],
            response: [
                (ctx) => {
                    if (ctx.fromCache) {
                        console.log(`  ⚡ [인터셉터] 캐시에서 즉각 반환됨 (${ctx.url})`)
                    }
                    return ctx
                }
            ]
        }
    })

    const parser = new JoaraTokenParser({ cache: true })

    // 2. 비로그인 세션 정보
    const session = client.getSession()
    console.log('[1] 비로그인 자동 발급 세션 / 게스트 식별 토큰:')
    console.log(`  - API Key     : ${session.apiKey}`)
    console.log(`  - Device UID  : ${session.deviceUid} (자동 생성된 게스트 식별 토큰)`)
    console.log(`  - Device Token: ${session.deviceToken}`)
    console.log(`  - Platform    : ${session.device}`)
    console.log(`  - App Version : ${session.version}`)
    console.log(`  - 발급 시각   : ${session.issuedAt}\n`)

    // 3. 베스트 소설 조회 (1차: 네트워크 요청 -> 2차: 캐시 히트 테스트)
    console.log('[2] 베스트 웹소설 조회 및 캐시 성능 테스트...')
    const t0 = Date.now()
    const bestRes1 = await client.getBestBooks({ category: '1', page: 1 })
    const d0 = Date.now() - t0
    console.log(`  - 1회차 네트워크 호출 응답: ${bestRes1.books?.length || 0}개 수신 (${d0}ms)`)

    const t1 = Date.now()
    const bestRes2 = await client.getBestBooks({ category: '1', page: 1 })
    const d1 = Date.now() - t1
    console.log(`  - 2회차 캐시 호출 응답    : ${bestRes2.books?.length || 0}개 수신 (${d1}ms)\n`)

    // 4. 비동기 스트림 이터레이터 (AsyncIterableIterator) 테스트
    console.log('[3] 비동기 제너레이터 스트리밍 테스트 (bestBooksStream)...')
    let streamCount = 0
    for await (const book of client.bestBooksStream({ category: '1', offset: 5, maxPages: 2 })) {
        streamCount++
        console.log(`  [스트림 #${streamCount}] ${book.subject} (작가: ${book.writer_name}, 코드: ${book.book_code})`)
        if (streamCount >= 4) break
    }
    console.log('')

    // 5. 키워드 검색 (/v2/search/query)
    const searchKeyword = '천재'
    console.log(`[4] 키워드 검색 기능 테스트 (검색어: "${searchKeyword}")...`)
    const searchResults = await parser.search(searchKeyword)
    console.log(`  - 검색 결과: ${searchResults.length}개 발견\n`)
    searchResults.slice(0, 3).forEach((item: SearchBookItem, idx: number) => {
        console.log(`  [검색 ${idx + 1}] ${item.subject}`)
        console.log(`      작품코드 : ${item.book_code}`)
        console.log(`      작가     : ${item.member_name}`)
        console.log(`      카테고리 : ${item.category_name || '-'}`)
        console.log(`      총 편수  : ${item.total_chapter_count || '-'}편`)
        console.log('')
    })

    // 6. 작품 이름 기반 자동 매칭 상세 정보 조회
    const targetTitle = '암살학교 천재교수'
    console.log(`[5] 작품 이름 기반 상세 정보 조회 (작품명: "${targetTitle}")...`)
    const { book, detail } = await parser.getNovelByName(targetTitle)
    if (book && detail) {
        console.log('  [조회 성공]')
        console.log(`  - 작품 제목    : ${detail.subject || book.subject}`)
        console.log(`  - 작품 코드    : ${detail.book_code || book.book_code}`)
        console.log(`  - 작가         : ${detail.writer_name || book.member_name} (${detail.writer_id || '-'})`)
        console.log(`  - 카테고리     : ${detail.category_name || book.category_name || '-'}`)
        console.log(`  - 총 편수      : ${detail.cnt_chapter || book.total_chapter_count || '-'}편`)
        console.log(`  - 완결 여부    : ${detail.chk_finish === 'TRUE' || book.chkfinish ? '완결' : '연재중'}`)
        console.log(`  - 작품 소개    :\n      ${(detail.intro || book.introduce || '').replace(/\r?\n/g, '\n      ')}`)
    }

    console.log('\n======================================================================')
    console.log('  엔터프라이즈 SDK 파싱 및 테스트 완료!')
    console.log('======================================================================')
}

// 직접 실행된 경우 데모 실행
if (process.argv[1] && (process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js'))) {
    runEnterpriseDemo().catch((err) => {
        console.error('실행 중 오류 발생:', err)
    })
}
