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
import { NamespaceHandler } from './NamespaceHandler.js';

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
        this.traverseJSONObject(jsonObj, '$', paths);
        
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
            return '$';
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
        if (path === '$') {
            return 'root';
        }
        
        // Extract last segment
        const segments = path.split(/[.\[\]'"]/).filter(s => s && s !== '$');
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
    module.exports = { PathExtractor, PathExtractorError };
} else if (typeof window !== 'undefined') {
    window.PathExtractor = PathExtractor;
    window.PathExtractorError = PathExtractorError;
}

// ES module export
export { PathExtractor, PathExtractorError };