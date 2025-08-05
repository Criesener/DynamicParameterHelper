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
