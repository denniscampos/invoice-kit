import appStyles from "~/app.css?inline";

/* The app's stylesheet as a string, for the print document to carry inside a
   <style> tag.

   `?inline` hands back the CSS Vite produced, which means Tailwind has already
   run and this is the compiled utilities rather than the source directives. The
   document has to bring its own styles because the headless browser that turns
   it into a PDF (feature 5b) never loads the app, so there is nothing to link
   to.

   Under Vitest this is an empty string: that config deliberately loads none of
   the app's Vite plugins, so nothing compiles the stylesheet. Anything that
   needs to assert on real CSS should take it as an argument rather than reach
   for this constant. */
export const PRINT_STYLES: string = appStyles;
