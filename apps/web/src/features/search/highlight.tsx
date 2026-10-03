/** Case- and accent-insensitive form of a string, for matching only. */
function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * Marks the first place `term` occurs in `text`, ignoring case and accents, so
 * "pokemon" highlights the "Pokémon" in a title. The match is found in a
 * folded copy and mapped back to the original, because folding can change a
 * string's length and the folded indices would otherwise drift.
 */
export function Highlight({ text, term }: { text: string; term: string }) {
  const needle = fold(term.trim());
  if (!needle) {
    return text;
  }

  let folded = "";
  // For each folded character, where its source character starts in `text`.
  const origin: number[] = [];
  let index = 0;
  for (const char of text) {
    for (const foldedChar of fold(char)) {
      folded += foldedChar;
      origin.push(index);
    }
    index += char.length;
  }

  const start = folded.indexOf(needle);
  if (start < 0) {
    return text;
  }

  const end = start + needle.length;
  const from = origin[start];
  const to = end < origin.length ? origin[end] : text.length;

  return (
    <>
      {text.slice(0, from)}
      <mark className="rounded-sm bg-primary/25 text-ember-300">
        {text.slice(from, to)}
      </mark>
      {text.slice(to)}
    </>
  );
}
