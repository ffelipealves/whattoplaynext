/**
 * Hands one category's selected ids to the generated client.
 *
 * A URL can only ever carry strings, and which ids are valid is published at
 * runtime by `GET /api/v1/filters` — the frontend deliberately keeps no second
 * copy of those enums — so this is the single seam where the string form meets
 * the contract's narrower union. Unknown ids are dropped at parse time when the
 * published allow-list is available, and rejected by the API otherwise. An
 * empty category is omitted rather than sent as a blank param, which the API's
 * strict query model forbids.
 */
export function selectedIds<Id extends string>(
  ids: string[],
): Id[] | undefined {
  return ids.length > 0 ? (ids as Id[]) : undefined;
}
