import { getAutocompleteSuggestions } from "@/features/search/get-autocomplete-suggestions";

/**
 * The browser's seam for title suggestions.
 *
 * The documented system view has the browser talking to this application and
 * only this application talking to the API, so the typed client — and the
 * API's base URL — stay on the server rather than shipping to every visitor
 * and needing a cross-origin allowance of their own.
 */
export async function GET(request: Request): Promise<Response> {
  const searchParams = new URL(request.url).searchParams;
  const query = searchParams.get("q")?.trim() ?? "";

  if (!query) {
    return Response.json({ items: [] });
  }

  const result = await getAutocompleteSuggestions(
    query,
    searchParams.getAll("platform"),
  );

  if (!result.ok) {
    // A suggestion list is an enhancement: the caller turns itself off rather
    // than surfacing this as a search failure.
    return Response.json({ items: [] }, { status: 502 });
  }

  return Response.json({ items: result.items });
}
