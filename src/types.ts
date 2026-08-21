/**
 * 로깅 동작을 커스터마이징할 수 있는 로거 인터페이스입니다.
 */
export interface Logger {
    /**
     * 디버그 로그를 출력합니다.
     * @param message - 로그 메시지
     * @param args - 추가 인자
     */
    debug(message: string, ...args: any[]): void
    /**
     * 일반 정보 로그를 출력합니다.
     * @param message - 로그 메시지
     * @param args - 추가 인자
     */
    info(message: string, ...args: any[]): void
    /**
     * 경고 로그를 출력합니다.
     * @param message - 로그 메시지
     * @param args - 추가 인자
     */
    warn(message: string, ...args: any[]): void
    /**
     * 오류 로그를 출력합니다.
     * @param message - 로그 메시지
     * @param args - 추가 인자
     */
    error(message: string, ...args: any[]): void
}

/**
 * 응답 캐싱을 위한 커스텀 캐시 저장소 인터페이스입니다.
 */
export interface CacheStore {
    /**
     * 키에 해당하는 캐시 값을 조회합니다.
     * @param key - 캐시 키
     * @returns 캐시된 값 또는 undefined
     */
    get<T>(key: string): Promise<T | undefined> | T | undefined
    /**
     * 키와 값을 지정된 TTL(밀리초) 동안 캐시에 저장합니다.
     * @param key - 캐시 키
     * @param value - 저장할 값
     * @param ttlMs - 유효 시간 (밀리초)
     */
    set<T>(key: string, value: T, ttlMs?: number): Promise<void> | void
    /**
     * 특정 캐시 키를 삭제합니다.
     * @param key - 삭제할 캐시 키
     * @returns 삭제 성공 여부
     */
    delete(key: string): Promise<boolean> | boolean
    /**
     * 저장된 모든 캐시를 비웁니다.
     */
    clear(): Promise<void> | void
}

/**
 * HTTP 요청 인터셉터 컨텍스트입니다.
 */
export interface RequestInterceptorContext {
    /** 대상 요청 URL */
    url: string
    /** HTTP 메서드 */
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | string
    /** 요청 헤더 목록 */
    headers: Record<string, string>
    /** 쿼리 파라미터 */
    params?: Record<string, any>
    /** 요청 바디 (POST 등) */
    body?: any
}

/**
 * HTTP 응답 인터셉터 컨텍스트입니다.
 */
export interface ResponseInterceptorContext<T = any> {
    /** 요청 URL */
    url: string
    /** HTTP 응답 상태 코드 */
    status: number
    /** 응답 헤더 객체 */
    headers: Headers
    /** 파싱된 응답 데이터 */
    data: T
    /** 캐시로부터 반환되었는지 여부 */
    fromCache?: boolean
}

/**
 * 에러 발생 시 호출되는 인터셉터 컨텍스트입니다.
 */
export interface ErrorInterceptorContext {
    /** 요청 URL */
    url: string
    /** 발생한 에러 객체 */
    error: Error
    /** 재시도 시도 횟수 */
    attempt?: number
}

/**
 * 재시도 발생 시 호출되는 인터셉터 컨텍스트입니다.
 */
export interface RetryInterceptorContext {
    /** 요청 URL */
    url: string
    /** 직전 발생한 에러 객체 */
    error: Error
    /** 현재 재시도 회차 (1부터 시작) */
    attempt: number
    /** 다음 재시도까지 대기할 시간 (밀리초) */
    delayMs: number
}

/**
 * HTTP 요청 전 컨텍스트를 가공할 수 있는 인터셉터 함수 타입입니다.
 */
export type RequestInterceptor = (context: RequestInterceptorContext) => Promise<RequestInterceptorContext> | RequestInterceptorContext

/**
 * HTTP 응답 수신 후 데이터를 가공하거나 검사할 수 있는 인터셉터 함수 타입입니다.
 */
export type ResponseInterceptor = <T>(context: ResponseInterceptorContext<T>) => Promise<ResponseInterceptorContext<T>> | ResponseInterceptorContext<T>

/**
 * 요청 중 에러 발생 시 후처리할 수 있는 인터셉터 함수 타입입니다.
 */
export type ErrorInterceptor = (context: ErrorInterceptorContext) => Promise<void> | void

/**
 * 재시도 수행 전 로깅이나 처리를 수행할 수 있는 인터셉터 함수 타입입니다.
 */
export type RetryInterceptor = (context: RetryInterceptorContext) => Promise<void> | void

/**
 * 클라이언트에 등록 가능한 인터셉터 모음입니다.
 */
export interface Interceptors {
    /** 요청 인터셉터 목록 */
    request?: RequestInterceptor[]
    /** 응답 인터셉터 목록 */
    response?: ResponseInterceptor[]
    /** 에러 인터셉터 목록 */
    error?: ErrorInterceptor[]
    /** 재시도 인터셉터 목록 */
    retry?: RetryInterceptor[]
}

/**
 * 조아라 클라이언트 초기화 옵션입니다.
 */
export interface JoaraClientOptions {
    /** 조아라 API 베이스 URL (기본값: 'https://api.joara.com') */
    baseUrl?: string
    /** 조아라 인증 API 베이스 URL (기본값: 'https://api-auth.joara.com') */
    authUrl?: string
    /** 클라이언트 API 키 */
    apiKey?: string
    /** 앱/API 버전 (기본값: '3.2.0') */
    version?: string
    /** 디바이스 종류 (기본값: 'mw') */
    device?: string
    /** 디바이스 토큰 (기본값: 'mw') */
    deviceToken?: string
    /** 고유 디바이스 UID (미지정 시 자동 생성) */
    deviceUid?: string
    /** 로그인 사용자 인증 토큰 */
    userToken?: string
    /** 요청에 사용할 User-Agent 헤더 */
    userAgent?: string
    /** 개별 요청 타임아웃 제한 시간 (밀리초, 기본값: 10000) */
    timeout?: number
    /** 요청 실패 시 최대 재시도 횟수 (기본값: 3) */
    maxRetries?: number
    /** 지수 백오프 재시도 기본 대기 시간 (밀리초, 기본값: 500) */
    retryBaseDelayMs?: number
    /** 지수 백오프 재시도 최대 대기 시간 (밀리초, 기본값: 10000) */
    retryMaxDelayMs?: number
    /** 캐시 사용 여부 (true인 경우 기본 MemoryTtlCache 사용) 또는 커스텀 CacheStore */
    cache?: boolean | CacheStore
    /** 기본 캐시 유지 시간 (밀리초, 기본값: 60000) */
    cacheTtlMs?: number
    /** 디버그 및 정보 출력을 위한 커스텀 로거 */
    logger?: Logger
    /** 요청/응답/에러 인터셉터 모음 */
    interceptors?: Interceptors
    /** 커스텀 fetch 함수 */
    fetch?: typeof fetch
    /** 모든 요청에 적용할 기본 HTTP 헤더 */
    headers?: Record<string, string>
}

/**
 * 개별 API 요청 단위로 전달하는 옵션입니다.
 */
export interface RequestOptions {
    /** 요청 타임아웃 제한 시간 (밀리초) */
    timeout?: number
    /** 취소 제어를 위한 AbortSignal */
    signal?: AbortSignal
    /** 최대 재시도 횟수 오버라이드 */
    maxRetries?: number
    /** 캐시 조회를 건너뛰고 네트워크 요청 강제 여부 */
    skipCache?: boolean
    /** 이 요청의 응답 캐시 유지 시간 (밀리초) */
    cacheTtlMs?: number
    /** 추가 HTTP 헤더 */
    headers?: Record<string, string>
}

/**
 * 페이징 처리를 위한 공통 파라미터 옵션입니다.
 */
export interface PaginationOptions {
    /** 페이지 번호 (1부터 시작, 기본값: 1) */
    page?: number
    /** 한 페이지당 가져올 항목 수 (기본값: 20) */
    offset?: number
    /** 스트리밍 시 최대로 가져올 페이지 수 */
    maxPages?: number
}

/**
 * 조아라 세션 및 디바이스 식별 정보입니다.
 */
export interface JoaraSession {
    /** API 키 */
    apiKey: string
    /** 생성된 디바이스 고유 UID */
    deviceUid: string
    /** 디바이스 토큰 */
    deviceToken: string
    /** 디바이스 구분 */
    device: string
    /** API 버전 */
    version: string
    /** 로그인 사용자 토큰 (로그인 시) */
    userToken?: string
    /** 로그인 여부 */
    isLoggedIn: boolean
    /** 세션 발급/초기화 시각 (ISO 문자열) */
    issuedAt: string
}

/**
 * 베스트 웹소설 조회 파라미터입니다.
 */
export interface BestBooksParams extends PaginationOptions {
    /** 카테고리 코드 (기본값: '1' - 로맨스/판타지 등 조아라 카테고리) */
    category?: string
    /** 세부 카테고리 코드 (기본값: '0') */
    subcategory?: string
}

/**
 * 도서 검색 파라미터입니다.
 */
export interface SearchParams extends PaginationOptions {
    /** 검색 키워드 */
    query: string
    /** 검색 대상 필드 ('all' | 'subject' | 'member_name' | 'keyword' | 'intro') */
    target?: 'all' | 'subject' | 'member_name' | 'keyword' | 'intro' | string
    /** 카테고리 필터 */
    category?: string
    /** 정렬 기준 ('cnt_pageview' | 'cnt_recom' | 'date') */
    orderby?: 'cnt_pageview' | 'cnt_recom' | 'date' | string
    /** 완결 여부 필터 ('Y' | 'N') */
    chk_finish?: 'Y' | 'N'
    /** 대상 개수 포함 여부 */
    with_target_count?: number
    /** 대체 일치 검색 활성화 여부 */
    enable_fallback_match?: string
}

/**
 * 조아라 웹소설 기본 정보 모델입니다.
 */
export interface JoaraBook {
    /** 작품 코드 */
    book_code: string | number
    /** 작품 제목 */
    subject: string
    /** 작품 소개글 */
    intro: string
    /** 작가 아이디 */
    writer_id: string
    /** 작가명 (필명) */
    writer_name: string
    /** 작가 등급 */
    writer_level?: string
    /** 작품 표지 이미지 URL */
    book_img?: string
    /** 완결 여부 ('TRUE' | 'FALSE' 등) */
    chk_finish?: string
    /** 연령 등급 / 등급 분류 */
    chk_rate?: string
    /** 메인 카테고리 */
    category?: string
    /** 세부 카테고리 */
    sub_category?: string
    /** 총 화수 */
    cnt_chapter?: number | string
    /** 총 조회수 */
    cnt_pageview?: number | string
    /** 총 추천수 */
    cnt_recom?: number | string
    /** 선작(선호작품) 수 */
    cnt_favorite?: number | string
    [key: string]: any
}

/**
 * 조아라 검색 결과 항목 모델입니다.
 */
export interface SearchBookItem {
    /** 작품 코드 */
    book_code: number | string
    /** 작품 제목 */
    subject: string
    /** 작가명 */
    member_name: string
    /** 표지 이미지 URL */
    cover?: string
    /** 완결 여부 */
    chkfinish?: boolean
    /** 성인물 여부 */
    chkadult?: boolean
    /** 스토어 구분 */
    store?: string
    /** 카테고리 코드 */
    category_code?: number
    /** 카테고리명 */
    category_name?: string
    /** 작품 소개글 */
    introduce?: string
    /** 총 편수 */
    total_chapter_count?: number
    /** 최초 등록 일시 */
    first_regist_datetime?: string
    /** 최근 수정/등록 일시 */
    last_regist_datetime?: string
    [key: string]: any
}

/**
 * 조아라 작품 회차 정보 모델입니다.
 */
export interface ChapterItem {
    /** 챕터 고유 ID (cid) */
    cid: string | number
    /** 챕터 번호 (회차 번호) */
    chapter: number
    /** 회차 제목 */
    subject: string
    /** 회차 생성 일시 */
    created_datetime?: string
    /** 파일 크기 */
    filesize?: number
    /** 가격/딱지 */
    price?: number
    /** 무료 회차 여부 */
    is_free?: boolean
    [key: string]: any
}

/**
 * 조아라 API의 표준 응답 래퍼 인터페이스입니다.
 */
export interface JoaraApiResponse<T = any> {
    /** 성공/실패 상태 코드 또는 불리언 */
    status: number | boolean
    /** 응답 메시지 */
    message?: string
    /** 에러 코드 (실패 시) */
    error_code?: number
    /** 도서 목록 응답 */
    books?: T[]
    /** 단일 도서 상세 응답 */
    book?: T
    /** 챕터/회차 목록 응답 */
    chapter?: ChapterItem[]
    /** 검색 및 추가 메타데이터 */
    data?: {
        list?: SearchBookItem[]
        keyword_cnt?: Record<string, number>
        [key: string]: any
    }
    /** 전체 항목 수 */
    total_cnt?: string | number
    [key: string]: any
}
