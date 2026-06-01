/**
 * Stylesheet injected into the Termly policy WebViews (Terms & Conditions and
 * Privacy Policy). Termly renders the policy client-side with its own default
 * dark text colors, which become unreadable on the app's near-black (#131313)
 * background. This forces the policy onto the app's dark palette with
 * high-contrast text — light body copy, pure-white headers, and the purple
 * accent for links — preserving the current aesthetic while fixing readability.
 *
 * Runs once after the document loads, before Termly injects its content, so the
 * styles are in place before the policy text appears (no unstyled flash).
 */
export const LEGAL_WEBVIEW_DARK_THEME_SCRIPT = `(function() {
  var css = [
    'html, body { background-color: #131313 !important; }',
    '#hosted, #hosted * { color: #E4E4E7 !important; }',
    "#hosted [data-custom-class='title'],",
    "#hosted [data-custom-class='heading_1'],",
    "#hosted [data-custom-class='heading_2'],",
    "#hosted [data-custom-class='subtitle'] { color: #FFFFFF !important; }",
    "#hosted [data-custom-class='link'], #hosted a { color: #8B5CF6 !important; }"
  ].join('\\n');
  var style = document.createElement('style');
  style.appendChild(document.createTextNode(css));
  (document.head || document.documentElement).appendChild(style);
})();
true;`;
