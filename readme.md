# Html-Js-Css-Analyzer

A lightweight VS Code extension for analyzing HTML, JavaScript, and CSS. It helps you find undefined classes, unused selectors, and provides intelligent code completion.

## Key Features

* **HTML Analysis**: Detects undefined classes/IDs and integrates HTMLHint for validation.
* **CSS Analysis**: Highlights unused selectors and validates syntax using advanced parsing.
* **JavaScript Analysis**: Integrates JSHint for code quality and error detection.
* **IntelliSense**: Provides auto-completion and "Go to Definition" for CSS classes and IDs across your workspace.

## Usage

The extension activates automatically when you open supported files.

* **Validate**: Open the Command Palette (`Ctrl+Shift+P`) and run `Html-Js-Css-Analyzer: Validate Current Document`.
* **Clear Cache**: Run `Html-Js-Css-Analyzer: Clear Style Cache` to refresh the workspace analysis.

## Configuration

You can customize the extension in VS Code settings:

* `Html-Js-Css-Analyzer.enable`: Enable or disable the extension.
* `Html-Js-Css-Analyzer.exclude`: Glob patterns to exclude specific files or folders from analysis.
* `Html-Js-Css-Analyzer.htmlHint.enabled`: Toggle HTML validation.
* `Html-Js-Css-Analyzer.jsHint.enabled`: Toggle JavaScript validation.

## License

Apache-2.0
