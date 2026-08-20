import { jest } from '@jest/globals'
import { JoaraClient } from "../src/client.js"
import { JoaraValidationError } from "../src/errors.js"

describe("JoaraClient 단위 테스트", () => {
    test("기본 설정 및 세션 토큰 자동 생성 확인", () => {
        const client = new JoaraClient()
        const session = client.getSession()

        expect(session.apiKey).toBe("mw_8ba234e7801ba288554ca07ae44c7")
        expect(session.device).toBe("mw")
        expect(session.version).toBe("3.2.0")
        expect(session.deviceUid).toBeDefined()
        expect(session.deviceUid.length).toBeGreaterThan(10)
        expect(session.isLoggedIn).toBe(false)
    })

    test("회원 로그인 토큰 주입 확인", () => {
        const client = new JoaraClient()
        client.setUserToken("sample_user_jwt_token")

        const session = client.getSession()
        expect(session.userToken).toBe("sample_user_jwt_token")
        expect(session.isLoggedIn).toBe(true)
    })

    test("유효성 검사 실패 시 JoaraValidationError 발생", async () => {
        const client = new JoaraClient()

        await expect(client.searchBooks({ query: "" })).rejects.toThrow(
            JoaraValidationError,
        )
        await expect(client.getBookDetail("")).rejects.toThrow(
            JoaraValidationError,
        )
    })

    test("Mock fetch를 통한 GET 요청 및 인터셉터 파이프라인 검증", async () => {
        let requestIntercepted = false
        let responseIntercepted = false

        const mockResponseData = {
            status: 1,
            books: [{ book_code: "12345", subject: "테스트 소설" }],
        }

        const mockFetch = jest.fn<any>().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: "OK",
            headers: new Headers({ "content-type": "application/json" }),
            text: async () => JSON.stringify(mockResponseData),
        })

        const client = new JoaraClient({
            fetch: mockFetch as unknown as typeof fetch,
            cache: true,
            interceptors: {
                request: [
                    (ctx) => {
                        requestIntercepted = true
                        return ctx
                    },
                ],
                response: [
                    (ctx) => {
                        responseIntercepted = true
                        return ctx
                    },
                ],
            },
        })

        const res = await client.getBestBooks({ category: "1" })

        expect(mockFetch).toHaveBeenCalledTimes(1)
        expect(requestIntercepted).toBe(true)
        expect(responseIntercepted).toBe(true)
        expect(res.books).toHaveLength(1)
        expect(res.books?.[0].subject).toBe("테스트 소설")

        // 2번째 호출: 캐시 히트 검증 (mockFetch 재호출 없음)
        const cachedRes = await client.getBestBooks({ category: "1" })
        expect(mockFetch).toHaveBeenCalledTimes(1)
        expect(cachedRes.books?.[0].subject).toBe("테스트 소설")
    })
})
