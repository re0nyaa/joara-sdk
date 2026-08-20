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

export class JoaraTokenParser {
    private client: JoaraClient

    constructor(options?: JoaraClientOptions) {
        this.client = new JoaraClient(options)
    }

    getSessionInfo(): JoaraSession {
        return this.client.getSession()
    }

    async fetchInitialData(options?: RequestOptions) {
        return this.client.getAppInfo(options)
    }

    async fetchBestNovels(category: string = '1', page: number = 1, options?: RequestOptions): Promise<JoaraBook[]> {
        const res = await this.client.getBestBooks({ category, page }, options)
        return res.books || []
    }

    bestNovelsStream(params: BestBooksParams = {}, options?: RequestOptions): AsyncIterableIterator<JoaraBook> {
        return this.client.bestBooksStream(params, options)
    }

    async fetchNovelDetail(bookCode: string | number, options?: RequestOptions) {
        return this.client.getBookDetail(bookCode, options)
    }

    async search(query: string, options: Partial<SearchParams> = {}, reqOptions?: RequestOptions): Promise<SearchBookItem[]> {
        const res = await this.client.searchBooks({
            query,
            ...options
        }, reqOptions)
        return res.data?.list || []
    }

    searchStream(params: SearchParams, options?: RequestOptions): AsyncIterableIterator<SearchBookItem> {
        return this.client.searchStream(params, options)
    }

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

    getClient(): JoaraClient {
        return this.client
    }
}

export default JoaraTokenParser
