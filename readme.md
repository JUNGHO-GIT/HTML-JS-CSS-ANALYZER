# Html-Js-Css-Analyzer

A lightweight VS Code extension for analyzing HTML, JavaScript, and CSS.  
Find undefined classes, unused selectors, and get intelligent code completion.

## Key Features

| Feature | Description |
| :--- | :--- |
| **HTML Analysis** | Detects undefined classes/IDs, integrates HTMLHint for validation |
| **CSS Analysis** | Highlights unused selectors, validates syntax using advanced parsing |
| **JavaScript Analysis** | Integrates JSHint for code quality and error detection |
| **IntelliSense** | Auto-completion and "Go to Definition" for CSS classes and IDs |

## Usage

| Command | Description |
| :--- | :--- |
| `Validate Current Document` | Validate the current file |
| `Clear Style Cache` | Refresh the workspace analysis |

## Settings

| Setting | Default | Description |
| :--- | :--- | :--- |
| `enable` | `true` | Enable or disable the extension |
| `exclude` | `[]` | Glob patterns to exclude files or folders |
| `htmlHint.enabled` | `true` | Toggle HTML validation |
| `jsHint.enabled` | `true` | Toggle JavaScript validation |

## License

[Apache License 2.0](./license.md)
