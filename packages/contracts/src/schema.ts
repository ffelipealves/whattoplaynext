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
         * @description Return one unfiltered page ordered by current popularity.
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
         * BrowseQuery
         * @description Normalized public criteria echoed with browse results.
         */
        BrowseQuery: {
            /**
             * Direction
             * @default desc
             * @constant
             */
            direction: "desc";
            /**
             * Sort
             * @default popularity
             * @constant
             */
            sort: "popularity";
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
         * SortOption
         * @description Supported catalog sort fields.
         * @enum {string}
         */
        SortOption: "popularity" | "rating" | "release-date" | "duration" | "title";
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
                page?: number;
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
