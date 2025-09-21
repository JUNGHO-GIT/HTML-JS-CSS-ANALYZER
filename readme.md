# CSS-ANALYZER 🚀

Smart CSS assistance for VS Code: **ID/class completions**, **jump to definition**, **undefined reference warnings**, and **unused selector highlighting** (grayed out). Works across HTML, JS/TS, and CSS-family files.

## ✨ Features

1. **Autocomplete**
   - Triggers in `id`, `class`, ``, `#`, `classList.*`, and `querySelector*` contexts.

2. **Go to Definition**
   - Jump from a class/ID token to its CSS definition.

3. **Diagnostics**
   - **Undefined**: Warn when HTML/JS/TS references a class/ID that has no CSS definition.
   - **Unused selectors**: In CSS files, selectors not used anywhere in open documents are flagged as `Hint` + `Unnecessary` → shown **grayed out**.

4. **Remote & Local CSS**
   - Scans `http(s)://…` and workspace globs.

5. **Scalable**
   - Honors your `exclude` globs to keep large repos snappy.

## 🧠 How It Works

1. Parses CSS from the current doc and from paths defined in `css.styleSheets`.
2. Scans **all open editors** to collect used class/ID tokens.
3. Emits diagnostics:
   - Undefined references → `Warning`.
   - Unused CSS selectors → `Hint` + `Unnecessary` tag for gray styling.
