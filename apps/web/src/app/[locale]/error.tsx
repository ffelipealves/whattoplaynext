"use client";

import type { ComponentProps } from "react";

import { SiteHeader } from "@/features/search/site-header";
import { UnexpectedError } from "@/features/system/unexpected-error";

export default function LocaleError(
  props: ComponentProps<typeof UnexpectedError>,
) {
  return (
    <>
      <SiteHeader />
      <UnexpectedError {...props} />
    </>
  );
}
