/* ==========================================================================
   icons.js — OWNER: Sanika Lobo
   Purpose: inline SVG icon strings (Lab.Icons, CONTRACT §5.7).
   Six matching line icons: 24x24 viewBox, stroke="currentColor", 1.75 stroke,
   round caps and joins, aria-hidden, no external references.
   A complete first draft: feel free to redraw in Figma and replace the paths.
   ========================================================================== */
window.Lab = window.Lab || {};
(function (Lab) {
  'use strict';

  var OPEN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
             'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  var CLOSE = '</svg>';
  function icon(body) { return OPEN + body + CLOSE; }

  Lab.Icons = {
    // laptop
    client: icon(
      '<rect x="4" y="5" width="16" height="11" rx="1.5"/>' +
      '<path d="M2 19h20"/>' +
      '<path d="M9 19l.5-3h5l.5 3"/>'
    ),

    // a box emitting arrows (traffic generator)
    generator: icon(
      '<rect x="3" y="8" width="9" height="9" rx="1.5"/>' +
      '<path d="M15 9h6"/><path d="M18.5 6.5L21 9l-2.5 2.5"/>' +
      '<path d="M15 14h6"/><path d="M18.5 11.5L21 14l-2.5 2.5"/>' +
      '<path d="M15 19h6"/><path d="M18.5 16.5L21 19l-2.5 2.5"/>'
    ),

    // rack server
    server: icon(
      '<rect x="3" y="4" width="18" height="6" rx="1.5"/>' +
      '<rect x="3" y="14" width="18" height="6" rx="1.5"/>' +
      '<path d="M7 7h.01"/><path d="M7 17h.01"/>' +
      '<path d="M12 7h6"/><path d="M12 17h6"/>'
    ),

    // stacked slots / inbox
    queue: icon(
      '<rect x="4" y="3.5" width="16" height="4" rx="1"/>' +
      '<rect x="4" y="10" width="16" height="4" rx="1"/>' +
      '<rect x="4" y="16.5" width="16" height="4" rx="1"/>' +
      '<path d="M8 5.5h5"/><path d="M8 12h5"/>'
    ),

    // signal / pulse
    status: icon(
      '<path d="M2 12h4l2.5-6 4 12 3-9 1.5 3H22"/>'
    ),

    // shield with a check (defence)
    shield: icon(
      '<path d="M12 3l7.5 2.7v5.6c0 4.4-3.1 8.2-7.5 9.7-4.4-1.5-7.5-5.3-7.5-9.7V5.7L12 3z"/>' +
      '<path d="M8.6 12l2.4 2.4 4.4-4.8"/>'
    )
  };
})(window.Lab);
