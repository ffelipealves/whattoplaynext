"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { usePathname } from "@/i18n/navigation";

import {
  parseBrowseParams,
  type BrowseParams,
  type RawSearchParams,
} from "./browse-params";
import { NameSearchForm } from "./name-search-form";

type HeaderSearchProps = {
  minimumQueryLength?: number;
};

const NO_CRITERIA: BrowseParams = parseBrowseParams({});

function rawSearchParams(searchParams: URLSearchParams): RawSearchParams {
  const raw: RawSearchParams = {};
  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);
    raw[key] = values.length > 1 ? values : values[0];
  }
  return raw;
}

/**
 * Reads the criteria from the URL rather than from props, so the header can
 * live in a layout: it then survives the search page's own loading state, and
 * keeps the applied filters when a name is searched from it.
 */
function UrlSearch({ minimumQueryLength }: HeaderSearchProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params =
    pathname === "/"
      ? parseBrowseParams(rawSearchParams(searchParams))
      : NO_CRITERIA;

  return (
    <NameSearchForm
      // A name applied or removed elsewhere (a chip, back and forward)
      // replaces whatever was being typed, as the URL is the source of truth.
      key={params.name ?? ""}
      minimumQueryLength={minimumQueryLength}
      params={params}
    />
  );
}

export function HeaderSearch({ minimumQueryLength }: HeaderSearchProps) {
  // Statically rendered pages cannot read the URL on the server; they ship
  // the empty field and pick the URL up once the browser takes over.
  return (
    <Suspense
      fallback={
        <NameSearchForm
          minimumQueryLength={minimumQueryLength}
          params={NO_CRITERIA}
        />
      }
    >
      <UrlSearch minimumQueryLength={minimumQueryLength} />
    </Suspense>
  );
}
