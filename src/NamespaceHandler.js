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
    module.exports = { NamespaceHandler, NamespaceHandlerError };
} else if (typeof window !== 'undefined') {
    window.NamespaceHandler = NamespaceHandler;
    window.NamespaceHandlerError = NamespaceHandlerError;
}

// ES module export
export { NamespaceHandler, NamespaceHandlerError };