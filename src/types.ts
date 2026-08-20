export interface Logger {
    debug(message: string, ...args: any[]): void
    info(message: string, ...args: any[]): void
    warn(message: string, ...args: any[]): void
    error(message: string, ...args: any[]): void
}

export interface CacheStore {
    get<T>(key: string): Promise<T | undefined> | T | undefined
    set<T>(key: string, value: T, ttlMs?: number): Promise<void> | void
    delete(key: string): Promise<boolean> | boolean
    clear(): Promise<void> | void
}

export interface RequestInterceptorContext {
    url: string
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | string
    headers: Record<string, string>
    params?: Record<string, any>
    body?: any
}


export interface ResponseInterceptorContext<T = any> {
    url: string
    status: number
    headers: Headers
    data: T
    fromCache?: boolean
}

export interface ErrorInterceptorContext {
    url: string
    error: Error
    attempt?: number
}

export interface RetryInterceptorContext {
    url: string
    error: Error
    attempt: number
    delayMs: number
}

export type RequestInterceptor = (context: RequestInterceptorContext) => Promise<RequestInterceptorContext> | RequestInterceptorContext
export type ResponseInterceptor = <T>(context: ResponseInterceptorContext<T>) => Promise<ResponseInterceptorContext<T>> | ResponseInterceptorContext<T>
export type ErrorInterceptor = (context: ErrorInterceptorContext) => Promise<void> | void
export type RetryInterceptor = (context: RetryInterceptorContext) => Promise<void> | void

export interface Interceptors {
    request?: RequestInterceptor[]
    response?: ResponseInterceptor[]
    error?: ErrorInterceptor[]
    retry?: RetryInterceptor[]
}

export interface JoaraClientOptions {
    baseUrl?: string
    authUrl?: string
    apiKey?: string
    version?: string
    device?: string
    deviceToken?: string
    deviceUid?: string
    userToken?: string
    userAgent?: string
    timeout?: number
    maxRetries?: number
    retryBaseDelayMs?: number
    retryMaxDelayMs?: number
    cache?: boolean | CacheStore
    cacheTtlMs?: number
    logger?: Logger
    interceptors?: Interceptors
    fetch?: typeof fetch
    headers?: Record<string, string>
}

export interface RequestOptions {
    timeout?: number
    signal?: AbortSignal
    maxRetries?: number
    skipCache?: boolean
    cacheTtlMs?: number
    headers?: Record<string, string>
}

export interface PaginationOptions {
    page?: number
    offset?: number
    maxPages?: number
}

export interface JoaraSession {
    apiKey: string
    deviceUid: string
    deviceToken: string
    device: string
    version: string
    userToken?: string
    isLoggedIn: boolean
    issuedAt: string
}

export interface BestBooksParams extends PaginationOptions {
    category?: string
    subcategory?: string
}

export interface SearchParams extends PaginationOptions {
    query: string
    target?: 'all' | 'subject' | 'member_name' | 'keyword' | 'intro' | string
    category?: string
    orderby?: 'cnt_pageview' | 'cnt_recom' | 'date' | string
    chk_finish?: 'Y' | 'N'
    with_target_count?: number
    enable_fallback_match?: string
}

export interface JoaraBook {
    book_code: string | number
    subject: string
    intro: string
    writer_id: string
    writer_name: string
    writer_level?: string
    book_img?: string
    chk_finish?: string
    chk_rate?: string
    category?: string
    sub_category?: string
    cnt_chapter?: number | string
    cnt_pageview?: number | string
    cnt_recom?: number | string
    cnt_favorite?: number | string
    [key: string]: any
}

export interface SearchBookItem {
    book_code: number | string
    subject: string
    member_name: string
    cover?: string
    chkfinish?: boolean
    chkadult?: boolean
    store?: string
    category_code?: number
    category_name?: string
    introduce?: string
    total_chapter_count?: number
    first_regist_datetime?: string
    last_regist_datetime?: string
    [key: string]: any
}

export interface ChapterItem {
    cid: string | number
    chapter: number
    subject: string
    created_datetime?: string
    filesize?: number
    price?: number
    is_free?: boolean
    [key: string]: any
}

export interface JoaraApiResponse<T = any> {
    status: number | boolean
    message?: string
    error_code?: number
    books?: T[]
    book?: T
    chapter?: ChapterItem[]
    data?: {
        list?: SearchBookItem[]
        keyword_cnt?: Record<string, number>
        [key: string]: any
    }
    total_cnt?: string | number
    [key: string]: any
}
