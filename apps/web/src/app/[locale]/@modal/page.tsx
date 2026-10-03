/**
 * Matches the home page, so a client navigation back to it (a genre link in
 * an open game, say) closes the modal: a slot left unmatched by a client
 * navigation would otherwise keep showing what it showed.
 */
export default function NoModalOnHome() {
  return null;
}
