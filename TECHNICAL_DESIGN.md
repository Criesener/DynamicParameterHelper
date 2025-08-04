# Technical Design Document: Dynamic Parameter Helper

## Architecture Overview

### Design Principles
1. **Zero Backend Dependency**: All processing happens client-side
2. **Single File Distribution**: One HTML file containing all necessary code
3. **Performance First**: Efficient handling of large XML/JSON documents
4. **SAP CI Compatibility**: Output format matches SAP Cloud Integration requirements

## Core Components

### 1. Document Parser Module
```javascript
class DocumentParser {
    parseXML(xmlString) {
        // Uses native DOMParser
        // Returns structured tree with namespace information
    }
    
    parseJSON(jsonString) {
        // Uses JSON.parse with error handling
        // Returns structured tree representation
    }
    
    detectFormat(input) {
        // Auto-detects XML vs JSON format
    }
}
```

### 2. Path Extractor Module
```javascript
class PathExtractor {
    extractXPaths(xmlDoc) {
        // Recursive traversal of XML DOM
        // Generates full XPath for each element
        // Handles namespace prefixes
    }
    
    extractJSONPaths(jsonObj) {
        // Recursive traversal of JSON object
        // Generates JSONPath expressions
        // Handles arrays and nested objects
    }
}
```

### 3. Namespace Handler
```javascript
class NamespaceHandler {
    extractNamespaces(xmlDoc) {
        // Scans for xmlns declarations
        // Maps prefixes to URIs
        // Handles default namespaces
    }
    
    formatForSAP(namespaceMap) {
        // Formats as "prefix=uri;prefix2=uri2"
        // Validates namespace URIs
    }
}
```

### 4. UI Controller
```javascript
class UIController {
    renderTree(pathData) {
        // Creates interactive tree view
        // Implements checkbox selection
        // Handles expand/collapse
    }
    
    updateOutput() {
        // Updates output fields in real-time
        // Formats selected paths
    }
}
```

## Data Flow

1. **Input Stage**
   - User pastes XML/JSON into textarea
   - Format detection triggers appropriate parser

2. **Processing Stage**
   - Parser creates DOM/object representation
   - Path extractor generates all possible paths
   - Namespace handler extracts declarations (XML only)

3. **Presentation Stage**
   - UI renders interactive tree with checkboxes
   - User selects desired paths
   - Output fields update automatically

4. **Output Stage**
   - Selected paths formatted for SAP CI
   - Namespace declarations formatted (XML only)
   - Copy-to-clipboard functionality

## Key Algorithms

### XPath Generation Algorithm
```javascript
function generateXPath(element, namespaceMap) {
    let path = '';
    let current = element;
    
    while (current && current.nodeType === Node.ELEMENT_NODE) {
        let index = getElementIndex(current);
        let prefix = namespaceMap.get(current.namespaceURI) || '';
        let tagName = prefix ? `${prefix}:${current.localName}` : current.localName;
        
        path = `/${tagName}[${index}]${path}`;
        current = current.parentNode;
    }
    
    return path;
}
```

### JSONPath Generation Algorithm
```javascript
function generateJSONPath(obj, currentPath = '$') {
    let paths = [];
    
    for (let key in obj) {
        let newPath = Array.isArray(obj) 
            ? `${currentPath}[${key}]` 
            : `${currentPath}.${key}`;
            
        paths.push({
            path: newPath,
            value: obj[key],
            key: key
        });
        
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            paths.push(...generateJSONPath(obj[key], newPath));
        }
    }
    
    return paths;
}
```

## Performance Considerations

### Large Document Handling
- **Virtual Scrolling**: Only render visible tree nodes
- **Lazy Loading**: Expand nodes on demand
- **Path Caching**: Store generated paths to avoid recalculation
- **Debounced Updates**: Batch UI updates for smooth interaction

### Memory Management
- **WeakMap Usage**: For DOM element metadata
- **Garbage Collection**: Clear references when switching documents
- **String Optimization**: Use string builders for large concatenations

## Security Considerations

1. **Input Validation**
   - Sanitize user input before parsing
   - Limit document size to prevent DoS
   - Validate XML/JSON structure

2. **XSS Prevention**
   - Escape all user content in UI
   - Use textContent instead of innerHTML
   - Sanitize paths before display

3. **Content Security Policy**
   - Inline scripts with nonce
   - No external resource loading
   - Strict CSP headers recommended

## Browser API Usage

### Native APIs Utilized
- `DOMParser`: XML parsing
- `document.evaluate()`: XPath evaluation
- `JSON.parse()`: JSON parsing
- `Clipboard API`: Copy functionality
- `FileReader API`: File upload support

### Polyfills Required
- None for modern browsers (2020+)
- Optional IE11 support via separate polyfill file

## Testing Strategy

### Unit Tests
- Path generation accuracy
- Namespace extraction correctness
- Format detection reliability

### Integration Tests
- End-to-end workflow validation
- Large document performance
- Browser compatibility

### Test Data
- Various XML schemas (SOAP, REST, proprietary)
- Complex JSON structures (nested, arrays)
- Edge cases (empty elements, special characters)

## Future Enhancements

1. **Advanced Features**
   - XPath 2.0 support
   - JSONPath advanced operators
   - Path validation against sample data
   - Expression builder UI

2. **Integration Options**
   - Browser extension version
   - VS Code extension
   - Direct SAP CI plugin

3. **Performance Improvements**
   - Web Workers for parsing
   - WebAssembly for heavy processing
   - IndexedDB for caching

## Implementation Phases

### Phase 1: Core Functionality (MVP)
- Basic XML/JSON parsing
- Simple path extraction
- Text-based output

### Phase 2: Enhanced UI
- Interactive tree view
- Checkbox selection
- Real-time updates

### Phase 3: SAP Integration
- Namespace handling
- Proper output formatting
- Copy functionality

### Phase 4: Polish & Performance
- Large document optimization
- Error handling
- User experience improvements