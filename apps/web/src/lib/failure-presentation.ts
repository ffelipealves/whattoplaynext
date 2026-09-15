import type { ApiFailureCode } from "./api-failure";

export type FailureCopy = { title: string; description: string };

const COPY: Record<ApiFailureCode, FailureCopy> = {
  VALIDATION_ERROR: {
    title: "validationTitle",
    description: "validationDescription",
  },
  INVALID_QUERY: {
    title: "validationTitle",
    description: "validationDescription",
  },
  RATE_LIMITED: {
    title: "rateLimitedTitle",
    description: "rateLimitedDescription",
  },
  UPSTREAM_UNAVAILABLE: {
    title: "unavailableTitle",
    description: "unavailableDescription",
  },
  UPSTREAM_TIMEOUT: {
    title: "timeoutTitle",
    description: "timeoutDescription",
  },
  UPSTREAM_INVALID_RESPONSE: {
    title: "invalidResponseTitle",
    description: "invalidResponseDescription",
  },
  UNREACHABLE: {
    title: "unreachableTitle",
    description: "unreachableDescription",
  },
  INTERNAL_ERROR: { title: "genericTitle", description: "genericDescription" },
  GAME_NOT_FOUND: { title: "genericTitle", description: "genericDescription" },
  NOT_FOUND: { title: "genericTitle", description: "genericDescription" },
  METHOD_NOT_ALLOWED: {
    title: "genericTitle",
    description: "genericDescription",
  },
  UNKNOWN: { title: "genericTitle", description: "genericDescription" },
};

const REJECTED_CRITERIA: ReadonlySet<ApiFailureCode> = new Set([
  "VALIDATION_ERROR",
  "INVALID_QUERY",
]);

export function failureCopy(code: ApiFailureCode): FailureCopy {
  return COPY[code];
}

export function isRecoverableFailure(code: ApiFailureCode): boolean {
  return !REJECTED_CRITERIA.has(code);
}
