export interface paths {
    "/api/v1/filters": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get catalog filter metadata
         * @description Return stable filter options from the configured catalog.
         */
        get: operations["getFilters"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/games": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Browse games
         * @description Return one strict, normalized page of catalog results.
         */
        get: operations["browseGames"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/games/{gameId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get game detail
         * @description Return complete normalized detail for one eligible game.
         */
        get: operations["getGameDetail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/games/autocomplete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Autocomplete game titles
         * @description Return at most eight normalized title suggestions.
         */
        get: operations["autocompleteGames"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/games/popular": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get popular games for the sitemap
         * @description Return a cacheable, bounded selection of eligible popular games.
         */
        get: operations["getPopularGames"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Check process health
         * @description Report liveness without synchronously calling IGDB or Redis.
         */
        get: operations["getHealth"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /**
         * AgeRating
         * @description One organization's age rating, preserved as provider text.
         */
        AgeRating: {
            /** Organization */
            organization: string;
            /** Rating */
            rating: string;
        };
        /**
         * AutocompleteResult
         * @description At most eight normalized autocomplete suggestions.
         */
        AutocompleteResult: {
            /** Items */
            items: components["schemas"]["AutocompleteSuggestion"][];
            meta: components["schemas"]["ResponseMeta"];
        };
        /**
         * AutocompleteSuggestion
         * @description One normalized title suggestion.
         */
        AutocompleteSuggestion: {
            cover: components["schemas"]["GameCover"] | null;
            /** Id */
            id: number;
            /** Releaseyear */
            releaseYear: number | null;
            /** Slug */
            slug: string;
            /** Title */
            title: string;
        };
        /**
         * BrowseQuery
         * @description Normalized public criteria echoed with browse results.
         */
        BrowseQuery: {
            direction: components["schemas"]["SortDirection"];
            sort: components["schemas"]["SortOption"];
        };
        /**
         * CatalogOption
         * @description Stable identifier and English source label for one filter option.
         */
        CatalogOption: {
            /** Id */
            id: string;
            /** Label */
            label: string;
        };
        /**
         * DetailDuration
         * @description One duration measure with its provider submission count.
         */
        DetailDuration: {
            /** Seconds */
            seconds: number;
            /** Submissioncount */
            submissionCount: number;
        };
        /**
         * DurationKind
         * @description Supported campaign-duration measures.
         * @enum {string}
         */
        DurationKind: "fast" | "normal" | "completionist";
        /**
         * ErrorCode
         * @description Stable failure codes understood by public adapters.
         * @enum {string}
         */
        ErrorCode: "GAME_NOT_FOUND" | "INTERNAL_ERROR" | "INVALID_QUERY" | "METHOD_NOT_ALLOWED" | "NOT_FOUND" | "RATE_LIMITED" | "UPSTREAM_INVALID_RESPONSE" | "UPSTREAM_TIMEOUT" | "UPSTREAM_UNAVAILABLE" | "VALIDATION_ERROR";
        /**
         * ErrorDetail
         * @description Public details nested inside an error response.
         */
        ErrorDetail: {
            code: components["schemas"]["ErrorCode"];
            /** Message */
            message: string;
            /** Requestid */
            requestId: string;
            /** Retryafterseconds */
            retryAfterSeconds?: number | null;
        };
        /**
         * ErrorResponse
         * @description Public envelope shared by every error response.
         */
        ErrorResponse: {
            error: components["schemas"]["ErrorDetail"];
        };
        /**
         * ExternalLink
         * @description One allow-listed external link.
         */
        ExternalLink: {
            /** Label */
            label: string;
            /** Url */
            url: string;
        };
        /**
         * FilterLimits
         * @description Public bounds shared by filter controls and query validation.
         */
        FilterLimits: {
            /** Maximumdurationhours */
            maximumDurationHours: number;
            /** Maximumnamelength */
            maximumNameLength: number;
            /** Maximumpage */
            maximumPage: number;
            /** Minimumautocompletelength */
            minimumAutocompleteLength: number;
            /** Minimumdurationhours */
            minimumDurationHours: number;
            /** Pagesize */
            pageSize: number;
        };
        /**
         * FilterMetadata
         * @description All allow-listed values needed to construct the search form.
         */
        FilterMetadata: {
            /** Durationkinds */
            durationKinds: components["schemas"]["DurationKind"][];
            /** Gamemodes */
            gameModes: components["schemas"]["CatalogOption"][];
            /** Genres */
            genres: components["schemas"]["CatalogOption"][];
            limits: components["schemas"]["FilterLimits"];
            /** Platforms */
            platforms: components["schemas"]["CatalogOption"][];
            /** Sortoptions */
            sortOptions: components["schemas"]["SortOption"][];
        };
        /**
         * GameCover
         * @description Normalized game cover image.
         */
        GameCover: {
            /** Height */
            height: number;
            /** Url */
            url: string;
            /** Width */
            width: number;
        };
        /**
         * GameDetail
         * @description Complete normalized detail for one game.
         */
        GameDetail: {
            /** Ageratings */
            ageRatings: components["schemas"]["AgeRating"][];
            /** Alternativenames */
            alternativeNames: string[];
            combinedRating: components["schemas"]["GameRating"] | null;
            cover: components["schemas"]["GameCover"] | null;
            criticRating: components["schemas"]["GameRating"] | null;
            durations: components["schemas"]["GameDurations"];
            /** Externallinks */
            externalLinks: components["schemas"]["ExternalLink"][];
            /** Gamemodes */
            gameModes: components["schemas"]["CatalogOption"][];
            /** Genres */
            genres: components["schemas"]["CatalogOption"][];
            /** Id */
            id: number;
            meta: components["schemas"]["ResponseMeta"];
            multiplayer: components["schemas"]["MultiplayerInfo"];
            /** Platforms */
            platforms: components["schemas"]["CatalogOption"][];
            /** Releases */
            releases: components["schemas"]["PlatformRelease"][];
            /** Screenshots */
            screenshots: components["schemas"]["GameCover"][];
            /** Slug */
            slug: string;
            /** Summary */
            summary: string | null;
            /** Summarylanguage */
            summaryLanguage?: "en" | null;
            /** Themes */
            themes: components["schemas"]["Theme"][];
            /** Title */
            title: string;
            userRating: components["schemas"]["GameRating"] | null;
        };
        /**
         * GameDurations
         * @description Fast, normal, and completionist durations where each exists.
         */
        GameDurations: {
            completionist: components["schemas"]["DetailDuration"] | null;
            fast: components["schemas"]["DetailDuration"] | null;
            normal: components["schemas"]["DetailDuration"] | null;
        };
        /**
         * GameModeId
         * @description Stable public game-mode identifiers accepted by search.
         * @enum {string}
         */
        GameModeId: "single-player" | "multiplayer" | "co-operative" | "split-screen" | "massively-multiplayer-online" | "battle-royale";
        /**
         * GamePage
         * @description One normalized page of game summaries.
         */
        GamePage: {
            /** Items */
            items: components["schemas"]["GameSummary"][];
            meta: components["schemas"]["ResponseMeta"];
            pagination: components["schemas"]["Pagination"];
            query: components["schemas"]["BrowseQuery"];
        };
        /**
         * GameRating
         * @description Normalized rating and the number of contributing scores.
         */
        GameRating: {
            /** Count */
            count: number;
            /** Source */
            source: string;
            /** Value */
            value: number;
        };
        /**
         * GameSummary
         * @description Provider-neutral game data required by browse results.
         */
        GameSummary: {
            cover: components["schemas"]["GameCover"] | null;
            /** Gamemodes */
            gameModes: components["schemas"]["CatalogOption"][];
            /** Genres */
            genres: components["schemas"]["CatalogOption"][];
            /** Id */
            id: number;
            /** Normaldurationseconds */
            normalDurationSeconds: number | null;
            /** Platforms */
            platforms: components["schemas"]["CatalogOption"][];
            rating: components["schemas"]["GameRating"] | null;
            /** Releaseyear */
            releaseYear: number | null;
            /** Slug */
            slug: string;
            /** Title */
            title: string;
        };
        /**
         * GenreId
         * @description Stable public genre identifiers accepted by search.
         * @enum {string}
         */
        GenreId: "point-and-click" | "fighting" | "shooter" | "music" | "platform" | "puzzle" | "racing" | "real-time-strategy-rts" | "role-playing-rpg" | "simulator" | "sport" | "strategy" | "turn-based-strategy-tbs" | "tactical" | "hack-and-slash-beat-em-up" | "quiz-trivia" | "pinball" | "adventure" | "indie" | "arcade" | "visual-novel" | "card-board-game" | "moba";
        /**
         * HealthResponse
         * @description Stable public response for process-health checks.
         */
        HealthResponse: {
            /**
             * Status
             * @default ok
             * @constant
             */
            status: "ok";
        };
        /**
         * MultiplayerInfo
         * @description Structured multiplayer support aggregated across platforms.
         */
        MultiplayerInfo: {
            /** Maxplayers */
            maxPlayers?: number | null;
            /** Offlinecoop */
            offlineCoop: boolean;
            /** Onlinecoop */
            onlineCoop: boolean;
            /** Splitscreen */
            splitScreen: boolean;
        };
        /**
         * Pagination
         * @description Page location and total result information.
         */
        Pagination: {
            /** Page */
            page: number;
            /**
             * Pagesize
             * @default 24
             * @constant
             */
            pageSize: 24;
            /** Totalitems */
            totalItems: number;
            /** Totalpages */
            totalPages: number;
        };
        /**
         * PlatformId
         * @description Stable public platform identifiers accepted by search.
         * @enum {string}
         */
        PlatformId: "pc" | "playstation-4" | "playstation-5" | "xbox-one" | "xbox-series-x-s" | "nintendo-switch";
        /**
         * PlatformRelease
         * @description One platform-specific release date.
         */
        PlatformRelease: {
            platform: components["schemas"]["CatalogOption"];
            /** Releasedate */
            releaseDate: string | null;
        };
        /**
         * PopularGame
         * @description One canonical game identity selected for sitemap discovery.
         */
        PopularGame: {
            /** Id */
            id: number;
            /** Slug */
            slug: string;
        };
        /**
         * PopularGameSelection
         * @description A bounded popularity-ordered selection used to build the sitemap.
         */
        PopularGameSelection: {
            /** Items */
            items: components["schemas"]["PopularGame"][];
            meta: components["schemas"]["ResponseMeta"];
        };
        /**
         * ResponseMeta
         * @description Freshness and processing metadata for one catalog response.
         */
        ResponseMeta: {
            /**
             * Datamaybestale
             * @default false
             */
            dataMayBeStale: boolean;
            /**
             * Excludedunknownduration
             * @default false
             */
            excludedUnknownDuration: boolean;
            /** Requestid */
            requestId?: string | null;
            /** @default provider */
            servedFrom: components["schemas"]["ServedFrom"];
        };
        /**
         * ServedFrom
         * @description Origin of the data returned to the caller.
         * @enum {string}
         */
        ServedFrom: "provider";
        /**
         * SortDirection
         * @description Provider-neutral ordering direction.
         * @enum {string}
         */
        SortDirection: "asc" | "desc";
        /**
         * SortOption
         * @description Supported catalog sort fields.
         * @enum {string}
         */
        SortOption: "popularity" | "rating" | "release-date" | "duration" | "title";
        /**
         * Theme
         * @description One provider theme, preserved without a stable public identity.
         */
        Theme: {
            /** Id */
            id: number;
            /** Name */
            name: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    getFilters: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FilterMetadata"];
                };
            };
            /** @description Method not allowed. */
            405: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Too many requests. */
            429: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description An unexpected error occurred. */
            500: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Game data provider returned an invalid response. */
            502: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Game data is temporarily unavailable. */
            503: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Game data provider timed out. */
            504: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    browseGames: {
        parameters: {
            query?: {
                direction?: components["schemas"]["SortDirection"] | null;
                durationKind?: components["schemas"]["DurationKind"];
                gameMode?: components["schemas"]["GameModeId"][];
                genre?: components["schemas"]["GenreId"][];
                maximumDurationHours?: number | null;
                minimumDurationHours?: number | null;
                minimumRating?: number | null;
                name?: string | null;
                page?: number;
                platform?: components["schemas"]["PlatformId"][];
                releaseFrom?: string | null;
                releaseTo?: string | null;
                sort?: components["schemas"]["SortOption"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GamePage"];
                };
            };
            /** @description Method not allowed. */
            405: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description One or more parameter values are invalid. */
            422: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Too many requests. */
            429: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description An unexpected error occurred. */
            500: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Game data provider returned an invalid response. */
            502: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Game data is temporarily unavailable. */
            503: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Game data provider timed out. */
            504: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getGameDetail: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                gameId: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GameDetail"];
                };
            };
            /** @description Game not found. */
            404: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Method not allowed. */
            405: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description One or more parameter values are invalid. */
            422: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Too many requests. */
            429: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description An unexpected error occurred. */
            500: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Game data provider returned an invalid response. */
            502: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Game data is temporarily unavailable. */
            503: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Game data provider timed out. */
            504: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    autocompleteGames: {
        parameters: {
            query: {
                platform?: components["schemas"]["PlatformId"][];
                q: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AutocompleteResult"];
                };
            };
            /** @description Method not allowed. */
            405: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description One or more parameter values are invalid. */
            422: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Too many requests. */
            429: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description An unexpected error occurred. */
            500: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Game data provider returned an invalid response. */
            502: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Game data is temporarily unavailable. */
            503: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Game data provider timed out. */
            504: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getPopularGames: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PopularGameSelection"];
                };
            };
            /** @description Method not allowed. */
            405: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Too many requests. */
            429: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description An unexpected error occurred. */
            500: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Game data provider returned an invalid response. */
            502: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Game data is temporarily unavailable. */
            503: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Game data provider timed out. */
            504: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    getHealth: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthResponse"];
                };
            };
            /** @description Method not allowed. */
            405: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description An unexpected error occurred. */
            500: {
                headers: {
                    /** @description Identifier used to correlate this response. */
                    "X-Request-ID"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
}
