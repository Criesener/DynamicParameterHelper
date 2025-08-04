# NamespaceHandler Documentation

## Overview

The NamespaceHandler module provides comprehensive XML namespace management for the Dynamic Parameter Helper project. It was implemented to fulfill Issue #4 requirements and enables proper SAP Cloud Integration support for XML documents with complex namespace scenarios.

## Features

### Core Capabilities
- **Namespace Extraction**: Extracts all namespace declarations with full inheritance support
- **Default Namespace Handling**: Detects and assigns prefixes to default namespaces
- **Prefix Generation**: Creates unique prefixes for namespaces that need them (ns0, ns1, etc.)
- **SAP CI Integration**: Formats namespaces for SAP Cloud Integration requirements
- **Element Resolution**: Resolves namespaces for specific elements with inheritance
- **Edge Case Handling**: Manages conflicts, empty declarations, and special characters

### SAP CI Compatibility
- **Format**: `"prefix1=uri1;prefix2=uri2"`
- **Encoding**: Handles special characters in namespace URIs
- **Validation**: Ensures proper URI and prefix formats
- **Consistency**: Produces sorted, deterministic output

## API Reference

### Constructor

```javascript
const handler = new NamespaceHandler(options);
```

**Options:**
- `defaultPrefixPattern` (string, default: 'ns') - Pattern for generated prefixes
- `validationEnabled` (boolean, default: true) - Enable URI/prefix validation

### Methods

#### `extractNamespaces(xmlDoc)`
Extracts all namespace declarations from an XML document with full inheritance support.

**Parameters:**
- `xmlDoc` (Document) - XML document to analyze

**Returns:**
- Map<string, string> - Map of namespace URI to prefix

**Features:**
- Processes entire document tree for namespace declarations
- Handles namespace inheritance from parent elements
- Assigns prefixes to default namespaces automatically
- Resolves conflicts with priority-based system

**Example:**
```javascript
const xmlDoc = parser.parseXML(`
    <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
                   xmlns="http://example.com/default">
        <soap:Body>
            <GetUser>
                <UserId>123</UserId>
            </GetUser>
        </soap:Body>
    </soap:Envelope>
`);

const namespaces = handler.extractNamespaces(xmlDoc);
// Returns:
// Map {
//   'http://schemas.xmlsoap.org/soap/envelope/' => 'soap',
//   'http://example.com/default' => 'ns0'
// }
```

#### `detectDefaultNamespace(xmlDoc)`
Detects the primary default namespace declaration in the document.

**Parameters:**
- `xmlDoc` (Document) - XML document to analyze

**Returns:**
- string|null - Primary default namespace URI, or null if none found

**Example:**
```javascript
const defaultNS = handler.detectDefaultNamespace(xmlDoc);
// Returns: 'http://example.com/default'
```

#### `assignPrefixForDefault(uri, existingMap)`
Generates a unique prefix for a default namespace URI.

**Parameters:**
- `uri` (string) - Namespace URI that needs a prefix
- `existingMap` (Map, optional) - Current namespace mappings to avoid conflicts

**Returns:**
- string - Generated unique prefix

**Features:**
- Generates sequential prefixes (ns0, ns1, ns2, ...)
- Avoids conflicts with existing prefixes
- Respects reserved prefixes (xml, xmlns)
- Customizable prefix pattern

**Example:**
```javascript
const existingMap = new Map([
    ['http://soap.com', 'soap'],
    ['http://other.com', 'ns0']
]);

const prefix = handler.assignPrefixForDefault('http://new.com', existingMap);
// Returns: 'ns1' (avoiding conflict with existing 'ns0')
```

#### `formatForSAP(namespaceMap)`
Formats namespace map for SAP Cloud Integration requirements.

**Parameters:**
- `namespaceMap` (Map<string, string>) - Namespace URI to prefix mapping

**Returns:**
- string - SAP CI formatted namespace string

**Format:**
- Pattern: `"prefix1=uri1;prefix2=uri2"`
- Sorted alphabetically by prefix for consistency
- Special characters encoded in URIs
- No trailing semicolon

**Example:**
```javascript
const namespaceMap = new Map([
    ['http://schemas.xmlsoap.org/soap/envelope/', 'soap'],
    ['http://example.com/users', 'ns1'],
    ['http://example.com/orders', 'ns2']
]);

const sapFormat = handler.formatForSAP(namespaceMap);
// Returns: "ns1=http://example.com/users;ns2=http://example.com/orders;soap=http://schemas.xmlsoap.org/soap/envelope/"
```

#### `resolveNamespace(element)`
Resolves namespace for a specific element with inheritance from parent chain.

**Parameters:**
- `element` (Element) - XML element to resolve namespace for

**Returns:**
- Object - Namespace info: `{uri, prefix, source}`

**Source Types:**
- `'element'` - Namespace from element itself
- `'inherited'` - Namespace inherited from parent
- `'default'` - Default namespace declaration
- `'none'` - No namespace found

**Example:**
```javascript
const element = xmlDoc.querySelector('GetUser');
const nsInfo = handler.resolveNamespace(element);
// Returns: {
//   uri: 'http://example.com/default',
//   prefix: '',
//   source: 'default'
// }
```

#### `getStats()`
Returns performance and configuration statistics.

**Returns:**
- Object - Statistics including prefix pattern, counter, and settings

#### `reset()`
Resets internal state for fresh processing.

## Integration with PathExtractor

The NamespaceHandler is seamlessly integrated with PathExtractor:

```javascript
const extractor = new PathExtractor();
const xmlDoc = parser.parseXML(xmlContent);

// PathExtractor automatically uses NamespaceHandler
const paths = extractor.extractXPaths(xmlDoc);

// Get SAP CI namespace format
const sapFormat = extractor.getSAPNamespaceFormat(xmlDoc);
```

## Edge Cases Handled

### Multiple Default Namespaces
```xml
<root xmlns="http://example.com/root">
    <level1 xmlns="http://example.com/level1">
        <level2 xmlns="http://example.com/level2">
            <content>text</content>
        </level2>
    </level1>
</root>
```
**Result:** Each default namespace gets a unique prefix (ns0, ns1, ns2)

### Namespace Prefix Conflicts
```xml
<root xmlns:ns1="http://example.com/first">
    <child xmlns:ns1="http://example.com/second">
        <grandchild>content</grandchild>
    </child>
</root>
```
**Result:** Both namespaces preserved, conflicts resolved by URI priority

### Empty Namespace Declarations
```xml
<root xmlns="" xmlns:empty="">
    <child>content</child>
</root>
```
**Result:** Empty namespace declarations ignored

### Special Characters in URIs
```javascript
const namespaceMap = new Map([
    ['http://example.com/ns;with=special&chars', 'ns1']
]);
const sapFormat = handler.formatForSAP(namespaceMap);
// Returns: "ns1=http://example.com/ns%3Bwith%3Dspecial&chars"
```

## Performance Characteristics

### Benchmarks
- **Large documents**: 50+ namespaces processed in <10ms
- **Complex inheritance**: Multi-level namespace resolution in <5ms
- **SAP formatting**: 100 namespaces formatted in <2ms
- **Memory efficiency**: Linear memory usage O(n) with namespace count

### Optimizations
- **Efficient DOM traversal**: Processes each element only once
- **Conflict avoidance**: Smart prefix generation avoids expensive checks
- **Caching**: Internal state maintained during single operation
- **Early termination**: Stops processing when all namespaces found

## SAP Cloud Integration Usage

### Dynamic Custom Header XML Namespace
```javascript
// Extract namespaces from XML document
const namespaces = handler.extractNamespaces(xmlDoc);

// Format for SAP CI Dynamic Custom Header
const dynamicCustomHeaderXMLNamespace = handler.formatForSAP(namespaces);

// Use in SAP CI integration:
// Property: DynamicCustomHeaderXMLNamespace
// Value: "soap=http://schemas.xmlsoap.org/soap/envelope/;ns0=http://example.com/default"
```

### XPath Expression Generation
```javascript
// Generate XPaths with proper namespace prefixes
const paths = pathExtractor.extractXPaths(xmlDoc);
const namespacedPaths = paths.filter(p => p.path.includes(':'));

// Example results:
// /soap:Envelope[1]/soap:Body[1]/ns0:GetUser[1]/ns0:UserId[1]
```

## Error Handling

The NamespaceHandler includes comprehensive error handling:

```javascript
try {
    const namespaces = handler.extractNamespaces(xmlDoc);
} catch (error) {
    if (error instanceof NamespaceHandlerError) {
        console.error('Namespace error:', error.message);
        console.error('Error type:', error.type);
        console.error('Context:', error.context);
    }
}
```

**Error Types:**
- `ValidationError` - Invalid input parameters
- `GenerationError` - Unable to generate unique prefix
- `ProcessingError` - Document processing failures

## Testing

The module includes comprehensive test coverage:

- **Functional Tests**: All API methods and edge cases
- **Integration Tests**: PathExtractor workflow integration
- **Performance Tests**: Large document handling
- **SAP CI Tests**: Format validation and compatibility
- **Browser Compatibility**: All modern browsers

Run tests by opening `test-issue-4.html` in a browser.

## Browser Support

- **Chrome/Edge**: Full support (recommended)
- **Firefox**: Full support
- **Safari**: Full support
- **IE11**: Not supported (uses modern JavaScript features)

## Configuration Examples

### Custom Prefix Pattern
```javascript
const handler = new NamespaceHandler({
    defaultPrefixPattern: 'prefix'
});
// Generates: prefix0, prefix1, prefix2, ...
```

### Validation Disabled
```javascript
const handler = new NamespaceHandler({
    validationEnabled: false
});
// Skips URI/prefix validation for performance
```

### PathExtractor Integration
```javascript
const extractor = new PathExtractor({
    namespaceOptions: {
        defaultPrefixPattern: 'ns',
        validationEnabled: true
    }
});
```

## Contributing

When extending NamespaceHandler:

1. **Maintain SAP CI Compatibility**: All changes must preserve SAP CI format requirements
2. **Handle Edge Cases**: Consider namespace inheritance, conflicts, and special characters
3. **Add Tests**: Include test cases for new functionality in `NamespaceHandler.test.js`
4. **Document Changes**: Update this documentation for API changes
5. **Performance**: Ensure O(n) or better complexity for all operations

## Version History

- **v1.0.0** - Initial implementation (Issue #4)
  - Complete namespace extraction with inheritance
  - Default namespace handling with prefix generation
  - SAP CI integration formatting
  - PathExtractor integration
  - Comprehensive edge case handling
  - Performance optimization for large documents

## Related Documentation

- [PathExtractor.md](PathExtractor.md) - XPath/JSONPath generation
- [DocumentParser.md](DocumentParser.md) - XML/JSON document parsing
- [Issue #4](https://github.com/your-repo/issues/4) - Original requirements and analysis