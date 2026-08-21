import crypto from 'crypto'
import { fetch as undiciFetch } from 'undici'
import { MemoryTtlCache } from './cache.js'
import {
    JoaraApiError,
    JoaraError,
    JoaraNetworkError,
    JoaraRateLimitError,
    JoaraTimeoutError,
    JoaraValidationError
} from './errors.js'
import { withRetry } from './retry.js'
import {
    BestBooksParams,
    CacheStore,
    Interceptors,
    JoaraApiResponse,
    JoaraBook,
    JoaraClientOptions,
    JoaraSession,
    Logger,
    PaginationOptions,
    RequestOptions,
    SearchBookItem,
    SearchParams
} from './types.js'

const DEFAULT_BASE_URL = 'https://api.joara.com'
const DEFAULT_AUTH_URL = 'https://api-auth.joara.com'
const DEFAULT_API_KEY = 'mw_8ba234e7801ba288554ca07ae44c7'
const DEFAULT_VERSION = '3.2.0'
const DEFAULT_DEVICE = 'mw'
const DEFAULT_DEVICE_TOKEN = 'mw'
const DEFAULT_TIMEOUT_MS = 10000
const DEFAULT_MAX_RETRIES = 3
const DEFAULT_RETRY_BASE_DELAY_MS = 500
const DEFAULT_RETRY_MAX_DELAY_MS = 10000
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

/**
 * 조아라(Joara) API와 통신하기 위한 고성능 엔터프라이즈 클라이언트입니다.
 * 커넥션 풀링(Undici), Full Jitter 지수 백오프 재시도, TTL 인메모리 캐싱, 비동기 제너레이터 스트리밍을 지원합니다.
 *
 * @example
 * ```ts
 * const client = new JoaraClient({
 *     cache: true,
 *     timeout: 8000,
 *     maxRetries: 3
 * })
 *
 * // 베스트 도서 목록 조회
 * const res = await client.getBestBooks({ category: '1' })
 * console.log(res.books)
 * ```
 */
export class JoaraClient {
    private readonly baseUrl: string
    private readonly authUrl: string
    private readonly apiKey: string
    private readonly version: string
    private readonly device: string
    private readonly deviceToken: string
    private readonly deviceUid: string
    private readonly userAgent: string
    private userToken?: string
    private readonly timeoutMs: number
    private readonly maxRetries: number
    private readonly retryBaseDelayMs: number
    private readonly retryMaxDelayMs: number
    private readonly defaultHeaders: Record<string, string>
    private readonly customFetch: typeof fetch
    private readonly cacheStore?: CacheStore
    private readonly cacheTtlMs: number
    private readonly logger?: Logger
    private readonly interceptors: Interceptors

    /**
     * @param baseUrlOrOptions - 베이스 URL 문자열 또는 클라이언트 옵션 객체
     */
    constructor(baseUrlOrOptions?: string | JoaraClientOptions) {
        if (typeof baseUrlOrOptions === 'string') {
            this.baseUrl = baseUrlOrOptions
            this.authUrl = DEFAULT_AUTH_URL
            this.apiKey = DEFAULT_API_KEY
            this.version = DEFAULT_VERSION
            this.device = DEFAULT_DEVICE
            this.deviceToken = DEFAULT_DEVICE_TOKEN
            this.deviceUid = this.generateDeviceUid()
            this.userAgent = DEFAULT_USER_AGENT
            this.timeoutMs = DEFAULT_TIMEOUT_MS
            this.maxRetries = DEFAULT_MAX_RETRIES
            this.retryBaseDelayMs = DEFAULT_RETRY_BASE_DELAY_MS
            this.retryMaxDelayMs = DEFAULT_RETRY_MAX_DELAY_MS
            this.defaultHeaders = {}
            this.customFetch = (undiciFetch as unknown as typeof fetch) || globalThis.fetch
            this.cacheTtlMs = 60000
            this.interceptors = {}
        } else {
            const options = baseUrlOrOptions ?? {}
            this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL
            this.authUrl = options.authUrl ?? DEFAULT_AUTH_URL
            this.apiKey = options.apiKey ?? DEFAULT_API_KEY
            this.version = options.version ?? DEFAULT_VERSION
            this.device = options.device ?? DEFAULT_DEVICE
            this.deviceToken = options.deviceToken ?? DEFAULT_DEVICE_TOKEN
            this.deviceUid = options.deviceUid ?? this.generateDeviceUid()
            this.userToken = options.userToken
            this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT
            this.timeoutMs = options.timeout ?? DEFAULT_TIMEOUT_MS
            this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
            this.retryBaseDelayMs = options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS
            this.retryMaxDelayMs = options.retryMaxDelayMs ?? DEFAULT_RETRY_MAX_DELAY_MS
            this.defaultHeaders = { ...options.headers }
            this.customFetch = (options.fetch ?? undiciFetch) as unknown as typeof fetch
            this.cacheTtlMs = options.cacheTtlMs ?? 60000
            this.logger = options.logger
            this.interceptors = options.interceptors ?? {}

            if (options.cache === true) {
                this.cacheStore = new MemoryTtlCache({
                    defaultTtlMs: this.cacheTtlMs
                })
            } else if (typeof options.cache === 'object') {
                this.cacheStore = options.cache
            }
        }
    }

    /**
     * 게스트 식별용 고유 디바이스 UID (MD5 해시)를 생성합니다.
     * @returns 고유 디바이스 UID 문자열
     */
    private generateDeviceUid(): string {
        const raw = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}_${process.pid || 1000}`
        return crypto.createHash('md5').update(raw).digest('hex')
    }

    /**
     * 현재 클라이언트의 세션 및 디바이스 식별 정보를 반환합니다.
     * @returns 세션 정보 객체
     */
    getSession(): JoaraSession {
        return {
            apiKey: this.apiKey,
            deviceUid: this.deviceUid,
            deviceToken: this.deviceToken,
            device: this.device,
            version: this.version,
            userToken: this.userToken,
            isLoggedIn: !!this.userToken,
            issuedAt: new Date().toISOString()
        }
    }

    /**
     * 조아라 로그인 사용자 인증 토큰을 설정합니다.
     * @param token - 사용자 토큰 (생략 시 로그아웃 상태)
     * @returns 클라이언트 인스턴스 (메서드 체이닝 가능)
     */
    setUserToken(token?: string): this {
        this.userToken = token
        return this
    }

    /**
     * 모든 요청에 공통으로 첨부되는 기본 파라미터 맵을 구성합니다.
     * @returns 기본 쿼리/바디 파라미터 객체
     */
    private getBaseParams(): Record<string, string> {
        const params: Record<string, string> = {
            api_key: this.apiKey,
            ver: this.version,
            device: this.device,
            deviceuid: this.deviceUid,
            devicetoken: this.deviceToken
        }
        if (this.userToken) {
            params.token = this.userToken
        }
        return params
    }

    /**
     * 캐시 키 생성을 위해 URL과 파라미터를 표준화합니다.
     * @param url - 대상 URL
     * @param params - 쿼리 파라미터
     * @param body - 요청 바디 파라미터
     * @returns 표준화된 캐시 키 문자열
     */
    private normalizeCacheKey(url: string, params?: Record<string, any>, body?: Record<string, any>): string {
        const pStr = params ? JSON.stringify(Object.keys(params).sort().reduce((acc: any, k) => { acc[k] = params[k]; return acc }, {})) : ''
        const bStr = body ? JSON.stringify(Object.keys(body).sort().reduce((acc: any, k) => { acc[k] = body[k]; return acc }, {})) : ''
        return `${url}?p=${pStr}&b=${bStr}`
    }

    /**
     * 조아라 API 엔드포인트로 HTTP 요청을 전송합니다.
     * 캐시 조회, 인터셉터 파이프라인, 타임아웃 처리, Full Jitter 재시도 로직이 통합 적용됩니다.
     *
     * @param endpoint - API 엔드포인트 경로 (예: '/v1/best/book.joa')
     * @param method - HTTP 메서드 ('GET' | 'POST' | 'PUT' | 'DELETE')
     * @param paramsOrBody - GET 요청의 경우 쿼리 파라미터, 그 외의 경우 요청 바디 파라미터
     * @param options - 요청 단위 추가 옵션 (타임아웃, 재시도, 캐시 건너뛰기 등)
     * @returns 파싱된 API 응답 데이터
     * @throws {JoaraTimeoutError} 요청 제한 시간을 초과한 경우
     * @throws {JoaraRateLimitError} 429 Too Many Requests 응답을 받은 경우
     * @throws {JoaraApiError} 조아라 API 서버 오류 또는 비정상 응답인 경우
     * @throws {JoaraNetworkError} 네트워크 연결 실패인 경우
     */
    async request<T = any>(
        endpoint: string,
        method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
        paramsOrBody: Record<string, any> = {},
        options: RequestOptions = {}
    ): Promise<JoaraApiResponse<T>> {
        const mergedParams = { ...this.getBaseParams(), ...paramsOrBody }
        const baseUrl = endpoint.startsWith('http') ? '' : this.baseUrl
        let targetUrl = `${baseUrl}${endpoint.startsWith('/') || endpoint.startsWith('http') ? endpoint : `/${endpoint}`}`

        let reqHeaders: Record<string, string> = {
            'User-Agent': this.userAgent,
            'Accept': 'application/json, text/plain, */*',
            'Referer': 'https://www.joara.com/',
            'Origin': 'https://www.joara.com',
            ...this.defaultHeaders,
            ...options.headers
        }

        let queryParams: Record<string, any> | undefined = undefined
        let requestBody: any = undefined

        if (method === 'GET') {
            queryParams = mergedParams
            const searchParams = new URLSearchParams()
            for (const [key, val] of Object.entries(mergedParams)) {
                if (val !== undefined && val !== null) {
                    searchParams.append(key, String(val))
                }
            }
            const queryStr = searchParams.toString()
            if (queryStr) {
                targetUrl += `${targetUrl.includes('?') ? '&' : '?'}${queryStr}`
            }
        } else {
            reqHeaders['Content-Type'] = 'application/x-www-form-urlencoded'
            const formData = new URLSearchParams()
            for (const [key, val] of Object.entries(mergedParams)) {
                if (val !== undefined && val !== null) {
                    formData.append(key, String(val))
                }
            }
            requestBody = formData.toString()
        }

        const cacheKey = this.normalizeCacheKey(targetUrl, queryParams, method !== 'GET' ? mergedParams : undefined)

        if (method === 'GET' && !options.skipCache && this.cacheStore) {
            const cached = await this.cacheStore.get<JoaraApiResponse<T>>(cacheKey)
            if (cached) {
                this.logger?.debug(`[캐시 히트] ${targetUrl}`)
                if (this.interceptors.response) {
                    for (const interceptor of this.interceptors.response) {
                        await interceptor({
                            url: targetUrl,
                            status: 200,
                            headers: new Headers(),
                            data: cached,
                            fromCache: true
                        })
                    }
                }
                return cached
            }
        }

        let context: {
            url: string
            method: 'GET' | 'POST' | 'PUT' | 'DELETE' | string
            headers: Record<string, string>
            params?: Record<string, any>
            body?: any
        } = {
            url: targetUrl,
            method,
            headers: reqHeaders,
            params: queryParams,
            body: requestBody
        }

        if (this.interceptors.request) {
            for (const interceptor of this.interceptors.request) {
                context = await interceptor(context)
            }
        }


        const maxRetries = options.maxRetries ?? this.maxRetries
        const timeoutMs = options.timeout ?? this.timeoutMs

        const executeRequest = async (): Promise<JoaraApiResponse<T>> => {
            const controller = new AbortController()
            let timeoutId: NodeJS.Timeout | undefined

            if (timeoutMs > 0) {
                timeoutId = setTimeout(() => {
                    controller.abort()
                }, timeoutMs)
            }

            const signal = options.signal
                ? AbortSignal.any
                    ? AbortSignal.any([options.signal, controller.signal])
                    : controller.signal
                : controller.signal

            try {
                this.logger?.debug(`[HTTP ${context.method}] ${context.url}`)
                const res = await this.customFetch(context.url, {
                    method: context.method,
                    headers: context.headers,
                    body: context.body,
                    signal
                })

                if (timeoutId) {
                    clearTimeout(timeoutId)
                }

                if (res.status === 429) {
                    const retryAfter = res.headers.get('retry-after')
                    const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined
                    throw new JoaraRateLimitError('Too Many Requests', retryAfterMs, context.url)
                }

                const text = await res.text()
                let data: any
                try {
                    data = JSON.parse(text)
                } catch {
                    data = text
                }

                if (!res.ok) {
                    throw new JoaraApiError(
                        `HTTP ${res.status} ${res.statusText}`,
                        res.status,
                        data?.error_code,
                        data,
                        context.url
                    )
                }

                if (data && typeof data === 'object') {
                    if (data.status === 0 || data.status === false) {
                        if (data.error_code || data.message) {
                            throw new JoaraApiError(
                                data.message || 'API 응답 오류',
                                res.status,
                                data.error_code,
                                data,
                                context.url
                            )
                        }
                    }
                }

                if (this.interceptors.response) {
                    for (const interceptor of this.interceptors.response) {
                        await interceptor({
                            url: context.url,
                            status: res.status,
                            headers: res.headers,
                            data,
                            fromCache: false
                        })
                    }
                }

                if (method === 'GET' && !options.skipCache && this.cacheStore) {
                    await this.cacheStore.set(cacheKey, data, options.cacheTtlMs ?? this.cacheTtlMs)
                }

                return data as JoaraApiResponse<T>
            } catch (err: any) {
                if (timeoutId) {
                    clearTimeout(timeoutId)
                }

                let finalError: Error
                if (err.name === 'AbortError' || controller.signal.aborted) {
                    finalError = new JoaraTimeoutError(`요청 시간 초과 (${timeoutMs}ms)`, timeoutMs, context.url)
                } else if (err instanceof JoaraError) {
                    finalError = err
                } else {
                    finalError = new JoaraNetworkError(err.message || '네트워크 통신 오류', err, context.url)
                }

                if (this.interceptors.error) {
                    for (const interceptor of this.interceptors.error) {
                        await interceptor({
                            url: context.url,
                            error: finalError
                        })
                    }
                }

                throw finalError
            }
        }

        return withRetry(executeRequest, {
            maxRetries,
            baseDelayMs: this.retryBaseDelayMs,
            maxDelayMs: this.retryMaxDelayMs,
            logger: this.logger,
            onRetry: this.interceptors.retry ? this.interceptors.retry[0] : undefined,
            url: context.url
        })
    }

    /**
     * GET 요청을 수행하는 헬퍼 메서드입니다.
     *
     * @param endpoint - API 엔드포인트 경로
     * @param params - 쿼리 파라미터
     * @param options - 요청 옵션
     * @returns API 응답 데이터
     */
    async get<T = any>(endpoint: string, params: Record<string, any> = {}, options?: RequestOptions): Promise<JoaraApiResponse<T>> {
        return this.request<T>(endpoint, 'GET', params, options)
    }

    /**
     * POST 요청을 수행하는 헬퍼 메서드입니다.
     *
     * @param endpoint - API 엔드포인트 경로
     * @param body - 요청 바디 파라미터
     * @param options - 요청 옵션
     * @returns API 응답 데이터
     */
    async post<T = any>(endpoint: string, body: Record<string, any> = {}, options?: RequestOptions): Promise<JoaraApiResponse<T>> {
        return this.request<T>(endpoint, 'POST', body, options)
    }

    /**
     * 조아라 앱 버전 및 서비스 기본 메타데이터 정보를 조회합니다.
     *
     * @param options - 요청 옵션
     * @returns 앱 메타데이터 응답
     */
    async getAppInfo(options?: RequestOptions) {
        return this.get('/api/info/index_v2', { device_type: this.device }, options)
    }

    /**
     * 베스트 웹소설 목록을 조회합니다.
     *
     * @param params - 카테고리, 페이징 등 조회 파라미터
     * @param options - 요청 옵션
     * @returns 베스트 도서 목록 응답 (res.books)
     *
     * @example
     * ```ts
     * const best = await client.getBestBooks({ category: '1', page: 1 })
     * console.log(best.books)
     * ```
     */
    async getBestBooks(params: BestBooksParams = {}, options?: RequestOptions): Promise<JoaraApiResponse<JoaraBook>> {
        return this.get<JoaraBook>('/v1/best/book.joa', {
            category: params.category || '1',
            subcategory: params.subcategory || '0',
            page: params.page || 1,
            offset: params.offset || 20
        }, options)
    }

    /**
     * 베스트 웹소설을 페이지 단위로 연속해서 받아오는 비동기 스트림(제너레이터)입니다.
     *
     * @param params - 카테고리, 시작 페이지, 최대 페이지 수 등 설정
     * @param options - 요청 옵션
     * @returns 각 도서(`JoaraBook`)의 비동기 이터레이터
     *
     * @example
     * ```ts
     * for await (const book of client.bestBooksStream({ category: '1', maxPages: 3 })) {
     *     console.log(book.subject, book.writer_name)
     * }
     * ```
     */
    async *bestBooksStream(params: BestBooksParams = {}, options?: RequestOptions): AsyncIterableIterator<JoaraBook> {
        let currentPage = params.page || 1
        const maxPages = params.maxPages || Number.MAX_SAFE_INTEGER
        let fetchedPages = 0

        while (fetchedPages < maxPages) {
            const res = await this.getBestBooks({ ...params, page: currentPage }, options)
            const books = res.books || []
            if (books.length === 0) {
                break
            }

            for (const book of books) {
                yield book
            }

            if (books.length < (params.offset || 20)) {
                break
            }

            currentPage++
            fetchedPages++
        }
    }

    /**
     * 키워드를 통해 조아라 작품 목록을 검색합니다.
     *
     * @param params - 검색 키워드 및 필터 파라미터 (`query` 필수)
     * @param options - 요청 옵션
     * @returns 검색 결과 응답 (res.data.list)
     * @throws {JoaraValidationError} `query`가 비어있거나 누락된 경우
     *
     * @example
     * ```ts
     * const results = await client.searchBooks({ query: '천재', orderby: 'cnt_recom' })
     * console.log(results.data?.list)
     * ```
     */
    async searchBooks(params: SearchParams, options?: RequestOptions): Promise<JoaraApiResponse<SearchBookItem>> {
        if (!params.query || !params.query.trim()) {
            throw new JoaraValidationError('검색 쿼리(query)는 필수 값입니다.', 'query')
        }

        return this.get<SearchBookItem>('/v2/search/query', {
            query: params.query,
            target: params.target || null,
            category: params.category || null,
            orderby: params.orderby || null,
            chk_finish: params.chk_finish || null,
            page: params.page || 1,
            offset: params.offset || 20,
            with_target_count: params.with_target_count ?? 1,
            enable_fallback_match: params.enable_fallback_match || 'false'
        }, options)
    }

    /**
     * 검색 결과를 페이지 단위로 연속해서 받아오는 비동기 스트림(제너레이터)입니다.
     *
     * @param params - 검색 키워드 및 페이징 설정
     * @param options - 요청 옵션
     * @returns 각 검색 결과 도서(`SearchBookItem`)의 비동기 이터레이터
     *
     * @example
     * ```ts
     * for await (const item of client.searchStream({ query: '회귀', maxPages: 2 })) {
     *     console.log(item.subject, item.book_code)
     * }
     * ```
     */
    async *searchStream(params: SearchParams, options?: RequestOptions): AsyncIterableIterator<SearchBookItem> {
        let currentPage = params.page || 1
        const maxPages = params.maxPages || Number.MAX_SAFE_INTEGER
        let fetchedPages = 0

        while (fetchedPages < maxPages) {
            const res = await this.searchBooks({ ...params, page: currentPage }, options)
            const items = res.data?.list || []
            if (items.length === 0) {
                break
            }

            for (const item of items) {
                yield item
            }

            if (items.length < (params.offset || 20)) {
                break
            }

            currentPage++
            fetchedPages++
        }
    }

    /**
     * 특정 작품의 상세 정보(소개글, 작가 정보, 추천수, 완결 여부 등)를 조회합니다.
     *
     * @param bookCode - 조아라 작품 코드 (숫자 또는 문자열)
     * @param options - 요청 옵션
     * @returns 작품 상세 정보 응답
     * @throws {JoaraValidationError} `bookCode`가 누락된 경우
     *
     * @example
     * ```ts
     * const detail = await client.getBookDetail('1234567')
     * console.log(detail.book)
     * ```
     */
    async getBookDetail(bookCode: string | number, options?: RequestOptions) {
        if (!bookCode) {
            throw new JoaraValidationError('작품 코드(bookCode)는 필수 값입니다.', 'bookCode')
        }
        return this.get('/v1/book/detail.joa', { book_code: String(bookCode) }, options)
    }

    /**
     * 특정 작품의 회차(챕터) 목록을 페이지 단위로 조회합니다.
     *
     * @param bookCode - 조아라 작품 코드
     * @param page - 회차 페이지 번호 (기본값: 1)
     * @param options - 요청 옵션
     * @returns 챕터 목록 응답
     * @throws {JoaraValidationError} `bookCode`가 누락된 경우
     */
    async getBookChapters(bookCode: string | number, page: number = 1, options?: RequestOptions) {
        if (!bookCode) {
            throw new JoaraValidationError('작품 코드(bookCode)는 필수 값입니다.', 'bookCode')
        }
        return this.get('/v1/book/chapter.joa', {
            book_code: String(bookCode),
            page
        }, options)
    }

    /**
     * 조아라 서비스 공지사항 목록을 조회합니다.
     *
     * @param page - 공지사항 페이지 번호 (기본값: 1)
     * @param options - 요청 옵션
     * @returns 공지사항 목록 응답
     */
    async getNoticeList(page: number = 1, options?: RequestOptions) {
        return this.get('/v1/board/notice_list.joa', { page }, options)
    }
}

export default JoaraClient
