# Dynamic Parameter Helper

A browser-based tool for extracting XPath and JSONPath expressions from XML and JSON documents, specifically designed for SAP Cloud Integration (CI) IFlow parameter configuration.

## Overview

This tool helps developers and integration specialists easily generate dynamic parameter configurations for SAP Cloud Integration by:
- Automatically extracting all possible XPath/JSONPath expressions from XML/JSON documents
- Providing an intuitive checkbox-based selection interface
- Generating properly formatted parameter values for SAP CI Content Modifier
- Handling XML namespace declarations automatically

## Features

- **Pure Browser-Based**: No server, no backend, no Docker - runs entirely in your browser
- **Dual Format Support**: Works with both XML and JSON documents
- **Namespace Handling**: Automatically extracts and formats XML namespace declarations
- **Interactive Selection**: Tree-view interface with checkboxes for easy path selection
- **SAP CI Compatible**: Generates output in the exact format required by SAP Cloud Integration
- **Privacy-First**: All processing happens locally - your data never leaves your browser

## Use Cases

1. **SAP Cloud Integration Development**: Generate dynamic parameters for Content Modifier steps
2. **API Response Mapping**: Extract specific fields from REST/SOAP responses
3. **Message Transformation**: Identify paths for data extraction in integration flows
4. **Testing & Debugging**: Quickly validate XPath/JSONPath expressions

## Technical Stack

- **JSONPath Processing**: jsonpath-plus library (6.1M weekly downloads)
- **XPath Processing**: Native browser document.evaluate() API
- **UI Framework**: Vanilla JavaScript with modern ES6+ features
- **No External Dependencies**: Self-contained HTML file with embedded resources

## Browser Compatibility

- Chrome/Edge 80+
- Firefox 75+
- Safari 13+
- Opera 67+

## Getting Started

1. Download the `index.html` file
2. Open it in your web browser
3. Paste your XML or JSON document
4. Select the paths you need
5. Copy the generated parameters

## Output Format

### For XML Documents
- **DynamicCustomHeaderXMLNamespace**: Contains namespace declarations in format `prefix=namespaceURI;prefix2=namespaceURI2`
- **DynamicCustomHeader**: Contains selected element names with their full XPath expressions

### For JSON Documents
- **DynamicCustomHeader**: Contains selected element names with their JSONPath expressions

## Contributing

Please see our [Contributing Guidelines](CONTRIBUTING.md) for details on how to submit improvements and bug fixes.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.