export interface paths {
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
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
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
