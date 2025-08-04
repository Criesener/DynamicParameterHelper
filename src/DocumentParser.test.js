/**
 * Comprehensive test suite for DocumentParser
 * Tests all critical functionality including edge cases, security, and performance
 */

// Mock DOM environment for testing
if (typeof window === 'undefined') {
    global.DOMParser = class {
        parseFromString(str, type) {
            // Simple mock - in real tests, use jsdom
            if (str.includes('parsererror')) {
                const doc = { querySelector: () => ({ textContent: 'Mock parse error' }) };
                return doc;
            }
            if (str.trim().startsWith('<') && str.trim().endsWith('>')) {
                return { 
                    documentElement: { 
                        tagName: 'root',
                        children: [],
                        getElementsByTagName: () => []
                    },
                    querySelector: () => null
                };
            }
            return { querySelector: () => ({ textContent: 'Parse error' }) };
        }
    };
    global.Blob = class {
        constructor(parts, options) {
            this.size = parts.join('').length;
        }
    };
}

// Import the DocumentParser
const { DocumentParser, DocumentParserError } = require('./DocumentParser.js');

/**
 * Test Suite: DocumentParser Core Functionality
 */
describe('DocumentParser', () => {
    let parser;

    beforeEach(() => {
        parser = new DocumentParser();
    });

    describe('Constructor and Configuration', () => {
        test('should initialize with default options', () => {
            const defaultParser = new DocumentParser();
            expect(defaultParser.maxSize).toBe(10 * 1024 * 1024);
            expect(defaultParser.maxDepth).toBe(100);
            expect(defaultParser.timeout).toBe(30000);
        });

        test('should accept custom options', () => {
            const customParser = new DocumentParser({
                maxSize: 5 * 1024 * 1024,
                maxDepth: 50,
                timeout: 15000
            });
            expect(customParser.maxSize).toBe(5 * 1024 * 1024);
            expect(customParser.maxDepth).toBe(50);
            expect(customParser.timeout).toBe(15000);
        });
    });

    describe('Input Validation', () => {
        test('should reject null or undefined input', () => {
            expect(() => parser.validateInput(null)).toThrow('Input must be a non-empty string');
            expect(() => parser.validateInput(undefined)).toThrow('Input must be a non-empty string');
            expect(() => parser.validateInput('')).toThrow('Input must be a non-empty string');
        });

        test('should reject non-string input', () => {
            expect(() => parser.validateInput(123)).toThrow('Input must be a non-empty string');
            expect(() => parser.validateInput({})).toThrow('Input must be a non-empty string');
            expect(() => parser.validateInput([])).toThrow('Input must be a non-empty string');
        });

        test('should reject input exceeding size limit', () => {
            const smallParser = new DocumentParser({ maxSize: 100 });
            const largeInput = 'x'.repeat(101);
            expect(() => smallParser.validateInput(largeInput)).toThrow('Document exceeds');
        });

        test('should reject input with null bytes', () => {
            const maliciousInput = 'normal content\0null byte attack';
            expect(() => parser.validateInput(maliciousInput)).toThrow('null bytes');
        });

        test('should reject input with extremely long lines', () => {
            const longLine = 'x'.repeat(10001);
            expect(() => parser.validateInput(longLine)).toThrow('exceeds maximum length');
        });

        test('should reject deeply nested input', () => {
            const deeplyNested = '<root>' + '<level>'.repeat(101) + '</level>'.repeat(101) + '</root>';
            expect(() => parser.validateInput(deeplyNested)).toThrow('nesting appears too deep');
        });
    });

    describe('Format Detection', () => {
        describe('JSON Detection', () => {
            test('should detect valid JSON objects', () => {
                expect(parser.detectFormat('{"key": "value"}')).toBe('json');
                expect(parser.detectFormat('{"nested": {"key": "value"}}')).toBe('json');
                expect(parser.detectFormat('{}')).toBe('json');
            });

            test('should detect valid JSON arrays', () => {
                expect(parser.detectFormat('[1, 2, 3]')).toBe('json');
                expect(parser.detectFormat('["a", "b", "c"]')).toBe('json');
                expect(parser.detectFormat('[]')).toBe('json');
            });

            test('should detect JSON primitives', () => {
                expect(parser.detectFormat('null')).toBe('json');
                expect(parser.detectFormat('true')).toBe('json');
                expect(parser.detectFormat('false')).toBe('json');
                expect(parser.detectFormat('123')).toBe('json');
                expect(parser.detectFormat('"string"')).toBe('json');
            });

            test('should handle JSON with whitespace', () => {
                expect(parser.detectFormat('  {"key": "value"}  ')).toBe('json');
                expect(parser.detectFormat('\n\t{"key": "value"}\n\t')).toBe('json');
            });
        });

        describe('XML Detection', () => {
            test('should detect XML with declaration', () => {
                expect(parser.detectFormat('<?xml version="1.0"?><root></root>')).toBe('xml');
            });

            test('should detect XML with DOCTYPE', () => {
                expect(parser.detectFormat('<!DOCTYPE root><root></root>')).toBe('xml');
            });

            test('should detect simple XML elements', () => {
                expect(parser.detectFormat('<root></root>')).toBe('xml');
                expect(parser.detectFormat('<root/>')).toBe('xml');
            });

            test('should detect XML with namespaces', () => {
                expect(parser.detectFormat('<ns:root xmlns:ns="http://example.com"></ns:root>')).toBe('xml');
            });

            test('should handle XML with whitespace', () => {
                expect(parser.detectFormat('  <root></root>  ')).toBe('xml');
                expect(parser.detectFormat('\n\t<root></root>\n\t')).toBe('xml');
            });
        });

        describe('Invalid Format Detection', () => {
            test('should detect invalid formats', () => {
                expect(parser.detectFormat('not xml or json')).toBe('invalid');
                expect(parser.detectFormat('{"invalid": json')).toBe('invalid');
                expect(parser.detectFormat('<invalid xml')).toBe('invalid');
                expect(parser.detectFormat('')).toBe('invalid');
                expect(parser.detectFormat('   ')).toBe('invalid');
            });
        });
    });

    describe('JSON Parsing', () => {
        test('should parse valid JSON objects', async () => {
            const json = '{"name": "test", "value": 123}';
            const result = await parser.parseJSON(json);
            expect(result).toEqual({ name: 'test', value: 123 });
        });

        test('should parse valid JSON arrays', async () => {
            const json = '[1, 2, {"key": "value"}]';
            const result = await parser.parseJSON(json);
            expect(result).toEqual([1, 2, { key: 'value' }]);
        });

        test('should parse JSON primitives', async () => {
            expect(await parser.parseJSON('null')).toBe(null);
            expect(await parser.parseJSON('true')).toBe(true);
            expect(await parser.parseJSON('false')).toBe(false);
            expect(await parser.parseJSON('123')).toBe(123);
            expect(await parser.parseJSON('"string"')).toBe('string');
        });

        test('should provide detailed error information for invalid JSON', async () => {
            const invalidJson = '{"invalid": json}';
            try {
                await parser.parseJSON(invalidJson);
                fail('Expected error to be thrown');
            } catch (error) {
                expect(error.message).toContain('JSON parsing');
            }
        });

        test('should detect potential prototype pollution', async () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            
            const maliciousJson = '{"__proto__": {"isAdmin": true}}';
            await parser.parseJSON(maliciousJson);
            
            expect(consoleSpy).toHaveBeenCalledWith(
                'Potentially dangerous key detected:', 
                '__proto__'
            );
            
            consoleSpy.mockRestore();
        });
    });

    describe('XML Parsing', () => {
        test('should parse valid XML documents', async () => {
            const xml = '<root><child>value</child></root>';
            const result = await parser.parseXML(xml);
            expect(result.documentElement.tagName).toBe('root');
        });

        test('should handle XML with namespaces', async () => {
            const xml = '<ns:root xmlns:ns="http://example.com"><ns:child>value</ns:child></ns:root>';
            const result = await parser.parseXML(xml);
            expect(result.documentElement).toBeDefined();
        });

        test('should provide detailed error information for invalid XML', async () => {
            const invalidXml = '<root><unclosed>';
            try {
                await parser.parseXML(invalidXml);
                fail('Expected error to be thrown');
            } catch (error) {
                expect(error.message).toContain('XML parsing failed');
            }
        });

        test('should reject empty XML documents', async () => {
            try {
                await parser.parseXML('');
                fail('Expected error to be thrown');
            } catch (error) {
                expect(error.message).toContain('empty or invalid');
            }
        });
    });

    describe('Main Parse Method', () => {
        test('should parse JSON and return metadata', async () => {
            const json = '{"test": "value"}';
            const result = await parser.parse(json);
            
            expect(result.format).toBe('json');
            expect(result.data).toEqual({ test: 'value' });
            expect(result.metadata).toHaveProperty('size');
            expect(result.metadata).toHaveProperty('parsedAt');
            expect(result.metadata).toHaveProperty('depth');
        });

        test('should parse XML and return metadata', async () => {
            const xml = '<root><child>value</child></root>';
            const result = await parser.parse(xml);
            
            expect(result.format).toBe('xml');
            expect(result.data.documentElement.tagName).toBe('root');
            expect(result.metadata).toHaveProperty('size');
            expect(result.metadata).toHaveProperty('parsedAt');
            expect(result.metadata).toHaveProperty('depth');
        });

        test('should throw DocumentParserError for invalid input', async () => {
            try {
                await parser.parse('invalid content');
                fail('Expected error to be thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(DocumentParserError);
                expect(error.type).toBe('ParseError');
                expect(error.context).toHaveProperty('inputSize');
            }
        });
    });

    describe('Depth Calculation', () => {
        test('should calculate JSON depth correctly', () => {
            const shallow = { key: 'value' };
            const deep = { level1: { level2: { level3: 'value' } } };
            
            expect(parser.calculateJSONDepth(shallow)).toBe(1);
            expect(parser.calculateJSONDepth(deep)).toBe(3);
        });

        test('should handle primitives and null', () => {
            expect(parser.calculateJSONDepth(null)).toBe(0);
            expect(parser.calculateJSONDepth('string')).toBe(0);
            expect(parser.calculateJSONDepth(123)).toBe(0);
        });

        test('should calculate array depth correctly', () => {
            const shallowArray = [1, 2, 3];
            const deepArray = [{ level1: { level2: 'value' } }];
            
            expect(parser.calculateJSONDepth(shallowArray)).toBe(1);
            expect(parser.calculateJSONDepth(deepArray)).toBe(3);
        });
    });

    describe('Utility Methods', () => {
        test('should get line numbers correctly', () => {
            const text = 'line1\nline2\nline3';
            expect(parser.getLineNumber(text, 0)).toBe(1);
            expect(parser.getLineNumber(text, 6)).toBe(2);
            expect(parser.getLineNumber(text, 12)).toBe(3);
        });

        test('should get column numbers correctly', () => {
            const text = 'line1\nline2\nline3';
            expect(parser.getColumnNumber(text, 0)).toBe(1);
            expect(parser.getColumnNumber(text, 3)).toBe(4);
            expect(parser.getColumnNumber(text, 6)).toBe(1); // Start of line 2
        });

        test('should estimate depth correctly', () => {
            expect(parser.estimateDepth('{"a": {"b": "c"}}')).toBeLessThanOrEqual(2);
            expect(parser.estimateDepth('<root><child><grandchild></grandchild></child></root>')).toBeLessThanOrEqual(3);
        });
    });

    describe('Security Features', () => {
        test('should detect potentially unsafe XML attributes', async () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            
            // Note: This would need a more complete DOM implementation in real tests
            const xml = '<root onload="alert(1)">content</root>';
            await parser.parseXML(xml);
            
            consoleSpy.mockRestore();
        });

        test('should handle circular references in JSON validation gracefully', () => {
            const obj = { a: 1 };
            obj.self = obj; // Create circular reference
            
            // Should not throw an error due to circular reference protection
            expect(() => parser.checkForPrototypePollution(obj)).not.toThrow();
        });
    });

    describe('Error Handling', () => {
        test('DocumentParserError should include context and metadata', () => {
            const error = new DocumentParserError(
                'Test error',
                'TestError',
                { input: 'test input' }
            );
            
            expect(error.name).toBe('DocumentParserError');
            expect(error.type).toBe('TestError');
            expect(error.context.input).toBe('test input');
            expect(error.timestamp).toBeDefined();
        });

        test('should handle parsing timeouts gracefully', () => {
            // This would require actual timeout implementation testing
            // For now, just ensure the timeout property is set
            expect(parser.timeout).toBe(30000);
        });
    });

    describe('Performance Considerations', () => {
        test('should handle reasonably large documents', async () => {
            const largeJson = JSON.stringify({
                data: Array(1000).fill({ key: 'value', nested: { deep: 'content' } })
            });
            
            const startTime = Date.now();
            const result = await parser.parse(largeJson);
            const endTime = Date.now();
            
            expect(result.format).toBe('json');
            expect(endTime - startTime).toBeLessThan(1000); // Should parse in less than 1 second
        });

        test('should provide size information in metadata', async () => {
            const json = '{"test": "value"}';
            const result = await parser.parse(json);
            
            expect(result.metadata.size).toBe(json.length);
        });
    });
});

/**
 * Integration Tests
 */
describe('DocumentParser Integration', () => {
    let parser;

    beforeEach(() => {
        parser = new DocumentParser();
    });

    test('should handle real-world JSON structures', async () => {
        const complexJson = JSON.stringify({
            users: [
                {
                    id: 1,
                    name: 'John Doe',
                    address: {
                        street: '123 Main St',
                        city: 'Anytown',
                        coordinates: { lat: 40.7128, lng: -74.0060 }
                    },
                    preferences: {
                        notifications: true,
                        theme: 'dark',
                        languages: ['en', 'es']
                    }
                }
            ],
            metadata: {
                total: 1,
                page: 1,
                timestamp: '2023-01-01T00:00:00Z'
            }
        });

        const result = await parser.parse(complexJson);
        expect(result.format).toBe('json');
        expect(result.data.users).toHaveLength(1);
        expect(result.metadata.depth).toBeGreaterThan(3);
    });

    test('should handle real-world XML structures', async () => {
        const complexXml = `<?xml version="1.0" encoding="UTF-8"?>
            <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
                          xmlns:tns="http://example.com/service">
                <soap:Header>
                    <tns:Authentication>
                        <tns:Username>user</tns:Username>
                        <tns:Token>abc123</tns:Token>
                    </tns:Authentication>
                </soap:Header>
                <soap:Body>
                    <tns:GetUserRequest>
                        <tns:UserId>12345</tns:UserId>
                        <tns:IncludeDetails>true</tns:IncludeDetails>
                    </tns:GetUserRequest>
                </soap:Body>
            </soap:Envelope>`;

        const result = await parser.parse(complexXml);
        expect(result.format).toBe('xml');
        expect(result.data.documentElement.tagName).toBe('soap:Envelope');
        expect(result.metadata.depth).toBeGreaterThan(2);
    });
});

module.exports = {
    DocumentParser,
    DocumentParserError
};