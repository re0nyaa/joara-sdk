import { JoaraClient } from './client.js'
import {
    BestBooksParams,
    JoaraBook,
    JoaraClientOptions,
    JoaraSession,
    RequestOptions,
    SearchBookItem,
    SearchParams
} from './types.js'

/**
 * 조아라 웹소설 데이터 조회를 위한 고수준 파서 및 헬퍼 클래스입니다.
 * JoaraClient 인스턴스를 캡슐화하여 제목 기반 자동 검색 매칭, 데이터 가공 등의 편의 메서드를 제공합니다.
 *
 * @example
 * ```ts
 * const parser = new JoaraTokenParser({ cache: true })
 *
 * // 작품 제목으로 검색 및 상세 정보 바로 조회
 * const { book, detail } = await parser.getNovelByName('암살학교 천재교수')
 * console.log(detail.subject, detail.cnt_chapter)
 * ```
 */
export class JoaraTokenParser {
    private client: JoaraClient

    /**
     * @param options - 클라이언트 초기화 옵션
     */
    constructor(options?: JoaraClientOptions) {
        this.client = new JoaraClient(options)
    }

    /**
     * 현재 게스트 식별 토큰 및 세션 정보를 조회합니다.
     * @returns 세션 정보 객체
     */
    getSessionInfo(): JoaraSession {
        return this.client.getSession()
    }

    /**
     * 조아라 앱 버전 및 초기 설정 데이터를 조회합니다.
     * @param options - 요청 옵션
     * @returns 앱 메타데이터 응답
     */
    async fetchInitialData(options?: RequestOptions) {
        return this.client.getAppInfo(options)
    }

    /**
     * 특정 카테고리의 베스트 소설 목록을 조회합니다.
     *
     * @param category - 카테고리 코드 (기본값: '1' - 로맨스/판타지)
     * @param page - 페이지 번호 (기본값: 1)
     * @param options - 요청 옵션
     * @returns 베스트 소설 배열 (`JoaraBook[]`)
     */
    async fetchBestNovels(category: string = '1', page: number = 1, options?: RequestOptions): Promise<JoaraBook[]> {
        const res = await this.client.getBestBooks({ category, page }, options)
        return res.books || []
    }

    /**
     * 베스트 소설을 페이지 단위로 연속 수신하는 비동기 스트림입니다.
     *
     * @param params - 베스트 조회 파라미터
     * @param options - 요청 옵션
     * @returns 각 도서 객체의 비동기 이터레이터
     */
    bestNovelsStream(params: BestBooksParams = {}, options?: RequestOptions): AsyncIterableIterator<JoaraBook> {
        return this.client.bestBooksStream(params, options)
    }

    /**
     * 작품 코드를 이용해 소설의 상세 정보를 조회합니다.
     *
     * @param bookCode - 작품 코드 (숫자 또는 문자열)
     * @param options - 요청 옵션
     * @returns 작품 상세 정보 응답
     */
    async fetchNovelDetail(bookCode: string | number, options?: RequestOptions) {
        return this.client.getBookDetail(bookCode, options)
    }

    /**
     * 키워드로 소설 목록을 검색합니다.
     *
     * @param query - 검색 키워드
     * @param options - 검색 세부 옵션 (대상 필드, 카테고리, 정렬 기준 등)
     * @param reqOptions - 개별 요청 옵션
     * @returns 검색 결과 항목 배열 (`SearchBookItem[]`)
     */
    async search(query: string, options: Partial<SearchParams> = {}, reqOptions?: RequestOptions): Promise<SearchBookItem[]> {
        const res = await this.client.searchBooks({
            query,
            ...options
        }, reqOptions)
        return res.data?.list || []
    }

    /**
     * 검색 결과를 연속 수신하는 비동기 스트림입니다.
     *
     * @param params - 검색 파라미터
     * @param options - 요청 옵션
     * @returns 각 검색 결과 항목의 비동기 이터레이터
     */
    searchStream(params: SearchParams, options?: RequestOptions): AsyncIterableIterator<SearchBookItem> {
        return this.client.searchStream(params, options)
    }

    /**
     * 작품 제목(정확한 제목 또는 부분 일치)을 검색한 후, 가장 근접한 작품의 상세 정보를 자동으로 조회합니다.
     *
     * @param title - 찾고자 하는 작품 제목
     * @param options - 요청 옵션
     * @returns 검색된 도서 항목(`book`)과 상세 정보(`detail`) 객체 (결과 없을 시 둘 다 null)
     *
     * @example
     * ```ts
     * const { book, detail } = await parser.getNovelByName('마법명가 막내아들')
     * if (book && detail) {
     *     console.log(`작가: ${detail.writer_name}, 총화수: ${detail.cnt_chapter}`)
     * }
     * ```
     */
    async getNovelByName(
        title: string,
        options?: RequestOptions
    ): Promise<{ book: SearchBookItem | null, detail: any | null }> {
        const books = await this.search(title, { target: 'subject' }, options)
        if (!books || books.length === 0) {
            return { book: null, detail: null }
        }

        const cleanTitle = title.trim().toLowerCase()
        const matchedBook = books.find(b => b.subject.trim().toLowerCase() === cleanTitle) || books[0]

        const detailResponse = await this.client.getBookDetail(String(matchedBook.book_code), options)

        return {
            book: matchedBook,
            detail: detailResponse.book || detailResponse
        }
    }

    /**
     * 내부에서 사용 중인 `JoaraClient` 인스턴스를 가져옵니다.
     * @returns `JoaraClient` 인스턴스
     */
    getClient(): JoaraClient {
        return this.client
    }
}

export default JoaraTokenParser
