# joara-sdk

조아라(joara.com) 비공식 TypeScript API 클라이언트입니다. 별도의 브라우저/UI 없이 비로그인 게스트 토큰을 자동 발급받아 작품 검색, 베스트 랭킹, 상세 정보 등을 조회할 수 있습니다.

## 설치

```bash
pnpm add joara-sdk
# or
npm install joara-sdk
```

## 사용법

### 1. 기본 파서 (`JoaraTokenParser`)

```typescript
import { JoaraTokenParser } from "joara-sdk"

const parser = new JoaraTokenParser()

// 작품 검색
const searchResults = await parser.search("마법사")

// 작품 이름으로 상세 정보 조회
const { book, detail } = await parser.getNovelByName("암살학교 천재교수")
console.log(detail.subject) // 작품 제목
console.log(detail.writer_name) // 작가명
console.log(detail.cnt_chapter) // 총 편수
console.log(detail.intro) // 줄거리
```

### 2. API 클라이언트 (`JoaraClient`)

```typescript
import { JoaraClient } from "joara-sdk"

const client = new JoaraClient({
    cache: true, // 인메모리 TTL 캐시 활성화 (기본 60초)
    maxRetries: 3, // 실패 시 자동 재시도
    timeout: 10000, // 10초 타임아웃
})

// 베스트 소설 목록 조회
const best = await client.getBestBooks({ category: "1", page: 1 })

// 대량 데이터 비동기 스트리밍 순회
for await (const book of client.searchStream({ query: "회귀", maxPages: 3 })) {
    console.log(book.subject, book.member_name)
}

// 작품 상세 정보 및 회차 목록
const detail = await client.getBookDetail("1879444")
const chapters = await client.getBookChapters("1879444", 1)
```

## 옵션 (`JoaraClientOptions`)

| 옵션           | 타입                    | 기본값      | 설명                              |
| :------------- | :---------------------- | :---------- | :-------------------------------- |
| `timeout`      | `number`                | `10000`     | 요청 타임아웃 (ms)                |
| `maxRetries`   | `number`                | `3`         | 지수 백오프 기반 최대 재시도 횟수 |
| `cache`        | `boolean \| CacheStore` | `false`     | 인메모리 캐시 사용 여부           |
| `cacheTtlMs`   | `number`                | `60000`     | 캐시 유지 시간 (ms)               |
| `userToken`    | `string`                | `undefined` | 회원 로그인 토큰 (선택)           |
| `logger`       | `Logger`                | `undefined` | 커스텀 로거                       |
| `interceptors` | `Interceptors`          | `{}`        | 요청/응답/에러/재시도 인터셉터    |

## 라이선스

MIT
