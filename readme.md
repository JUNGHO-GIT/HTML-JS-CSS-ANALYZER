# Html-Js-Css-Analyzer

## Overview

Html-Js-Css-Analyzer is a VS Code extension that checks HTML, JavaScript, and CSS
files for diagnostics, cross-file issues, and editor assistance.

## Structure

* `src/langs/` contains language-specific analyzers and validators
* `src/consts/` defines extension-wide configuration constants
* `src/assets/` holds shared scripts, helpers, and type definitions
* `src/exports/` exposes barrel modules used across the extension
* `out/` is the generated extension output

## Notes

* The repository focuses on editor feedback rather than standalone CLI execution.
* Language behavior is split by domain so each analyzer stays isolated.
