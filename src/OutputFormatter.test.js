/**
 * Comprehensive test suite for OutputFormatter class
 * Tests SAP CI output formatting, clipboard functionality, validation, and error handling
 */

const OutputFormatter = require('./OutputFormatter');

describe('OutputFormatter', () => {
    let formatter;
    
    beforeEach(() => {
        formatter = new OutputFormatter();
        // Reset clipboard mock
        if (global.navigator && global.navigator.clipboard) {
            global.navigator.clipboard.writeText.mockClear();
        }
    });

    describe('Constructor and Configuration', () => {
        test('should create formatter with default options', () => {
            const defaultFormatter = new OutputFormatter();
            expect(defaultFormatter.options.lineFormat).toBe('multiline');
            expect(defaultFormatter.options.enableRealTime).toBe(true);
            expect(defaultFormatter.options.escapeSpecialChars).toBe(true);
            expect(defaultFormatter.options.validateFormat).toBe(true);
        });

        test('should create formatter with custom options', () => {
            const customFormatter = new OutputFormatter({
                lineFormat: 'comma',
                enableRealTime: false,
                escapeSpecialChars: false,
                validateFormat: false
            });
            expect(customFormatter.options.lineFormat).toBe('comma');
            expect(customFormatter.options.enableRealTime).toBe(false);
            expect(customFormatter.options.escapeSpecialChars).toBe(false);
            expect(customFormatter.options.validateFormat).toBe(false);
        });

        test('should initialize internal state correctly', () => {
            expect(formatter.lastOutput).toBeNull();
            expect(formatter.updateCallbacks).toBeInstanceOf(Set);
            expect(formatter.updateCallbacks.size).toBe(0);
        });

        test('should set up SAP escape characters', () => {
            expect(formatter.sapEscapeChars).toEqual({
                '\\': '\\\\',
                "'": "\\'",
                '"': '\\"',
                '\n': '\\n',
                '\r': '\\r',
                '\t': '\\t'
            });
        });

        test('should configure validation rules', () => {
            expect(formatter.validationRules.maxPathLength).toBe(1000);
            expect(formatter.validationRules.maxNamespaceLength).toBe(2000);
            expect(formatter.validationRules.forbiddenChars).toBeInstanceOf(RegExp);
        });
    });

    describe('formatForSAP', () => {
        test('should format basic XPath array successfully', () => {
            const paths = ['/root/element1', '/root/element2'];
            const namespaces = new Map([['http://example.com', 'ex']]);
            
            const result = formatter.formatForSAP(paths, namespaces);
            
            expect(result).toHaveProperty('DynamicCustomHeader');
            expect(result).toHaveProperty('DynamicCustomHeaderXMLNamespace');
            expect(result).toHaveProperty('metadata');
            expect(result.DynamicCustomHeader).toBe('/root/element1\n/root/element2');
            expect(result.DynamicCustomHeaderXMLNamespace).toBe('ex=http://example.com');
            expect(result.metadata.pathCount).toBe(2);
            expect(result.metadata.namespaceCount).toBe(1);
            expect(result.metadata.valid).toBe(true);
        });

        test('should handle empty paths array', () => {
            const result = formatter.formatForSAP([]);
            
            expect(result.DynamicCustomHeader).toBe('');
            expect(result.DynamicCustomHeaderXMLNamespace).toBe('');
            expect(result.metadata.pathCount).toBe(0);
            expect(result.metadata.namespaceCount).toBe(0);
        });

        test('should throw error for invalid input type', () => {
            expect(() => formatter.formatForSAP('not-an-array')).toThrow('selectedPaths must be an array');
            expect(() => formatter.formatForSAP(null)).toThrow('selectedPaths must be an array');
            expect(() => formatter.formatForSAP(123)).toThrow('selectedPaths must be an array');
        });

        test('should handle complex JSONPath expressions', () => {
            const paths = ['$.store.book[0].title', '$.store.book[*].author'];
            const result = formatter.formatForSAP(paths);
            
            expect(result.DynamicCustomHeader).toBe('$.store.book[0].title\n$.store.book[*].author');
            expect(result.metadata.pathCount).toBe(2);
        });

        test('should store last output for future reference', () => {
            const paths = ['/test/path'];
            const result = formatter.formatForSAP(paths);
            
            expect(formatter.lastOutput).toEqual(result);
        });

        test('should include proper metadata', () => {
            const paths = ['/test/path1', '/test/path2'];
            const namespaces = new Map([
                ['http://example1.com', 'ex1'],
                ['http://example2.com', 'ex2']
            ]);
            
            const result = formatter.formatForSAP(paths, namespaces);
            
            expect(result.metadata).toEqual(
                expect.objectContaining({
                    pathCount: 2,
                    namespaceCount: 2,
                    format: 'multiline',
                    valid: true,
                    errors: []
                })
            );
            expect(result.metadata.generated).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        });
    });

    describe('formatDynamicHeader', () => {
        test('should format paths with multiline format', () => {
            const paths = ['/root/item1', '/root/item2', '/root/item3'];
            const result = formatter.formatDynamicHeader(paths);
            
            expect(result).toBe('/root/item1\n/root/item2\n/root/item3');
        });

        test('should format paths with comma format', () => {
            const paths = ['/root/item1', '/root/item2'];
            const result = formatter.formatDynamicHeader(paths, { lineFormat: 'comma' });
            
            expect(result).toBe('/root/item1,/root/item2');
        });

        test('should handle empty array', () => {
            expect(formatter.formatDynamicHeader([])).toBe('');
            expect(formatter.formatDynamicHeader(null)).toBe('');
        });

        test('should escape special characters when enabled', () => {
            const paths = ["/root/item[@attr='value\"with\\quotes']"];
            const result = formatter.formatDynamicHeader(paths);
            
            expect(result).toBe("/root/item[@attr=\\'value\\\"with\\\\quotes\\']");
        });

        test('should not escape when disabled', () => {
            const noEscapeFormatter = new OutputFormatter({ escapeSpecialChars: false });
            const paths = ["/root/item[@attr='value\"with\\quotes']"];
            const result = noEscapeFormatter.formatDynamicHeader(paths);
            
            expect(result).toBe("/root/item[@attr='value\"with\\quotes']");
        });

        test('should handle JSONPath expressions', () => {
            const paths = ['$.store.book[0].title', '$.users[?(@.age > 25)].name'];
            const result = formatter.formatDynamicHeader(paths);
            
            expect(result).toContain('$.store.book[0].title');
            expect(result).toContain('$.users[?(@.age > 25)].name');
        });
    });

    describe('formatNamespaceHeader', () => {
        test('should format single namespace', () => {
            const namespaces = new Map([['http://example.com', 'ex']]);
            const result = formatter.formatNamespaceHeader(namespaces);
            
            expect(result).toBe('ex=http://example.com');
        });

        test('should format multiple namespaces', () => {
            const namespaces = new Map([
                ['http://example1.com', 'ex1'],
                ['http://example2.com', 'ex2'],
                ['http://schemas.xmlsoap.org/soap/envelope/', 'soap']
            ]);
            const result = formatter.formatNamespaceHeader(namespaces);
            
            expect(result).toContain('ex1=http://example1.com');
            expect(result).toContain('ex2=http://example2.com');
            expect(result).toContain('soap=http://schemas.xmlsoap.org/soap/envelope/');
            // Should use semicolon separator
            expect(result.split(';')).toHaveLength(3);
        });

        test('should handle empty namespaces', () => {
            expect(formatter.formatNamespaceHeader(new Map())).toBe('');
            expect(formatter.formatNamespaceHeader(null)).toBe('');
        });

        test('should skip invalid namespace entries', () => {
            const namespaces = new Map([
                ['http://valid.com', 'valid'],
                ['', 'empty-uri'],
                ['http://empty-prefix.com', ''],
                [null, 'null-uri'],
                ['http://null-prefix.com', null]
            ]);
            const result = formatter.formatNamespaceHeader(namespaces);
            
            expect(result).toBe('valid=http://valid.com');
        });

        test('should escape special characters in URIs when enabled', () => {
            const namespaces = new Map([['http://example.com/path?query="value"', 'ex']]);
            const result = formatter.formatNamespaceHeader(namespaces);
            
            expect(result).toBe('ex=http://example.com/path?query=\\"value\\"');
        });
    });

    describe('Special Character Escaping', () => {
        test('should escape all SAP special characters', () => {
            const testString = "Test\\string'with\"quotes\nand\r\ttabs";
            const escaped = formatter._escapeSAPExpression(testString);
            
            expect(escaped).toBe("Test\\\\string\\'with\\\"quotes\\nand\\r\\ttabs");
        });

        test('should handle strings without special characters', () => {
            const normalString = "normal/xpath/expression";
            const escaped = formatter._escapeSAPExpression(normalString);
            
            expect(escaped).toBe("normal/xpath/expression");
        });

        test('should handle non-string input', () => {
            expect(formatter._escapeSAPExpression(null)).toBeNull();
            expect(formatter._escapeSAPExpression(123)).toBe(123);
            expect(formatter._escapeSAPExpression({})).toEqual({});
        });
    });

    describe('Validation', () => {
        test('should validate successful output', () => {
            const paths = ['/short/path'];
            const result = formatter.formatForSAP(paths);
            
            expect(result.metadata.valid).toBe(true);
            expect(result.metadata.errors).toEqual([]);
        });

        test('should detect header length violation', () => {
            const longPath = '/very/long/path'.repeat(100); // Create a very long path
            const paths = [longPath];
            const result = formatter.formatForSAP(paths);
            
            expect(result.metadata.valid).toBe(false);
            expect(result.metadata.errors).toContainEqual(
                expect.stringContaining('DynamicCustomHeader exceeds maximum length')
            );
        });

        test('should detect namespace length violation', () => {
            // Create a namespace that exceeds 2000 characters limit
            const longUri = 'http://very-long-namespace-uri.com/path/'.repeat(60); // ~2100 chars
            const namespaces = new Map([[longUri, 'ns']]);
            const result = formatter.formatForSAP([], namespaces);
            
            expect(result.metadata.valid).toBe(false);
            expect(result.metadata.errors).toContainEqual(
                expect.stringContaining('DynamicCustomHeaderXMLNamespace exceeds maximum length')
            );
        });

        test('should detect forbidden control characters', () => {
            const pathWithControlChars = '/root/element\x00\x08\x1F';
            const paths = [pathWithControlChars];
            const result = formatter.formatForSAP(paths);
            
            expect(result.metadata.valid).toBe(false);
            expect(result.metadata.errors).toContainEqual(
                expect.stringContaining('forbidden control characters')
            );
        });

        test('should skip validation when disabled', () => {
            const noValidationFormatter = new OutputFormatter({ validateFormat: false });
            const longPath = '/very/long/path'.repeat(100);
            const paths = [longPath];
            const result = noValidationFormatter.formatForSAP(paths);
            
            // Should default to valid since validation is disabled
            expect(result.metadata.valid).toBe(true);
            expect(result.metadata.errors).toEqual([]);
        });
    });

    describe('Clipboard Functionality', () => {
        beforeEach(() => {
            // Setup successful clipboard mock
            global.navigator.clipboard.writeText.mockResolvedValue();
        });

        test('should copy header to clipboard', async () => {
            const paths = ['/test/path1', '/test/path2'];
            const output = formatter.formatForSAP(paths);
            
            const success = await formatter.copyToClipboard('header');
            
            expect(success).toBe(true);
            expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith('/test/path1\n/test/path2');
        });

        test('should copy namespace to clipboard', async () => {
            const namespaces = new Map([['http://example.com', 'ex']]);
            const output = formatter.formatForSAP([], namespaces);
            
            const success = await formatter.copyToClipboard('namespace');
            
            expect(success).toBe(true);
            expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith('ex=http://example.com');
        });

        test('should copy complete output to clipboard', async () => {
            const paths = ['/test/path'];
            const namespaces = new Map([['http://example.com', 'ex']]);
            const output = formatter.formatForSAP(paths, namespaces);
            
            const success = await formatter.copyToClipboard('all');
            
            expect(success).toBe(true);
            expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith(
                expect.stringContaining('SAP Cloud Integration Output')
            );
            expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith(
                expect.stringContaining('/test/path')
            );
            expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith(
                expect.stringContaining('ex=http://example.com')
            );
        });

        test('should handle clipboard API failure', async () => {
            global.navigator.clipboard.writeText.mockRejectedValue(new Error('Clipboard failed'));
            
            const paths = ['/test/path'];
            formatter.formatForSAP(paths);
            
            const success = await formatter.copyToClipboard('header');
            
            expect(success).toBe(false);
        });

        test('should throw error for unavailable clipboard API', async () => {
            const noClipboardFormatter = new OutputFormatter();
            noClipboardFormatter.clipboardAPI = null;
            
            await expect(noClipboardFormatter.copyToClipboard('header')).rejects.toThrow(
                'Clipboard API not available'
            );
        });

        test('should throw error for invalid field', async () => {
            const paths = ['/test/path'];
            formatter.formatForSAP(paths);
            
            await expect(formatter.copyToClipboard('invalid')).rejects.toThrow(
                "Invalid field: invalid. Use 'header', 'namespace', or 'all'"
            );
        });

        test('should throw error when no output available', async () => {
            await expect(formatter.copyToClipboard('header')).rejects.toThrow(
                'No output data available to copy'
            );
        });
    });

    describe('Update Callbacks', () => {
        test('should register and trigger update callbacks', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            
            formatter.onUpdate(callback1);
            formatter.onUpdate(callback2);
            
            const paths = ['/test/path'];
            const result = formatter.formatForSAP(paths);
            
            expect(callback1).toHaveBeenCalledWith(result);
            expect(callback2).toHaveBeenCalledWith(result);
        });

        test('should remove update callbacks', () => {
            const callback = jest.fn();
            
            formatter.onUpdate(callback);
            formatter.offUpdate(callback);
            
            const paths = ['/test/path'];
            formatter.formatForSAP(paths);
            
            expect(callback).not.toHaveBeenCalled();
        });

        test('should not trigger callbacks when real-time disabled', () => {
            const noRealTimeFormatter = new OutputFormatter({ enableRealTime: false });
            const callback = jest.fn();
            
            noRealTimeFormatter.onUpdate(callback);
            
            const paths = ['/test/path'];
            noRealTimeFormatter.formatForSAP(paths);
            
            expect(callback).not.toHaveBeenCalled();
        });

        test('should handle callback errors gracefully', () => {
            const errorCallback = jest.fn().mockImplementation(() => {
                throw new Error('Callback error');
            });
            const normalCallback = jest.fn();
            
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            formatter.onUpdate(errorCallback);
            formatter.onUpdate(normalCallback);
            
            const paths = ['/test/path'];
            const result = formatter.formatForSAP(paths);
            
            expect(errorCallback).toHaveBeenCalled();
            expect(normalCallback).toHaveBeenCalledWith(result);
            expect(consoleSpy).toHaveBeenCalledWith(
                'Error in OutputFormatter update callback:', 
                expect.any(Error)
            );
            
            consoleSpy.mockRestore();
        });

        test('should ignore non-function callbacks', () => {
            formatter.onUpdate('not-a-function');
            formatter.onUpdate(null);
            formatter.onUpdate(123);
            
            expect(formatter.updateCallbacks.size).toBe(0);
        });
    });

    describe('Output Statistics', () => {
        test('should return no-output stats when no output exists', () => {
            const stats = formatter.getOutputStats();
            
            expect(stats).toEqual({ hasOutput: false });
        });

        test('should return comprehensive stats for existing output', () => {
            const paths = ['/path1', '/path2'];
            const namespaces = new Map([['http://example.com', 'ex']]);
            const result = formatter.formatForSAP(paths, namespaces);
            
            const stats = formatter.getOutputStats();
            
            expect(stats).toEqual({
                hasOutput: true,
                pathCount: 2,
                namespaceCount: 1,
                headerLength: '/path1\n/path2'.length,
                namespaceLength: 'ex=http://example.com'.length,
                isValid: true,
                errors: [],
                generated: result.metadata.generated
            });
        });
    });

    describe('File Download', () => {
        let mockLink;
        let mockBlob;
        let mockURL;

        beforeEach(() => {
            // Mock DOM APIs for download functionality
            mockLink = {
                href: '',
                download: '',
                click: jest.fn()
            };
            mockBlob = {};
            mockURL = {
                createObjectURL: jest.fn().mockReturnValue('blob:mock-url'),
                revokeObjectURL: jest.fn()
            };

            const mockCreateElement = jest.fn().mockReturnValue(mockLink);
            global.document = {
                createElement: mockCreateElement,
                body: {
                    appendChild: jest.fn(),
                    removeChild: jest.fn()
                }
            };
            global.Blob = jest.fn().mockReturnValue(mockBlob);
            global.URL = mockURL;
        });

        afterEach(() => {
            delete global.document;
            delete global.Blob;
            delete global.URL;
        });

        test('should download as text file', () => {
            const paths = ['/test/path'];
            formatter.formatForSAP(paths);
            
            formatter.downloadAsFile('txt', 'test-output.txt');
            
            expect(global.Blob).toHaveBeenCalledWith(
                [expect.stringContaining('SAP Cloud Integration Output')],
                { type: 'text/plain' }
            );
            expect(mockLink.click).toHaveBeenCalled();
            expect(global.URL.createObjectURL).toHaveBeenCalled();
            expect(global.URL.revokeObjectURL).toHaveBeenCalled();
        });

        test('should download as JSON file', () => {
            const paths = ['/test/path'];
            const result = formatter.formatForSAP(paths);
            
            formatter.downloadAsFile('json', 'test-output.json');
            
            expect(global.Blob).toHaveBeenCalledWith(
                [JSON.stringify(result, null, 2)],
                { type: 'application/json' }
            );
            expect(mockLink.download).toBe('test-output.json');
        });

        test('should generate default filename with timestamp', () => {
            const paths = ['/test/path'];
            formatter.formatForSAP(paths);
            
            formatter.downloadAsFile('txt');
            
            expect(mockLink.download).toMatch(/^sap-ci-output-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.txt$/);
        });

        test('should throw error for unsupported format', () => {
            const paths = ['/test/path'];
            formatter.formatForSAP(paths);
            
            expect(() => formatter.downloadAsFile('xml')).toThrow('Unsupported format: xml');
        });

        test('should throw error when no output available', () => {
            expect(() => formatter.downloadAsFile('txt')).toThrow(
                'No output data available to download'
            );
        });

        test('should throw error in non-browser environment', () => {
            delete global.document;
            
            const paths = ['/test/path'];
            formatter.formatForSAP(paths);
            
            expect(() => formatter.downloadAsFile('txt')).toThrow(
                'Download functionality requires browser environment'
            );
        });
    });

    describe('updateOutputDisplay', () => {
        test('should trigger callbacks when real-time enabled and output exists', () => {
            const callback = jest.fn();
            formatter.onUpdate(callback);
            
            const paths = ['/test/path'];
            const result = formatter.formatForSAP(paths);
            
            callback.mockClear(); // Clear the call from formatForSAP
            
            formatter.updateOutputDisplay();
            
            expect(callback).toHaveBeenCalledWith(result);
        });

        test('should not trigger callbacks when no output exists', () => {
            const callback = jest.fn();
            formatter.onUpdate(callback);
            
            formatter.updateOutputDisplay();
            
            expect(callback).not.toHaveBeenCalled();
        });

        test('should not trigger callbacks when real-time disabled', () => {
            const noRealTimeFormatter = new OutputFormatter({ enableRealTime: false });
            const callback = jest.fn();
            noRealTimeFormatter.onUpdate(callback);
            
            const paths = ['/test/path'];
            noRealTimeFormatter.formatForSAP(paths);
            noRealTimeFormatter.updateOutputDisplay();
            
            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        test('should wrap formatting errors with context', () => {
            // Force an error by mocking a method to throw
            const originalMethod = formatter.formatDynamicHeader;
            formatter.formatDynamicHeader = jest.fn().mockImplementation(() => {
                throw new Error('Mock formatting error');
            });
            
            expect(() => formatter.formatForSAP(['test'])).toThrow(
                'OutputFormatter error: Mock formatting error'
            );
            
            formatter.formatDynamicHeader = originalMethod;
        });

        test('should handle various input edge cases', () => {
            // Empty strings
            expect(formatter.formatDynamicHeader([''])).toBe('');
            
            // Mixed empty and valid paths
            const result = formatter.formatDynamicHeader(['', '/valid/path', '']);
            expect(result).toContain('/valid/path');
            
            // Special unicode characters
            const unicodePaths = ['/root/元素', '/root/элемент'];
            const unicodeResult = formatter.formatDynamicHeader(unicodePaths);
            expect(unicodeResult).toContain('元素');
            expect(unicodeResult).toContain('элемент');
        });
    });

    describe('Integration Tests', () => {
        test('should handle complete SAP CI workflow', () => {
            // Simulate complete workflow with complex data
            const xpaths = [
                '/soap:Envelope/soap:Body/req:Request/req:Data[@type="input"]',
                '/soap:Envelope/soap:Body/req:Request/req:Metadata/req:ProcessingInfo'
            ];
            
            const namespaces = new Map([
                ['http://schemas.xmlsoap.org/soap/envelope/', 'soap'],
                ['http://example.com/request', 'req']
            ]);
            
            const result = formatter.formatForSAP(xpaths, namespaces);
            
            // Verify complete structure
            expect(result.DynamicCustomHeader).toContain('/soap:Envelope/soap:Body');
            expect(result.DynamicCustomHeaderXMLNamespace).toContain('soap=');
            expect(result.DynamicCustomHeaderXMLNamespace).toContain('req=');
            expect(result.metadata.pathCount).toBe(2);
            expect(result.metadata.namespaceCount).toBe(2);
            expect(result.metadata.valid).toBe(true);
        });

        test('should maintain consistency across multiple format calls', () => {
            const paths = ['/consistent/path'];
            const namespaces = new Map([['http://consistent.com', 'cons']]);
            
            const result1 = formatter.formatForSAP(paths, namespaces);
            const result2 = formatter.formatForSAP(paths, namespaces);
            
            expect(result1.DynamicCustomHeader).toBe(result2.DynamicCustomHeader);
            expect(result1.DynamicCustomHeaderXMLNamespace).toBe(result2.DynamicCustomHeaderXMLNamespace);
            expect(result1.metadata.pathCount).toBe(result2.metadata.pathCount);
            expect(result1.metadata.namespaceCount).toBe(result2.metadata.namespaceCount);
        });

        test('should handle performance with large datasets', () => {
            // Test with moderately large dataset - use shorter paths to avoid validation errors
            const largePaths = Array.from({ length: 100 }, (_, i) => `/e${i}`);
            const largeNamespaces = new Map(
                Array.from({ length: 20 }, (_, i) => [`http://ex${i}.com`, `ns${i}`])
            );
            
            const startTime = Date.now();
            const result = formatter.formatForSAP(largePaths, largeNamespaces);
            const endTime = Date.now();
            
            // Should complete within reasonable time (less than 100ms)
            expect(endTime - startTime).toBeLessThan(100);
            expect(result.metadata.pathCount).toBe(100);
            expect(result.metadata.namespaceCount).toBe(20);
            expect(result.metadata.valid).toBe(true);
        });
    });
});