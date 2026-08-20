import { jest } from '@jest/globals'
import { JoaraTokenParser } from '../src/parser.js'

describe('JoaraTokenParser 단위 테스트', () => {
    test('파서 인스턴스 생성 및 세션 정보 획득', () => {
        const parser = new JoaraTokenParser()
        const session = parser.getSessionInfo()

        expect(session.apiKey).toBe('mw_8ba234e7801ba288554ca07ae44c7')
        expect(session.deviceUid).toBeDefined()
    })

    test('getNovelByName 검색 결과 매칭 로직 검증 (Mock)', async () => {
        const mockSearchData = {
            status: 1,
            data: {
                list: [
                    { book_code: 1001, subject: '전지적 독자 시점', member_name: '싱숑' },
                    { book_code: 1002, subject: '전지적 작가 시점', member_name: '작가B' }
                ]
            }
        }

        const mockDetailData = {
            status: 1,
            book: {
                book_code: '1001',
                subject: '전지적 독자 시점',
                writer_name: '싱숑',
                cnt_chapter: 551,
                intro: '오직 나만이, 이 세계의 결말을 알고 있다.'
            }
        }

        const mockFetch = jest.fn<any>().mockImplementation(async (url: any) => {
            const urlStr = String(url)
            if (urlStr.includes('/v2/search/query')) {
                return {
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    headers: new Headers(),
                    text: async () => JSON.stringify(mockSearchData)
                }
            }
            if (urlStr.includes('/v1/book/detail.joa')) {
                return {
                    ok: true,
                    status: 200,
                    statusText: 'OK',
                    headers: new Headers(),
                    text: async () => JSON.stringify(mockDetailData)
                }
            }
            return {
                ok: false,
                status: 404,
                headers: new Headers(),
                text: async () => '{}'
            }
        })


        const parser = new JoaraTokenParser({
            fetch: mockFetch as unknown as typeof fetch
        })

        const { book, detail } = await parser.getNovelByName('전지적 독자 시점')

        expect(book).toBeDefined()
        expect(book?.book_code).toBe(1001)
        expect(detail).toBeDefined()
        expect(detail.subject).toBe('전지적 독자 시점')
        expect(detail.writer_name).toBe('싱숑')
        expect(detail.cnt_chapter).toBe(551)
    })
})
