/**
 * Verification script for Issue #4: XML Namespace Handler
 * Tests all acceptance criteria and edge cases to ensure complete implementation
 */

// Load required modules
if (typeof window === 'undefined') {
    // Node.js environment - load modules
    const fs = require('fs');
    const path = require('path');
    
    // Load NamespaceHandler
    const namespaceHandlerCode = fs.readFileSync(path.join(__dirname, 'src', 'NamespaceHandler.js'), 'utf8');
    eval(namespaceHandlerCode);
    
    // Load PathExtractor
    const pathExtractorCode = fs.readFileSync(path.join(__dirname, 'src', 'PathExtractor.js'), 'utf8');
    eval(pathExtractorCode);
    
    // Add DOM parser for Node.js
    const { DOMParser } = require('@xmldom/xmldom');
    global.DOMParser = DOMParser;
    global.Node = {
        ELEMENT_NODE: 1,
        ATTRIBUTE_NODE: 2,
        TEXT_NODE: 3
    };
}

console.log('🔍 VERIFYING ISSUE #4: XML NAMESPACE HANDLER IMPLEMENTATION\n');

class Issue4Verification {
    constructor() {
        this.tests = [];
        this.results = [];
        this.namespaceHandler = new NamespaceHandler();
        this.pathExtractor = new PathExtractor();
    }

    test(name, testFn) {
        this.tests.push({ name, testFn });
    }

    async runAll() {
        console.log(`🧪 Running ${this.tests.length} verification tests...\n`);
        
        for (const { name, testFn } of this.tests) {
            try {
                const startTime = Date.now();
                await testFn();
                const duration = Date.now() - startTime;
                
                this.results.push({ name, status: 'PASS', duration });
                console.log(`✅ ${name} (${duration}ms)`);
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
        
        console.log(`\n📊 ISSUE #4 VERIFICATION SUMMARY:`);
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`⏱️  Total Time: ${totalTime}ms`);
        console.log(`📈 Success Rate: ${((passed / this.tests.length) * 100).toFixed(1)}%`);
        
        if (failed === 0) {
            console.log(`\n🎉 ISSUE #4 IMPLEMENTATION VERIFIED SUCCESSFULLY!`);
            console.log(`✨ All acceptance criteria have been met.`);
            return true;
        } else {
            console.log(`\n⚠️  ISSUE #4 IMPLEMENTATION HAS FAILURES`);
            console.log(`🔧 Please fix the failing tests before closing the issue.`);
            return false;
        }
    }

    createXMLDocument(xmlString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlString, 'application/xml');
        if (typeof window !== 'undefined') {
            const parseError = doc.querySelector('parsererror');
            if (parseError) {
                throw new Error('Invalid XML: ' + parseError.textContent);
            }
        }
        return doc;
    }

    assert(condition, message) {
        if (!condition) {
            throw new Error(message || 'Assertion failed');
        }
    }

    assertEqual(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(`${message || 'Values not equal'}: expected "${expected}", got "${actual}"`);
        }
    }
}

const verification = new Issue4Verification();

// ================================
// ACCEPTANCE CRITERIA TESTS
// ================================

verification.test('AC1: NamespaceHandler class exists with all required methods', () => {
    verification.assert(typeof NamespaceHandler === 'function', 'NamespaceHandler class should exist');
    
    const handler = new NamespaceHandler();
    verification.assert(typeof handler.extractNamespaces === 'function', 'extractNamespaces method should exist');
    verification.assert(typeof handler.detectDefaultNamespace === 'function', 'detectDefaultNamespace method should exist');
    verification.assert(typeof handler.assignPrefixForDefault === 'function', 'assignPrefixForDefault method should exist');
    verification.assert(typeof handler.formatForSAP === 'function', 'formatForSAP method should exist');
    verification.assert(typeof handler.resolveNamespace === 'function', 'resolveNamespace method should exist');
});

verification.test('AC2: Extract all namespace declarations', () => {
    const xmlDoc = verification.createXMLDocument(`
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
                       xmlns:ns1="http://example.com/users"
                       xmlns="http://example.com/default">
            <soap:Body>
                <ns1:GetUser>
                    <ns1:UserId>123</ns1:UserId>
                </ns1:GetUser>
            </soap:Body>
        </soap:Envelope>
    `);
    
    const namespaces = verification.namespaceHandler.extractNamespaces(xmlDoc);
    
    verification.assert(namespaces.has('http://schemas.xmlsoap.org/soap/envelope/'), 'Should extract SOAP namespace');
    verification.assert(namespaces.has('http://example.com/users'), 'Should extract users namespace');
    verification.assert(namespaces.has('http://example.com/default'), 'Should extract default namespace');
    
    verification.assertEqual(namespaces.get('http://schemas.xmlsoap.org/soap/envelope/'), 'soap', 'SOAP namespace should have soap prefix');
    verification.assertEqual(namespaces.get('http://example.com/users'), 'ns1', 'Users namespace should have ns1 prefix');
    
    // Default namespace should be assigned a prefix
    const defaultPrefix = namespaces.get('http://example.com/default');
    verification.assert(defaultPrefix && defaultPrefix.startsWith('ns'), 'Default namespace should be assigned ns-style prefix');
});

verification.test('AC3: Detect default namespaces properly', () => {
    const xmlDoc = verification.createXMLDocument(`
        <root xmlns="http://example.com/root-default">
            <child xmlns="http://example.com/child-default">
                <grandchild>content</grandchild>
            </child>
        </root>
    `);
    
    const defaultNS = verification.namespaceHandler.detectDefaultNamespace(xmlDoc);
    verification.assertEqual(defaultNS, 'http://example.com/root-default', 'Should detect root-level default namespace');
});

verification.test('AC4: Assign prefixes for default namespaces', () => {
    const existingMap = new Map([
        ['http://example.com/existing', 'ns0']
    ]);
    
    const prefix1 = verification.namespaceHandler.assignPrefixForDefault('http://example.com/new1', existingMap);
    const prefix2 = verification.namespaceHandler.assignPrefixForDefault('http://example.com/new2', existingMap);
    
    verification.assert(prefix1.startsWith('ns'), 'Should generate ns-style prefix');
    verification.assert(prefix2.startsWith('ns'), 'Should generate ns-style prefix');
    verification.assert(prefix1 !== prefix2, 'Should generate unique prefixes');
    verification.assert(prefix1 !== 'ns0', 'Should not conflict with existing prefixes');
});

verification.test('AC5: Format for SAP CI integration', () => {
    const namespaceMap = new Map([
        ['http://schemas.xmlsoap.org/soap/envelope/', 'soap'],
        ['http://example.com/users', 'ns1'],
        ['http://example.com/orders', 'ns2']
    ]);
    
    const sapFormat = verification.namespaceHandler.formatForSAP(namespaceMap);
    
    verification.assert(sapFormat.includes('soap=http://schemas.xmlsoap.org/soap/envelope/'), 'Should include SOAP namespace');
    verification.assert(sapFormat.includes('ns1=http://example.com/users'), 'Should include users namespace');
    verification.assert(sapFormat.includes('ns2=http://example.com/orders'), 'Should include orders namespace');
    verification.assert(sapFormat.includes(';'), 'Should use semicolon separator');
    verification.assert(!sapFormat.endsWith(';'), 'Should not end with semicolon');
    
    // Verify format: "prefix1=uri1;prefix2=uri2"
    const parts = sapFormat.split(';');
    verification.assert(parts.length === 3, 'Should have 3 namespace parts');
    parts.forEach(part => {
        verification.assert(part.includes('='), 'Each part should contain = separator');
        verification.assert(!part.startsWith('='), 'Should not start with =');
        verification.assert(!part.endsWith('='), 'Should not end with =');
    });
});

verification.test('AC6: Resolve namespace for specific elements', () => {
    const xmlDoc = verification.createXMLDocument(`
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
                       xmlns="http://example.com/default">
            <soap:Body>
                <GetUser>
                    <UserId>123</UserId>
                </GetUser>
            </soap:Body>
        </soap:Envelope>
    `);
    
    const soapBody = xmlDoc.getElementsByTagName('Body')[0];
    const getUser = xmlDoc.getElementsByTagName('GetUser')[0];
    
    const soapBodyNS = verification.namespaceHandler.resolveNamespace(soapBody);
    verification.assertEqual(soapBodyNS.uri, 'http://schemas.xmlsoap.org/soap/envelope/', 'Should resolve SOAP namespace');
    verification.assertEqual(soapBodyNS.prefix, 'soap', 'Should have soap prefix');
    
    const getUserNS = verification.namespaceHandler.resolveNamespace(getUser);
    verification.assertEqual(getUserNS.uri, 'http://example.com/default', 'Should resolve default namespace');
});

// ================================
// EDGE CASE TESTS
// ================================

verification.test('EDGE: Multiple default namespaces at different levels', () => {
    const xmlDoc = verification.createXMLDocument(`
        <root xmlns="http://example.com/root">
            <level1 xmlns="http://example.com/level1">
                <level2 xmlns="http://example.com/level2">
                    <content>text</content>
                </level2>
            </level1>
        </root>
    `);
    
    const namespaces = verification.namespaceHandler.extractNamespaces(xmlDoc);
    
    verification.assert(namespaces.has('http://example.com/root'), 'Should extract root namespace');
    verification.assert(namespaces.has('http://example.com/level1'), 'Should extract level1 namespace');
    verification.assert(namespaces.has('http://example.com/level2'), 'Should extract level2 namespace');
    
    // All should have unique prefixes
    const prefixes = [
        namespaces.get('http://example.com/root'),
        namespaces.get('http://example.com/level1'),
        namespaces.get('http://example.com/level2')
    ];
    
    const uniquePrefixes = new Set(prefixes);
    verification.assertEqual(uniquePrefixes.size, 3, 'All prefixes should be unique');
});

verification.test('EDGE: Empty and invalid namespace declarations', () => {
    const xmlDoc = verification.createXMLDocument(`
        <root xmlns="" xmlns:empty="">
            <child>content</child>
        </root>
    `);
    
    const namespaces = verification.namespaceHandler.extractNamespaces(xmlDoc);
    
    // Should not include empty namespace URIs
    const emptyURIs = Array.from(namespaces.keys()).filter(uri => uri === '');
    verification.assertEqual(emptyURIs.length, 0, 'Should not include empty namespace URIs');
});

verification.test('EDGE: Special characters in namespace URIs', () => {
    const namespaceMap = new Map([
        ['http://example.com/ns;with=special&chars', 'ns1']
    ]);
    
    const sapFormat = verification.namespaceHandler.formatForSAP(namespaceMap);
    
    // Special characters should be encoded
    verification.assert(sapFormat.includes('ns1=http://example.com/ns%3Bwith%3Dspecial&chars'), 'Should encode special characters');
});

// ================================
// INTEGRATION TESTS
// ================================

verification.test('INTEGRATION: PathExtractor uses NamespaceHandler', () => {
    const xmlDoc = verification.createXMLDocument(`
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
                       xmlns="http://example.com/default">
            <soap:Body>
                <GetUser>
                    <UserId>123</UserId>
                </GetUser>
            </soap:Body>
        </soap:Envelope>
    `);
    
    // Test that PathExtractor now uses NamespaceHandler
    const paths = verification.pathExtractor.extractXPaths(xmlDoc);
    verification.assert(paths.length > 0, 'PathExtractor should extract paths');
    
    // Test SAP format generation
    const sapFormat = verification.pathExtractor.getSAPNamespaceFormat(xmlDoc);
    verification.assert(sapFormat.length > 0, 'Should generate SAP namespace format');
    verification.assert(sapFormat.includes('soap=http://schemas.xmlsoap.org/soap/envelope/'), 'SAP format should include SOAP namespace');
    
    console.log(`   📋 Generated SAP format: ${sapFormat}`);
});

verification.test('INTEGRATION: Complete SAP CI workflow', () => {
    const xmlDoc = verification.createXMLDocument(`
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
                       xmlns:auth="http://example.com/auth"
                       xmlns="http://example.com/default">
            <soap:Header>
                <auth:Authentication>
                    <auth:Token>secret</auth:Token>
                </auth:Authentication>
            </soap:Header>
            <soap:Body>
                <GetUserRequest>
                    <UserId>123</UserId>
                </GetUserRequest>
            </soap:Body>
        </soap:Envelope>
    `);
    
    // Extract paths and generate SAP CI parameters
    const paths = verification.pathExtractor.extractXPaths(xmlDoc);
    const sapNamespaces = verification.pathExtractor.getSAPNamespaceFormat(xmlDoc);
    
    verification.assert(paths.length > 0, 'Should extract XPath expressions');
    verification.assert(sapNamespaces.length > 0, 'Should generate SAP namespace format');
    
    // Verify SAP format contains all expected namespaces
    verification.assert(sapNamespaces.includes('soap=http://schemas.xmlsoap.org/soap/envelope/'), 'Should include SOAP namespace');
    verification.assert(sapNamespaces.includes('auth=http://example.com/auth'), 'Should include auth namespace');
    
    // Default namespace should be assigned a prefix
    const defaultParts = sapNamespaces.split(';').filter(part => part.includes('http://example.com/default'));
    verification.assert(defaultParts.length === 1, 'Should include default namespace with assigned prefix');
    
    console.log(`   📋 Complete SAP CI format: ${sapNamespaces}`);
    console.log(`   📈 Generated ${paths.length} XPath expressions`);
});

// ================================
// PERFORMANCE TESTS
// ================================

verification.test('PERFORMANCE: Large document with many namespaces', () => {
    // Generate large XML with many namespaces
    let xmlContent = '<root';
    for (let i = 0; i < 50; i++) {
        xmlContent += ` xmlns:ns${i}="http://example.com/ns${i}"`;
    }
    xmlContent += ' xmlns="http://example.com/default">';
    
    for (let i = 0; i < 100; i++) {
        xmlContent += `<ns${i % 10}:element${i}>content${i}</ns${i % 10}:element${i}>`;
    }
    
    xmlContent += '</root>';
    
    const xmlDoc = verification.createXMLDocument(xmlContent);
    
    const startTime = Date.now();
    const namespaces = verification.namespaceHandler.extractNamespaces(xmlDoc);
    const sapFormat = verification.namespaceHandler.formatForSAP(namespaces);
    const duration = Date.now() - startTime;
    
    verification.assert(namespaces.size >= 50, 'Should extract all namespaces');
    verification.assert(sapFormat.length > 0, 'Should generate SAP format');
    verification.assert(duration < 1000, `Should process quickly, took ${duration}ms`);
    
    console.log(`   📊 Processed ${namespaces.size} namespaces in ${duration}ms`);
});

// ================================
// RUN VERIFICATION
// ================================

console.log('🚀 Starting Issue #4 verification...\n');

verification.runAll().then(success => {
    if (success) {
        console.log('\n🎯 VERIFICATION RESULT: ISSUE #4 IS READY TO CLOSE');
        console.log('✨ All acceptance criteria have been implemented and verified.');
        console.log('🔧 The XML Namespace Handler is fully functional and integrated.');
        
        process.exit(0);
    } else {
        console.log('\n❌ VERIFICATION RESULT: ISSUE #4 NEEDS MORE WORK');
        console.log('🚧 Please fix the failing tests before closing the issue.');
        
        process.exit(1);
    }
}).catch(error => {
    console.error('\n💥 VERIFICATION FAILED WITH ERROR:', error.message);
    process.exit(1);
});