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

    private generateDeviceUid(): string {
        const raw = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}_${process.pid || 1000}`
        return crypto.createHash('md5').update(raw).digest('hex')
    }

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

    setUserToken(token?: string): this {
        this.userToken = token
        return this
    }

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

    private normalizeCacheKey(url: string, params?: Record<string, any>, body?: Record<string, any>): string {
        const pStr = params ? JSON.stringify(Object.keys(params).sort().reduce((acc: any, k) => { acc[k] = params[k]; return acc }, {})) : ''
        const bStr = body ? JSON.stringify(Object.keys(body).sort().reduce((acc: any, k) => { acc[k] = body[k]; return acc }, {})) : ''
        return `${url}?p=${pStr}&b=${bStr}`
    }

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

    async get<T = any>(endpoint: string, params: Record<string, any> = {}, options?: RequestOptions): Promise<JoaraApiResponse<T>> {
        return this.request<T>(endpoint, 'GET', params, options)
    }

    async post<T = any>(endpoint: string, body: Record<string, any> = {}, options?: RequestOptions): Promise<JoaraApiResponse<T>> {
        return this.request<T>(endpoint, 'POST', body, options)
    }

    async getAppInfo(options?: RequestOptions) {
        return this.get('/api/info/index_v2', { device_type: this.device }, options)
    }

    async getBestBooks(params: BestBooksParams = {}, options?: RequestOptions): Promise<JoaraApiResponse<JoaraBook>> {
        return this.get<JoaraBook>('/v1/best/book.joa', {
            category: params.category || '1',
            subcategory: params.subcategory || '0',
            page: params.page || 1,
            offset: params.offset || 20
        }, options)
    }

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

    async getBookDetail(bookCode: string | number, options?: RequestOptions) {
        if (!bookCode) {
            throw new JoaraValidationError('작품 코드(bookCode)는 필수 값입니다.', 'bookCode')
        }
        return this.get('/v1/book/detail.joa', { book_code: String(bookCode) }, options)
    }

    async getBookChapters(bookCode: string | number, page: number = 1, options?: RequestOptions) {
        if (!bookCode) {
            throw new JoaraValidationError('작품 코드(bookCode)는 필수 값입니다.', 'bookCode')
        }
        return this.get('/v1/book/chapter.joa', {
            book_code: String(bookCode),
            page
        }, options)
    }

    async getNoticeList(page: number = 1, options?: RequestOptions) {
        return this.get('/v1/board/notice_list.joa', { page }, options)
    }
}

export default JoaraClient
