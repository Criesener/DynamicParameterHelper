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
            maxPathLength: 5000, // Increased to accommodate new format with element names
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
     * @param {Array} paths - Array of XPath/JSONPath strings or objects with path and displayName
     * @param {Object} options - Formatting options
     * @returns {string} Formatted header value
     */
    formatDynamicHeader(paths, options = {}) {
        if (!Array.isArray(paths) || paths.length === 0) {
            return '';
        }
        
        // Process paths to extract element names and format them
        const formattedEntries = paths.map(pathItem => {
            let path, elementName;
            
            // Handle both string paths and objects with metadata
            if (typeof pathItem === 'string') {
                path = pathItem;
                // Extract element name from path
                elementName = this._extractElementNameFromPath(path);
            } else if (pathItem && typeof pathItem === 'object') {
                path = pathItem.path || pathItem;
                elementName = pathItem.displayName || pathItem.elementName || this._extractElementNameFromPath(path);
            } else {
                return ''; // Skip invalid entries
            }
            
            // Skip empty paths or element names
            if (!path || !elementName || path.trim() === '' || elementName.trim() === '') {
                return '';
            }
            
            // Apply escaping if enabled
            if (this.options.escapeSpecialChars) {
                path = this._escapeSAPExpression(path);
                elementName = this._escapeSAPExpression(elementName);
            }
            
            // Format as {{ElementName}},{{Path}}
            return `{{${elementName}}},{{${path}}}`;
        }).filter(entry => entry); // Remove empty entries
        
        // Join with semicolons as separator
        return formattedEntries.join(';');
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
            escaped = escaped.replace(new RegExp(char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
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

    /**
     * Extract element name from XPath or JSONPath
     * @private
     */
    _extractElementNameFromPath(path) {
        if (!path || path.trim() === '') return '';
        
        // Handle JSONPath
        if (path.startsWith('$')) {
            const segments = path.split(/[\[\].]+/);
            const lastSegment = segments[segments.length - 1].replace(/['"]/g, '');
            return lastSegment || 'root';
        }
        
        // Handle XPath
        const segments = path.split('/').filter(s => s);
        if (segments.length === 0) return 'root';
        
        let lastSegment = segments[segments.length - 1];
        
        // Handle special cases
        if (lastSegment.startsWith('@')) {
            // Attribute - return the attribute name
            return lastSegment;
        }
        
        if (lastSegment === 'text()') {
            // Text node - use parent element name
            return segments.length > 1 ? segments[segments.length - 2].split('[')[0] + '_text' : 'text';
        }
        
        // Remove array indices and namespace prefixes
        lastSegment = lastSegment.split('[')[0];
        if (lastSegment.includes(':')) {
            lastSegment = lastSegment.split(':')[1];
        }
        
        return lastSegment;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OutputFormatter;
}