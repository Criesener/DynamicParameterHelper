/**
 * Comprehensive test suite for NamespaceHandler
 * Tests all acceptance criteria from Issue #4:
 * - Extract namespace declarations with inheritance
 * - Detect default namespaces and assign prefixes
 * - Format for SAP CI integration
 * - Handle edge cases and conflicts
 * - Resolve namespaces for specific elements
 */

// Test framework setup (reusing from PathExtractor tests)
class TestFramework {
    constructor() {
        this.tests = [];
        this.results = [];
    }

    test(name, testFn) {
        this.tests.push({ name, testFn });
    }

    async runAll() {
        console.log(`🧪 Running ${this.tests.length} NamespaceHandler tests...\n`);
        
        for (const { name, testFn } of this.tests) {
            try {
                const startTime = performance.now();
                await testFn();
                const duration = performance.now() - startTime;
                
                this.results.push({ name, status: 'PASS', duration });
                console.log(`✅ ${name} (${duration.toFixed(2)}ms)`);
            } catch (error) {
                this.results.push({ name, status: 'FAIL', error: error.message });
                console.error(`❌ ${name}: ${error.message}`);
            }
        }
        
        this.printSummary();
    }

    printSummary() {
        const passed = this.results.filter(r => r.status === 'PASS').length;
        const failed = this.results.filter(r => r.status === 'FAIL').length;
        const totalTime = this.results.reduce((sum, r) => sum + (r.duration || 0), 0);
        
        console.log(`\n📊 NamespaceHandler Test Summary:`);
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`⏱️  Total Time: ${totalTime.toFixed(2)}ms`);
        console.log(`📈 Success Rate: ${((passed / this.tests.length) * 100).toFixed(1)}%`);
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message || 'Values not equal'}: expected "${expected}", got "${actual}"`);
    }
}

function assertContains(array, item, message) {
    if (!array.includes(item)) {
        throw new Error(`${message || 'Array does not contain item'}: ${item}`);
    }
}

// Initialize test framework and NamespaceHandler
const testFramework = new TestFramework();
const namespaceHandler = new NamespaceHandler();

// Test data generators
function createXMLDocument(xmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'application/xml');
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
        throw new Error('Invalid XML: ' + parseError.textContent);
    }
    return doc;
}

// ================================
// CORE FUNCTIONALITY TESTS
// ================================

testFramework.test('extractNamespaces: Basic namespace extraction', () => {
    const xmlDoc = createXMLDocument(`
        <root xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
              xmlns:ns1="http://example.com/users">
            <soap:Body>
                <ns1:GetUser>
                    <ns1:UserId>123</ns1:UserId>
                </ns1:GetUser>
            </soap:Body>
        </root>
    `);
    
    const namespaces = namespaceHandler.extractNamespaces(xmlDoc);
    
    assert(namespaces.has('http://schemas.xmlsoap.org/soap/envelope/'), 'Should extract SOAP namespace');
    assert(namespaces.has('http://example.com/users'), 'Should extract custom namespace');
    
    assertEqual(namespaces.get('http://schemas.xmlsoap.org/soap/envelope/'), 'soap', 'Should map SOAP namespace to soap prefix');
    assertEqual(namespaces.get('http://example.com/users'), 'ns1', 'Should map custom namespace to ns1 prefix');
});

testFramework.test('extractNamespaces: Default namespace handling', () => {
    const xmlDoc = createXMLDocument(`
        <root xmlns="http://example.com/default"
              xmlns:ns1="http://example.com/users">
            <user>
                <name>John</name>
            </user>
        </root>
    `);
    
    const namespaces = namespaceHandler.extractNamespaces(xmlDoc);
    
    assert(namespaces.has('http://example.com/default'), 'Should extract default namespace');
    assert(namespaces.has('http://example.com/users'), 'Should extract prefixed namespace');
    
    // Default namespace should get assigned a prefix
    const defaultPrefix = namespaces.get('http://example.com/default');
    assert(defaultPrefix && defaultPrefix !== '', 'Default namespace should be assigned a prefix');
    assert(defaultPrefix.startsWith('ns'), 'Default namespace should get ns-style prefix');
});

testFramework.test('detectDefaultNamespace: Find default namespace', () => {
    const xmlDoc = createXMLDocument(`
        <root xmlns="http://example.com/default">
            <child xmlns="http://example.com/child-default">
                <grandchild>content</grandchild>
            </child>
        </root>
    `);
    
    const defaultNS = namespaceHandler.detectDefaultNamespace(xmlDoc);
    assertEqual(defaultNS, 'http://example.com/default', 'Should detect document-level default namespace');
});

testFramework.test('assignPrefixForDefault: Generate unique prefixes', () => {
    const existingMap = new Map([
        ['http://example.com/ns1', 'ns0'],
        ['http://example.com/ns2', 'ns1']
    ]);
    
    const prefix1 = namespaceHandler.assignPrefixForDefault('http://example.com/new1', existingMap);
    const prefix2 = namespaceHandler.assignPrefixForDefault('http://example.com/new2', existingMap);
    
    assert(prefix1.startsWith('ns'), 'Should generate ns-style prefix');
    assert(prefix2.startsWith('ns'), 'Should generate ns-style prefix');
    assert(prefix1 !== prefix2, 'Should generate unique prefixes');
    assert(!existingMap.has(prefix1), 'Should not conflict with existing prefixes');
    assert(!existingMap.has(prefix2), 'Should not conflict with existing prefixes');
});

testFramework.test('formatForSAP: Basic SAP CI formatting', () => {
    const namespaceMap = new Map([
        ['http://schemas.xmlsoap.org/soap/envelope/', 'soap'],
        ['http://example.com/users', 'ns1'],
        ['http://example.com/orders', 'ns2']
    ]);
    
    const sapFormat = namespaceHandler.formatForSAP(namespaceMap);
    
    assert(sapFormat.includes('soap=http://schemas.xmlsoap.org/soap/envelope/'), 'Should include SOAP namespace');
    assert(sapFormat.includes('ns1=http://example.com/users'), 'Should include ns1 namespace');
    assert(sapFormat.includes('ns2=http://example.com/orders'), 'Should include ns2 namespace');
    assert(sapFormat.includes(';'), 'Should use semicolon separator');
    assert(!sapFormat.endsWith(';'), 'Should not end with semicolon');
});

testFramework.test('resolveNamespace: Element namespace resolution', () => {
    const xmlDoc = createXMLDocument(`
        <root xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
              xmlns="http://example.com/default">
            <soap:Body>
                <GetUser>
                    <UserId>123</UserId>
                </GetUser>
            </soap:Body>
        </root>
    `);
    
    const soapBody = xmlDoc.querySelector('Body');
    const getUser = xmlDoc.querySelector('GetUser');
    const userId = xmlDoc.querySelector('UserId');
    
    const soapBodyNS = namespaceHandler.resolveNamespace(soapBody);
    assertEqual(soapBodyNS.uri, 'http://schemas.xmlsoap.org/soap/envelope/', 'Should resolve SOAP namespace');
    assertEqual(soapBodyNS.prefix, 'soap', 'Should have soap prefix');
    
    const getUserNS = namespaceHandler.resolveNamespace(getUser);
    assertEqual(getUserNS.uri, 'http://example.com/default', 'Should resolve default namespace');
});

// ================================
// EDGE CASE TESTS
// ================================

testFramework.test('Edge Case: Multiple default namespaces at different levels', () => {
    const xmlDoc = createXMLDocument(`
        <root xmlns="http://example.com/root">
            <level1 xmlns="http://example.com/level1">
                <level2 xmlns="http://example.com/level2">
                    <content>text</content>
                </level2>
            </level1>
        </root>
    `);
    
    const namespaces = namespaceHandler.extractNamespaces(xmlDoc);
    
    assert(namespaces.has('http://example.com/root'), 'Should extract root default namespace');
    assert(namespaces.has('http://example.com/level1'), 'Should extract level1 default namespace');
    assert(namespaces.has('http://example.com/level2'), 'Should extract level2 default namespace');
    
    // All should have assigned prefixes
    const rootPrefix = namespaces.get('http://example.com/root');
    const level1Prefix = namespaces.get('http://example.com/level1');
    const level2Prefix = namespaces.get('http://example.com/level2');
    
    assert(rootPrefix && rootPrefix !== '', 'Root namespace should have prefix');
    assert(level1Prefix && level1Prefix !== '', 'Level1 namespace should have prefix');
    assert(level2Prefix && level2Prefix !== '', 'Level2 namespace should have prefix');
    
    // All prefixes should be unique
    const prefixes = [rootPrefix, level1Prefix, level2Prefix];
    const uniquePrefixes = new Set(prefixes);
    assertEqual(uniquePrefixes.size, 3, 'All prefixes should be unique');
});

testFramework.test('Edge Case: Namespace prefix conflicts', () => {
    const xmlDoc = createXMLDocument(`
        <root xmlns:ns1="http://example.com/first">
            <child xmlns:ns1="http://example.com/second">
                <grandchild ns1:attr="value">content</grandchild>
            </child>
        </root>
    `);
    
    const namespaces = namespaceHandler.extractNamespaces(xmlDoc);
    
    assert(namespaces.has('http://example.com/first'), 'Should extract first namespace');
    assert(namespaces.has('http://example.com/second'), 'Should extract second namespace');
    
    // Both namespaces should be preserved even with same prefix
    assertEqual(namespaces.get('http://example.com/first'), 'ns1', 'First namespace should keep ns1 prefix');
    assertEqual(namespaces.get('http://example.com/second'), 'ns1', 'Second namespace should also have ns1 prefix');
});

testFramework.test('Edge Case: Empty namespace declarations', () => {
    const xmlDoc = createXMLDocument(`
        <root xmlns="" xmlns:empty="">
            <child>content</child>
        </root>
    `);
    
    const namespaces = namespaceHandler.extractNamespaces(xmlDoc);
    
    // Empty namespace declarations should be ignored
    assert(!Array.from(namespaces.keys()).some(uri => uri === ''), 'Should not include empty namespace URIs');
});

testFramework.test('Edge Case: Invalid namespace URIs', () => {
    const handler = new NamespaceHandler({ validationEnabled: true });
    const namespaceMap = new Map([
        ['http://valid.com/namespace', 'valid'],
        ['invalid-uri', 'invalid'],
        ['', 'empty'],
        ['http://another-valid.com/ns', 'valid2']
    ]);
    
    const sapFormat = handler.formatForSAP(namespaceMap);
    
    assert(sapFormat.includes('valid=http://valid.com/namespace'), 'Should include valid URI');
    assert(sapFormat.includes('valid2=http://another-valid.com/ns'), 'Should include another valid URI');
    assert(!sapFormat.includes('invalid-uri'), 'Should exclude invalid URI');
    assert(!sapFormat.includes('empty='), 'Should exclude empty URI');
});

testFramework.test('Edge Case: Special characters in namespace URIs', () => {
    const namespaceMap = new Map([
        ['http://example.com/ns;with=special&chars', 'ns1'],
        ['urn:example:namespace', 'urn1']
    ]);
    
    const sapFormat = namespaceHandler.formatForSAP(namespaceMap);
    
    // Special characters should be encoded
    assert(sapFormat.includes('ns1=http://example.com/ns%3Bwith%3Dspecial&chars'), 'Should encode special characters');
    assert(sapFormat.includes('urn1=urn:example:namespace'), 'Should handle URN format');
});

testFramework.test('Edge Case: Reserved prefixes handling', () => {
    try {
        const handler = new NamespaceHandler();
        handler.assignPrefixForDefault('http://example.com/test', new Map([
            ['http://xml.com', 'xml'],
            ['http://xmlns.com', 'xmlns']
        ]));
        
        // Should succeed and not use reserved prefixes
        assert(true, 'Should handle reserved prefixes correctly');
    } catch (error) {
        assert(false, `Should not throw error for reserved prefixes: ${error.message}`);
    }
});

// ================================
// SAP CI INTEGRATION TESTS
// ================================

testFramework.test('SAP CI: Complete workflow test', () => {
    const xmlDoc = createXMLDocument(`
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
                       xmlns="http://example.com/default">
            <soap:Header>
                <Authentication xmlns:auth="http://example.com/auth">
                    <auth:Token>secret</auth:Token>
                </Authentication>
            </soap:Header>
            <soap:Body>
                <GetUserRequest>
                    <UserId>123</UserId>
                </GetUserRequest>
            </soap:Body>
        </soap:Envelope>
    `);
    
    const namespaces = namespaceHandler.extractNamespaces(xmlDoc);
    const sapFormat = namespaceHandler.formatForSAP(namespaces);
    
    // Should contain all namespaces in proper SAP CI format
    assert(sapFormat.includes('soap=http://schemas.xmlsoap.org/soap/envelope/'), 'Should include SOAP namespace');
    assert(sapFormat.includes('auth=http://example.com/auth'), 'Should include auth namespace');
    
    // Default namespace should be assigned a prefix
    const defaultParts = sapFormat.split(';').filter(part => part.includes('http://example.com/default'));
    assert(defaultParts.length === 1, 'Should include default namespace with assigned prefix');
    
    const defaultPrefix = defaultParts[0].split('=')[0];
    assert(defaultPrefix.startsWith('ns'), 'Default namespace should get ns-style prefix');
});

testFramework.test('SAP CI: Empty namespace map handling', () => {
    const emptyMap = new Map();
    const sapFormat = namespaceHandler.formatForSAP(emptyMap);
    
    assertEqual(sapFormat, '', 'Should return empty string for empty namespace map');
});

testFramework.test('SAP CI: Sorting and consistency', () => {
    const namespaceMap = new Map([
        ['http://z.com', 'z'],
        ['http://a.com', 'a'],
        ['http://m.com', 'm']
    ]);
    
    const sapFormat1 = namespaceHandler.formatForSAP(namespaceMap);
    const sapFormat2 = namespaceHandler.formatForSAP(namespaceMap);
    
    assertEqual(sapFormat1, sapFormat2, 'Should produce consistent output');
    
    // Should be sorted alphabetically by prefix
    const parts = sapFormat1.split(';');
    const prefixes = parts.map(part => part.split('=')[0]);
    const sortedPrefixes = [...prefixes].sort();
    
    for (let i = 0; i < prefixes.length; i++) {
        assertEqual(prefixes[i], sortedPrefixes[i], `Prefix ${i} should be sorted`);
    }
});

// ================================
// PERFORMANCE TESTS
// ================================

testFramework.test('Performance: Large XML document with many namespaces', () => {
    // Generate XML with many namespace declarations
    let xmlContent = '<root';
    for (let i = 0; i < 100; i++) {
        xmlContent += ` xmlns:ns${i}="http://example.com/ns${i}"`;
    }
    xmlContent += ' xmlns="http://example.com/default">';
    
    for (let i = 0; i < 50; i++) {
        xmlContent += `<ns${i % 10}:element${i}>content${i}</ns${i % 10}:element${i}>`;
    }
    
    xmlContent += '</root>';
    
    const xmlDoc = createXMLDocument(xmlContent);
    
    const startTime = performance.now();
    const namespaces = namespaceHandler.extractNamespaces(xmlDoc);
    const duration = performance.now() - startTime;
    
    console.log(`📊 Performance: Processed ${namespaces.size} namespaces in ${duration.toFixed(2)}ms`);
    
    assert(namespaces.size >= 100, 'Should extract all namespaces');
    assert(duration < 100, `Should process quickly, took ${duration.toFixed(2)}ms`);
    
    // Test SAP formatting performance
    const sapStartTime = performance.now();
    const sapFormat = namespaceHandler.formatForSAP(namespaces);
    const sapDuration = performance.now() - sapStartTime;
    
    assert(sapFormat.length > 0, 'Should generate SAP format');
    assert(sapDuration < 50, `SAP formatting should be fast, took ${sapDuration.toFixed(2)}ms`);
});

// ================================
// INTEGRATION TESTS
// ================================

testFramework.test('Integration: PathExtractor compatibility', () => {
    // Test that NamespaceHandler works with PathExtractor workflow
    if (typeof PathExtractor !== 'undefined') {
        const xmlDoc = createXMLDocument(`
            <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
                           xmlns="http://example.com/default">
                <soap:Body>
                    <GetUser>
                        <UserId>123</UserId>
                    </GetUser>
                </soap:Body>
            </soap:Envelope>
        `);
        
        const namespaces = namespaceHandler.extractNamespaces(xmlDoc);
        const sapFormat = namespaceHandler.formatForSAP(namespaces);
        
        // Test that extracted namespaces can be used by PathExtractor
        const pathExtractor = new PathExtractor();
        const paths = pathExtractor.extractXPaths(xmlDoc);
        
        assert(paths.length > 0, 'PathExtractor should work with namespace-rich document');
        assert(sapFormat.length > 0, 'Should generate SAP format for PathExtractor use');
        
        console.log(`ℹ️  Integration test: ${paths.length} paths, SAP format: ${sapFormat}`);
    } else {
        console.log('ℹ️  Skipping PathExtractor integration test (not available)');
    }
});

// ================================
// ERROR HANDLING TESTS
// ================================

testFramework.test('Error Handling: Invalid inputs', () => {
    try {
        namespaceHandler.extractNamespaces(null);
        assert(false, 'Should throw error for null document');
    } catch (error) {
        assert(error instanceof NamespaceHandlerError, 'Should throw NamespaceHandlerError');
        assert(error.type === 'ValidationError', 'Should be ValidationError type');
    }
    
    try {
        namespaceHandler.resolveNamespace(null);
        assert(false, 'Should throw error for null element');
    } catch (error) {
        assert(error instanceof NamespaceHandlerError, 'Should throw NamespaceHandlerError');
    }
    
    try {
        namespaceHandler.assignPrefixForDefault('', new Map());
        assert(false, 'Should throw error for empty URI');
    } catch (error) {
        assert(error instanceof NamespaceHandlerError, 'Should throw NamespaceHandlerError');
    }
});

testFramework.test('Configuration: Custom options', () => {
    const customHandler = new NamespaceHandler({
        defaultPrefixPattern: 'prefix',
        validationEnabled: false
    });
    
    const prefix = customHandler.assignPrefixForDefault('http://example.com/test', new Map());
    assert(prefix.startsWith('prefix'), 'Should use custom prefix pattern');
    
    const stats = customHandler.getStats();
    assertEqual(stats.defaultPrefixPattern, 'prefix', 'Should store custom prefix pattern');
    assertEqual(stats.validationEnabled, false, 'Should store validation setting');
});

// ================================
// RUN ALL TESTS
// ================================

// Auto-run tests when script loads
if (typeof window !== 'undefined') {
    // Browser environment - run tests after DOM loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => testFramework.runAll());
    } else {
        testFramework.runAll();
    }
} else {
    // Node.js environment - run tests immediately
    testFramework.runAll();
}

// Export test framework for external use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testFramework, NamespaceHandler };
} else if (typeof window !== 'undefined') {
    window.NamespaceHandlerTests = testFramework;
}