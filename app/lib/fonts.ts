/* One source for the app's webfont, because two of them would drift and the
   drift would only show up in the PDF: the printed invoice has to be set in the
   same face as the preview the user approved. `root.tsx` links it for the app,
   and the print document links it for the headless browser that makes the PDF.

   Classic's serif is deliberately absent from here. It is a system stack, so it
   costs no request and cannot fail to load. */
export const INTER_STYLESHEET_HREF =
	"https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap";

/* Two origins, named rather than ordered, because only one of them takes
   `crossorigin` and nothing else records which. */
export const FONT_CSS_ORIGIN = "https://fonts.googleapis.com";

/* The font files themselves. This is the preconnect that needs `crossorigin`:
   fonts are fetched in CORS mode, and a preconnect without it opens a
   connection the real request cannot reuse. */
export const FONT_FILE_ORIGIN = "https://fonts.gstatic.com";
