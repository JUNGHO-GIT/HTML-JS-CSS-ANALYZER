// consts/ConstsCss.ts

import { vscode } from "@exportLibs";
import type { CacheValType } from "@exportTypes";

// 1. Number -----------------------------------------------------------------------------------------------
export const maxCache = 300;
export const cacheTTL = 30 * 60 * 1000;

// 2. String -----------------------------------------------------------------------------------------------
export const zeroPosition = new vscode.Position(0, 0);

// 3. Array ------------------------------------------------------------------------------------------------
export const styleCache: Map<string, CacheValType> = new Map();
export const defaultCssExclude: string[] = [
	"**/node_modules/**",
	"**/.git/**",
	"**/dist/**",
	"**/out/**",
	"**/.svn/**",
	"**/.hg/**",
	"**/CVS/**",
	"**/.idea/**",
	"**/.vscode/**",
	"**/.settings/**",
	"**/.metadata/**",
	"**/.history/**",
	"**/.backup/**",
	"**/.etc/**",
	"**/.cache/**",
	"**/.gradle/**",
	"**/.mvn/**",
	"**/bin/**",
	"**/build/**",
	"**/target/**",
	"**/logs/**",
	"**/.pytest_cache/**",
	"**/.scannerwork/**",
	"**/.terraform/**",
	"**/__pycache__/**",
	"**/.venv/**",
	"**/.classpath",
	"**/.project",
	"**/.factorypath",
	"**/.DS_Store",
	"**/Thumbs.db",
	"**/desktop.ini",
	"**/.coverage"
];

// 4. Regex ------------------------------------------------------------------------------------------------
export const regexSelectorBoundary = /\s|[#.:,[\]()()>+~=*^$|{}]/;
export const regexLeadingWhitespace = /^\s*/;
export const validCssIdentifierRegex = /^[_a-zA-Z][-_a-zA-Z0-9]*$/;
export const backslashRegex = /\\/g;
export const regexSelectorClassToken = /(^|[^\\])\.((?:\\.|[-_a-zA-Z0-9])+)/g;
export const regexSelectorIdToken = /(^|[^\\])#((?:\\.|[-_a-zA-Z0-9])+)/g;