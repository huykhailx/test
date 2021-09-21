import {
    Source,
    Manga,
    Chapter,
    ChapterDetails,
    HomeSection,
    SearchRequest,
    PagedResults,
    SourceInfo,
    TagType,
    TagSection,
    ContentRating,
    RequestHeaders,
    HomeSectionType
} from "paperback-extensions-common"
import { parseSearch, isLastPage, parseChapterDetails, parseChapters, parseHomeSections, parseMangaDetails, parseViewMore, parseAddedSections, parsePopularSections } from "./HentaiVNParser"
import tags from './tags.json';

const DOMAIN = `https://hentaivn.tv/`
const method = 'GET'

export const HentaiVNInfo: SourceInfo = {
    version: '2.5.0',
    name: 'HentaiVN',
    icon: 'icon.png',
    author: 'Huynhzip3',
    authorWebsite: 'https://github.com/huynh12345678',
    description: 'Extension that pulls manga from HentaiVN',
    websiteBaseURL: '',
    contentRating: ContentRating.ADULT,
    sourceTags: [
        {
            text: "18+",
            type: TagType.YELLOW
        }
    ]
}

export class HentaiVN extends Source {
    getMangaShareUrl(mangaId: string): string { return `${DOMAIN}${mangaId}` };
    requestManager = createRequestManager({
        requestsPerSecond: 5,
        requestTimeout: 20000
    })
    async getMangaDetails(mangaId: string): Promise<Manga> {
        const request = createRequestObject({
            url: `${DOMAIN}`,
            method,
            param: mangaId.split("::")[0],
        });

        const response = await this.requestManager.schedule(request, 1);
        const $ = this.cheerio.load(response.data);
        return parseMangaDetails($, mangaId);
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = createRequestObject({
            url: `${DOMAIN}`,
            method,
            param: mangaId.split("::")[0],
        });

        const response = await this.requestManager.schedule(request, 1);
        const $ = this.cheerio.load(response.data);

        return parseChapters($, mangaId);
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = createRequestObject({
            url: `${DOMAIN}`,
            method,
            param: chapterId,
        });

        const response = await this.requestManager.schedule(request, 1);
        let $ = this.cheerio.load(response.data);
        return parseChapterDetails($, mangaId, chapterId);
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const section0 = createHomeSection({ id: 'featured', title: 'Tiêu điểm', type: HomeSectionType.featured });
        const section1 = createHomeSection({ id: 'recently-updated', title: 'Mới cập nhật', view_more: true });
        const section2 = createHomeSection({ id: 'popular', title: 'Tiêu điểm', view_more: true });
        const section3 = createHomeSection({ id: 'recently_added', title: 'Truyện mới đăng', view_more: true });
        const sections = [section0, section1, section2, section3];

        let request = createRequestObject({
            url: `${DOMAIN}`,
            method,
        });

        let response = await this.requestManager.schedule(request, 1);
        let $ = this.cheerio.load(response.data);
        parseHomeSections($, sections, sectionCallback);

        //added
        request = createRequestObject({
            url: `${DOMAIN}danh-sach.html`,
            method,
        });
        response = await this.requestManager.schedule(request, 1);
        $ = this.cheerio.load(response.data);
        parseAddedSections($, sections, sectionCallback);

        //popular
        request = createRequestObject({
            url: `${DOMAIN}tieu-diem.html`,
            method,
        });
        response = await this.requestManager.schedule(request, 1);
        $ = this.cheerio.load(response.data);
        parsePopularSections($, sections, sectionCallback);
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        let page: number = metadata?.page ?? 1;
        let select = 1;
        let param = '';
        let url = '';
        switch (homepageSectionId) {
            case "recently-updated":
                url = `${DOMAIN}`;
                param = `?page=${page}`;
                select = 1;
                break;
            case "recently_added":
                url = `${DOMAIN}danh-sach.html`;
                param = `?page=${page}`;
                select = 2;
                break;
            case "popular":
                url = `${DOMAIN}tieu-diem.html`;
                param = `?page=${page}`;
                select = 3;
                break;
            default:
                return Promise.resolve(createPagedResults({ results: [] }))
        }

        const request = createRequestObject({
            url,
            method,
            param
        });

        const response = await this.requestManager.schedule(request, 1);
        const $ = this.cheerio.load(response.data);

        const manga = parseViewMore($, select);
        metadata = !isLastPage($) ? { page: page + 1 } : undefined;
        return createPagedResults({
            results: manga,
            metadata,
        });
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        let page: number = metadata?.page ?? 1;
        const tag = query.includedTags?.map(tag => tag.id) ?? [];
        const request = createRequestObject({
            url: query.title ? `${DOMAIN}tim-kiem-truyen.html?key=${encodeURI(query.title)}` : `${DOMAIN}${tag[0]}?`, //encodeURI để search được chữ có dấu
            method,
            param: `&page=${page}`
        });

        const response = await this.requestManager.schedule(request, 1);
        const $ = this.cheerio.load(response.data);
        const manga = parseSearch($);
        metadata = !isLastPage($) ? { page: page + 1 } : undefined;

        return createPagedResults({
            results: manga,
            metadata
        });
    }

    async getSearchTags(): Promise<TagSection[]> {
        const tagSections: TagSection[] = [createTagSection({ id: '0', label: 'Thể Loại (Chỉ chọn 1)', tags: tags.map(x => createTag(x)) })]
        return tagSections;
    }

    globalRequestHeaders(): RequestHeaders {
        return {
            referer: `${DOMAIN}` + '/'
        }
    }

    // getCloudflareBypassRequest() {
    //     return createRequestObject({
    //         url: `${DOMAIN}`,
    //         method: 'GET',
    //     })

    // }
}