// consts/ConstsHtml.ts

// 1. Number -----------------------------------------------------------------------------------------------

// 2. String -----------------------------------------------------------------------------------------------

// 3. Array ------------------------------------------------------------------------------------------------
export const voidTags = new Set<string>([
	"br", "hr", "img", "meta", "link", "input", "source", "embed",
	"param", "track", "area", "col", "base"
]);
export const obsoleteTags: string[] = [
	"center", "font", "big", "strike", "tt", "acronym",
	"applet", "basefont", "bgsound", "blink", "marquee"
];
export const htmlLanguages: string[] = [
	"html",
	"htm",
	"html5"
];

// 4. Regex ------------------------------------------------------------------------------------------------
export const regexAttrValueSingleQuotes = /(\w[\w:-]*)='([^']*)'/g;
export const regexTagnameUppercase = /<\/?([A-Z][A-Za-z0-9]*)\b/g;
export const regexAttrnameUppercase = /\s([A-Z][A-Za-z0-9-_]*)\s*=/g;
export const regexAttrValueWhitespaceSimplify = /(\w[\w:-]*)\s*=\s*(["'])(\s+)([^"']*?)(\s+)(\2)/g;
export const regexAttrWhitespace = /(\w[\w:-]*)\s*=\s*(["'][^"']*["'])/g;
export const regexVoidTagOpen = /<([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g;
export const regexVoidTagBadClose = /<\/(br|hr|img|meta|link|input|source|embed|param|track|area|col|base)\s*>/ig;
export const regexAnyTag = /<\/?\s*[^>]+?>/g;

// HTML scanning regexes
export const regexHtmlClassAttr = /class\s*=\s*(["'])([^"']*)\1/gis;
export const regexHtmlIdAttr = /\bid\s*=\s*(["'])([^"']*)\1/gis;
export const regexStyleTag = /<style(?:\s[^>]*)?>[\s\S]*?<\/style>/gi;
export const regexLinkStylesheet = /<link\s+[^>]*\brel\s*=\s*["']stylesheet["'][^>]*>/gi;
export const regexHrefAttribute = /\bhref\s*=\s*(["'])([^"']+)\1/i;
export const regexHeadTag = /<head(\s[^>]*)?>([\s\S]*?)<\/head>/i;