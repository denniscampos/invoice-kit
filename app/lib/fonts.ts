/* One source for the app's webfont, because two of them would drift and the
   drift would only show up in the PDF: the printed invoice has to be set in the
   same face as the preview the user approved. `root.tsx` links it for the app,
   and the print document links it for the headless browser that makes the PDF.

   Classic's serif is deliberately absent from here. It is a system stack, so it
   costs no request and cannot fail to load. */
export const INTER_STYLESHEET_HREF =
	"https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap";

export const FONT_ORIGINS = [
	"https://fonts.googleapis.com",
	"https://fonts.gstatic.com",
] as const;
