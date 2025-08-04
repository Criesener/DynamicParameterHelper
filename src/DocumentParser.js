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
    module.exports = { DocumentParser, DocumentParserError };
} else if (typeof window !== 'undefined') {
    window.DocumentParser = DocumentParser;
    window.DocumentParserError = DocumentParserError;
}