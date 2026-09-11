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
