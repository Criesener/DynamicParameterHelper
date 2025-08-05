
// Bundled JavaScript modules

// src/DocumentParser.js
(function() {
/**
 * DocumentParser - Core module for parsing XML and JSON documents
 * Handles format detection, validation, security, and parsing with comprehensive error handling
 * 
 * Features:
 * - Auto-detection of XML vs JSON format
 * - Robust parsing with detailed error reporting
 * - Security validation and sanitization
 * - 10MB size limit enforcement
 * - Performance optimization for large documents
 * - Namespace preservation for XML
 */
class DocumentParser {
    constructor(options = {}) {
        this.maxSize = options.maxSize || 10 * 1024 * 1024; // 10MB default
        this.maxDepth = options.maxDepth || 100;
        this.timeout = options.timeout || 30000; // 30 seconds
    }

    /**
     * Main parsing method - detects format and parses accordingly
     * @param {string} input - Raw document string
     * @returns {Object} Parsed document with metadata
     */
    async parse(input) {
        try {
            // Input validation and security checks
            this.validateInput(input);
            
            // Detect format
            const format = this.detectFormat(input);
            
            if (format === 'invalid') {
                throw new Error('Unable to determine document format. Please ensure input is valid XML or JSON.');
            }
            
            // Parse based on detected format
            const result = format === 'xml' 
                ? await this.parseXML(input)
                : await this.parseJSON(input);
                
            return {
                format,
                data: result,
                metadata: {
                    size: new Blob([input]).size,
                    parsedAt: new Date().toISOString(),
                    depth: this.calculateDepth(result)
                }
            };
            
        } catch (error) {
            throw new DocumentParserError(error.message, error.name || 'ParseError', {
                input: input ? input.substring(0, 100) + '...' : null,
                inputSize: input ? new Blob([input]).size : 0
            });
        }
    }

    /**
     * Validates input document for security and size constraints
     * @param {string} input - Document to validate
     */
    validateInput(input) {
        if (!input || typeof input !== 'string') {
            throw new Error('Input must be a non-empty string');
        }

        // Check size before any processing
        const sizeInBytes = new Blob([input]).size;
        if (sizeInBytes > this.maxSize) {
            throw new Error(`Document exceeds ${this.maxSize / (1024 * 1024)}MB limit (actual: ${(sizeInBytes / (1024 * 1024)).toFixed(2)}MB)`);
        }

        // Security validation - check for null bytes and potentially malicious content
        if (input.includes('\0')) {
            throw new Error('Document contains null bytes which are not allowed');
        }

        // Check for extremely long lines that might cause issues
        const lines = input.split('\n');
        const maxLineLength = 10000;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].length > maxLineLength) {
                throw new Error(`Line ${i + 1} exceeds maximum length of ${maxLineLength} characters`);
            }
        }

        // Estimate depth to prevent stack overflow
        const estimatedDepth = this.estimateDepth(input);
        if (estimatedDepth > this.maxDepth) {
            throw new Error(`Document nesting appears too deep (estimated: ${estimatedDepth}, max: ${this.maxDepth})`);
        }
    }

    /**
     * Detects whether input is XML or JSON using multiple strategies
     * @param {string} input - Document to analyze
     * @returns {string} 'xml', 'json', or 'invalid'
     */
    detectFormat(input) {
        const trimmed = input.trim();
        
        if (!trimmed) {
            return 'invalid';
        }

        // Strategy 1: Try JSON first (faster, more deterministic)
        if (this.looksLikeJSON(trimmed)) {
            try {
                JSON.parse(trimmed);
                return 'json';
            } catch (e) {
                // Not valid JSON, continue
            }
        }

        // Strategy 2: XML detection with multiple checks
        if (this.looksLikeXML(trimmed)) {
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(trimmed, 'application/xml');
                
                // Check for parse errors
                const parseError = doc.querySelector('parsererror');
                if (!parseError) {
                    return 'xml';
                }
            } catch (e) {
                // Not valid XML
            }
        }

        return 'invalid';
    }

    /**
     * Quick heuristic check if content looks like JSON
     * @param {string} input - Trimmed input
     * @returns {boolean}
     */
    looksLikeJSON(input) {
        return (input.startsWith('{') && input.endsWith('}')) ||
               (input.startsWith('[') && input.endsWith(']')) ||
               (input.startsWith('"') && input.endsWith('"')) ||
               input === 'null' ||
               input === 'true' ||
               input === 'false' ||
               !isNaN(Number(input));
    }

    /**
     * Quick heuristic check if content looks like XML
     * @param {string} input - Trimmed input
     * @returns {boolean}
     */
    looksLikeXML(input) {
        return input.startsWith('<?xml') ||
               input.startsWith('<!DOCTYPE') ||
               (input.startsWith('<') && input.includes('>'));
    }

    /**
     * Parses XML document with comprehensive error handling
     * @param {string} xmlString - XML content
     * @returns {Document} Parsed XML document
     */
    async parseXML(xmlString) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(xmlString, 'application/xml');
            
            // Check for parse errors
            const parseError = doc.querySelector('parsererror');
            if (parseError) {
                const errorText = parseError.textContent;
                const lineMatch = errorText.match(/line (\d+)/i);
                const columnMatch = errorText.match(/column (\d+)/i);
                
                const line = lineMatch ? lineMatch[1] : 'unknown';
                const column = columnMatch ? columnMatch[1] : 'unknown';
                
                throw new Error(`XML parsing failed at line ${line}, column ${column}: ${errorText}`);
            }

            // Validate document has content
            if (!doc.documentElement) {
                throw new Error('XML document is empty or invalid');
            }

            // Additional validation
            this.validateXMLDocument(doc);

            return doc;
            
        } catch (error) {
            if (error.message.includes('XML parsing failed')) {
                throw error;
            }
            throw new Error(`XML parsing error: ${error.message}`);
        }
    }

    /**
     * Parses JSON document with comprehensive error handling
     * @param {string} jsonString - JSON content
     * @returns {any} Parsed JSON object/array/primitive
     */
    async parseJSON(jsonString) {
        try {
            // Custom JSON parsing with detailed error information
            const result = JSON.parse(jsonString);
            
            // Additional validation
            this.validateJSONData(result);
            
            return result;
            
        } catch (error) {
            // Enhanced JSON error reporting
            const match = error.message.match(/position (\d+)/);
            if (match) {
                const position = parseInt(match[1]);
                const line = this.getLineNumber(jsonString, position);
                const column = this.getColumnNumber(jsonString, position);
                
                throw new Error(`JSON parsing failed at line ${line}, column ${column}: ${error.message}`);
            }
            
            throw new Error(`JSON parsing error: ${error.message}`);
        }
    }

    /**
     * Validates XML document for potential issues
     * @param {Document} doc - Parsed XML document
     */
    validateXMLDocument(doc) {
        if (!doc || !doc.documentElement) {
            throw new Error('XML document is empty or invalid');
        }
        
        const root = doc.documentElement;
        
        // Check for suspicious attributes that might indicate malicious content
        const allElements = root.getElementsByTagName('*');
        for (let element of allElements) {
            // Check for script-like attributes
            if (element.attributes) {
                for (let attr of element.attributes) {
                    if (attr.name.toLowerCase().startsWith('on') || 
                        attr.value.toLowerCase().includes('javascript:')) {
                        console.warn('Potentially unsafe attribute detected:', attr.name, attr.value);
                    }
                }
            }
        }
    }

    /**
     * Validates JSON data for potential issues
     * @param {any} data - Parsed JSON data
     */
    validateJSONData(data) {
        // Check for prototype pollution attempts
        if (typeof data === 'object' && data !== null) {
            this.checkForPrototypePollution(data);
        }
    }

    /**
     * Recursively checks object for prototype pollution attempts
     * @param {any} obj - Object to check
     * @param {Set} visited - Visited objects (circular reference detection)
     */
    checkForPrototypePollution(obj, visited = new Set()) {
        if (visited.has(obj) || typeof obj !== 'object' || obj === null) {
            return;
        }
        
        visited.add(obj);
        
        const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
        
        if (Array.isArray(obj)) {
            obj.forEach(item => this.checkForPrototypePollution(item, visited));
        } else {
            for (const key in obj) {
                if (dangerousKeys.includes(key)) {
                    console.warn('Potentially dangerous key detected:', key);
                }
                this.checkForPrototypePollution(obj[key], visited);
            }
        }
    }

    /**
     * Estimates document nesting depth to prevent stack overflow
     * @param {string} input - Document string
     * @returns {number} Estimated depth
     */
    estimateDepth(input) {
        let maxDepth = 0;
        let currentDepth = 0;
        let inString = false;
        let stringChar = null;
        let inTag = false;
        
        for (let i = 0; i < input.length; i++) {
            const char = input[i];
            const prevChar = i > 0 ? input[i - 1] : '';
            
            // Handle string literals in JSON
            if ((char === '"' || char === "'") && prevChar !== '\\') {
                if (!inString) {
                    inString = true;
                    stringChar = char;
                } else if (char === stringChar) {
                    inString = false;
                    stringChar = null;
                }
                continue;
            }
            
            if (inString) continue;
            
            // Handle XML tags more carefully
            if (char === '<' && !inTag) {
                // Skip closing tags and self-closing tags for depth counting
                const nextChars = input.substring(i, i + 10);
                if (!nextChars.startsWith('</') && !nextChars.includes('/>')) {
                    currentDepth++;
                    maxDepth = Math.max(maxDepth, currentDepth);
                }
                inTag = true;
            } else if (char === '>' && inTag) {
                inTag = false;
                // Check if this was a closing tag
                const tagContent = input.substring(input.lastIndexOf('<', i), i + 1);
                if (tagContent.startsWith('</')) {
                    currentDepth = Math.max(0, currentDepth - 1);
                }
            } else if (char === '{' || char === '[') {
                if (!inTag) {
                    currentDepth++;
                    maxDepth = Math.max(maxDepth, currentDepth);
                }
            } else if (char === '}' || char === ']') {
                if (!inTag) {
                    currentDepth = Math.max(0, currentDepth - 1);
                }
            }
        }
        
        return maxDepth;
    }

    /**
     * Calculates actual depth of parsed structure
     * @param {any} data - Parsed data
     * @returns {number} Actual depth
     */
    calculateDepth(data) {
        if (data === null || typeof data !== 'object') {
            return 0;
        }
        
        if (data.nodeType) { // XML Document
            return this.calculateXMLDepth(data.documentElement);
        } else {
            return this.calculateJSONDepth(data);
        }
    }

    /**
     * Calculates depth of XML element tree
     * @param {Element} element - XML element
     * @returns {number} Depth
     */
    calculateXMLDepth(element) {
        if (!element || !element.children) {
            return 1;
        }
        
        let maxChildDepth = 0;
        for (let child of element.children) {
            maxChildDepth = Math.max(maxChildDepth, this.calculateXMLDepth(child));
        }
        
        return 1 + maxChildDepth;
    }

    /**
     * Calculates depth of JSON object/array
     * @param {any} obj - JSON object
     * @returns {number} Depth
     */
    calculateJSONDepth(obj) {
        if (typeof obj !== 'object' || obj === null) {
            return 0;
        }
        
        let maxDepth = 0;
        const values = Array.isArray(obj) ? obj : Object.values(obj);
        
        for (const value of values) {
            if (typeof value === 'object' && value !== null) {
                maxDepth = Math.max(maxDepth, this.calculateJSONDepth(value));
            }
        }
        
        return 1 + maxDepth;
    }

    /**
     * Gets line number for a character position in string
     * @param {string} str - Input string
     * @param {number} position - Character position
     * @returns {number} Line number (1-based)
     */
    getLineNumber(str, position) {
        return str.substring(0, position).split('\n').length;
    }

    /**
     * Gets column number for a character position in string
     * @param {string} str - Input string
     * @param {number} position - Character position
     * @returns {number} Column number (1-based)
     */
    getColumnNumber(str, position) {
        const lines = str.substring(0, position).split('\n');
        return lines[lines.length - 1].length + 1;
    }
}

/**
 * Custom error class for DocumentParser errors
 */
class DocumentParserError extends Error {
    constructor(message, type = 'ParseError', context = {}) {
        super(message);
        this.name = 'DocumentParserError';
        this.type = type;
        this.context = context;
        this.timestamp = new Date().toISOString();
        
        // Maintain proper stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, DocumentParserError);
        }
    }
}

// Export for both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
    
} else if (typeof window !== 'undefined') {
    window.DocumentParser = DocumentParser;
    window.DocumentParserError = DocumentParserError;
}


window.DocumentParser = DocumentParser;

window.DocumentParserError = DocumentParserError;

})();

// src/PathExtractor.js
(function() {
/**
 * PathExtractor - Generates XPath and JSONPath expressions from parsed documents
 * Handles namespace prefixes, array indices, and special characters correctly
 * 
 * Features:
 * - Generate valid XPath 1.0 expressions for XML elements
 * - Generate valid JSONPath expressions for JSON properties  
 * - Handle XML attributes (@attribute syntax)
 * - Preserve namespace prefixes in XPath
 * - Handle array notation correctly
 * - Performance optimized for large documents (1MB in <1s, 10k+ paths)
 */

// Import NamespaceHandler for namespace support


// Fallback for CommonJS environments
let CJSNamespaceHandler;
if (typeof require !== 'undefined' && typeof module !== 'undefined') {
    try {
        CJSNamespaceHandler = require('./NamespaceHandler');
    } catch (e) {
        // Ignore error in ES module environments
    }
}

class PathExtractor {
    constructor(options = {}) {
        this.includeAttributes = options.includeAttributes !== false; // default true
        this.includeTextNodes = options.includeTextNodes || false;
        this.maxPaths = options.maxPaths || 50000; // Performance limit
        
        // Initialize NamespaceHandler for proper XML namespace support
        this.namespaceHandler = new NamespaceHandler(options.namespaceOptions || {});
    }

    /**
     * Extract all XPath expressions from XML document
     * @param {Document} xmlDoc - Parsed XML document from DocumentParser
     * @returns {Array} Array of {path, element, name, type, namespaceURI}
     */
    extractXPaths(xmlDoc) {
        if (!xmlDoc || !xmlDoc.documentElement) {
            throw new Error('Invalid XML document provided');
        }

        const paths = [];
        // Use NamespaceHandler for proper namespace extraction
        const namespaceMap = this.namespaceHandler.extractNamespaces(xmlDoc);
        
        // Start traversal from document element
        this.traverseXMLElement(xmlDoc.documentElement, paths, namespaceMap);
        
        if (paths.length > this.maxPaths) {
            console.warn(`Document contains ${paths.length} paths, truncating to ${this.maxPaths} for performance`);
            return paths.slice(0, this.maxPaths);
        }
        
        return paths;
    }

    /**
     * Extract all JSONPath expressions from JSON object
     * @param {any} jsonObj - Parsed JSON object from DocumentParser  
     * @returns {Array} Array of {path, value, key, type}
     */
    extractJSONPaths(jsonObj) {
        if (jsonObj === null || jsonObj === undefined) {
            throw new Error('Invalid JSON object provided');
        }

        const paths = [];
        
        // Start traversal from root
        this.traverseJSONObject(jsonObj, '
</html>, paths);
        
        if (paths.length > this.maxPaths) {
            console.warn(`Document contains ${paths.length} paths, truncating to ${this.maxPaths} for performance`);
            return paths.slice(0, this.maxPaths);
        }
        
        return paths;
    }

    /**
     * Generate XPath for specific element with namespace handling
     * @param {Element} element - XML element
     * @param {Map} namespaceMap - Namespace prefix to URI mapping
     * @returns {string} XPath expression
     */
    generateXPath(element, namespaceMap) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) {
            throw new Error('Invalid element provided for XPath generation');
        }

        let path = '';
        let current = element;
        
        while (current && current.nodeType === Node.ELEMENT_NODE) {
            const index = this.getElementIndex(current);
            const prefix = this.getNamespacePrefix(current, namespaceMap);
            const localName = current.localName || current.nodeName;
            const tagName = prefix ? `${prefix}:${localName}` : localName;
            
            path = `/${tagName}[${index}]${path}`;
            current = current.parentNode;
        }
        
        return path || '/';
    }

    /**
     * Generate JSONPath for specific object path
     * @param {any} obj - Current object
     * @param {string} currentPath - Current path being built
     * @returns {string} JSONPath expression
     */
    generateJSONPath(obj, currentPath) {
        if (currentPath === undefined || currentPath === null) {
            return '
</html>;
        }
        
        return currentPath;
    }

    /**
     * Extract namespace declarations from XML document
     * @deprecated Use NamespaceHandler.extractNamespaces() instead
     * @param {Document} xmlDoc - XML document
     * @returns {Map} Map of namespace URI to prefix
     */
    extractNamespaces(xmlDoc) {
        console.warn('PathExtractor.extractNamespaces() is deprecated. Use NamespaceHandler.extractNamespaces() instead.');
        return this.namespaceHandler.extractNamespaces(xmlDoc);
    }

    /**
     * Extract namespace declarations from specific element
     * @deprecated Use NamespaceHandler methods instead
     * @param {Element} element - XML element
     * @param {Map} namespaceMap - Map to populate
     */
    extractElementNamespaces(element, namespaceMap) {
        console.warn('PathExtractor.extractElementNamespaces() is deprecated. Use NamespaceHandler methods instead.');
        // Legacy support - delegate to NamespaceHandler
        if (!element.attributes) return;
        
        for (let attr of element.attributes) {
            if (attr.name === 'xmlns') {
                // Default namespace - let NamespaceHandler assign proper prefix
                if (attr.value && attr.value.trim()) {
                    const prefix = this.namespaceHandler.assignPrefixForDefault(attr.value, namespaceMap);
                    namespaceMap.set(attr.value, prefix);
                }
            } else if (attr.name.startsWith('xmlns:')) {
                // Prefixed namespace
                const prefix = attr.name.substring(6);
                if (attr.value && attr.value.trim() && prefix) {
                    namespaceMap.set(attr.value, prefix);
                }
            }
        }
        
        // Add element's own namespace if not already mapped
        if (element.namespaceURI && !Array.from(namespaceMap.keys()).includes(element.namespaceURI)) {
            const prefix = element.prefix || this.namespaceHandler.assignPrefixForDefault(element.namespaceURI, namespaceMap);
            namespaceMap.set(element.namespaceURI, prefix);
        }
    }

    /**
     * Get namespace prefix for element
     * @param {Element} element - XML element
     * @param {Map} namespaceMap - Namespace mapping
     * @returns {string} Namespace prefix or empty string
     */
    getNamespacePrefix(element, namespaceMap) {
        if (!element.namespaceURI) {
            return '';
        }
        
        // Try to find exact match
        if (namespaceMap.has(element.namespaceURI)) {
            return namespaceMap.get(element.namespaceURI);
        }
        
        // Use element's own prefix if available
        return element.prefix || '';
    }

    /**
     * Get element index among siblings with same name
     * @param {Element} element - XML element
     * @returns {number} 1-based index
     */
    getElementIndex(element) {
        if (!element.parentNode) {
            return 1;
        }
        
        const siblings = Array.from(element.parentNode.children || []);
        const sameNameSiblings = siblings.filter(sibling => 
            sibling.namespaceURI === element.namespaceURI && 
            (sibling.localName || sibling.nodeName) === (element.localName || element.nodeName)
        );
        
        const index = sameNameSiblings.indexOf(element);
        return index >= 0 ? index + 1 : 1;
    }

    /**
     * Recursively traverse XML element tree
     * @param {Element} element - Current element
     * @param {Array} paths - Array to populate with paths
     * @param {Map} namespaceMap - Namespace mapping
     */
    traverseXMLElement(element, paths, namespaceMap) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) {
            return;
        }

        const xpath = this.generateXPath(element, namespaceMap);
        const localName = element.localName || element.nodeName;
        
        // Add element path
        paths.push({
            path: xpath,
            element: element,
            name: localName,
            type: 'element',
            namespaceURI: element.namespaceURI || null
        });

        // Add attribute paths if enabled
        if (this.includeAttributes && element.attributes) {
            for (let attr of element.attributes) {
                // Skip namespace declarations
                if (attr.name.startsWith('xmlns')) {
                    continue;
                }
                
                const attrPath = `${xpath}/@${attr.name}`;
                paths.push({
                    path: attrPath,
                    element: element,
                    name: attr.name,
                    type: 'attribute',
                    value: attr.value,
                    namespaceURI: attr.namespaceURI || null
                });
            }
        }

        // Add text content if enabled and exists
        if (this.includeTextNodes && element.textContent && element.textContent.trim()) {
            // Only add text node if element has no child elements (leaf node)
            const hasChildElements = Array.from(element.children || []).length > 0;
            if (!hasChildElements) {
                paths.push({
                    path: `${xpath}/text()`,
                    element: element,
                    name: 'text()',
                    type: 'text',
                    value: element.textContent.trim(),
                    namespaceURI: null
                });
            }
        }

        // Recursively traverse child elements
        if (element.children) {
            for (let child of element.children) {
                this.traverseXMLElement(child, paths, namespaceMap);
            }
        }
    }

    /**
     * Recursively traverse JSON object
     * @param {any} obj - Current object/array/primitive
     * @param {string} currentPath - Current JSONPath
     * @param {Array} paths - Array to populate with paths
     */
    traverseJSONObject(obj, currentPath, paths) {
        if (obj === null || obj === undefined) {
            paths.push({
                path: currentPath,
                value: obj,
                key: this.extractKeyFromPath(currentPath),
                type: 'null'
            });
            return;
        }

        const objType = Array.isArray(obj) ? 'array' : typeof obj;
        
        // Add current path
        paths.push({
            path: currentPath,
            value: obj,
            key: this.extractKeyFromPath(currentPath),
            type: objType
        });

        // Traverse object properties or array elements
        if (Array.isArray(obj)) {
            obj.forEach((item, index) => {
                const newPath = `${currentPath}[${index}]`;
                this.traverseJSONObject(item, newPath, paths);
            });
        } else if (typeof obj === 'object') {
            for (const [key, value] of Object.entries(obj)) {
                const newPath = this.buildJSONPath(currentPath, key);
                this.traverseJSONObject(value, newPath, paths);
            }
        }
    }

    /**
     * Build JSONPath handling special characters in property names
     * @param {string} currentPath - Current path
     * @param {string} key - Property key
     * @returns {string} New path
     */
    buildJSONPath(currentPath, key) {
        // Handle special characters in key names
        if (this.needsBracketNotation(key)) {
            return `${currentPath}['${key.replace(/'/g, "\\'")}']`;
        } else {
            return `${currentPath}.${key}`;
        }
    }

    /**
     * Check if property key needs bracket notation
     * @param {string} key - Property key
     * @returns {boolean} True if bracket notation needed
     */
    needsBracketNotation(key) {
        // Use bracket notation for keys with spaces, special chars, or starting with numbers
        return !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key);
    }

    /**
     * Extract key name from JSONPath
     * @param {string} path - JSONPath
     * @returns {string} Key name
     */
    extractKeyFromPath(path) {
        if (path === '
</html>) {
            return 'root';
        }
        
        // Extract last segment
        const segments = path.split(/[.\[\]'"]/).filter(s => s && s !== '
</html>);
        return segments[segments.length - 1] || 'unknown';
    }

    /**
     * Validate generated XPath expression
     * @param {string} xpath - XPath expression to validate
     * @param {Document} xmlDoc - XML document for context
     * @returns {boolean} True if valid
     */
    validateXPath(xpath, xmlDoc) {
        try {
            if (!xmlDoc || !xpath) return false;
            
            // Use browser's XPath evaluator
            const result = xmlDoc.evaluate(
                xpath,
                xmlDoc,
                null,
                XPathResult.ANY_TYPE,
                null
            );
            
            return result !== null;
        } catch (error) {
            console.warn('XPath validation failed:', xpath, error.message);
            return false;
        }
    }

    /**
     * Get performance statistics
     * @returns {Object} Performance stats
     */
    getStats() {
        return {
            maxPaths: this.maxPaths,
            includeAttributes: this.includeAttributes,
            includeTextNodes: this.includeTextNodes,
            namespaceHandler: this.namespaceHandler.getStats()
        };
    }

    /**
     * Get SAP CI formatted namespace string for current document
     * @param {Document} xmlDoc - XML document
     * @returns {string} SAP CI formatted namespace string
     */
    getSAPNamespaceFormat(xmlDoc) {
        const namespaces = this.namespaceHandler.extractNamespaces(xmlDoc);
        return this.namespaceHandler.formatForSAP(namespaces);
    }
}

/**
 * Custom error class for PathExtractor errors
 */
class PathExtractorError extends Error {
    constructor(message, type = 'ExtractionError', context = {}) {
        super(message);
        this.name = 'PathExtractorError';
        this.type = type;
        this.context = context;
        this.timestamp = new Date().toISOString();
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, PathExtractorError);
        }
    }
}

// Export for both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
    
} else if (typeof window !== 'undefined') {
    window.PathExtractor = PathExtractor;
    window.PathExtractorError = PathExtractorError;
}


window.PathExtractor = PathExtractor;

window.PathExtractorError = PathExtractorError;

})();

// src/NamespaceHandler.js
(function() {
/**
 * NamespaceHandler - Comprehensive XML namespace management for SAP CI integration
 * Handles namespace extraction, default namespace resolution, prefix generation,
 * and SAP Cloud Integration formatting requirements.
 * 
 * Features:
 * - Extract all namespace declarations with inheritance support
 * - Detect and handle default namespaces properly  
 * - Generate unique prefixes for default namespaces (ns0, ns1, etc.)
 * - Format namespaces for SAP CI: "prefix1=uri1;prefix2=uri2"
 * - Resolve namespaces for specific elements with inheritance
 * - Handle edge cases: conflicts, empty declarations, special characters
 */
class NamespaceHandler {
    constructor(options = {}) {
        this.defaultPrefixPattern = options.defaultPrefixPattern || 'ns';
        this.reservedPrefixes = new Set(['xml', 'xmlns']);
        this.prefixCounter = 0;
        this.validationEnabled = options.validationEnabled !== false; // default true
    }

    /**
     * Extract all namespace declarations from XML document with full inheritance support
     * @param {Document} xmlDoc - XML document to analyze
     * @returns {Map<string, string>} Map of namespace URI to prefix
     */
    extractNamespaces(xmlDoc) {
        if (!xmlDoc || !xmlDoc.documentElement) {
            throw new NamespaceHandlerError('Invalid XML document provided', 'ValidationError');
        }

        const namespaceMap = new Map();
        const processedElements = new Set();
        
        // Reset prefix counter for consistent generation
        this.prefixCounter = 0;
        
        // Process document element and all descendants
        this._processElementWithInheritance(xmlDoc.documentElement, namespaceMap, processedElements);
        
        // Handle any default namespaces that need prefixes
        this._assignPrefixesForDefaults(namespaceMap);
        
        return namespaceMap;
    }

    /**
     * Detect default namespace declarations in the document
     * @param {Document} xmlDoc - XML document to analyze
     * @returns {string|null} Primary default namespace URI, or null if none
     */
    detectDefaultNamespace(xmlDoc) {
        if (!xmlDoc || !xmlDoc.documentElement) {
            return null;
        }

        // Check document element first for default namespace
        const docDefaultNS = this._getElementDefaultNamespace(xmlDoc.documentElement);
        if (docDefaultNS) {
            return docDefaultNS;
        }

        // Search through all elements for default namespace declarations
        const elements = xmlDoc.getElementsByTagName('*');
        for (let element of elements) {
            const defaultNS = this._getElementDefaultNamespace(element);
            if (defaultNS) {
                return defaultNS;
            }
        }

        return null;
    }

    /**
     * Generate unique prefix for default namespace URI
     * @param {string} uri - Namespace URI that needs a prefix
     * @param {Map<string, string>} existingMap - Current namespace mappings
     * @returns {string} Generated unique prefix
     */
    assignPrefixForDefault(uri, existingMap) {
        if (!uri) {
            throw new NamespaceHandlerError('URI cannot be empty for prefix assignment', 'ValidationError');
        }

        // Check if URI already has a non-empty prefix
        if (existingMap && existingMap.has(uri)) {
            const existingPrefix = existingMap.get(uri);
            if (existingPrefix && existingPrefix.trim() !== '') {
                return existingPrefix;
            }
        }

        // Generate unique prefix
        let prefix;
        let attempts = 0;
        const maxAttempts = 1000; // Prevent infinite loops
        
        do {
            prefix = `${this.defaultPrefixPattern}${this.prefixCounter}`;
            this.prefixCounter++;
            attempts++;
            
            if (attempts > maxAttempts) {
                throw new NamespaceHandlerError('Unable to generate unique prefix', 'GenerationError');
            }
        } while (
            this.reservedPrefixes.has(prefix) || 
            (existingMap && Array.from(existingMap.values()).includes(prefix))
        );

        return prefix;
    }

    /**
     * Format namespace map for SAP CI: "prefix1=uri1;prefix2=uri2"
     * @param {Map<string, string>} namespaceMap - Namespace URI to prefix mapping
     * @returns {string} SAP CI formatted namespace string
     */
    formatForSAP(namespaceMap) {
        if (!namespaceMap || namespaceMap.size === 0) {
            return '';
        }

        const validEntries = [];
        
        for (const [uri, prefix] of namespaceMap.entries()) {
            // Skip entries with empty URI or prefix
            if (!uri || !uri.trim() || !prefix || !prefix.trim()) {
                continue;
            }
            
            // Validate URI format (basic RFC 3986 compliance)
            if (this.validationEnabled && !this._isValidNamespaceURI(uri)) {
                console.warn(`Invalid namespace URI skipped: ${uri}`);
                continue;
            }
            
            // Validate prefix format
            if (this.validationEnabled && !this._isValidPrefix(prefix)) {
                console.warn(`Invalid namespace prefix skipped: ${prefix}`);
                continue;
            }
            
            // Encode special characters in URI if needed
            const encodedURI = this._encodeURIForSAP(uri);
            validEntries.push(`${prefix}=${encodedURI}`);
        }
        
        // Sort for consistent output
        validEntries.sort();
        
        return validEntries.join(';');
    }

    /**
     * Resolve namespace for specific element with inheritance from parent chain
     * @param {Element} element - XML element to resolve namespace for
     * @returns {Object} Namespace info: {uri, prefix, source}
     */
    resolveNamespace(element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) {
            throw new NamespaceHandlerError('Invalid element provided', 'ValidationError');
        }

        // Check element's own namespace first
        if (element.namespaceURI) {
            return {
                uri: element.namespaceURI,
                prefix: element.prefix || '',
                source: 'element'
            };
        }

        // Walk up parent chain for inherited namespaces
        let current = element.parentNode;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
            if (current.namespaceURI) {
                return {
                    uri: current.namespaceURI,
                    prefix: current.prefix || '',
                    source: 'inherited'
                };
            }
            current = current.parentNode;
        }

        // Check for default namespace declarations
        const defaultNS = this._findDefaultNamespaceInHierarchy(element);
        if (defaultNS) {
            return {
                uri: defaultNS,
                prefix: '',
                source: 'default'
            };
        }

        return {
            uri: null,
            prefix: '',
            source: 'none'
        };
    }

    /**
     * Process element and extract all namespace declarations with inheritance
     * @private
     */
    _processElementWithInheritance(element, namespaceMap, processedElements) {
        if (!element || processedElements.has(element)) {
            return;
        }
        
        processedElements.add(element);
        
        // Extract namespace declarations from this element
        this._extractElementNamespaces(element, namespaceMap);
        
        // Add element's own namespace if not already mapped
        if (element.namespaceURI && !namespaceMap.has(element.namespaceURI)) {
            const prefix = element.prefix || '';
            namespaceMap.set(element.namespaceURI, prefix);
        }
        
        // Process child elements
        if (element.children) {
            for (let child of element.children) {
                this._processElementWithInheritance(child, namespaceMap, processedElements);
            }
        }
    }

    /**
     * Extract namespace declarations from specific element attributes
     * @private
     */
    _extractElementNamespaces(element, namespaceMap) {
        if (!element.attributes) return;
        
        for (let attr of element.attributes) {
            if (attr.name === 'xmlns') {
                // Default namespace declaration
                if (attr.value && attr.value.trim()) {
                    namespaceMap.set(attr.value, '');
                }
            } else if (attr.name.startsWith('xmlns:')) {
                // Prefixed namespace declaration
                const prefix = attr.name.substring(6);
                if (attr.value && attr.value.trim() && prefix) {
                    namespaceMap.set(attr.value, prefix);
                }
            }
        }
    }

    /**
     * Assign prefixes to default namespaces (those with empty prefix)
     * @private
     */
    _assignPrefixesForDefaults(namespaceMap) {
        const defaultNamespaces = [];
        
        // Find all URIs with empty prefixes
        for (const [uri, prefix] of namespaceMap.entries()) {
            if (prefix === '') {
                defaultNamespaces.push(uri);
            }
        }
        
        // Assign prefixes to default namespaces
        for (const uri of defaultNamespaces) {
            const newPrefix = this.assignPrefixForDefault(uri, namespaceMap);
            namespaceMap.set(uri, newPrefix);
        }
    }

    /**
     * Get default namespace URI from element's xmlns attribute
     * @private
     */
    _getElementDefaultNamespace(element) {
        if (!element.attributes) return null;
        
        for (let attr of element.attributes) {
            if (attr.name === 'xmlns' && attr.value && attr.value.trim()) {
                return attr.value;
            }
        }
        
        return null;
    }

    /**
     * Find default namespace by walking up element hierarchy
     * @private
     */
    _findDefaultNamespaceInHierarchy(element) {
        let current = element;
        
        while (current && current.nodeType === Node.ELEMENT_NODE) {
            const defaultNS = this._getElementDefaultNamespace(current);
            if (defaultNS) {
                return defaultNS;
            }
            current = current.parentNode;
        }
        
        return null;
    }

    /**
     * Validate namespace URI format (basic RFC 3986 compliance)
     * @private
     */
    _isValidNamespaceURI(uri) {
        try {
            // Basic URI validation - must be absolute URI
            return uri.includes(':') && (uri.startsWith('http://') || uri.startsWith('https://') || uri.includes('urn:'));
        } catch (error) {
            return false;
        }
    }

    /**
     * Validate namespace prefix format
     * @private
     */
    _isValidPrefix(prefix) {
        // XML namespace prefix rules: NCName (Name minus colon)
        return /^[a-zA-Z_][a-zA-Z0-9_.-]*$/.test(prefix) && !this.reservedPrefixes.has(prefix);
    }

    /**
     * Encode URI special characters for SAP CI compatibility
     * @private
     */
    _encodeURIForSAP(uri) {
        // Basic encoding for characters that might cause issues in SAP CI
        return uri.replace(/;/g, '%3B').replace(/=/g, '%3D');
    }

    /**
     * Get performance and configuration statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            defaultPrefixPattern: this.defaultPrefixPattern,
            prefixCounter: this.prefixCounter,
            reservedPrefixes: Array.from(this.reservedPrefixes),
            validationEnabled: this.validationEnabled
        };
    }

    /**
     * Reset internal state for fresh processing
     */
    reset() {
        this.prefixCounter = 0;
    }
}

/**
 * Custom error class for NamespaceHandler errors
 */
class NamespaceHandlerError extends Error {
    constructor(message, type = 'NamespaceError', context = {}) {
        super(message);
        this.name = 'NamespaceHandlerError';
        this.type = type;
        this.context = context;
        this.timestamp = new Date().toISOString();
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, NamespaceHandlerError);
        }
    }
}

// Export for both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
    
} else if (typeof window !== 'undefined') {
    window.NamespaceHandler = NamespaceHandler;
    window.NamespaceHandlerError = NamespaceHandlerError;
}

// ES module export

window.NamespaceHandler = NamespaceHandler;

window.NamespaceHandlerError = NamespaceHandlerError;

})();

// src/OutputFormatter.js
(function() {
/**
 * OutputFormatter - Formats selected paths for SAP Cloud Integration compatibility
 * Generates DynamicCustomHeader and DynamicCustomHeaderXMLNamespace format output
 * with real-time updates, copy functionality, and proper SAP CI escaping.
 * 
 * Features:
 * - SAP CI compatible output formatting
 * - Real-time output updates on selection changes
 * - Individual field copy functionality
 * - Special character escaping for SAP expressions
 * - Format validation and error handling
 * - Line-by-line configurable output format
 * - Download as file functionality
 */
class OutputFormatter {
    constructor(options = {}) {
        this.options = {
            lineFormat: options.lineFormat || 'multiline', // 'multiline' or 'comma'
            enableRealTime: options.enableRealTime !== false,
            escapeSpecialChars: options.escapeSpecialChars !== false,
            validateFormat: options.validateFormat !== false,
            ...options
        };
        
        // Internal state
        this.lastOutput = null;
        this.updateCallbacks = new Set();
        this.clipboardAPI = (typeof navigator !== 'undefined' && navigator.clipboard) || null;
        
        // SAP CI special characters that need escaping
        this.sapEscapeChars = {
            '\\': '\\\\',
            "'": "\\'",
            '"': '\\"',
            '\n': '\\n',
            '\r': '\\r',
            '\t': '\\t'
        };
        
        // Format validation rules for SAP CI
        this.validationRules = {
            maxPathLength: 1000,
            maxNamespaceLength: 2000,
            forbiddenChars: /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g // Control characters
        };
    }

    /**
     * Main formatting method - generates SAP CI compatible output
     * @param {Array} selectedPaths - Array of selected XPath/JSONPath strings
     * @param {Map} namespaces - Map of namespace URI to prefix from NamespaceHandler
     * @param {Object} options - Formatting options
     * @returns {Object} Formatted output for SAP CI
     */
    formatForSAP(selectedPaths, namespaces = new Map(), options = {}) {
        if (!Array.isArray(selectedPaths)) {
            throw new Error('selectedPaths must be an array');
        }
        
        try {
            // Format DynamicCustomHeader - paths for element selection
            const formattedHeader = this.formatDynamicHeader(selectedPaths, options);
            
            // Format DynamicCustomHeaderXMLNamespace - namespace declarations
            const formattedNamespaces = this.formatNamespaceHeader(namespaces, options);
            
            // Create complete output object
            const output = {
                DynamicCustomHeader: formattedHeader,
                DynamicCustomHeaderXMLNamespace: formattedNamespaces,
                metadata: {
                    pathCount: selectedPaths.length,
                    namespaceCount: namespaces.size,
                    format: this.options.lineFormat,
                    generated: new Date().toISOString(),
                    valid: true,
                    errors: []
                }
            };
            
            // Validate output if enabled
            if (this.options.validateFormat) {
                this._validateOutput(output);
            }
            
            // Store for comparison and callbacks
            this.lastOutput = output;
            
            // Trigger update callbacks for real-time updates
            if (this.options.enableRealTime) {
                this._triggerUpdateCallbacks(output);
            }
            
            return output;
            
        } catch (error) {
            throw new Error(`OutputFormatter error: ${error.message}`);
        }
    }

    /**
     * Format paths for DynamicCustomHeader field
     * @param {Array} paths - Array of XPath/JSONPath strings
     * @param {Object} options - Formatting options
     * @returns {string} Formatted header value
     */
    formatDynamicHeader(paths, options = {}) {
        if (!Array.isArray(paths) || paths.length === 0) {
            return '';
        }
        
        // Apply escaping if enabled
        let processedPaths = paths;
        if (this.options.escapeSpecialChars) {
            processedPaths = paths.map(path => this._escapeSAPExpression(path));
        }
        
        // Apply format - line-separated (SAP CI requirement) or comma-separated
        const format = options.lineFormat || this.options.lineFormat;
        if (format === 'multiline') {
            return processedPaths.join('\n');
        } else {
            return processedPaths.join(',');
        }
    }

    /**
     * Format namespaces for DynamicCustomHeaderXMLNamespace field
     * @param {Map} namespaces - Map of namespace URI to prefix
     * @param {Object} options - Formatting options
     * @returns {string} Formatted namespace declarations (prefix1=uri1;prefix2=uri2)
     */
    formatNamespaceHeader(namespaces, options = {}) {
        if (!namespaces || namespaces.size === 0) {
            return '';
        }
        
        const namespaceEntries = [];
        
        // Convert map to prefix=uri format
        for (const [uri, prefix] of namespaces) {
            if (uri && prefix) {
                // Escape special characters in URI if needed
                const escapedUri = this.options.escapeSpecialChars ? 
                    this._escapeSAPExpression(uri) : uri;
                
                namespaceEntries.push(`${prefix}=${escapedUri}`);
            }
        }
        
        // Join with semicolons (SAP CI format requirement)
        // Note: No trailing semicolon as per specification
        return namespaceEntries.join(';');
    }

    /**
     * Update output display in real-time
     * Triggers UI updates and callbacks when selection changes
     */
    updateOutputDisplay() {
        // This method is called by the InteractiveTreeView when selections change
        // It triggers all registered update callbacks
        if (this.lastOutput && this.options.enableRealTime) {
            this._triggerUpdateCallbacks(this.lastOutput);
        }
    }

    /**
     * Copy formatted output to clipboard
     * @param {string} field - Field to copy ('header', 'namespace', 'all')
     * @param {Object} output - Output object to copy from (optional, uses lastOutput)
     * @returns {Promise<boolean>} Success status
     */
    async copyToClipboard(field, output = null) {
        if (!this.clipboardAPI) {
            throw new Error('Clipboard API not available');
        }
        
        const outputData = output || this.lastOutput;
        if (!outputData) {
            throw new Error('No output data available to copy');
        }
        
        let textToCopy = '';
        
        switch (field) {
            case 'header':
                textToCopy = outputData.DynamicCustomHeader;
                break;
            case 'namespace':  
                textToCopy = outputData.DynamicCustomHeaderXMLNamespace;
                break;
            case 'all':
                textToCopy = this._formatCompleteOutput(outputData);
                break;
            default:
                throw new Error(`Invalid field: ${field}. Use 'header', 'namespace', or 'all'`);
        }
        
        try {
            await this.clipboardAPI.writeText(textToCopy);
            return true;
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            return false;
        }
    }

    /**
     * Register callback for real-time updates
     * @param {Function} callback - Function to call when output updates
     */
    onUpdate(callback) {
        if (typeof callback === 'function') {
            this.updateCallbacks.add(callback);
        }
    }

    /**
     * Remove update callback
     * @param {Function} callback - Callback to remove
     */
    offUpdate(callback) {
        this.updateCallbacks.delete(callback);
    }

    /**
     * Get current output statistics
     * @returns {Object} Statistics about current output
     */
    getOutputStats() {
        if (!this.lastOutput) {
            return { hasOutput: false };
        }
        
        return {
            hasOutput: true,
            pathCount: this.lastOutput.metadata.pathCount,
            namespaceCount: this.lastOutput.metadata.namespaceCount,
            headerLength: this.lastOutput.DynamicCustomHeader.length,
            namespaceLength: this.lastOutput.DynamicCustomHeaderXMLNamespace.length,
            isValid: this.lastOutput.metadata.valid,
            errors: this.lastOutput.metadata.errors,
            generated: this.lastOutput.metadata.generated
        };
    }

    /**
     * Download output as file
     * @param {string} format - File format ('txt', 'json', 'xml')
     * @param {string} filename - Optional filename
     */
    downloadAsFile(format = 'txt', filename = null) {
        if (!this.lastOutput) {
            throw new Error('No output data available to download');
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const defaultFilename = `sap-ci-output-${timestamp}`;
        
        let content = '';
        let mimeType = 'text/plain';
        let extension = 'txt';
        
        switch (format.toLowerCase()) {
            case 'txt':
                content = this._formatCompleteOutput(this.lastOutput);
                mimeType = 'text/plain';
                extension = 'txt';
                break;
            case 'json':
                content = JSON.stringify(this.lastOutput, null, 2);
                mimeType = 'application/json';
                extension = 'json';
                break;
            default:
                throw new Error(`Unsupported format: ${format}`);
        }
        
        // Create and trigger download (browser only)
        if (typeof document !== 'undefined' && typeof URL !== 'undefined' && typeof Blob !== 'undefined') {
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename || `${defaultFilename}.${extension}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } else {
            throw new Error('Download functionality requires browser environment');
        }
    }

    // ===== PRIVATE METHODS =====

    /**
     * Escape special characters for SAP expressions
     * @private
     */
    _escapeSAPExpression(str) {
        if (typeof str !== 'string') return str;
        
        let escaped = str;
        for (const [char, replacement] of Object.entries(this.sapEscapeChars)) {
            escaped = escaped.replace(new RegExp(char.replace(/[.*+?^${}()|[\]\\]/g, '\\</body>'), 'g'), replacement);
        }
        
        return escaped;
    }

    /**
     * Validate output against SAP CI requirements
     * @private
     */
    _validateOutput(output) {
        const errors = [];
        
        // Validate DynamicCustomHeader
        if (output.DynamicCustomHeader.length > this.validationRules.maxPathLength) {
            errors.push(`DynamicCustomHeader exceeds maximum length (${this.validationRules.maxPathLength})`);
        }
        
        // Validate DynamicCustomHeaderXMLNamespace
        if (output.DynamicCustomHeaderXMLNamespace.length > this.validationRules.maxNamespaceLength) {
            errors.push(`DynamicCustomHeaderXMLNamespace exceeds maximum length (${this.validationRules.maxNamespaceLength})`);
        }
        
        // Check for forbidden characters
        if (this.validationRules.forbiddenChars.test(output.DynamicCustomHeader)) {
            errors.push('DynamicCustomHeader contains forbidden control characters');
        }
        
        if (this.validationRules.forbiddenChars.test(output.DynamicCustomHeaderXMLNamespace)) {
            errors.push('DynamicCustomHeaderXMLNamespace contains forbidden control characters');
        }
        
        // Update output metadata
        output.metadata.valid = errors.length === 0;
        output.metadata.errors = errors;
        
        if (errors.length > 0) {
            console.warn('OutputFormatter validation warnings:', errors);
        }
    }

    /**
     * Trigger all registered update callbacks
     * @private
     */
    _triggerUpdateCallbacks(output) {
        for (const callback of this.updateCallbacks) {
            try {
                callback(output);
            } catch (error) {
                console.error('Error in OutputFormatter update callback:', error);
            }
        }
    }

    /**
     * Format complete output for display/download
     * @private
     */
    _formatCompleteOutput(output) {
        return `SAP Cloud Integration Output
Generated: ${new Date(output.metadata.generated).toLocaleString()}

DynamicCustomHeader:
${output.DynamicCustomHeader || '(no paths selected)'}

DynamicCustomHeaderXMLNamespace:
${output.DynamicCustomHeaderXMLNamespace || '(no namespaces)'}

Metadata:
- Selected Paths: ${output.metadata.pathCount}
- Namespaces: ${output.metadata.namespaceCount}
- Format: ${output.metadata.format}
- Valid: ${output.metadata.valid}
${output.metadata.errors.length > 0 ? `- Errors: ${output.metadata.errors.join(', ')}` : ''}`;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    
}

// ES module export

window.OutputFormatter = OutputFormatter;

})();

// src/TreeDataTransformer.js
(function() {
/**
 * TreeDataTransformer - Converts flat XPath/JSONPath arrays into hierarchical tree structures
 * Optimized for performance with large datasets (10k+ paths) and virtual scrolling support
 * 
 * Features:
 * - Transform flat paths to hierarchical TreeNode structure
 * - Handle both XPath and JSONPath formats
 * - Support for flattening tree for virtual scrolling
 * - Preserve original path metadata and types
 * - Efficient parent-child relationship mapping
 */
class TreeDataTransformer {
    constructor(options = {}) {
        this.nodeIdCounter = 0;
        this.nodeMap = new Map(); // ID -> TreeNode mapping for fast lookups
        this.pathToNodeMap = new Map(); // Path -> TreeNode for deduplication
    }

    /**
     * Transform flat path array to hierarchical tree structure
     * @param {Array} paths - Array of path objects from PathExtractor
     * @param {string} documentFormat - 'xml' or 'json'
     * @returns {TreeNode} Root tree node
     */
    transformPathsToTree(paths, documentFormat) {
        if (!paths || !Array.isArray(paths) || paths.length === 0) {
            throw new TreeDataTransformerError('Invalid paths array provided', 'ValidationError');
        }

        // Reset state for new transformation
        this.reset();

        // Create virtual root node
        const rootNode = this.createTreeNode('$root', null, {
            type: 'root',
            displayName: documentFormat === 'xml' ? 'XML Document' : 'JSON Document',
            isRoot: true
        });

        // Group paths by their hierarchical structure
        const pathGroups = this.groupPathsByHierarchy(paths, documentFormat);

        // Build tree structure
        this.buildTreeFromGroups(rootNode, pathGroups, documentFormat);

        return rootNode;
    }

    /**
     * Flatten tree structure for virtual scrolling
     * @param {TreeNode} rootNode - Root node of the tree
     * @param {boolean} respectExpansion - Only include visible (expanded) nodes
     * @returns {Array} Flat array of TreeNode objects in display order
     */
    flattenTreeForDisplay(rootNode, respectExpansion = true) {
        const flattenedNodes = [];
        
        const traverse = (node, level = 0) => {
            if (!node) return;

            // Add current node (skip virtual root)
            if (!node.metadata.isRoot) {
                flattenedNodes.push({
                    ...node,
                    level: level,
                    displayIndex: flattenedNodes.length
                });
            }

            // Add children if expanded or expansion is ignored
            if (!respectExpansion || node.expanded || node.metadata.isRoot) {
                const childLevel = node.metadata.isRoot ? 0 : level + 1;
                for (const child of node.children.values()) {
                    traverse(child, childLevel);
                }
            }
        };

        traverse(rootNode);
        return flattenedNodes;
    }

    /**
     * Create a new TreeNode with unique ID
     * @param {string} path - Full path (XPath or JSONPath)
     * @param {any} originalData - Original data from PathExtractor
     * @param {Object} metadata - Additional metadata
     * @returns {TreeNode}
     */
    createTreeNode(path, originalData, metadata = {}) {
        const node = new TreeNode(
            this.generateNodeId(),
            path,
            originalData,
            {
                ...metadata,
                displayName: metadata.displayName || this.extractDisplayName(path),
                hasChildren: false,
                childCount: 0
            }
        );

        this.nodeMap.set(node.id, node);
        this.pathToNodeMap.set(path, node);
        
        return node;
    }

    /**
     * Group paths by their hierarchical relationships
     * @private
     */
    groupPathsByHierarchy(paths, documentFormat) {
        const groups = new Map();

        for (const pathInfo of paths) {
            const pathSegments = this.parsePathSegments(pathInfo.path, documentFormat);
            const parentPath = this.buildParentPath(pathSegments, documentFormat);
            
            if (!groups.has(parentPath)) {
                groups.set(parentPath, []);
            }
            
            groups.get(parentPath).push({
                ...pathInfo,
                segments: pathSegments,
                parentPath: parentPath
            });
        }

        return groups;
    }

    /**
     * Build tree structure from grouped paths
     * @private
     */
    buildTreeFromGroups(rootNode, pathGroups, documentFormat) {
        // Sort groups by path depth to ensure parents are created before children
        const sortedGroups = Array.from(pathGroups.entries())
            .sort(([pathA], [pathB]) => {
                const depthA = this.calculatePathDepth(pathA, documentFormat);
                const depthB = this.calculatePathDepth(pathB, documentFormat);
                return depthA - depthB;
            });

        for (const [parentPath, pathInfos] of sortedGroups) {
            const parentNode = this.findOrCreateParentNode(parentPath, rootNode, documentFormat);
            
            for (const pathInfo of pathInfos) {
                this.addChildToParent(parentNode, pathInfo, documentFormat);
            }
        }

        // Update hasChildren flags and child counts
        this.updateTreeMetadata(rootNode);
    }

    /**
     * Find or create parent node in the tree
     * @private
     */
    findOrCreateParentNode(parentPath, rootNode, documentFormat) {
        if (!parentPath || parentPath === '$root') {
            return rootNode;
        }

        // Check if node already exists
        if (this.pathToNodeMap.has(parentPath)) {
            return this.pathToNodeMap.get(parentPath);
        }

        // Create intermediate parent nodes if needed
        const segments = this.parsePathSegments(parentPath, documentFormat);
        let currentNode = rootNode;
        let currentPath = documentFormat === 'xml' ? '' : '
</html>;

        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            const segmentPath = this.buildPathFromSegments(segments.slice(0, i + 1), documentFormat);
            
            if (this.pathToNodeMap.has(segmentPath)) {
                currentNode = this.pathToNodeMap.get(segmentPath);
            } else {
                // Create intermediate node
                const intermediateNode = this.createTreeNode(segmentPath, null, {
                    type: 'intermediate',
                    displayName: segment,
                    isIntermediate: true
                });
                
                currentNode.addChild(intermediateNode);
                currentNode = intermediateNode;
            }
        }

        return currentNode;
    }

    /**
     * Add child node to parent
     * @private
     */
    addChildToParent(parentNode, pathInfo, documentFormat) {
        const existingNode = this.pathToNodeMap.get(pathInfo.path);
        
        if (existingNode) {
            // Update existing node with more specific data
            existingNode.originalData = pathInfo;
            existingNode.metadata = {
                ...existingNode.metadata,
                type: pathInfo.type || 'element',
                value: pathInfo.value,
                namespaceURI: pathInfo.namespaceURI
            };
        } else {
            // Create new child node
            const childNode = this.createTreeNode(pathInfo.path, pathInfo, {
                type: pathInfo.type || 'element',
                displayName: this.extractDisplayName(pathInfo.path),
                value: pathInfo.value,
                namespaceURI: pathInfo.namespaceURI
            });
            
            parentNode.addChild(childNode);
        }
    }

    /**
     * Parse path into segments based on format
     * @private
     */
    parsePathSegments(path, documentFormat) {
        if (documentFormat === 'xml') {
            return this.parseXPathSegments(path);
        } else {
            return this.parseJSONPathSegments(path);
        }
    }

    /**
     * Parse XPath into segments
     * @private
     */
    parseXPathSegments(xpath) {
        if (!xpath || xpath === '/') return [];
        
        // Remove leading slash and split by /
        const segments = xpath.replace(/^\/+/, '').split('/').filter(s => s);
        
        // Clean up segments (remove indices for grouping)
        return segments.map(segment => {
            // Remove [index] notation for element names
            const match = segment.match(/^(.+?)\[\d+\]$/);
            return match ? match[1] : segment;
        });
    }

    /**
     * Parse JSONPath into segments
     * @private
     */
    parseJSONPathSegments(jsonPath) {
        if (!jsonPath || jsonPath === '
</html>) return [];
        
        // Handle different JSONPath notations
        const segments = [];
        let current = jsonPath.replace(/^\$\.?/, ''); // Remove root indicator
        
        // Split by . and handle bracket notation
        const parts = current.split(/\.|\[|\]/);
        
        for (const part of parts) {
            if (part && part !== "'" && part !== '"') {
                // Clean quotes from bracket notation
                const cleaned = part.replace(/^['"]|['"]$/g, '');
                if (cleaned) {
                    segments.push(cleaned);
                }
            }
        }
        
        return segments;
    }

    /**
     * Build parent path from segments
     * @private
     */
    buildParentPath(segments, documentFormat) {
        if (segments.length <= 1) {
            return '$root';
        }
        
        const parentSegments = segments.slice(0, -1);
        return this.buildPathFromSegments(parentSegments, documentFormat);
    }

    /**
     * Build path from segments array
     * @private
     */
    buildPathFromSegments(segments, documentFormat) {
        if (segments.length === 0) {
            return '$root';
        }
        
        if (documentFormat === 'xml') {
            return '/' + segments.join('/');
        } else {
            return '$.' + segments.join('.');
        }
    }

    /**
     * Calculate path depth
     * @private
     */
    calculatePathDepth(path, documentFormat) {
        if (!path || path === '$root') return 0;
        return this.parsePathSegments(path, documentFormat).length;
    }

    /**
     * Extract display name from path
     * @private
     */
    extractDisplayName(path) {
        if (!path) return 'Unknown';
        
        if (path.includes('/')) {
            // XPath - get last segment
            const segments = path.split('/').filter(s => s);
            const lastSegment = segments[segments.length - 1];
            
            // Handle attributes and text nodes
            if (lastSegment.startsWith('@')) {
                return lastSegment; // Keep @ for attributes
            }
            if (lastSegment === 'text()') {
                return 'text()';
            }
            
            // Remove index notation for display
            const match = lastSegment.match(/^(.+?)\[\d+\]$/);
            return match ? match[1] : lastSegment;
        } else {
            // JSONPath - get last segment
            const segments = path.split(/[.\[\]'"]/).filter(s => s && s !== '
</html>);
            return segments[segments.length - 1] || 'root';
        }
    }

    /**
     * Update tree metadata (hasChildren, childCount)
     * @private
     */
    updateTreeMetadata(node) {
        if (!node) return;
        
        const childCount = node.children.size;
        node.metadata.hasChildren = childCount > 0;
        node.metadata.childCount = childCount;
        
        // Recursively update children
        for (const child of node.children.values()) {
            this.updateTreeMetadata(child);
        }
    }

    /**
     * Generate unique node ID
     * @private
     */
    generateNodeId() {
        return `node_${this.nodeIdCounter++}`;
    }

    /**
     * Reset transformer state
     */
    reset() {
        this.nodeIdCounter = 0;
        this.nodeMap.clear();
        this.pathToNodeMap.clear();
    }

    /**
     * Get transformer statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            nodeCount: this.nodeMap.size,
            pathCount: this.pathToNodeMap.size,
            nextNodeId: this.nodeIdCounter
        };
    }
}

/**
 * TreeNode - Represents a single node in the hierarchical tree structure
 * Manages selection state, expansion state, and parent-child relationships
 */
class TreeNode {
    constructor(id, path, originalData, metadata = {}) {
        this.id = id;
        this.path = path;
        this.originalData = originalData;
        this.metadata = metadata;
        
        // Tree structure
        this.parent = null;
        this.children = new Map(); // key -> TreeNode
        
        // Selection state
        this.selected = false;
        this.indeterminate = false;
        
        // UI state
        this.expanded = false;
        this.visible = true;
        this.highlighted = false;
        
        // Display properties
        this.level = 0;
        this.displayIndex = -1;
    }

    /**
     * Add child node
     * @param {TreeNode} childNode - Child to add
     */
    addChild(childNode) {
        if (!childNode || !childNode.id) {
            throw new Error('Invalid child node');
        }
        
        childNode.parent = this;
        this.children.set(childNode.id, childNode);
        
        // Update metadata
        this.metadata.hasChildren = true;
        this.metadata.childCount = this.children.size;
    }

    /**
     * Remove child node
     * @param {string} childId - ID of child to remove
     */
    removeChild(childId) {
        const child = this.children.get(childId);
        if (child) {
            child.parent = null;
            this.children.delete(childId);
            
            // Update metadata
            this.metadata.hasChildren = this.children.size > 0;
            this.metadata.childCount = this.children.size;
        }
    }

    /**
     * Get all descendant nodes
     * @returns {Array<TreeNode>} All descendants
     */
    getAllDescendants() {
        const descendants = [];
        
        const traverse = (node) => {
            for (const child of node.children.values()) {
                descendants.push(child);
                traverse(child);
            }
        };
        
        traverse(this);
        return descendants;
    }

    /**
     * Get path to root
     * @returns {Array<TreeNode>} Path from this node to root
     */
    getPathToRoot() {
        const path = [];
        let current = this;
        
        while (current) {
            path.unshift(current);
            current = current.parent;
        }
        
        return path;
    }

    /**
     * Check if node is ancestor of another node
     * @param {TreeNode} node - Node to check
     * @returns {boolean} True if this node is ancestor
     */
    isAncestorOf(node) {
        let current = node.parent;
        
        while (current) {
            if (current === this) {
                return true;
            }
            current = current.parent;
        }
        
        return false;
    }

    /**
     * Get display name with type indicator
     * @returns {string} Display name
     */
    getDisplayName() {
        const baseName = this.metadata.displayName || 'Unknown';
        
        // Add type indicators
        switch (this.metadata.type) {
            case 'attribute':
                return baseName; // Already has @ prefix
            case 'text':
                return 'text()';
            case 'array':
                return `${baseName} []`;
            case 'object':
                return `${baseName} {}`;
            default:
                return baseName;
        }
    }

    /**
     * Check if node matches search criteria
     * @param {string} searchTerm - Search term
     * @returns {boolean} True if matches
     */
    matchesSearch(searchTerm) {
        if (!searchTerm) return true;
        
        const term = searchTerm.toLowerCase();
        const displayName = this.getDisplayName().toLowerCase();
        const path = this.path.toLowerCase();
        
        return displayName.includes(term) || path.includes(term);
    }

    /**
     * Clone node (shallow copy)
     * @returns {TreeNode} Cloned node
     */
    clone() {
        const cloned = new TreeNode(
            this.id,
            this.path,
            this.originalData,
            { ...this.metadata }
        );
        
        cloned.selected = this.selected;
        cloned.indeterminate = this.indeterminate;
        cloned.expanded = this.expanded;
        cloned.visible = this.visible;
        cloned.highlighted = this.highlighted;
        cloned.level = this.level;
        cloned.displayIndex = this.displayIndex;
        
        return cloned;
    }
}

/**
 * Custom error class for TreeDataTransformer errors
 */
class TreeDataTransformerError extends Error {
    constructor(message, type = 'TransformError', context = {}) {
        super(message);
        this.name = 'TreeDataTransformerError';
        this.type = type;
        this.context = context;
        this.timestamp = new Date().toISOString();
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, TreeDataTransformerError);
        }
    }
}

// Export for both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
    
} else if (typeof window !== 'undefined') {
    window.TreeDataTransformer = TreeDataTransformer;
    window.TreeNode = TreeNode;
    window.TreeDataTransformerError = TreeDataTransformerError;
}

// ES module export

window.TreeDataTransformer = TreeDataTransformer;

window.TreeNode = TreeNode;

window.TreeDataTransformerError = TreeDataTransformerError;

})();

// src/VirtualizedTreeView.js
(function() {
/**
 * VirtualizedTreeView - High-performance virtual scrolling tree view component
 * Handles rendering of 10,000+ tree nodes efficiently by virtualizing the viewport
 * 
 * Features:
 * - Virtual scrolling with viewport-based rendering
 * - Dynamic height calculation and caching
 * - Smooth scrolling with momentum
 * - DOM element recycling for memory efficiency
 * - Touch and mouse scroll support
 * - Keyboard navigation support
 */
class VirtualizedTreeView {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            itemHeight: options.itemHeight || 28,
            overscan: options.overscan || 5,
            bufferSize: options.bufferSize || 50,
            smoothScrolling: options.smoothScrolling !== false,
            ...options
        };
        
        // State
        this.flattenedNodes = [];
        this.visibleNodes = [];
        this.scrollTop = 0;
        this.viewportHeight = 0;
        this.totalHeight = 0;
        this.visibleStart = 0;
        this.visibleEnd = 0;
        
        // DOM elements
        this.viewport = null;
        this.scrollArea = null;
        this.nodeContainer = null;
        
        // Element recycling
        this.nodeElementPool = [];
        this.activeElements = new Map(); // nodeId -> DOM element
        
        // Performance tracking
        this.renderCount = 0;
        this.lastRenderTime = 0;
        
        // Event handlers (bound for proper cleanup)
        this.boundHandleScroll = this.handleScroll.bind(this);
        this.boundHandleResize = this.handleResize.bind(this);
        this.boundHandleKeyboard = this.handleKeyboard.bind(this);
        
        this.initialize();
    }

    /**
     * Initialize the virtual scrolling container
     */
    initialize() {
        this.createDOMStructure();
        this.attachEventListeners();
        this.measureViewport();
    }

    /**
     * Create the DOM structure for virtual scrolling
     * @private
     */
    createDOMStructure() {
        this.container.innerHTML = '';
        this.container.className = 'virtualized-tree-view';
        
        // Create viewport (visible area)
        this.viewport = document.createElement('div');
        this.viewport.className = 'tree-viewport';
        this.viewport.style.cssText = `
            position: relative;
            overflow: auto;
            height: 100%;
            width: 100%;
        `;
        
        // Create scroll area (full height container)
        this.scrollArea = document.createElement('div');
        this.scrollArea.className = 'tree-scroll-area';
        this.scrollArea.style.cssText = `
            position: relative;
            width: 100%;
        `;
        
        // Create node container (rendered nodes)
        this.nodeContainer = document.createElement('div');
        this.nodeContainer.className = 'tree-node-container';
        this.nodeContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
        `;
        
        this.scrollArea.appendChild(this.nodeContainer);
        this.viewport.appendChild(this.scrollArea);
        this.container.appendChild(this.viewport);
    }

    /**
     * Attach event listeners
     * @private
     */
    attachEventListeners() {
        this.viewport.addEventListener('scroll', this.boundHandleScroll, { passive: true });
        window.addEventListener('resize', this.boundHandleResize);
        this.container.addEventListener('keydown', this.boundHandleKeyboard);
        
        // Touch support
        let touchStartY = 0;
        this.viewport.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        }, { passive: true });
        
        this.viewport.addEventListener('touchmove', (e) => {
            const touchY = e.touches[0].clientY;
            const deltaY = touchStartY - touchY;
            this.viewport.scrollTop += deltaY;
            touchStartY = touchY;
        }, { passive: true });
    }

    /**
     * Set the flattened node data
     * @param {Array} nodes - Flattened array of TreeNode objects
     */
    setData(nodes) {
        this.flattenedNodes = nodes || [];
        this.updateTotalHeight();
        this.render();
    }

    /**
     * Update the total height of the scroll area
     * @private
     */
    updateTotalHeight() {
        this.totalHeight = this.flattenedNodes.length * this.options.itemHeight;
        this.scrollArea.style.height = `${this.totalHeight}px`;
    }

    /**
     * Measure viewport dimensions
     * @private
     */
    measureViewport() {
        const rect = this.viewport.getBoundingClientRect();
        this.viewportHeight = rect.height;
    }

    /**
     * Calculate visible range based on scroll position
     * @private
     */
    calculateVisibleRange() {
        const itemHeight = this.options.itemHeight;
        const overscan = this.options.overscan;
        
        // Calculate visible items
        const visibleCount = Math.ceil(this.viewportHeight / itemHeight);
        const scrollIndex = Math.floor(this.scrollTop / itemHeight);
        
        // Add overscan for smooth scrolling
        this.visibleStart = Math.max(0, scrollIndex - overscan);
        this.visibleEnd = Math.min(
            this.flattenedNodes.length,
            scrollIndex + visibleCount + overscan * 2
        );
        
        // Extract visible nodes
        this.visibleNodes = this.flattenedNodes.slice(this.visibleStart, this.visibleEnd);
    }

    /**
     * Render visible nodes
     */
    render() {
        const startTime = performance.now();
        
        this.calculateVisibleRange();
        this.recycleElements();
        this.renderVisibleNodes();
        this.updateNodeContainerPosition();
        
        this.renderCount++;
        this.lastRenderTime = performance.now() - startTime;
        
        // Emit render event
        this.emit('render', {
            visibleStart: this.visibleStart,
            visibleEnd: this.visibleEnd,
            renderTime: this.lastRenderTime
        });
    }

    /**
     * Recycle DOM elements not in use
     * @private
     */
    recycleElements() {
        const visibleNodeIds = new Set(this.visibleNodes.map(node => node.id));
        
        // Recycle elements not in visible range
        for (const [nodeId, element] of this.activeElements.entries()) {
            if (!visibleNodeIds.has(nodeId)) {
                this.recycleElement(element);
                this.activeElements.delete(nodeId);
            }
        }
    }

    /**
     * Render visible nodes to DOM
     * @private
     */
    renderVisibleNodes() {
        for (let i = 0; i < this.visibleNodes.length; i++) {
            const node = this.visibleNodes[i];
            const actualIndex = this.visibleStart + i;
            
            let element = this.activeElements.get(node.id);
            
            if (!element) {
                element = this.getOrCreateElement();
                this.activeElements.set(node.id, element);
                this.nodeContainer.appendChild(element);
            }
            
            this.renderNodeToElement(node, element, actualIndex);
        }
    }

    /**
     * Get or create a DOM element for a node
     * @private
     */
    getOrCreateElement() {
        if (this.nodeElementPool.length > 0) {
            return this.nodeElementPool.pop();
        }
        
        return this.createNodeElement();
    }

    /**
     * Create a new node DOM element
     * @private
     */
    createNodeElement() {
        const element = document.createElement('div');
        element.className = 'tree-node-item';
        element.style.cssText = `
            position: absolute;
            width: 100%;
            height: ${this.options.itemHeight}px;
            display: flex;
            align-items: center;
            padding: 4px 8px;
            box-sizing: border-box;
            cursor: pointer;
            user-select: none;
        `;
        
        // Create inner structure
        element.innerHTML = `
            <div class="tree-node-indent"></div>
            <div class="tree-node-expander"></div>
            <div class="tree-node-checkbox">
                <input type="checkbox" tabindex="-1">
            </div>
            <div class="tree-node-icon"></div>
            <div class="tree-node-label"></div>
            <div class="tree-node-value"></div>
        `;
        
        return element;
    }

    /**
     * Render node data to DOM element
     * @private
     */
    renderNodeToElement(node, element, index) {
        const top = index * this.options.itemHeight;
        element.style.top = `${top}px`;
        element.setAttribute('data-node-id', node.id);
        element.setAttribute('data-index', index);
        
        // Update element classes
        element.className = `tree-node-item ${this.getNodeClasses(node)}`;
        
        // Update indent
        const indent = element.querySelector('.tree-node-indent');
        indent.style.width = `${node.level * 20}px`;
        
        // Update expander
        const expander = element.querySelector('.tree-node-expander');
        expander.className = `tree-node-expander ${this.getExpanderClasses(node)}`;
        expander.innerHTML = this.getExpanderIcon(node);
        
        // Update checkbox
        const checkbox = element.querySelector('.tree-node-checkbox input');
        checkbox.checked = node.selected;
        checkbox.indeterminate = node.indeterminate;
        
        // Update icon
        const icon = element.querySelector('.tree-node-icon');
        icon.className = `tree-node-icon ${this.getIconClasses(node)}`;
        icon.innerHTML = this.getNodeIcon(node);
        
        // Update label
        const label = element.querySelector('.tree-node-label');
        label.textContent = node.getDisplayName();
        label.title = node.path; // Tooltip with full path
        
        // Update value
        const value = element.querySelector('.tree-node-value');
        if (node.originalData && node.originalData.value !== undefined) {
            value.textContent = this.formatValue(node.originalData.value);
            value.style.display = 'block';
        } else {
            value.style.display = 'none';
        }
        
        // Highlight search matches
        if (node.highlighted) {
            element.classList.add('highlighted');
        }
    }

    /**
     * Get CSS classes for node
     * @private
     */
    getNodeClasses(node) {
        const classes = [];
        
        if (node.selected) classes.push('selected');
        if (node.indeterminate) classes.push('indeterminate');
        if (node.highlighted) classes.push('highlighted');
        if (node.metadata.hasChildren) classes.push('has-children');
        if (node.expanded) classes.push('expanded');
        if (node.metadata.type) classes.push(`type-${node.metadata.type}`);
        
        return classes.join(' ');
    }

    /**
     * Get CSS classes for expander
     * @private
     */
    getExpanderClasses(node) {
        const classes = ['expander'];
        
        if (node.metadata.hasChildren) {
            classes.push('expandable');
            if (node.expanded) classes.push('expanded');
        } else {
            classes.push('leaf');
        }
        
        return classes.join(' ');
    }

    /**
     * Get expander icon HTML
     * @private
     */
    getExpanderIcon(node) {
        if (!node.metadata.hasChildren) {
            return '<span class="expander-placeholder"></span>';
        }
        
        return node.expanded ? '▼' : '▶';
    }

    /**
     * Get CSS classes for icon
     * @private
     */
    getIconClasses(node) {
        const classes = ['icon'];
        
        switch (node.metadata.type) {
            case 'element':
                classes.push('icon-element');
                break;
            case 'attribute':
                classes.push('icon-attribute');
                break;
            case 'text':
                classes.push('icon-text');
                break;
            case 'array':
                classes.push('icon-array');
                break;
            case 'object':
                classes.push('icon-object');
                break;
            default:
                classes.push('icon-default');
        }
        
        return classes.join(' ');
    }

    /**
     * Get node icon HTML
     * @private
     */
    getNodeIcon(node) {
        switch (node.metadata.type) {
            case 'element':
                return '📄';
            case 'attribute':
                return '🏷️';
            case 'text':
                return '📝';
            case 'array':
                return '📋';
            case 'object':
                return '📁';
            case 'root':
                return '🌳';
            default:
                return '📄';
        }
    }

    /**
     * Format node value for display
     * @private
     */
    formatValue(value) {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (typeof value === 'string') {
            return value.length > 50 ? value.substring(0, 50) + '...' : value;
        }
        return String(value);
    }

    /**
     * Update node container position
     * @private
     */
    updateNodeContainerPosition() {
        const offsetY = this.visibleStart * this.options.itemHeight;
        this.nodeContainer.style.transform = `translateY(${offsetY}px)`;
    }

    /**
     * Recycle a DOM element back to the pool
     * @private
     */
    recycleElement(element) {
        if (element.parentNode) {
            element.parentNode.removeChild(element);
        }
        
        // Clean up element
        element.className = 'tree-node-item';
        element.removeAttribute('data-node-id');
        element.removeAttribute('data-index');
        
        this.nodeElementPool.push(element);
    }

    /**
     * Handle scroll events
     * @private
     */
    handleScroll(event) {
        const newScrollTop = this.viewport.scrollTop;
        
        if (Math.abs(newScrollTop - this.scrollTop) > 5) {
            this.scrollTop = newScrollTop;
            this.render();
        }
    }

    /**
     * Handle resize events
     * @private
     */
    handleResize() {
        this.measureViewport();
        this.render();
    }

    /**
     * Handle keyboard navigation
     * @private
     */
    handleKeyboard(event) {
        // Delegate keyboard handling to parent component
        this.emit('keydown', event);
    }

    /**
     * Scroll to specific node
     * @param {string} nodeId - Node ID to scroll to
     */
    scrollToNode(nodeId) {
        const nodeIndex = this.flattenedNodes.findIndex(node => node.id === nodeId);
        if (nodeIndex === -1) return;
        
        const targetScrollTop = nodeIndex * this.options.itemHeight;
        
        if (this.options.smoothScrolling) {
            this.viewport.scrollTo({
                top: targetScrollTop,
                behavior: 'smooth'
            });
        } else {
            this.viewport.scrollTop = targetScrollTop;
        }
    }

    /**
     * Get visible node at screen coordinates
     * @param {number} clientX - X coordinate
     * @param {number} clientY - Y coordinate
     * @returns {TreeNode|null} Node at coordinates
     */
    getNodeAtPoint(clientX, clientY) {
        const rect = this.viewport.getBoundingClientRect();
        const relativeY = clientY - rect.top + this.scrollTop;
        const nodeIndex = Math.floor(relativeY / this.options.itemHeight);
        
        return this.flattenedNodes[nodeIndex] || null;
    }

    /**
     * Get performance statistics
     * @returns {Object} Performance stats
     */
    getPerformanceStats() {
        return {
            totalNodes: this.flattenedNodes.length,
            visibleNodes: this.visibleNodes.length,
            activeElements: this.activeElements.size,
            pooledElements: this.nodeElementPool.length,
            renderCount: this.renderCount,
            lastRenderTime: this.lastRenderTime,
            viewportHeight: this.viewportHeight,
            totalHeight: this.totalHeight
        };
    }

    /**
     * Update options
     * @param {Object} newOptions - New options to merge
     */
    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
        
        if ('itemHeight' in newOptions) {
            this.updateTotalHeight();
        }
        
        this.render();
    }

    /**
     * Refresh the view (re-render everything)
     */
    refresh() {
        this.recycleAllElements();
        this.render();
    }

    /**
     * Recycle all active elements
     * @private
     */
    recycleAllElements() {
        for (const element of this.activeElements.values()) {
            this.recycleElement(element);
        }
        this.activeElements.clear();
    }

    /**
     * Destroy the virtual tree view
     */
    destroy() {
        // Remove event listeners
        this.viewport.removeEventListener('scroll', this.boundHandleScroll);
        window.removeEventListener('resize', this.boundHandleResize);
        this.container.removeEventListener('keydown', this.boundHandleKeyboard);
        
        // Clean up DOM
        this.container.innerHTML = '';
        
        // Clear references
        this.flattenedNodes = [];
        this.visibleNodes = [];
        this.activeElements.clear();
        this.nodeElementPool = [];
    }

    /**
     * Simple event emitter
     * @private
     */
    emit(eventName, data) {
        const event = new CustomEvent(eventName, { detail: data });
        this.container.dispatchEvent(event);
    }
}

// Export for both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
    
} else if (typeof window !== 'undefined') {
    window.VirtualizedTreeView = VirtualizedTreeView;
}

// ES module export

window.VirtualizedTreeView = VirtualizedTreeView;

})();

// src/SelectionStateManager.js
(function() {
/**
 * SelectionStateManager - Manages tree node selection state with parent-child synchronization
 * Handles complex checkbox interactions, batch updates, and indeterminate states
 * 
 * Features:
 * - Parent-child selection synchronization
 * - Indeterminate state calculation
 * - Batch selection updates for performance
 * - Multi-select with keyboard modifiers
 * - Select all / deselect all operations
 * - Selection event system
 */
class SelectionStateManager {
    constructor(options = {}) {
        this.options = {
            enableParentSync: options.enableParentSync !== false,
            enableChildSync: options.enableChildSync !== false,
            enableBatchUpdates: options.enableBatchUpdates !== false,
            ...options
        };
        
        // State
        this.selectedNodes = new Set();
        this.indeterminateNodes = new Set();
        this.lastSelectedNode = null;
        this.batchInProgress = false;
        this.pendingUpdates = new Map();
        
        // Event system
        this.eventListeners = new Map();
    }

    /**
     * Set selection state for a node
     * @param {TreeNode} node - Node to update
     * @param {boolean} selected - New selection state
     * @param {Object} options - Update options
     */
    setNodeSelection(node, selected, options = {}) {
        if (!node) throw new Error('Node is required');
        
        const updateOptions = {
            cascadeToChildren: options.cascadeToChildren !== false,
            updateParentChain: options.updateParentChain !== false,
            isUserAction: options.isUserAction || false,
            shiftKey: options.shiftKey || false,
            ctrlKey: options.ctrlKey || false,
            ...options
        };
        
        // Handle shift+click range selection
        if (updateOptions.shiftKey && this.lastSelectedNode && updateOptions.isUserAction) {
            this.selectRange(this.lastSelectedNode, node, selected);
            return;
        }
        
        const batch = new SelectionBatch();
        
        // Update the node itself
        this.addToBatch(batch, node, selected, false);
        
        // Handle child synchronization
        if (this.options.enableChildSync && updateOptions.cascadeToChildren) {
            this.cascadeSelectionToChildren(node, selected, batch);
        }
        
        // Handle parent synchronization
        if (this.options.enableParentSync && updateOptions.updateParentChain) {
            this.updateParentChain(node, batch);
        }
        
        // Apply the batch
        this.applyBatch(batch);
        
        // Update last selected for range selection
        if (updateOptions.isUserAction) {
            this.lastSelectedNode = node;
        }
        
        // Emit selection change event
        this.emit('selectionChange', {
            node: node,
            selected: selected,
            selectedCount: this.selectedNodes.size,
            options: updateOptions
        });
    }

    /**
     * Toggle node selection state
     * @param {TreeNode} node - Node to toggle
     * @param {Object} options - Toggle options
     */
    toggleNodeSelection(node, options = {}) {
        const currentlySelected = this.isNodeSelected(node);
        this.setNodeSelection(node, !currentlySelected, options);
    }

    /**
     * Select range of nodes between two nodes
     * @param {TreeNode} startNode - Start of range
     * @param {TreeNode} endNode - End of range
     * @param {boolean} selected - Selection state to apply
     */
    selectRange(startNode, endNode, selected) {
        if (!startNode || !endNode) return;
        
        // Find the range of nodes in flattened tree
        const flattenedNodes = this.getFlattenedNodesFromTree(startNode);
        const startIndex = flattenedNodes.findIndex(n => n.id === startNode.id);
        const endIndex = flattenedNodes.findIndex(n => n.id === endNode.id);
        
        if (startIndex === -1 || endIndex === -1) return;
        
        // Determine range bounds
        const minIndex = Math.min(startIndex, endIndex);
        const maxIndex = Math.max(startIndex, endIndex);
        
        const batch = new SelectionBatch();
        
        // Select/deselect all nodes in range
        for (let i = minIndex; i <= maxIndex; i++) {
            const node = flattenedNodes[i];
            this.addToBatch(batch, node, selected, false);
        }
        
        this.applyBatch(batch);
        
        this.emit('rangeSelection', {
            startNode,
            endNode,
            selected,
            count: maxIndex - minIndex + 1
        });
    }

    /**
     * Select all nodes
     * @param {TreeNode} rootNode - Root node of tree
     */
    selectAll(rootNode) {
        if (!rootNode) return;
        
        const batch = new SelectionBatch();
        const allNodes = this.getAllNodesFromTree(rootNode);
        
        for (const node of allNodes) {
            if (!node.metadata.isRoot) { // Skip virtual root
                this.addToBatch(batch, node, true, false);
            }
        }
        
        this.applyBatch(batch);
        
        this.emit('selectAll', {
            count: allNodes.length - 1 // Exclude root
        });
    }

    /**
     * Deselect all nodes
     */
    deselectAll() {
        const batch = new SelectionBatch();
        
        for (const nodeId of this.selectedNodes) {
            const node = this.getNodeById(nodeId);
            if (node) {
                this.addToBatch(batch, node, false, false);
            }
        }
        
        this.applyBatch(batch);
        
        this.emit('deselectAll');
    }

    /**
     * Get selected nodes
     * @returns {Array<TreeNode>} Array of selected nodes
     */
    getSelectedNodes() {
        const selectedNodes = [];
        
        for (const nodeId of this.selectedNodes) {
            const node = this.getNodeById(nodeId);
            if (node) {
                selectedNodes.push(node);
            }
        }
        
        return selectedNodes;
    }

    /**
     * Get selected node paths
     * @returns {Array<string>} Array of selected node paths
     */
    getSelectedPaths() {
        return this.getSelectedNodes().map(node => node.path);
    }

    /**
     * Check if node is selected
     * @param {TreeNode} node - Node to check
     * @returns {boolean} True if selected
     */
    isNodeSelected(node) {
        return this.selectedNodes.has(node.id);
    }

    /**
     * Check if node is indeterminate
     * @param {TreeNode} node - Node to check
     * @returns {boolean} True if indeterminate
     */
    isNodeIndeterminate(node) {
        return this.indeterminateNodes.has(node.id);
    }

    /**
     * Get selection statistics
     * @returns {Object} Selection statistics
     */
    getSelectionStats() {
        return {
            selectedCount: this.selectedNodes.size,
            indeterminateCount: this.indeterminateNodes.size,
            lastSelectedNode: this.lastSelectedNode?.id || null
        };
    }

    /**
     * Cascade selection to all children
     * @private
     */
    cascadeSelectionToChildren(node, selected, batch) {
        const descendants = node.getAllDescendants();
        
        for (const descendant of descendants) {
            this.addToBatch(batch, descendant, selected, false);
        }
    }

    /**
     * Update parent chain with proper indeterminate states
     * @private
     */
    updateParentChain(startNode, batch) {
        let currentNode = startNode.parent;
        
        while (currentNode && !currentNode.metadata.isRoot) {
            const childStates = this.calculateChildSelectionStates(currentNode, batch);
            
            if (childStates.allSelected) {
                this.addToBatch(batch, currentNode, true, false);
            } else if (childStates.someSelected) {
                this.addToBatch(batch, currentNode, false, true);
            } else {
                this.addToBatch(batch, currentNode, false, false);
            }
            
            currentNode = currentNode.parent;
        }
    }

    /**
     * Calculate child selection states for a parent node
     * @private
     */
    calculateChildSelectionStates(parentNode, batch = null) {
        const children = Array.from(parentNode.children.values());
        
        if (children.length === 0) {
            return { allSelected: false, someSelected: false, noneSelected: true };
        }
        
        let selectedCount = 0;
        let indeterminateCount = 0;
        
        for (const child of children) {
            // Check if child has pending batch update
            const pendingUpdate = batch?.updates.get(child.id);
            
            const isSelected = pendingUpdate ? 
                pendingUpdate.selected : 
                this.isNodeSelected(child);
                
            const isIndeterminate = pendingUpdate ? 
                pendingUpdate.indeterminate : 
                this.isNodeIndeterminate(child);
            
            if (isSelected) {
                selectedCount++;
            } else if (isIndeterminate) {
                indeterminateCount++;
            }
        }
        
        const allSelected = selectedCount === children.length;
        const someSelected = selectedCount > 0 || indeterminateCount > 0;
        const noneSelected = selectedCount === 0 && indeterminateCount === 0;
        
        return { allSelected, someSelected, noneSelected };
    }

    /**
     * Add update to batch
     * @private
     */
    addToBatch(batch, node, selected, indeterminate) {
        batch.add(node.id, {
            node: node,
            selected: selected,
            indeterminate: indeterminate,
            previousSelected: this.isNodeSelected(node),
            previousIndeterminate: this.isNodeIndeterminate(node)
        });
    }

    /**
     * Apply selection batch atomically
     * @private
     */
    applyBatch(batch) {
        if (batch.updates.size === 0) return;
        
        const changes = [];
        
        // Apply all updates
        for (const [nodeId, update] of batch.updates) {
            const { node, selected, indeterminate, previousSelected, previousIndeterminate } = update;
            
            // Update internal state
            if (selected) {
                this.selectedNodes.add(nodeId);
            } else {
                this.selectedNodes.delete(nodeId);
            }
            
            if (indeterminate) {
                this.indeterminateNodes.add(nodeId);
            } else {
                this.indeterminateNodes.delete(nodeId);
            }
            
            // Update node state
            node.selected = selected;
            node.indeterminate = indeterminate;
            
            // Track changes
            if (selected !== previousSelected || indeterminate !== previousIndeterminate) {
                changes.push({
                    node,
                    selected,
                    indeterminate,
                    previousSelected,
                    previousIndeterminate
                });
            }
        }
        
        // Emit batch change event
        if (changes.length > 0) {
            this.emit('batchChange', {
                changes: changes,
                selectedCount: this.selectedNodes.size
            });
        }
    }

    /**
     * Get flattened nodes from tree (helper method)
     * @private
     */
    getFlattenedNodesFromTree(startNode) {
        // This would typically be provided by the tree view component
        // For now, implement a basic flattening
        const nodes = [];
        const root = this.findRootNode(startNode);
        
        const traverse = (node) => {
            if (!node.metadata.isRoot) {
                nodes.push(node);
            }
            
            for (const child of node.children.values()) {
                traverse(child);
            }
        };
        
        traverse(root);
        return nodes;
    }

    /**
     * Get all nodes from tree
     * @private
     */
    getAllNodesFromTree(rootNode) {
        const nodes = [rootNode];
        const queue = [rootNode];
        
        while (queue.length > 0) {
            const current = queue.shift();
            
            for (const child of current.children.values()) {
                nodes.push(child);
                queue.push(child);
            }
        }
        
        return nodes;
    }

    /**
     * Find root node by traversing up
     * @private
     */
    findRootNode(node) {
        let current = node;
        while (current.parent) {
            current = current.parent;
        }
        return current;
    }

    /**
     * Get node by ID (would be provided by tree component)
     * @private
     */
    getNodeById(nodeId) {
        // This would typically be provided by the tree component
        // For now, return null - this method should be overridden
        return null;
    }

    /**
     * Set node lookup function
     * @param {Function} lookupFn - Function that takes nodeId and returns TreeNode
     */
    setNodeLookupFunction(lookupFn) {
        this.getNodeById = lookupFn;
    }

    /**
     * Clear all selections
     */
    clear() {
        this.selectedNodes.clear();
        this.indeterminateNodes.clear();
        this.lastSelectedNode = null;
        
        this.emit('clear');
    }

    /**
     * Export selection state
     * @returns {Object} Serializable selection state
     */
    exportState() {
        return {
            selectedNodeIds: Array.from(this.selectedNodes),
            indeterminateNodeIds: Array.from(this.indeterminateNodes),
            lastSelectedNodeId: this.lastSelectedNode?.id || null
        };
    }

    /**
     * Import selection state
     * @param {Object} state - Previously exported state
     */
    importState(state) {
        this.selectedNodes = new Set(state.selectedNodeIds || []);
        this.indeterminateNodes = new Set(state.indeterminateNodeIds || []);
        this.lastSelectedNode = state.lastSelectedNodeId ? 
            this.getNodeById(state.lastSelectedNodeId) : null;
        
        this.emit('stateImported', state);
    }

    /**
     * Add event listener
     * @param {string} eventName - Event name
     * @param {Function} callback - Event callback
     */
    addEventListener(eventName, callback) {
        if (!this.eventListeners.has(eventName)) {
            this.eventListeners.set(eventName, []);
        }
        this.eventListeners.get(eventName).push(callback);
    }

    /**
     * Remove event listener
     * @param {string} eventName - Event name
     * @param {Function} callback - Event callback to remove
     */
    removeEventListener(eventName, callback) {
        const listeners = this.eventListeners.get(eventName);
        if (listeners) {
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * Emit event to listeners
     * @private
     */
    emit(eventName, data) {
        const listeners = this.eventListeners.get(eventName);
        if (listeners) {
            for (const callback of listeners) {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in ${eventName} event listener:`, error);
                }
            }
        }
    }

    /**
     * Destroy the selection manager
     */
    destroy() {
        this.clear();
        this.eventListeners.clear();
    }
}

/**
 * SelectionBatch - Represents a batch of selection updates
 * Used for atomic updates to prevent intermediate states
 */
class SelectionBatch {
    constructor() {
        this.updates = new Map(); // nodeId -> update object
    }

    /**
     * Add update to batch
     * @param {string} nodeId - Node ID
     * @param {Object} update - Update object
     */
    add(nodeId, update) {
        this.updates.set(nodeId, update);
    }

    /**
     * Check if batch has updates
     * @returns {boolean} True if has updates
     */
    hasUpdates() {
        return this.updates.size > 0;
    }

    /**
     * Get update count
     * @returns {number} Number of updates
     */
    getUpdateCount() {
        return this.updates.size;
    }

    /**
     * Clear all updates
     */
    clear() {
        this.updates.clear();
    }
}

// Export for both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
    
} else if (typeof window !== 'undefined') {
    window.SelectionStateManager = SelectionStateManager;
    window.SelectionBatch = SelectionBatch;
}

// ES module export

window.SelectionStateManager = SelectionStateManager;

window.SelectionBatch = SelectionBatch;

})();

// src/InteractiveTreeView.js
(function() {
/**
 * InteractiveTreeView - Main orchestrating component for the tree view UI
 * Combines TreeDataTransformer, VirtualizedTreeView, and SelectionStateManager
 * 
 * Features:
 * - Complete tree view with selection, expansion, and search
 * - Integration with DocumentParser and PathExtractor
 * - SAP CI output format generation
 * - Accessibility support (ARIA, keyboard navigation)
 * - Mobile-responsive touch interactions
 * - Performance optimized for 10k+ nodes
 */
class InteractiveTreeView {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            // Display options
            itemHeight: 28,
            showSearch: true,
            showControls: true,
            showStats: false,
            
            // Behavior options
            enableVirtualScrolling: true,
            enableSelection: true,
            enableExpansion: true,
            enableSearch: true,
            
            // Performance options
            overscan: 5,
            bufferSize: 50,
            maxNodes: 50000,
            
            // Integration options
            includeAttributes: true,
            includeTextNodes: false,
            
            ...options
        };
        
        // Core components
        this.dataTransformer = new TreeDataTransformer();
        this.selectionManager = new SelectionStateManager();
        this.virtualTreeView = null;
        
        // State
        this.rootNode = null;
        this.flattenedNodes = [];
        this.filteredNodes = [];
        this.documentFormat = null;
        this.currentSearchTerm = '';
        this.focusedNodeId = null;
        
        // DOM elements
        this.headerContainer = null;
        this.searchInput = null;
        this.controlsContainer = null;
        this.treeContainer = null;
        this.footerContainer = null;
        this.statsContainer = null;
        
        // Event handlers (bound for cleanup)
        this.boundHandleClick = this.handleClick.bind(this);
        this.boundHandleKeyDown = this.handleKeyDown.bind(this);
        this.boundHandleSearch = this.handleSearch.bind(this);
        
        this.initialize();
    }

    /**
     * Initialize the interactive tree view
     */
    initialize() {
        this.createDOMStructure();
        this.setupComponents();
        this.attachEventListeners();
        this.addStyles();
    }

    /**
     * Create the main DOM structure
     * @private
     */
    createDOMStructure() {
        this.container.innerHTML = '';
        this.container.className = 'interactive-tree-view';
        this.container.setAttribute('role', 'tree');
        this.container.setAttribute('aria-label', 'Document structure tree');
        
        // Header with search and controls
        if (this.options.showSearch || this.options.showControls) {
            this.createHeader();
        }
        
        // Main tree container
        this.treeContainer = document.createElement('div');
        this.treeContainer.className = 'tree-container';
        this.treeContainer.style.cssText = `
            flex: 1;
            min-height: 0;
            position: relative;
        `;
        this.container.appendChild(this.treeContainer);
        
        // Footer with stats
        if (this.options.showStats) {
            this.createFooter();
        }
        
        // Set container styles
        this.container.style.cssText = `
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
            background: #fff;
            border: 1px solid #ddd;
            border-radius: 4px;
            overflow: hidden;
        `;
    }

    /**
     * Create header with search and controls
     * @private
     */
    createHeader() {
        this.headerContainer = document.createElement('div');
        this.headerContainer.className = 'tree-header';
        this.headerContainer.style.cssText = `
            padding: 12px;
            border-bottom: 1px solid #eee;
            background: #f8f9fa;
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
        `;
        
        // Search input
        if (this.options.enableSearch) {
            this.createSearchInput();
        }
        
        // Control buttons
        if (this.options.showControls) {
            this.createControlButtons();
        }
        
        this.container.appendChild(this.headerContainer);
    }

    /**
     * Create search input
     * @private
     */
    createSearchInput() {
        const searchContainer = document.createElement('div');
        searchContainer.className = 'search-container';
        searchContainer.style.cssText = `
            position: relative;
            flex: 1;
            min-width: 200px;
        `;
        
        this.searchInput = document.createElement('input');
        this.searchInput.type = 'text';
        this.searchInput.placeholder = 'Search nodes...';
        this.searchInput.className = 'search-input';
        this.searchInput.setAttribute('aria-label', 'Search tree nodes');
        this.searchInput.style.cssText = `
            width: 100%;
            padding: 8px 32px 8px 12px;
            border: 1px solid #ccc;
            border-radius: 4px;
            font-size: 14px;
            outline: none;
        `;
        
        // Search icon
        const searchIcon = document.createElement('span');
        searchIcon.className = 'search-icon';
        searchIcon.innerHTML = '🔍';
        searchIcon.style.cssText = `
            position: absolute;
            right: 8px;
            top: 50%;
            transform: translateY(-50%);
            pointer-events: none;
            font-size: 16px;
        `;
        
        searchContainer.appendChild(this.searchInput);
        searchContainer.appendChild(searchIcon);
        this.headerContainer.appendChild(searchContainer);
    }

    /**
     * Create control buttons
     * @private
     */
    createControlButtons() {
        this.controlsContainer = document.createElement('div');
        this.controlsContainer.className = 'tree-controls';
        this.controlsContainer.style.cssText = `
            display: flex;
            gap: 8px;
            align-items: center;
        `;
        
        // Expand All button
        const expandAllBtn = this.createButton('Expand All', '📖', () => {
            this.expandAll();
        });
        
        // Collapse All button
        const collapseAllBtn = this.createButton('Collapse All', '📋', () => {
            this.collapseAll();
        });
        
        // Select All button
        const selectAllBtn = this.createButton('Select All', '☑️', () => {
            this.selectAll();
        });
        
        // Deselect All button
        const deselectAllBtn = this.createButton('Deselect All', '☐', () => {
            this.deselectAll();
        });
        
        this.controlsContainer.appendChild(expandAllBtn);
        this.controlsContainer.appendChild(collapseAllBtn);
        this.controlsContainer.appendChild(selectAllBtn);
        this.controlsContainer.appendChild(deselectAllBtn);
        
        this.headerContainer.appendChild(this.controlsContainer);
    }

    /**
     * Create a button element
     * @private
     */
    createButton(text, icon, onClick) {
        const button = document.createElement('button');
        button.textContent = `${icon} ${text}`;
        button.className = 'tree-control-btn';
        button.title = text;
        button.onclick = onClick;
        button.style.cssText = `
            padding: 6px 12px;
            border: 1px solid #ccc;
            border-radius: 4px;
            background: #fff;
            cursor: pointer;
            font-size: 12px;
            white-space: nowrap;
        `;
        
        button.addEventListener('mouseover', () => {
            button.style.background = '#f0f0f0';
        });
        
        button.addEventListener('mouseout', () => {
            button.style.background = '#fff';
        });
        
        return button;
    }

    /**
     * Create footer with statistics
     * @private
     */
    createFooter() {
        this.footerContainer = document.createElement('div');
        this.footerContainer.className = 'tree-footer';
        this.footerContainer.style.cssText = `
            padding: 8px 12px;
            border-top: 1px solid #eee;
            background: #f8f9fa;
            font-size: 12px;
            color: #666;
        `;
        
        this.statsContainer = document.createElement('div');
        this.statsContainer.className = 'tree-stats';
        this.footerContainer.appendChild(this.statsContainer);
        
        this.container.appendChild(this.footerContainer);
    }

    /**
     * Setup core components
     * @private
     */
    setupComponents() {
        // Setup selection manager
        this.selectionManager.setNodeLookupFunction((nodeId) => {
            return this.dataTransformer.nodeMap.get(nodeId);
        });
        
        // Setup virtual tree view
        if (this.options.enableVirtualScrolling) {
            this.virtualTreeView = new VirtualizedTreeView(this.treeContainer, {
                itemHeight: this.options.itemHeight,
                overscan: this.options.overscan,
                bufferSize: this.options.bufferSize
            });
        }
    }

    /**
     * Attach event listeners
     * @private
     */
    attachEventListeners() {
        // Tree click events
        this.treeContainer.addEventListener('click', this.boundHandleClick);
        
        // Keyboard events
        this.container.addEventListener('keydown', this.boundHandleKeyDown);
        
        // Search input
        if (this.searchInput) {
            this.searchInput.addEventListener('input', this.boundHandleSearch);
        }
        
        // Virtual tree view events
        if (this.virtualTreeView) {
            this.treeContainer.addEventListener('render', (event) => {
                this.updateStats();
            });
        }
        
        // Selection events
        this.selectionManager.addEventListener('selectionChange', (data) => {
            this.onSelectionChange(data);
        });
        
        this.selectionManager.addEventListener('batchChange', (data) => {
            this.onBatchSelectionChange(data);
        });
    }

    /**
     * Load document data into the tree view
     * @param {Object} parsedDocument - Result from DocumentParser.parse()
     * @param {Array} pathData - Result from PathExtractor
     */
    loadDocument(parsedDocument, pathData) {
        if (!parsedDocument || !pathData) {
            throw new Error('Both parsedDocument and pathData are required');
        }
        
        this.documentFormat = parsedDocument.format;
        
        try {
            // Transform paths to tree structure
            this.rootNode = this.dataTransformer.transformPathsToTree(pathData, this.documentFormat);
            
            // Initialize all nodes as collapsed except root
            this.initializeNodeStates(this.rootNode);
            
            // Update displays
            this.updateTreeDisplay();
            this.updateStats();
            
            // Emit load event
            this.emit('documentLoaded', {
                format: this.documentFormat,
                nodeCount: this.dataTransformer.getStats().nodeCount,
                pathCount: pathData.length
            });
            
        } catch (error) {
            console.error('Error loading document:', error);
            this.showError('Failed to load document: ' + error.message);
        }
    }

    /**
     * Initialize node states (expansion, selection)
     * @private
     */
    initializeNodeStates(node, level = 0) {
        if (!node) return;
        
        // Expand first few levels by default
        node.expanded = level < 2;
        node.level = level;
        
        // Recursively initialize children
        for (const child of node.children.values()) {
            this.initializeNodeStates(child, level + 1);
        }
    }

    /**
     * Update tree display
     * @private
     */
    updateTreeDisplay() {
        if (!this.rootNode) return;
        
        // Flatten tree for display
        this.flattenedNodes = this.dataTransformer.flattenTreeForDisplay(this.rootNode, true);
        
        // Apply search filter
        this.applySearchFilter();
        
        // Update virtual tree view
        if (this.virtualTreeView) {
            this.virtualTreeView.setData(this.filteredNodes);
        } else {
            // Fallback to regular rendering for small datasets
            this.renderRegularTree();
        }
    }

    /**
     * Apply search filter to nodes
     * @private
     */
    applySearchFilter() {
        if (!this.currentSearchTerm) {
            this.filteredNodes = this.flattenedNodes;
            return;
        }
        
        const searchTerm = this.currentSearchTerm.toLowerCase();
        this.filteredNodes = this.flattenedNodes.filter(node => {
            const matches = node.matchesSearch(searchTerm);
            node.highlighted = matches;
            return matches;
        });
    }

    /**
     * Handle click events
     * @private
     */
    handleClick(event) {
        const nodeElement = event.target.closest('.tree-node-item');
        if (!nodeElement) return;
        
        const nodeId = nodeElement.getAttribute('data-node-id');
        const node = this.dataTransformer.nodeMap.get(nodeId);
        if (!node) return;
        
        // Handle different click targets
        if (event.target.closest('.tree-node-expander')) {
            this.handleExpanderClick(node, event);
        } else if (event.target.closest('.tree-node-checkbox')) {
            this.handleCheckboxClick(node, event);
        } else {
            this.handleNodeClick(node, event);
        }
    }

    /**
     * Handle expander click
     * @private
     */
    handleExpanderClick(node, event) {
        event.preventDefault();
        
        if (!node.metadata.hasChildren) return;
        
        node.expanded = !node.expanded;
        this.updateTreeDisplay();
        
        this.emit('nodeExpanded', {
            node: node,
            expanded: node.expanded
        });
    }

    /**
     * Handle checkbox click
     * @private
     */
    handleCheckboxClick(node, event) {
        event.preventDefault();
        
        this.selectionManager.toggleNodeSelection(node, {
            isUserAction: true,
            shiftKey: event.shiftKey,
            ctrlKey: event.ctrlKey || event.metaKey
        });
    }

    /**
     * Handle node label click
     * @private
     */
    handleNodeClick(node, event) {
        // Focus the node
        this.focusNode(node);
        
        // If not using checkboxes, handle selection here
        if (!this.options.enableSelection) return;
        
        this.selectionManager.toggleNodeSelection(node, {
            isUserAction: true,
            shiftKey: event.shiftKey,
            ctrlKey: event.ctrlKey || event.metaKey
        });
    }

    /**
     * Handle keyboard events
     * @private
     */
    handleKeyDown(event) {
        if (!this.focusedNodeId) return;
        
        const focusedNode = this.dataTransformer.nodeMap.get(this.focusedNodeId);
        if (!focusedNode) return;
        
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.focusNextNode();
                break;
                
            case 'ArrowUp':
                event.preventDefault();
                this.focusPreviousNode();
                break;
                
            case 'ArrowRight':
                event.preventDefault();
                if (focusedNode.metadata.hasChildren && !focusedNode.expanded) {
                    focusedNode.expanded = true;
                    this.updateTreeDisplay();
                } else {
                    this.focusNextNode();
                }
                break;
                
            case 'ArrowLeft':
                event.preventDefault();
                if (focusedNode.metadata.hasChildren && focusedNode.expanded) {
                    focusedNode.expanded = false;
                    this.updateTreeDisplay();
                } else if (focusedNode.parent && !focusedNode.parent.metadata.isRoot) {
                    this.focusNode(focusedNode.parent);
                }
                break;
                
            case ' ':
            case 'Enter':
                event.preventDefault();
                this.selectionManager.toggleNodeSelection(focusedNode, {
                    isUserAction: true
                });
                break;
                
            case 'Home':
                event.preventDefault();
                this.focusFirstNode();
                break;
                
            case 'End':
                event.preventDefault();
                this.focusLastNode();
                break;
        }
    }

    /**
     * Handle search input
     * @private
     */
    handleSearch(event) {
        this.currentSearchTerm = event.target.value;
        this.applySearchFilter();
        
        if (this.virtualTreeView) {
            this.virtualTreeView.setData(this.filteredNodes);
        }
        
        this.updateStats();
        
        this.emit('search', {
            term: this.currentSearchTerm,
            resultCount: this.filteredNodes.length
        });
    }

    /**
     * Focus a specific node
     * @private
     */
    focusNode(node) {
        if (!node) return;
        
        this.focusedNodeId = node.id;
        
        // Scroll to node if using virtual scrolling
        if (this.virtualTreeView) {
            this.virtualTreeView.scrollToNode(node.id);
        }
        
        // Update visual focus
        this.updateFocusDisplay();
        
        this.emit('nodeFocused', { node });
    }

    /**
     * Focus next node
     * @private
     */
    focusNextNode() {
        const currentIndex = this.filteredNodes.findIndex(n => n.id === this.focusedNodeId);
        if (currentIndex < this.filteredNodes.length - 1) {
            this.focusNode(this.filteredNodes[currentIndex + 1]);
        }
    }

    /**
     * Focus previous node
     * @private
     */
    focusPreviousNode() {
        const currentIndex = this.filteredNodes.findIndex(n => n.id === this.focusedNodeId);
        if (currentIndex > 0) {
            this.focusNode(this.filteredNodes[currentIndex - 1]);
        }
    }

    /**
     * Focus first node
     * @private
     */
    focusFirstNode() {
        if (this.filteredNodes.length > 0) {
            this.focusNode(this.filteredNodes[0]);
        }
    }

    /**
     * Focus last node
     * @private
     */
    focusLastNode() {
        if (this.filteredNodes.length > 0) {
            this.focusNode(this.filteredNodes[this.filteredNodes.length - 1]);
        }
    }

    /**
     * Update focus display
     * @private
     */
    updateFocusDisplay() {
        // Remove previous focus
        const prevFocused = this.treeContainer.querySelector('.tree-node-item.focused');
        if (prevFocused) {
            prevFocused.classList.remove('focused');
        }
        
        // Add focus to current node
        const focusedElement = this.treeContainer.querySelector(`[data-node-id="${this.focusedNodeId}"]`);
        if (focusedElement) {
            focusedElement.classList.add('focused');
        }
    }

    /**
     * Expand all nodes
     */
    expandAll() {
        if (!this.rootNode) return;
        
        const expandNode = (node) => {
            if (node.metadata.hasChildren) {
                node.expanded = true;
            }
            for (const child of node.children.values()) {
                expandNode(child);
            }
        };
        
        expandNode(this.rootNode);
        this.updateTreeDisplay();
        
        this.emit('expandAll');
    }

    /**
     * Collapse all nodes
     */
    collapseAll() {
        if (!this.rootNode) return;
        
        const collapseNode = (node) => {
            if (node.metadata.hasChildren && !node.metadata.isRoot) {
                node.expanded = false;
            }
            for (const child of node.children.values()) {
                collapseNode(child);
            }
        };
        
        collapseNode(this.rootNode);
        this.updateTreeDisplay();
        
        this.emit('collapseAll');
    }

    /**
     * Select all nodes
     */
    selectAll() {
        if (!this.rootNode) return;
        
        this.selectionManager.selectAll(this.rootNode);
        this.updateTreeDisplay();
    }

    /**
     * Deselect all nodes
     */
    deselectAll() {
        this.selectionManager.deselectAll();
        this.updateTreeDisplay();
    }

    /**
     * Get selected paths for SAP CI integration using OutputFormatter
     * @returns {Object} SAP CI formatted output
     */
    getSelectedPathsForSAP() {
        if (!this.outputFormatter) {
            // OutputFormatter will be loaded when needed
            console.log('OutputFormatter not initialized');
            return { metadata: { valid: false }, output: '' };
        }
        
        const selectedNodes = this.selectionManager.getSelectedNodes();
        const selectedPaths = selectedNodes.map(node => node.path);
        
        // Get namespace information for XML documents
        let namespaces = new Map();
        if (this.documentFormat === 'xml' && selectedNodes.length > 0) {
            const xmlNode = selectedNodes.find(node => node.originalData && node.originalData.element);
            if (xmlNode && xmlNode.originalData.element.ownerDocument) {
                const pathExtractor = new PathExtractor();
                const namespaceString = pathExtractor.getSAPNamespaceFormat(xmlNode.originalData.element.ownerDocument);
                
                // Parse namespace string back to Map format for OutputFormatter
                if (namespaceString) {
                    const pairs = namespaceString.split(';');
                    for (const pair of pairs) {
                        const [prefix, uri] = pair.split('=');
                        if (prefix && uri) {
                            namespaces.set(uri, prefix);
                        }
                    }
                }
            }
        }
        
        // Use OutputFormatter for proper SAP CI formatting
        const formattedOutput = this.outputFormatter.formatForSAP(selectedPaths, namespaces);
        
        // Return legacy format for backward compatibility
        return {
            DynamicCustomHeader: formattedOutput.DynamicCustomHeader,
            DynamicCustomHeaderXMLNamespace: formattedOutput.DynamicCustomHeaderXMLNamespace,
            selectedCount: selectedPaths.length,
            documentFormat: this.documentFormat
        };
    }

    /**
     * Handle selection change event
     * @private
     */
    onSelectionChange(data) {
        this.updateTreeDisplay();
        this.updateStats();
        
        // Trigger real-time output updates if OutputFormatter is initialized
        if (this.outputFormatter) {
            this.outputFormatter.updateOutputDisplay();
        }
        
        this.emit('selectionChange', data);
    }

    /**
     * Handle batch selection change event
     * @private
     */
    onBatchSelectionChange(data) {
        this.updateTreeDisplay();
        this.updateStats();
        
        // Trigger real-time output updates if OutputFormatter is initialized
        if (this.outputFormatter) {
            this.outputFormatter.updateOutputDisplay();
        }
        
        this.emit('batchSelectionChange', data);
    }

    /**
     * Update statistics display
     * @private
     */
    updateStats() {
        if (!this.statsContainer) return;
        
        const selectionStats = this.selectionManager.getSelectionStats();
        const treeStats = this.dataTransformer.getStats();
        
        const displayedCount = this.currentSearchTerm ? 
            this.filteredNodes.length : 
            this.flattenedNodes.length;
        
        this.statsContainer.innerHTML = `
            Total: ${treeStats.nodeCount} | 
            Displayed: ${displayedCount} | 
            Selected: ${selectionStats.selectedCount}
            ${this.currentSearchTerm ? ` | Search: "${this.currentSearchTerm}"` : ''}
        `;
    }

    /**
     * Show error message
     * @private
     */
    showError(message) {
        this.treeContainer.innerHTML = `
            <div class="tree-error" style="
                padding: 20px;
                text-align: center;
                color: #dc3545;
                font-size: 14px;
            ">
                ❌ ${message}
            </div>
        `;
    }

    /**
     * Render regular tree (fallback for small datasets)
     * @private
     */
    renderRegularTree() {
        // Implementation for non-virtualized rendering
        // This would be used for small datasets or as a fallback
        this.treeContainer.innerHTML = '<div>Regular tree rendering not implemented</div>';
    }

    /**
     * Add CSS styles
     * @private
     */
    addStyles() {
        const styleId = 'interactive-tree-view-styles';
        if (document.getElementById(styleId)) return;
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .tree-node-item {
                transition: background-color 0.15s ease;
            }
            
            .tree-node-item:hover {
                background-color: #f5f5f5;
            }
            
            .tree-node-item.selected {
                background-color: #e3f2fd;
            }
            
            .tree-node-item.focused {
                outline: 2px solid #2196f3;
                outline-offset: -2px;
            }
            
            .tree-node-item.highlighted {
                background-color: #fff3cd;
            }
            
            .tree-node-expander {
                width: 16px;
                height: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 12px;
                margin-right: 4px;
            }
            
            .tree-node-expander.leaf {
                cursor: default;
            }
            
            .tree-node-checkbox {
                margin-right: 8px;
            }
            
            .tree-node-icon {
                margin-right: 6px;
                font-size: 14px;
            }
            
            .tree-node-label {
                flex: 1;
                font-size: 13px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .tree-node-value {
                font-size: 11px;
                color: #666;
                font-style: italic;
                margin-left: 8px;
                max-width: 150px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            @media (max-width: 768px) {
                .tree-header {
                    flex-direction: column;
                    align-items: stretch;
                }
                
                .tree-controls {
                    flex-wrap: wrap;
                    justify-content: center;
                }
                
                .tree-control-btn {
                    font-size: 11px;
                    padding: 4px 8px;
                }
                
                .tree-node-value {
                    display: none;
                }
            }
        `;
        
        document.head.appendChild(style);
    }

    /**
     * Simple event emitter
     * @private
     */
    emit(eventName, data) {
        const event = new CustomEvent(eventName, { detail: data });
        this.container.dispatchEvent(event);
    }

    /**
     * Destroy the tree view
     */
    destroy() {
        // Remove event listeners
        this.treeContainer.removeEventListener('click', this.boundHandleClick);
        this.container.removeEventListener('keydown', this.boundHandleKeyDown);
        
        if (this.searchInput) {
            this.searchInput.removeEventListener('input', this.boundHandleSearch);
        }
        
        // Destroy components
        if (this.virtualTreeView) {
            this.virtualTreeView.destroy();
        }
        
        this.selectionManager.destroy();
        this.dataTransformer.reset();
        
        // Clear DOM
        this.container.innerHTML = '';
        
        // Clear references
        this.rootNode = null;
        this.flattenedNodes = [];
        this.filteredNodes = [];
    }
}

// Export for both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
    
} else if (typeof window !== 'undefined') {
    window.InteractiveTreeView = InteractiveTreeView;
}

// ES module export

window.InteractiveTreeView = InteractiveTreeView;

})();

// src/FileHandler.js
(function() {
/**
 * FileHandler - File Upload and Drag-and-Drop Support
 * Implements Issue #7 requirements for DynamicParameterHelper
 * 
 * Features:
 * - File upload button
 * - Drag-and-drop zone with visual feedback
 * - File type validation (.xml, .json, .txt)
 * - File size limits (10MB)
 * - Progress indication
 * - Recent files history (localStorage)
 * - Security validation
 * - Accessibility support
 * - Mobile-friendly file selection
 */

class FileHandler {
    constructor(options = {}) {
        this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
        this.allowedTypes = options.allowedTypes || ['.xml', '.json', '.txt'];
        this.enableHistory = options.enableHistory !== false;
        this.maxHistoryItems = options.maxHistoryItems || 10;
        
        // Element references
        this.dropZone = null;
        this.fileInput = null;
        this.progressContainer = null;
        this.progressBar = null;
        this.progressText = null;
        
        // Event callbacks
        this.onFileLoad = options.onFileLoad || null;
        this.onProgress = options.onProgress || null;
        this.onError = options.onError || null;
        this.onValidationError = options.onValidationError || null;
        
        // State
        this.isDragActive = false;
        this.currentFile = null;
        
        // Bind methods to preserve context
        this.handleDragEnter = this.handleDragEnter.bind(this);
        this.handleDragOver = this.handleDragOver.bind(this);
        this.handleDragLeave = this.handleDragLeave.bind(this);
        this.handleDrop = this.handleDrop.bind(this);
        this.handleFileSelect = this.handleFileSelect.bind(this);
        
        // Proactively create file input for E2E testing compatibility
        this.setupFileInput();
    }
    
    /**
     * Initialize drag-drop functionality on a target element
     * @param {HTMLElement} dropZone - Element to set up as drop zone
     */
    setupDragDrop(dropZone) {
        if (!dropZone) {
            throw new Error('Drop zone element is required');
        }
        
        this.dropZone = dropZone;
        
        // Add ARIA attributes for accessibility
        dropZone.setAttribute('role', 'button');
        dropZone.setAttribute('aria-label', 'File drop zone - drag and drop files here or click to browse');
        dropZone.setAttribute('tabindex', '0');
        
        // Add CSS classes for styling
        dropZone.classList.add('file-drop-zone');
        
        // Add drag and drop event listeners
        dropZone.addEventListener('dragenter', this.handleDragEnter);
        dropZone.addEventListener('dragover', this.handleDragOver);
        dropZone.addEventListener('dragleave', this.handleDragLeave);
        dropZone.addEventListener('drop', this.handleDrop);
        
        // Add keyboard support for accessibility
        dropZone.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                this.openFileDialog();
            }
        });
        
        // Add click support for file dialog
        dropZone.addEventListener('click', () => {
            this.openFileDialog();
        });
        
        this.updateVisualFeedback('default');
    }
    
    /**
     * Set up file input element
     * @param {HTMLElement} inputElement - File input element
     */
    setupFileInput(inputElement) {
        if (!inputElement) {
            // Create hidden file input if not provided
            inputElement = document.createElement('input');
            inputElement.type = 'file';
            inputElement.style.display = 'none';
            inputElement.accept = this.allowedTypes.join(',');
            inputElement.multiple = false;
            document.body.appendChild(inputElement);
        }
        
        this.fileInput = inputElement;
        this.fileInput.accept = this.allowedTypes.join(',');
        this.fileInput.addEventListener('change', (event) => {
            if (event.target.files && event.target.files[0]) {
                this.handleFileSelect(event.target.files[0]);
            }
        });
    }
    
    /**
     * Set up progress indication elements
     * @param {HTMLElement} container - Container for progress elements
     */
    setupProgressIndicator(container) {
        if (!container) return;
        
        this.progressContainer = container;
        this.progressContainer.innerHTML = `
            <div class="file-progress-bar">
                <div class="file-progress-fill"></div>
            </div>
            <div class="file-progress-text">Ready</div>
        `;
        
        this.progressBar = container.querySelector('.file-progress-fill');
        this.progressText = container.querySelector('.file-progress-text');
        this.progressContainer.style.display = 'none';
    }
    
    /**
     * Open file dialog programmatically
     */
    openFileDialog() {
        if (!this.fileInput) {
            this.setupFileInput();
        }
        this.fileInput.click();
    }
    
    /**
     * Handle drag enter event
     * @param {DragEvent} event 
     */
    handleDragEnter(event) {
        event.preventDefault();
        event.stopPropagation();
        
        if (!this.isDragActive) {
            this.isDragActive = true;
            this.updateVisualFeedback('dragover');
        }
    }
    
    /**
     * Handle drag over event
     * @param {DragEvent} event 
     */
    handleDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Check if files are being dragged
        const hasFiles = event.dataTransfer.types.includes('Files');
        const feedbackState = hasFiles ? 'dragover-valid' : 'dragover-invalid';
        this.updateVisualFeedback(feedbackState);
    }
    
    /**
     * Handle drag leave event
     * @param {DragEvent} event 
     */
    handleDragLeave(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Only update if leaving the drop zone completely
        if (!this.dropZone.contains(event.relatedTarget)) {
            this.isDragActive = false;
            this.updateVisualFeedback('default');
        }
    }
    
    /**
     * Handle drop event
     * @param {DragEvent} event 
     */
    handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        
        this.isDragActive = false;
        this.updateVisualFeedback('default');
        
        const files = event.dataTransfer.files;
        if (files && files[0]) {
            this.handleFileSelect(files[0]);
        }
    }
    
    /**
     * Process uploaded/selected file
     * @param {File} file - File object to process
     */
    async handleFileSelect(file) {
        this.currentFile = file;
        
        try {
            // Validate file first
            this.validateFile(file);
            
            // Show progress for larger files
            const showProgress = file.size > 1024 * 1024; // 1MB
            if (showProgress) {
                this.showProgress(0);
            }
            
            // Read file content
            const content = await this.readFileContent(file);
            
            if (showProgress) {
                this.showProgress(100);
            }
            
            // Save to history
            if (this.enableHistory) {
                this.saveToHistory({
                    name: file.name,
                    size: file.size,
                    type: file.type || this.getFileTypeFromExtension(file.name),
                    lastModified: file.lastModified,
                    loadedAt: Date.now()
                });
            }
            
            // Call success callback
            if (this.onFileLoad) {
                this.onFileLoad({
                    file: file,
                    content: content,
                    metadata: {
                        name: file.name,
                        size: file.size,
                        type: file.type || this.getFileTypeFromExtension(file.name),
                        lastModified: new Date(file.lastModified),
                        loadedAt: new Date()
                    }
                });
            }
            
            // Hide progress after short delay
            if (showProgress) {
                setTimeout(() => {
                    if (this.progressContainer) {
                        this.progressContainer.style.display = 'none';
                    }
                }, 1000);
            }
            
        } catch (error) {
            this.handleError(error);
        }
    }
    
    /**
     * Validate file before processing
     * @param {File} file - File to validate
     * @returns {boolean} True if valid
     * @throws {Error} If validation fails
     */
    validateFile(file) {
        // Check if file exists
        if (!file) {
            throw new Error('No file provided');
        }
        
        // Size validation
        if (file.size > this.maxFileSize) {
            const maxSizeMB = Math.round(this.maxFileSize / 1024 / 1024);
            throw new Error(`File size (${this.formatFileSize(file.size)}) exceeds maximum limit of ${maxSizeMB}MB`);
        }
        
        // Empty file check
        if (file.size === 0) {
            throw new Error('File is empty');
        }
        
        // Name validation (check first to provide better error messages)
        if (!file.name || file.name.trim() === '') {
            throw new Error('File must have a valid name');
        }
        
        // Type validation (client-side only, not security-critical)
        const extension = this.getFileExtension(file.name);
        if (!this.allowedTypes.includes(extension)) {
            throw new Error(`File type "${extension}" not supported. Allowed types: ${this.allowedTypes.join(', ')}`);
        }
        
        // Check for suspicious file name patterns
        if (file.name.includes('..') || /[<>:"/\\|?*\x00-\x1f]/.test(file.name)) {
            throw new Error('File name contains invalid characters');
        }
        
        return true;
    }
    
    /**
     * Read file content as text
     * @param {File} file - File to read
     * @returns {Promise<string>} File content as string
     */
    readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    const content = event.target.result;
                    
                    // Basic content validation
                    if (typeof content !== 'string') {
                        throw new Error('File content is not text-readable');
                    }
                    
                    // Check for null bytes (potential security issue)
                    if (content.includes('\0')) {
                        throw new Error('File contains null bytes and may be corrupted or unsafe');
                    }
                    
                    resolve(content);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file: ' + (reader.error?.message || 'Unknown error')));
            };
            
            reader.onprogress = (event) => {
                if (event.lengthComputable && this.onProgress) {
                    const percent = Math.round((event.loaded / event.total) * 100);
                    this.onProgress(percent);
                    this.showProgress(percent);
                }
            };
            
            // Read as text with UTF-8 encoding
            reader.readAsText(file, 'UTF-8');
        });
    }
    
    /**
     * Show progress indication
     * @param {number} percent - Progress percentage (0-100)
     */
    showProgress(percent) {
        if (!this.progressContainer) return;
        
        this.progressContainer.style.display = 'block';
        
        if (this.progressBar) {
            this.progressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
        }
        
        if (this.progressText) {
            if (percent >= 100) {
                this.progressText.textContent = 'Complete!';
            } else if (percent > 0) {
                this.progressText.textContent = `Loading... ${percent}%`;
            } else {
                this.progressText.textContent = 'Starting...';
            }
        }
        
        // Call progress callback
        if (this.onProgress) {
            this.onProgress(percent);
        }
    }
    
    /**
     * Update visual feedback based on current state
     * @param {string} state - Visual state ('default', 'dragover', 'dragover-valid', 'dragover-invalid', 'error', 'success')
     */
    updateVisualFeedback(state) {
        if (!this.dropZone) return;
        
        // Remove all state classes
        const stateClasses = ['drag-default', 'drag-over', 'drag-valid', 'drag-invalid', 'drag-error', 'drag-success'];
        this.dropZone.classList.remove(...stateClasses);
        
        // Add appropriate state class
        switch (state) {
            case 'default':
                this.dropZone.classList.add('drag-default');
                this.dropZone.setAttribute('aria-label', 'File drop zone - drag and drop files here or click to browse');
                break;
            case 'dragover':
                this.dropZone.classList.add('drag-over');
                this.dropZone.setAttribute('aria-label', 'Drop files here');
                break;
            case 'dragover-valid':
                this.dropZone.classList.add('drag-valid');
                this.dropZone.setAttribute('aria-label', 'Valid files - drop to upload');
                break;
            case 'dragover-invalid':
                this.dropZone.classList.add('drag-invalid');
                this.dropZone.setAttribute('aria-label', 'Invalid file type - only XML, JSON, and TXT files are supported');
                break;
            case 'error':
                this.dropZone.classList.add('drag-error');
                break;
            case 'success':
                this.dropZone.classList.add('drag-success');
                setTimeout(() => this.updateVisualFeedback('default'), 2000);
                break;
        }
    }
    
    /**
     * Save file information to history
     * @param {Object} fileInfo - File metadata to save
     */
    saveToHistory(fileInfo) {
        if (!this.enableHistory) return;
        
        try {
            let history = this.getRecentFiles();
            
            // Remove duplicate entries (same name and size)
            history = history.filter(item => 
                !(item.name === fileInfo.name && item.size === fileInfo.size)
            );
            
            // Add new entry at the beginning
            history.unshift(fileInfo);
            
            // Limit history size
            if (history.length > this.maxHistoryItems) {
                history = history.slice(0, this.maxHistoryItems);
            }
            
            // Save to localStorage
            localStorage.setItem('fileHandler.recentFiles', JSON.stringify(history));
        } catch (error) {
            console.warn('Failed to save file to history:', error);
        }
    }
    
    /**
     * Get recent files from history
     * @returns {Array} Array of recent file information
     */
    getRecentFiles() {
        if (!this.enableHistory) return [];
        
        try {
            const historyJson = localStorage.getItem('fileHandler.recentFiles');
            return historyJson ? JSON.parse(historyJson) : [];
        } catch (error) {
            console.warn('Failed to load file history:', error);
            return [];
        }
    }
    
    /**
     * Clear file history
     */
    clearHistory() {
        try {
            localStorage.removeItem('fileHandler.recentFiles');
        } catch (error) {
            console.warn('Failed to clear file history:', error);
        }
    }
    
    /**
     * Handle errors
     * @param {Error} error - Error to handle
     */
    handleError(error) {
        console.error('FileHandler error:', error);
        
        this.updateVisualFeedback('error');
        
        if (this.progressContainer) {
            this.progressContainer.style.display = 'none';
        }
        
        if (this.onError) {
            this.onError(error);
        } else {
            // Default error handling
            alert(`File error: ${error.message}`);
        }
        
        // Reset visual state after error display
        setTimeout(() => {
            this.updateVisualFeedback('default');
        }, 3000);
    }
    
    /**
     * Get file extension from filename
     * @param {string} filename - File name
     * @returns {string} File extension (with dot)
     */
    getFileExtension(filename) {
        const lastDotIndex = filename.lastIndexOf('.');
        return lastDotIndex >= 0 ? filename.substring(lastDotIndex).toLowerCase() : '';
    }
    
    /**
     * Get file type from extension
     * @param {string} filename - File name
     * @returns {string} MIME type
     */
    getFileTypeFromExtension(filename) {
        const extension = this.getFileExtension(filename);
        const typeMap = {
            '.xml': 'application/xml',
            '.json': 'application/json',
            '.txt': 'text/plain'
        };
        return typeMap[extension] || 'text/plain';
    }
    
    /**
     * Format file size for display
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted size string
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        
        const units = ['B', 'KB', 'MB', 'GB'];
        const k = 1024;
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + units[i];
    }
    
    /**
     * Check if FileAPI is supported
     * @returns {boolean} True if supported
     */
    static isSupported() {
        return (
            typeof File !== 'undefined' &&
            typeof FileReader !== 'undefined' &&
            typeof FileList !== 'undefined' &&
            typeof Blob !== 'undefined'
        );
    }
    
    /**
     * Get current file being processed
     * @returns {File|null} Current file or null
     */
    getCurrentFile() {
        return this.currentFile;
    }
    
    /**
     * Reset the file handler state
     */
    reset() {
        this.currentFile = null;
        this.isDragActive = false;
        
        if (this.fileInput) {
            this.fileInput.value = '';
        }
        
        if (this.progressContainer) {
            this.progressContainer.style.display = 'none';
        }
        
        this.updateVisualFeedback('default');
    }
    
    /**
     * Destroy the file handler and clean up resources
     */
    destroy() {
        // Remove event listeners
        if (this.dropZone) {
            this.dropZone.removeEventListener('dragenter', this.handleDragEnter);
            this.dropZone.removeEventListener('dragover', this.handleDragOver);
            this.dropZone.removeEventListener('dragleave', this.handleDragLeave);
            this.dropZone.removeEventListener('drop', this.handleDrop);
        }
        
        // Clean up file input
        if (this.fileInput && this.fileInput.parentNode) {
            this.fileInput.parentNode.removeChild(this.fileInput);
        }
        
        // Reset references
        this.dropZone = null;
        this.fileInput = null;
        this.progressContainer = null;
        this.progressBar = null;
        this.progressText = null;
        this.currentFile = null;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    
}
window.FileHandler = FileHandler;

})();


// Global function: loadSampleXML
async function loadSampleXML() {
            const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:tns="http://example.com/service"
               xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <soap:Header>
        <tns:Authentication>
            <tns:Username>admin</tns:Username>
            <tns:Token>abc123xyz789</tns:Token>
            <tns:Timestamp>2023-01-01T10:00:00Z</tns:Timestamp>
        </tns:Authentication>
        <tns:RequestInfo>
            <tns:RequestId>REQ-001</tns:RequestId>
            <tns:ClientInfo>
                <tns:Application>SAP CI</tns:Application>
                <tns:Version>2.0</tns:Version>
            </tns:ClientInfo>
        </tns:RequestInfo>
    </soap:Header>
    <soap:Body>
        <tns:GetUserRequest>
            <tns:UserId>12345</tns:UserId>
            <tns:IncludeDetails>true</tns:IncludeDetails>
            <tns:Fields>
                <tns:Field>name</tns:Field>
                <tns:Field>email</tns:Field>
                <tns:Field>address</tns:Field>
                <tns:Field>preferences</tns:Field>
            </tns:Fields>
            <tns:Options>
                <tns:MaxResults>100</tns:MaxResults>
                <tns:SortBy>name</tns:SortBy>
                <tns:IncludeMetadata>true</tns:IncludeMetadata>
            </tns:Options>
        </tns:GetUserRequest>
    </soap:Body>
</soap:Envelope>`;
            
            await loadDocument(xmlData, 'SOAP XML');
        }
window.loadSampleXML = loadSampleXML;


// Global function: loadSampleJSON
async function loadSampleJSON() {
            const jsonData = `{
  "order": {
    "id": "ORD-001",
    "status": "processing",
    "createdAt": "2023-01-01T10:00:00Z",
    "customer": {
      "id": "CUST-123",
      "name": "Acme Corporation",
      "type": "business",
      "contact": {
        "email": "orders@acme.com",
        "phone": "+1-555-0123",
        "address": {
          "street": "123 Business Blvd",
          "city": "Commerce City",
          "state": "CA",
          "zip": "90210",
          "country": "USA"
        }
window.loadSampleJSON = loadSampleJSON;


// Global function: loadComplexXML
async function loadComplexXML() {
            const complexXML = `<?xml version="1.0" encoding="UTF-8"?>
<sap:Message xmlns:sap="http://sap.com/xi/XI/Message/30"
             xmlns:prx="http://sap.com/xi/XI/Message/Proxy/30"
             xmlns:tns="http://example.com/integration/order"
             xmlns:cust="http://example.com/customer"
             xmlns:prod="http://example.com/product">
    <sap:MessageHeader>
        <sap:From>
            <sap:Party>SAP_CLIENT_001</sap:Party>
            <sap:Service>ORDER_PROCESSING</sap:Service>
        </sap:From>
        <sap:To>
            <sap:Party>ERP_SYSTEM</sap:Party>
            <sap:Service>ORDER_RECEIVER</sap:Service>
        </sap:To>
        <sap:MessageId>MSG-12345-67890</sap:MessageId>
        <sap:Timestamp>2023-01-01T10:00:00.000Z</sap:Timestamp>
        <sap:QualityOfService>ExactlyOnce</sap:QualityOfService>
    </sap:MessageHeader>
    <sap:MessageBody>
        <tns:OrderMessage>
            <tns:OrderHeader>
                <tns:OrderId>ORD-001</tns:OrderId>
                <tns:OrderType>SALES</tns:OrderType>
                <tns:Priority>HIGH</tns:Priority>
                <tns:CreationDate>2023-01-01</tns:CreationDate>
                <tns:RequestedDeliveryDate>2023-01-05</tns:RequestedDeliveryDate>
                <cust:CustomerInfo>
                    <cust:CustomerId>CUST-123</cust:CustomerId>
                    <cust:CustomerName>Acme Corporation</cust:CustomerName>
                    <cust:CustomerClass>PREMIUM</cust:CustomerClass>
                    <cust:BillingAddress>
                        <cust:Street>123 Main St</cust:Street>
                        <cust:City>Anytown</cust:City>
                        <cust:PostalCode>12345</cust:PostalCode>
                        <cust:Country>US</cust:Country>
                    </cust:BillingAddress>
                    <cust:ShippingAddress>
                        <cust:Street>456 Oak Ave</cust:Street>
                        <cust:City>Somewhere</cust:City>
                        <cust:PostalCode>67890</cust:PostalCode>
                        <cust:Country>US</cust:Country>
                    </cust:ShippingAddress>
                </cust:CustomerInfo>
            </tns:OrderHeader>
            <tns:OrderItems>
                <tns:OrderItem>
                    <tns:ItemNumber>10</tns:ItemNumber>
                    <prod:ProductInfo>
                        <prod:ProductId>PROD-001</prod:ProductId>
                        <prod:ProductName>Widget Alpha</prod:ProductName>
                        <prod:Category>WIDGETS</prod:Category>
                        <prod:UnitPrice currency="USD">29.99</prod:UnitPrice>
                    </prod:ProductInfo>
                    <tns:Quantity unitOfMeasure="EA">5</tns:Quantity>
                    <tns:RequestedDate>2023-01-03</tns:RequestedDate>
                </tns:OrderItem>
                <tns:OrderItem>
                    <tns:ItemNumber>20</tns:ItemNumber>
                    <prod:ProductInfo>
                        <prod:ProductId>PROD-002</prod:ProductId>
                        <prod:ProductName>Gadget Beta</prod:ProductName>
                        <prod:Category>GADGETS</prod:Category>
                        <prod:UnitPrice currency="USD">149.99</prod:UnitPrice>
                    </prod:ProductInfo>
                    <tns:Quantity unitOfMeasure="EA">2</tns:Quantity>
                    <tns:RequestedDate>2023-01-03</tns:RequestedDate>
                </tns:OrderItem>
            </tns:OrderItems>
            <tns:OrderTotals>
                <tns:SubTotal currency="USD">449.93</tns:SubTotal>
                <tns:Tax currency="USD">36.00</tns:Tax>
                <tns:ShippingCost currency="USD">15.00</tns:ShippingCost>
                <tns:TotalAmount currency="USD">500.93</tns:TotalAmount>
            </tns:OrderTotals>
        </tns:OrderMessage>
    </sap:MessageBody>
</sap:Message>`;
            
            await loadDocument(complexXML, 'SAP Integration XML');
        }
window.loadComplexXML = loadComplexXML;


// Global function: loadLargeDataset
async function loadLargeDataset() {
            // Generate large JSON dataset
            const items = [];
            for (let i = 1; i <= 100; i++) {
                items.push({
                    id: `ITEM-${i.toString().padStart(3, '0')}`,
                    name: `Product ${i}`,
                    category: `Category ${Math.ceil(i / 10)}`,
                    price: (Math.random() * 1000).toFixed(2),
                    attributes: {
                        color: ['red', 'blue', 'green', 'yellow'][i % 4],
                        size: ['small', 'medium', 'large'][i % 3],
                        weight: (Math.random() * 10).toFixed(1),
                        manufacturer: `Manufacturer ${Math.ceil(i / 20)}`
                    }
window.loadLargeDataset = loadLargeDataset;


// Global function: loadMassiveDataset
async function loadMassiveDataset() {
            // Generate massive dataset for virtual scrolling test
            const generateNestedData = (depth, breadth, currentDepth = 0) => {
                const obj = {
                    id: `node_${currentDepth}_${Math.random().toString(36).substr(2, 9)}`,
                    name: `Node at depth ${currentDepth}`,
                    value: Math.random() * 1000,
                    timestamp: new Date().toISOString(),
                    metadata: {
                        depth: currentDepth,
                        generated: true,
                        random: Math.random()
                    }
window.loadMassiveDataset = loadMassiveDataset;


// Global function: clearOutput
function clearOutput() {
            if (treeView) {
                treeView.selectionManager.deselectAll();
                updateOutput();
                updateMetrics();
            }
window.clearOutput = clearOutput;


// Global function: exportSelection
function exportSelection() {
            if (!treeView) {
                alert('No tree view loaded');
                return;
            }
window.exportSelection = exportSelection;


// Global function: downloadOutput
function downloadOutput() {
            if (!treeView) {
                alert('No tree view loaded');
                return;
            }
window.downloadOutput = downloadOutput;


// Global function: copyField
async function copyField(field) {
            if (!treeView) {
                showCopyFeedback('No data to copy', false);
                return;
            }
window.copyField = copyField;


// Global function: openTreeFileDialog
function openTreeFileDialog() {
            if (treeFileHandler) {
                treeFileHandler.openFileDialog();
            }
window.openTreeFileDialog = openTreeFileDialog;


// Global function: loadDocument
async function loadDocument(documentText, description) {
            try {
                // Parse document
                console.time('Document Parsing');
                currentDocument = await parser.parse(documentText);
                console.timeEnd('Document Parsing');
                
                // Extract paths
                console.time('Path Extraction');
                if (currentDocument.format === 'xml') {
                    currentPaths = pathExtractor.extractXPaths(currentDocument.data);
                }
window.loadDocument = loadDocument;


// Global function: showMessage
function showMessage(text, type) {
            // Simple alert for now - could be enhanced with toast notifications
            console.log(`${type.toUpperCase()}: ${text}`);
        }
window.showMessage = showMessage;


// Global function: initializeTreeView
function initializeTreeView() {
            const container = document.getElementById('treeViewContainer');
            
            if (treeView) {
                treeView.destroy();
            }
window.initializeTreeView = initializeTreeView;


// Global function: initializeTreeFileHandler
function initializeTreeFileHandler() {
            if (!FileHandler.isSupported()) {
                console.warn('File upload not supported in this browser');
                return;
            }
window.initializeTreeFileHandler = initializeTreeFileHandler;


// Global function: updateMetrics
function updateMetrics() {
            if (!treeView) return;
            
            const treeStats = treeView.dataTransformer.getStats();
            const selectionStats = treeView.selectionManager.getSelectionStats();
            
            let virtualStats = {};
            if (treeView.virtualTreeView) {
                virtualStats = treeView.virtualTreeView.getPerformanceStats();
            }
window.updateMetrics = updateMetrics;



// Original inline script

        // Global variables
        let treeView = null;
        let currentDocument = null;
        let currentPaths = null;
        let treeFileHandler = null;
        
        // Initialize components
        const parser = new DocumentParser();
        const pathExtractor = new PathExtractor({
            includeAttributes: true,
            includeTextNodes: false
        });
        
        // Initialize tree view
        
            
            treeView = new InteractiveTreeView(container, {
                itemHeight: 28,
                showSearch: true,
                showControls: true,
                showStats: true,
                enableVirtualScrolling: true,
                enableSelection: true,
                enableExpansion: true,
                enableSearch: true
            });
            
            // Set up event listeners
            container.addEventListener('selectionChange', (event) => {
                updateOutput();
                updateMetrics();
            });
            
            container.addEventListener('documentLoaded', (event) => {
                updateMetrics();
                updateOutput();
            });
            
            container.addEventListener('search', (event) => {
                updateMetrics();
            });
        }
        
        // Initialize TreeView FileHandler
        
            
            treeFileHandler = new FileHandler({
                maxFileSize: 10 * 1024 * 1024, // 10MB
                allowedTypes: ['.xml', '.json', '.txt'],
                enableHistory: false, // Disable history for tree view to avoid conflicts
                onFileLoad: async (fileData) => {
                    try {
                        showMessage(`📁 Loading file: ${fileData.metadata.name}...`, 'info');
                        
                        // Load document using the file content
                        await loadDocument(fileData.content, `File: ${fileData.metadata.name}`);
                        
                        showMessage(`✅ File loaded successfully: ${fileData.metadata.name} (${treeFileHandler.formatFileSize(fileData.metadata.size)})`, 'success');
                    } catch (error) {
                        showMessage(`❌ Error loading file: ${error.message}`, 'error');
                    }
                },
                onError: (error) => {
                    showMessage(`❌ File error: ${error.message}`, 'error');
                },
                onProgress: (percent) => {
                    if (percent < 100) {
                        showMessage(`📁 Loading file... ${percent}%`, 'info');
                    }
                }
            });
            
            // Setup drag-drop zone
            treeFileHandler.setupDragDrop(document.getElementById('treeFileDropZone'));
        }
        
        // Tree file functions
        
        }
        
        // Load and process document
         else {
                    currentPaths = pathExtractor.extractJSONPaths(currentDocument.data);
                }
                console.timeEnd('Path Extraction');
                
                // Load into tree view
                console.time('Tree View Loading');
                treeView.loadDocument(currentDocument, currentPaths);
                console.timeEnd('Tree View Loading');
                
                // Show success message
                showMessage(`✅ Loaded ${description}: ${currentPaths.length} paths detected`, 'success');
                
            } catch (error) {
                console.error('Error loading document:', error);
                showMessage(`❌ Error loading ${description}: ${error.message}`, 'error');
            }
        }
        
        // Sample data functions
        
        
        
      },
      "preferences": {
        "notifications": true,
        "currency": "USD",
        "language": "en-US",
        "paymentMethods": ["credit_card", "bank_transfer"]
      }
    },
    "items": [
      {
        "sku": "WIDGET-A",
        "name": "Premium Widget",
        "category": "widgets",
        "quantity": 5,
        "price": 29.99,
        "attributes": {
          "color": "blue",
          "size": "large",
          "warranty": "1 year",
          "material": "aluminum"
        },
        "customizations": {
          "engraving": "ACME Corp",
          "gift_wrap": false
        }
      },
      {
        "sku": "GADGET-B",
        "name": "Super Gadget",
        "category": "gadgets",
        "quantity": 2,
        "price": 149.99,
        "attributes": {
          "color": "silver",
          "model": "SG-2023",
          "warranty": "2 years"
        }
      }
    ],
    "shipping": {
      "method": "express",
      "carrier": "FedEx",
      "trackingNumber": "1234567890",
      "estimatedDelivery": "2023-01-03T18:00:00Z",
      "address": {
        "street": "123 Business Blvd",
        "city": "Commerce City",
        "state": "CA",
        "zip": "90210",
        "country": "USA",
        "instructions": "Leave at front desk"
      }
    },
    "payment": {
      "method": "credit_card",
      "cardType": "Visa",
      "last4": "1234",
      "authCode": "AUTH123",
      "transactionId": "TXN-789"
    },
    "totals": {
      "subtotal": 449.93,
      "tax": 36.00,
      "shipping": 15.00,
      "discount": 0.00,
      "total": 500.93
    },
    "metadata": {
      "source": "web_portal",
      "browser": "Chrome",
      "ip_address": "192.168.1.1",
      "user_agent": "Mozilla/5.0..."
    }
  }
}`;
            
            await loadDocument(jsonData, 'E-commerce JSON');
        }
        
        
        
        ,
                    inventory: {
                        quantity: Math.floor(Math.random() * 1000),
                        warehouse: `WH-${Math.ceil(i / 25)}`,
                        reserved: Math.floor(Math.random() * 100),
                        available: Math.floor(Math.random() * 900)
                    },
                    metadata: {
                        created: `2023-01-${(i % 30) + 1}T10:00:00Z`,
                        updated: `2023-01-${(i % 30) + 1}T15:30:00Z`,
                        version: Math.floor(Math.random() * 10) + 1,
                        tags: [`tag${i % 5}`, `feature${i % 3}`, `type${i % 7}`]
                    }
                });
            }
            
            const largeData = {
                dataset: "Large Product Catalog",
                version: "1.0",
                generatedAt: "2023-01-01T10:00:00Z",
                totalItems: items.length,
                categories: Array.from({length: 10}, (_, i) => `Category ${i + 1}`),
                items: items,
                statistics: {
                    averagePrice: items.reduce((sum, item) => sum + parseFloat(item.price), 0) / items.length,
                    totalInventory: items.reduce((sum, item) => sum + item.inventory.quantity, 0),
                    manufacturerCount: 5,
                    warehouseCount: 4
                }
            };
            
            await loadDocument(JSON.stringify(largeData, null, 2), 'Large Dataset (1000+ nodes)');
        }
        
        
                };
                
                if (currentDepth < depth) {
                    obj.children = {};
                    for (let i = 0; i < breadth; i++) {
                        obj.children[`child_${i}`] = generateNestedData(depth, breadth, currentDepth + 1);
                    }
                }
                
                return obj;
            };
            
            const massiveData = {
                description: "Massive dataset for virtual scrolling performance test",
                nodeCount: "10,000+",
                generatedAt: new Date().toISOString(),
                structure: generateNestedData(6, 8) // Will create ~40,000+ nodes
            };
            
            await loadDocument(JSON.stringify(massiveData, null, 2), 'Massive Dataset (10k+ nodes)');
        }
        
        // Initialize OutputFormatter with real-time updates
        let outputFormatter = null;
        
        // Update output with selected paths using enhanced UI
        function updateOutput() {
            if (!treeView) {
                clearOutputFields();
                return;
            }
            
            try {
                const sapOutput = treeView.getSelectedPathsForSAP();
                
                // Update individual fields
                document.getElementById('dynamicCustomHeader').value = sapOutput.DynamicCustomHeader || '';
                document.getElementById('dynamicCustomHeaderXMLNamespace').value = sapOutput.DynamicCustomHeaderXMLNamespace || '';
                
                // Update character counts
                document.getElementById('headerCharCount').textContent = (sapOutput.DynamicCustomHeader || '').length + ' chars';
                document.getElementById('namespaceCharCount').textContent = (sapOutput.DynamicCustomHeaderXMLNamespace || '').length + ' chars';
                
                // Update stats
                document.getElementById('selectedPathCount').textContent = sapOutput.selectedCount || 0;
                document.getElementById('namespaceCount').textContent = (sapOutput.DynamicCustomHeaderXMLNamespace || '').split(';').filter(s => s.includes('=')).length;
                document.getElementById('documentFormat').textContent = sapOutput.documentFormat || 'none';
                
                // Get output stats from OutputFormatter if available
                if (treeView.outputFormatter) {
                    const stats = treeView.outputFormatter.getOutputStats();
                    document.getElementById('outputValid').textContent = stats.isValid ? '✅' : '❌';
                    
                    // Show/hide validation errors
                    const errorsDiv = document.getElementById('validationErrors');
                    const errorList = document.getElementById('errorList');
                    
                    if (stats.errors && stats.errors.length > 0) {
                        errorList.innerHTML = stats.errors.map(error => `<li>${error}</li>`).join('');
                        errorsDiv.classList.remove('hidden');
                    } else {
                        errorsDiv.classList.add('hidden');
                    }
                } else {
                    document.getElementById('outputValid').textContent = '-';
                    document.getElementById('validationErrors').classList.add('hidden');
                }
                
            } catch (error) {
                console.error('Error updating output:', error);
                clearOutputFields();
                document.getElementById('outputValid').textContent = '❌';
            }
        }
        
        // Clear all output fields
        function clearOutputFields() {
            document.getElementById('dynamicCustomHeader').value = '';
            document.getElementById('dynamicCustomHeaderXMLNamespace').value = '';
            document.getElementById('headerCharCount').textContent = '0 chars';
            document.getElementById('namespaceCharCount').textContent = '0 chars';
            document.getElementById('selectedPathCount').textContent = '0';
            document.getElementById('namespaceCount').textContent = '0';
            document.getElementById('documentFormat').textContent = 'none';
            document.getElementById('outputValid').textContent = '-';
            document.getElementById('validationErrors').classList.add('hidden');
        }
        
        // Clear output
        
        }
        
        // Copy field to clipboard
        
            
            try {
                let success = false;
                
                if (treeView.outputFormatter) {
                    success = await treeView.outputFormatter.copyToClipboard(field);
                } else {
                    // Fallback for direct copy
                    let textToCopy = '';
                    switch (field) {
                        case 'header':
                            textToCopy = document.getElementById('dynamicCustomHeader').value;
                            break;
                        case 'namespace':
                            textToCopy = document.getElementById('dynamicCustomHeaderXMLNamespace').value;
                            break;
                        case 'all':
                            const headerText = document.getElementById('dynamicCustomHeader').value;
                            const namespaceText = document.getElementById('dynamicCustomHeaderXMLNamespace').value;
                            textToCopy = `DynamicCustomHeader:\n${headerText}\n\nDynamicCustomHeaderXMLNamespace:\n${namespaceText}`;
                            break;
                    }
                    
                    if (navigator.clipboard) {
                        await navigator.clipboard.writeText(textToCopy);
                        success = true;
                    }
                }
                
                showCopyFeedback(success ? 'Copied to clipboard!' : 'Copy failed', success);
                
            } catch (error) {
                console.error('Copy failed:', error);
                showCopyFeedback('Copy failed - ' + error.message, false);
            }
        }
        
        // Show copy feedback
        function showCopyFeedback(message, success = true) {
            const feedback = document.getElementById('copyFeedback');
            const feedbackText = feedback.querySelector('.feedback-text');
            
            feedbackText.textContent = message;
            feedback.className = `copy-feedback ${success ? 'success' : 'error'}`;
            
            setTimeout(() => {
                feedback.classList.add('hidden');
            }, 2000);
        }
        
        // Download output as file
        
            
            try {
                if (treeView.outputFormatter) {
                    treeView.outputFormatter.downloadAsFile('txt');
                } else {
                    // Fallback download
                    const sapOutput = treeView.getSelectedPathsForSAP();
                    const content = `SAP Cloud Integration Output
Generated: ${new Date().toLocaleString()}

DynamicCustomHeader:
${sapOutput.DynamicCustomHeader || '(no paths selected)'}

DynamicCustomHeaderXMLNamespace:
${sapOutput.DynamicCustomHeaderXMLNamespace || '(no namespaces)'}

Selection Summary:
- Selected Paths: ${sapOutput.selectedCount}
- Document Format: ${sapOutput.documentFormat || 'none'}`;
                    
                    const blob = new Blob([content], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `sap-ci-output-${Date.now()}.txt`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }
            } catch (error) {
                console.error('Download failed:', error);
                alert('Download failed: ' + error.message);
            }
        }
        
        // Update performance metrics
        
            
            const metricsText = `Tree Statistics:
Total Nodes: ${treeStats.nodeCount}
Displayed: ${treeView.filteredNodes.length}

Selection:
Selected: ${selectionStats.selectedCount}
Indeterminate: ${selectionStats.indeterminateCount}

Virtual Scrolling:
Visible Nodes: ${virtualStats.visibleNodes || 'N/A'}
Active Elements: ${virtualStats.activeElements || 'N/A'}
Render Count: ${virtualStats.renderCount || 'N/A'}
Last Render: ${virtualStats.lastRenderTime ? virtualStats.lastRenderTime.toFixed(2) + 'ms' : 'N/A'}

Memory:
Pooled Elements: ${virtualStats.pooledElements || 'N/A'}`;
            
            document.getElementById('performanceMetrics').textContent = metricsText;
        }
        
        // Export selection
        
            
            const sapOutput = treeView.getSelectedPathsForSAP();
            const exportData = {
                exportedAt: new Date().toISOString(),
                documentFormat: sapOutput.documentFormat,
                selectedPaths: sapOutput.DynamicCustomHeader.split(',').filter(p => p),
                namespaces: sapOutput.DynamicCustomHeaderXMLNamespace,
                selectionCount: sapOutput.selectedCount,
                sapFormat: {
                    DynamicCustomHeader: sapOutput.DynamicCustomHeader,
                    DynamicCustomHeaderXMLNamespace: sapOutput.DynamicCustomHeaderXMLNamespace
                }
            };
            
            // Create download
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tree-selection-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showMessage(`✅ Exported ${sapOutput.selectedCount} selected paths`, 'success');
        }
        
        // Show message
        
        
        // Initialize on page load
        document.addEventListener('DOMContentLoaded', () => {
            initializeTreeView();
            initializeTreeFileHandler();
            
            // Load sample data by default
            setTimeout(() => {
                loadSampleXML();
            }, 100);
        });
        
        // Handle window resize
        window.addEventListener('resize', () => {
            if (treeView && treeView.virtualTreeView) {
                treeView.virtualTreeView.handleResize();
            }
        });
    
