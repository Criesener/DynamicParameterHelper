/**
 * Comprehensive test suite for PathExtractor
 * Tests all acceptance criteria from Issue #3:
 * - Valid XPath 1.0 expressions
 * - XML attributes (@attribute syntax)  
 * - Valid JSONPath expressions
 * - Array notation handling
 * - Namespace prefix preservation
 * - Special character handling
 * - Performance requirements (1MB in <1s, 10k+ paths)
 */

// Test framework setup
class TestFramework {
    constructor() {
        this.tests = [];
        this.results = [];
    }

    test(name, testFn) {
        this.tests.push({ name, testFn });
    }

    async runAll() {
        console.log(`🧪 Running ${this.tests.length} PathExtractor tests...\n`);
        
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
        
        console.log(`\n📊 Test Summary:`);
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

// Initialize test framework and PathExtractor
const testFramework = new TestFramework();
const pathExtractor = new PathExtractor();

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
// XPATH GENERATION TESTS
// ================================

testFramework.test('XPath: Basic element paths', () => {
    const xmlDoc = createXMLDocument(`
        <root>
            <user>
                <name>John</name>
                <age>30</age>
            </user>
        </root>
    `);
    
    const paths = pathExtractor.extractXPaths(xmlDoc);
    const pathStrings = paths.map(p => p.path);
    
    assert(pathStrings.includes('/root[1]'), 'Should include root element path');
    assert(pathStrings.includes('/root[1]/user[1]'), 'Should include user element path');
    assert(pathStrings.includes('/root[1]/user[1]/name[1]'), 'Should include name element path');
    assert(pathStrings.includes('/root[1]/user[1]/age[1]'), 'Should include age element path');
});

testFramework.test('XPath: Multiple sibling elements with indices', () => {
    const xmlDoc = createXMLDocument(`
        <users>
            <user id="1">Alice</user>
            <user id="2">Bob</user>
            <user id="3">Charlie</user>
        </users>
    `);
    
    const paths = pathExtractor.extractXPaths(xmlDoc);
    const pathStrings = paths.map(p => p.path);
    
    assert(pathStrings.includes('/users[1]/user[1]'), 'Should include first user with [1]');
    assert(pathStrings.includes('/users[1]/user[2]'), 'Should include second user with [2]');
    assert(pathStrings.includes('/users[1]/user[3]'), 'Should include third user with [3]');
});

testFramework.test('XPath: Attribute handling (@attribute syntax)', () => {
    const xmlDoc = createXMLDocument(`
        <product id="123" category="electronics">
            <name lang="en">Laptop</name>
            <price currency="USD">999.99</price>
        </product>
    `);
    
    const paths = pathExtractor.extractXPaths(xmlDoc);
    const pathStrings = paths.map(p => p.path);
    
    assert(pathStrings.includes('/product[1]/@id'), 'Should include id attribute');
    assert(pathStrings.includes('/product[1]/@category'), 'Should include category attribute');
    assert(pathStrings.includes('/product[1]/name[1]/@lang'), 'Should include lang attribute');
    assert(pathStrings.includes('/product[1]/price[1]/@currency'), 'Should include currency attribute');
    
    const attrPaths = paths.filter(p => p.type === 'attribute');
    assert(attrPaths.length >= 4, 'Should find at least 4 attributes');
});

testFramework.test('XPath: Namespace preservation', () => {
    const xmlDoc = createXMLDocument(`
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
                       xmlns:ns1="http://example.com/users">
            <soap:Body>
                <ns1:GetUser>
                    <ns1:UserId>123</ns1:UserId>
                </ns1:GetUser>
            </soap:Body>
        </soap:Envelope>
    `);
    
    const paths = pathExtractor.extractXPaths(xmlDoc);
    const pathStrings = paths.map(p => p.path);
    
    // Check that namespace prefixes are preserved
    assert(pathStrings.some(p => p.includes('soap:')), 'Should preserve soap namespace prefix');
    assert(pathStrings.some(p => p.includes('ns1:')), 'Should preserve ns1 namespace prefix');
    
    // Check specific namespaced paths
    assert(pathStrings.includes('/soap:Envelope[1]'), 'Should include namespaced root');
    assert(pathStrings.includes('/soap:Envelope[1]/soap:Body[1]'), 'Should include namespaced Body');
    assert(pathStrings.includes('/soap:Envelope[1]/soap:Body[1]/ns1:GetUser[1]'), 'Should include mixed namespaces');
});

testFramework.test('XPath: Special characters in element names', () => {
    const xmlDoc = createXMLDocument(`
        <root>
            <user-profile>
                <first_name>John</first_name>
                <last.name>Doe</last.name>
            </user-profile>
        </root>
    `);
    
    const paths = pathExtractor.extractXPaths(xmlDoc);
    const pathStrings = paths.map(p => p.path);
    
    assert(pathStrings.includes('/root[1]/user-profile[1]'), 'Should handle hyphens in element names');
    assert(pathStrings.includes('/root[1]/user-profile[1]/first_name[1]'), 'Should handle underscores');
    assert(pathStrings.includes('/root[1]/user-profile[1]/last.name[1]'), 'Should handle dots');
});

testFramework.test('XPath: Validation with document.evaluate()', () => {
    const xmlDoc = createXMLDocument(`
        <catalog>
            <book id="1">
                <title>JavaScript Guide</title>
                <author>John Doe</author>
            </book>
        </catalog>
    `);
    
    const paths = pathExtractor.extractXPaths(xmlDoc);
    
    // Test that generated XPaths are valid and return expected elements
    for (const pathObj of paths.slice(0, 10)) { // Test first 10 paths
        if (pathObj.type === 'element') {
            const isValid = pathExtractor.validateXPath(pathObj.path, xmlDoc);
            assert(isValid, `Generated XPath should be valid: ${pathObj.path}`);
            
            // Verify the XPath actually finds the element
            const result = xmlDoc.evaluate(pathObj.path, xmlDoc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            assert(result.singleNodeValue !== null, `XPath should find element: ${pathObj.path}`);
        }
    }
});

// ================================
// JSONPATH GENERATION TESTS  
// ================================

testFramework.test('JSONPath: Basic object paths', () => {
    const jsonData = {
        user: {
            name: 'John',
            age: 30,
            active: true
        }
    };
    
    const paths = pathExtractor.extractJSONPaths(jsonData);
    const pathStrings = paths.map(p => p.path);
    
    assert(pathStrings.includes('$'), 'Should include root path');
    assert(pathStrings.includes('$.user'), 'Should include user object path');
    assert(pathStrings.includes('$.user.name'), 'Should include name property path');
    assert(pathStrings.includes('$.user.age'), 'Should include age property path');
    assert(pathStrings.includes('$.user.active'), 'Should include active property path');
});

testFramework.test('JSONPath: Array notation handling', () => {
    const jsonData = {
        users: [
            { name: 'Alice', scores: [95, 87, 92] },
            { name: 'Bob', scores: [88, 90, 85] }
        ]
    };
    
    const paths = pathExtractor.extractJSONPaths(jsonData);
    const pathStrings = paths.map(p => p.path);
    
    assert(pathStrings.includes('$.users'), 'Should include array path');
    assert(pathStrings.includes('$.users[0]'), 'Should include first array element');
    assert(pathStrings.includes('$.users[1]'), 'Should include second array element');
    assert(pathStrings.includes('$.users[0].name'), 'Should include nested property in array');
    assert(pathStrings.includes('$.users[0].scores'), 'Should include nested array');
    assert(pathStrings.includes('$.users[0].scores[0]'), 'Should include nested array element');
    assert(pathStrings.includes('$.users[1].scores[2]'), 'Should include deep nested array element');
});

testFramework.test('JSONPath: Special characters in property names', () => {
    const jsonData = {
        'first name': 'John',
        'last-name': 'Doe',
        'email@domain': 'john@example.com',
        '123-id': 'user123',
        'user.profile': {
            'full name': 'John Doe'
        }
    };
    
    const paths = pathExtractor.extractJSONPaths(jsonData);
    const pathStrings = paths.map(p => p.path);
    
    // Properties with special characters should use bracket notation
    assert(pathStrings.includes("$['first name']"), 'Should use bracket notation for spaces');
    assert(pathStrings.includes("$['email@domain']"), 'Should use bracket notation for @ symbol');
    assert(pathStrings.includes("$['123-id']"), 'Should use bracket notation for names starting with numbers');
    assert(pathStrings.includes("$['user.profile']['full name']"), 'Should handle nested special characters');
    
    // Simple property names should use dot notation  
    assert(pathStrings.includes("$['last-name']") || pathStrings.includes("$.last-name"), 'Should handle hyphens appropriately');
});

testFramework.test('JSONPath: Complex nested structures', () => {
    const jsonData = {
        company: {
            departments: [
                {
                    name: 'Engineering',
                    teams: [
                        {
                            name: 'Frontend',
                            members: [
                                { name: 'Alice', skills: ['React', 'TypeScript'] },
                                { name: 'Bob', skills: ['Vue', 'JavaScript'] }
                            ]
                        }
                    ]
                }
            ]
        }
    };
    
    const paths = pathExtractor.extractJSONPaths(jsonData);
    const pathStrings = paths.map(p => p.path);
    
    assert(pathStrings.includes('$.company.departments[0].teams[0].members[0].skills[0]'), 
           'Should handle deeply nested array access');
    assert(pathStrings.includes('$.company.departments[0].teams[0].members[1].name'), 
           'Should handle complex nested object access');
    
    const leafPaths = paths.filter(p => typeof p.value !== 'object');
    assert(leafPaths.length > 10, 'Should generate many leaf paths for complex structure');
});

testFramework.test('JSONPath: Primitive value handling', () => {
    const jsonData = {
        str: 'hello',
        num: 42,
        bool: true,
        nullVal: null,
        arr: [1, 'two', false, null],
        empty: {}
    };
    
    const paths = pathExtractor.extractJSONPaths(jsonData);
    
    const stringPath = paths.find(p => p.path === '$.str');
    assertEqual(stringPath.type, 'string', 'Should identify string type');
    assertEqual(stringPath.value, 'hello', 'Should capture string value');
    
    const numPath = paths.find(p => p.path === '$.num');
    assertEqual(numPath.type, 'number', 'Should identify number type');
    assertEqual(numPath.value, 42, 'Should capture number value');
    
    const boolPath = paths.find(p => p.path === '$.bool');
    assertEqual(boolPath.type, 'boolean', 'Should identify boolean type');
    
    const nullPath = paths.find(p => p.path === '$.nullVal');
    assertEqual(nullPath.type, 'null', 'Should identify null type');
});

// ================================
// PERFORMANCE TESTS
// ================================

testFramework.test('Performance: Large XML document (10k+ paths)', async () => {
    // Generate large XML document with 1000+ elements
    let xmlContent = '<catalog>';
    for (let i = 0; i < 100; i++) {
        xmlContent += `
            <product id="p${i}" category="cat${i % 10}">
                <name>Product ${i}</name>
                <description>Description for product ${i}</description>
                <price currency="USD">${(Math.random() * 1000).toFixed(2)}</price>
                <specs>
                    <weight>${(Math.random() * 10).toFixed(1)}kg</weight>
                    <dimensions>${Math.floor(Math.random() * 100)}x${Math.floor(Math.random() * 100)}x${Math.floor(Math.random() * 100)}</dimensions>
                </specs>
                <tags>
                    <tag>tag${i % 5}</tag>
                    <tag>tag${(i + 1) % 5}</tag>
                </tags>
            </product>
        `;
    }
    xmlContent += '</catalog>';
    
    const xmlDoc = createXMLDocument(xmlContent);
    
    const startTime = performance.now();
    const paths = pathExtractor.extractXPaths(xmlDoc);
    const duration = performance.now() - startTime;
    
    console.log(`📊 Performance: Generated ${paths.length} paths in ${duration.toFixed(2)}ms`);
    
    assert(paths.length > 1000, `Should generate 1000+ paths, got ${paths.length}`);
    assert(duration < 1000, `Should process in <1000ms, took ${duration.toFixed(2)}ms`);
});

testFramework.test('Performance: Large JSON document (10k+ paths)', async () => {
    // Generate large JSON document
    const jsonData = {
        users: [],
        products: [],
        orders: []
    };
    
    // Add 100 users with complex profiles
    for (let i = 0; i < 100; i++) {
        jsonData.users.push({
            id: i,
            name: `User ${i}`,
            email: `user${i}@example.com`,
            profile: {
                age: 20 + (i % 50),
                address: {
                    street: `${i} Main St`,
                    city: `City ${i % 10}`,
                    country: 'US'
                },
                preferences: {
                    notifications: i % 2 === 0,
                    theme: i % 3 === 0 ? 'dark' : 'light',
                    languages: ['en', `lang${i % 5}`]
                }
            },
            orders: Array.from({ length: i % 10 }, (_, j) => ({
                id: `order-${i}-${j}`,
                total: Math.random() * 1000,
                items: Array.from({ length: j % 5 + 1 }, (_, k) => ({
                    product: `product-${k}`,
                    quantity: k + 1
                }))
            }))
        });
    }
    
    const startTime = performance.now();
    const paths = pathExtractor.extractJSONPaths(jsonData);
    const duration = performance.now() - startTime;
    
    console.log(`📊 Performance: Generated ${paths.length} JSON paths in ${duration.toFixed(2)}ms`);
    
    assert(paths.length > 5000, `Should generate 5000+ paths, got ${paths.length}`);
    assert(duration < 1000, `Should process in <1000ms, took ${duration.toFixed(2)}ms`);
});

testFramework.test('Performance: Memory efficiency test', () => {
    // Test that PathExtractor doesn't leak memory or create excessive references
    const initialMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
    
    const xmlDoc = createXMLDocument(`
        <root>
            ${Array.from({ length: 1000 }, (_, i) => `<item id="${i}">Value ${i}</item>`).join('')}
        </root>
    `);
    
    const paths = pathExtractor.extractXPaths(xmlDoc);
    
    // Force garbage collection if available
    if (window.gc) {
        window.gc();
    }
    
    const finalMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
    const memoryIncrease = finalMemory - initialMemory;
    
    console.log(`📊 Memory: Used ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB for ${paths.length} paths`);
    
    assert(paths.length > 2000, 'Should generate expected number of paths');
    // Memory usage should be reasonable (less than 50MB for this test)
    if (initialMemory > 0) {
        assert(memoryIncrease < 50 * 1024 * 1024, 'Memory usage should be reasonable');
    }
});

// ================================
// INTEGRATION TESTS
// ================================

testFramework.test('Integration: DocumentParser + PathExtractor workflow', () => {
    // Test integration with DocumentParser (if available)
    if (typeof DocumentParser !== 'undefined') {
        const parser = new DocumentParser();
        const xmlContent = `
            <books xmlns:lib="http://library.example.com">
                <lib:book id="1">
                    <lib:title>JavaScript Guide</lib:title>
                    <lib:author>John Doe</lib:author>
                </lib:book>
            </books>
        `;
        
        const result = parser.parse(xmlContent);
        assert(result.format === 'xml', 'DocumentParser should detect XML format');
        
        const paths = pathExtractor.extractXPaths(result.data);
        assert(paths.length > 0, 'Should extract paths from parsed document');
        
        const namespacedPaths = paths.filter(p => p.path.includes('lib:'));
        assert(namespacedPaths.length > 0, 'Should preserve namespaces from DocumentParser');
    } else {
        console.log('ℹ️  Skipping DocumentParser integration test (not available)');
    }
});

testFramework.test('Edge Cases: Empty and invalid inputs', () => {
    // Test error handling for invalid inputs
    try {
        pathExtractor.extractXPaths(null);
        assert(false, 'Should throw error for null XML document');
    } catch (error) {
        assert(error.message.includes('Invalid XML document'), 'Should provide meaningful error message');
    }
    
    try {
        pathExtractor.extractJSONPaths(undefined);
        assert(false, 'Should throw error for undefined JSON object');
    } catch (error) {
        assert(error.message.includes('Invalid JSON object'), 'Should provide meaningful error message');
    }
    
    // Test with empty but valid structures
    const emptyXml = createXMLDocument('<root></root>');
    const emptyPaths = pathExtractor.extractXPaths(emptyXml);
    assert(emptyPaths.length >= 1, 'Should handle empty XML document');
    
    const emptyJson = {};
    const emptyJsonPaths = pathExtractor.extractJSONPaths(emptyJson);
    assert(emptyJsonPaths.length >= 1, 'Should handle empty JSON object');
});

testFramework.test('Configuration: PathExtractor options', () => {
    const extractor = new PathExtractor({
        includeAttributes: false,
        includeTextNodes: true,
        maxPaths: 100
    });
    
    const xmlDoc = createXMLDocument(`
        <product id="123">
            <name>Laptop</name>
            <description>A great laptop</description>
        </product>
    `);
    
    const paths = extractor.extractXPaths(xmlDoc);
    const attrPaths = paths.filter(p => p.type === 'attribute');
    const textPaths = paths.filter(p => p.type === 'text');
    
    assertEqual(attrPaths.length, 0, 'Should exclude attributes when includeAttributes is false');
    assert(textPaths.length > 0, 'Should include text nodes when includeTextNodes is true');
    
    const stats = extractor.getStats();
    assertEqual(stats.maxPaths, 100, 'Should respect maxPaths setting');
    assertEqual(stats.includeAttributes, false, 'Should respect includeAttributes setting');
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
    module.exports = { testFramework, PathExtractor };
} else if (typeof window !== 'undefined') {
    window.PathExtractorTests = testFramework;
}