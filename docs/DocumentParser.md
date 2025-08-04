# DocumentParser Module Documentation

## Overview

The `DocumentParser` is the core module of the Dynamic Parameter Helper tool, responsible for parsing XML and JSON documents with comprehensive error handling, security validation, and performance optimization. This module directly addresses the requirements outlined in **Issue #2: Feature: Core Document Parser Module**.

## Features

### ✨ Core Capabilities
- **Automatic Format Detection**: Intelligently detects XML vs JSON format using multiple strategies
- **Robust Parsing**: Handles both XML and JSON with detailed error reporting
- **Security First**: Built-in validation against common security vulnerabilities  
- **Performance Optimized**: Handles large documents up to 10MB efficiently
- **Browser Compatible**: Works in all modern browsers without dependencies

### 🔒 Security Features
- **Input Sanitization**: Validates and sanitizes all input before processing
- **Size Limits**: Enforces 10MB document size limit to prevent DoS
- **Null Byte Protection**: Rejects input containing null bytes
- **Prototype Pollution Detection**: Warns about potentially dangerous JSON keys
- **XSS Prevention**: Safe handling of parsed content for UI display
- **Depth Limiting**: Prevents stack overflow from deeply nested structures

### 🚀 Performance Optimizations
- **Memory Efficient**: Optimized memory usage with size validation
- **Fast Format Detection**: Quick heuristic checks before expensive parsing
- **Error Caching**: Efficient error handling with detailed context
- **Circular Reference Protection**: Safe traversal of complex object structures

## API Reference

### Constructor

```javascript
const parser = new DocumentParser(options);
```

**Options:**
- `maxSize` (number): Maximum document size in bytes (default: 10MB)
- `maxDepth` (number): Maximum nesting depth allowed (default: 100)
- `timeout` (number): Parsing timeout in milliseconds (default: 30000)

### Main Methods

#### `parse(input: string): Promise<ParseResult>`

Main parsing method that automatically detects format and parses the document.

**Parameters:**
- `input` (string): Raw document content (XML or JSON)

**Returns:**
```javascript
{
  format: 'xml' | 'json',
  data: Document | any,     // Parsed document or JSON object
  metadata: {
    size: number,           // Document size in bytes
    parsedAt: string,       // ISO timestamp of parsing
    depth: number           // Calculated nesting depth
  }
}
```

**Throws:** `DocumentParserError` for invalid input or parsing failures

#### `detectFormat(input: string): string`

Detects document format using multiple strategies.

**Returns:** `'xml'`, `'json'`, or `'invalid'`

#### `validateInput(input: string): void`

Validates input for security and size constraints.

**Throws:** Error for invalid, malicious, or oversized input

### Specialized Parsing Methods

#### `parseXML(xmlString: string): Promise<Document>`

Parses XML with comprehensive error handling and validation.

**Features:**
- DOM-based parsing using native `DOMParser`
- Namespace preservation
- Detailed error location reporting
- Security attribute validation

#### `parseJSON(jsonString: string): Promise<any>`

Parses JSON with enhanced error reporting and security checks.

**Features:**
- Enhanced error messages with line/column numbers
- Prototype pollution detection
- Support for all JSON data types
- Circular reference handling

## Error Handling

### DocumentParserError Class

Custom error class providing detailed context for parsing failures.

```javascript
class DocumentParserError extends Error {
  constructor(message, type, context);
}
```

**Properties:**
- `name`: Always 'DocumentParserError'
- `type`: Error category ('ParseError', 'ValidationError', etc.)
- `context`: Additional context object with input details
- `timestamp`: ISO timestamp when error occurred

### Common Error Types

| Error Type | Description | Common Causes |
|------------|-------------|---------------|
| `ValidationError` | Input validation failed | Empty input, null bytes, size limits |
| `ParseError` | Document parsing failed | Invalid XML/JSON syntax |
| `SecurityError` | Security validation failed | Malicious content detected |
| `FormatError` | Format detection failed | Unrecognizable document format |

## Usage Examples

### Basic Usage

```javascript
const parser = new DocumentParser();

// Parse JSON
try {
  const result = await parser.parse('{"users": [{"id": 1, "name": "John"}]}');
  console.log('Format:', result.format); // 'json'
  console.log('Data:', result.data.users); // Array of users
} catch (error) {
  console.error('Parsing failed:', error.message);
}

// Parse XML
try {
  const result = await parser.parse('<users><user id="1">John</user></users>');
  console.log('Format:', result.format); // 'xml'
  console.log('Root:', result.data.documentElement.tagName); // 'users'
} catch (error) {
  console.error('Parsing failed:', error.message);
}
```

### Advanced Configuration

```javascript
const parser = new DocumentParser({
  maxSize: 5 * 1024 * 1024,  // 5MB limit
  maxDepth: 50,              // Shallow nesting limit
  timeout: 15000             // 15 second timeout
});
```

### Error Handling

```javascript
try {
  const result = await parser.parse(invalidContent);
} catch (error) {
  if (error instanceof DocumentParserError) {
    console.log('Error type:', error.type);
    console.log('Context:', error.context);
    console.log('Timestamp:', error.timestamp);
  }
}
```

## Integration with Other Modules

### PathExtractor Integration

The DocumentParser provides structured data that the PathExtractor can traverse:

```javascript
const parseResult = await parser.parse(xmlContent);
if (parseResult.format === 'xml') {
  const paths = pathExtractor.extractXPaths(parseResult.data);
} else {
  const paths = pathExtractor.extractJSONPaths(parseResult.data);
}
```

### NamespaceHandler Integration

For XML documents, namespace information is preserved:

```javascript
const parseResult = await parser.parse(xmlWithNamespaces);
const namespaces = namespaceHandler.extractNamespaces(parseResult.data);
```

## Testing

### Test Coverage

The DocumentParser includes comprehensive tests covering:

- ✅ **Format Detection**: All supported formats and edge cases
- ✅ **Input Validation**: Security checks and size limits  
- ✅ **Parse Accuracy**: Correct parsing of valid documents
- ✅ **Error Handling**: Proper error reporting for invalid input
- ✅ **Security Features**: Protection against common vulnerabilities
- ✅ **Performance**: Large document handling within time limits

### Running Tests

```bash
# Node.js environment
node src/DocumentParser.test.js

# Browser environment
open demo.html  # Click "Run All Tests"
```

## Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 60+ | ✅ Full Support |
| Firefox | 55+ | ✅ Full Support |
| Safari | 12+ | ✅ Full Support |
| Edge | 79+ | ✅ Full Support |

**Required APIs:**
- `DOMParser` (XML parsing)
- `JSON.parse()` (JSON parsing)
- `Promise` (async operations)
- `Blob` (size calculation)

## Security Considerations

### Input Validation
- All input is validated before processing
- Size limits prevent memory exhaustion
- Null byte detection prevents binary attacks
- Line length limits prevent parser issues

### Content Security
- No external resource loading
- Safe DOM manipulation only
- XSS prevention through proper escaping
- Prototype pollution warnings

### Performance Security
- Timeout protection against infinite parsing
- Depth limits prevent stack overflow
- Memory monitoring for large documents
- Circular reference detection

## Future Enhancements

### Planned Features
- **Streaming Support**: Process documents larger than memory
- **Web Worker Integration**: Background parsing for UI responsiveness
- **Format Extensions**: Support for YAML, TOML, and other formats
- **Validation Schemas**: JSON Schema and XSD validation
- **Recovery Mode**: Partial parsing of malformed documents

### Performance Improvements
- **Incremental Parsing**: Parse documents as they load
- **Caching Layer**: Cache parsed results for repeated access
- **Compression Support**: Handle gzipped input documents
- **Memory Optimization**: Reduce memory footprint for large documents

## Issue #2 Compliance

This DocumentParser module fully addresses all requirements from Issue #2:

✅ **Format Detection Algorithm**: Robust multi-strategy detection  
✅ **XML Parsing Edge Cases**: Comprehensive namespace and encoding support  
✅ **JSON Parsing Vulnerabilities**: Security validation and error handling  
✅ **Performance Bottlenecks**: Memory management and optimization  
✅ **Error Handling Strategy**: Detailed error types and user-friendly messages  
✅ **Security Vulnerability Assessment**: Input sanitization and validation  
✅ **Architecture Integration**: Clean interfaces for other modules  
✅ **Comprehensive Testing**: Full test coverage including edge cases  

The implementation follows all recommendations from the issue analysis and provides a solid foundation for the Dynamic Parameter Helper tool.

## Contributing

When contributing to the DocumentParser module:

1. **Security First**: All changes must maintain security standards
2. **Test Coverage**: New features require comprehensive tests
3. **Performance**: Consider impact on parsing performance
4. **Compatibility**: Maintain browser compatibility requirements
5. **Documentation**: Update this documentation for API changes

## License

This module is part of the Dynamic Parameter Helper project and follows the same licensing terms.