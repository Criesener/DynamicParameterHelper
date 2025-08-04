/**
 * Issue #5 Verification Script - Interactive Tree View UI
 * Tests all requirements and performance targets from the issue specification
 */

// Mock DOM environment for Node.js testing
if (typeof window === 'undefined') {
    // Basic DOM mocks for Node.js environment
    global.window = {};
    global.document = {
        createElement: () => ({ 
            style: {}, 
            classList: { add: () => {}, remove: () => {} },
            addEventListener: () => {},
            removeEventListener: () => {},
            appendChild: () => {},
            removeChild: () => {},
            querySelector: () => null,
            querySelectorAll: () => [],
            setAttribute: () => {},
            removeAttribute: () => {},
            getBoundingClientRect: () => ({ height: 600, width: 800 })
        }),
        head: { appendChild: () => {} },
        body: { appendChild: () => {}, removeChild: () => {} },
        addEventListener: () => {},
        getElementById: () => null,
        dispatchEvent: () => {}
    };
    global.Node = { ELEMENT_NODE: 1 };
    global.CustomEvent = class CustomEvent { constructor(name, data) { this.name = name; this.detail = data; } };
    global.XPathResult = { ANY_TYPE: 0 };
    global.DOMParser = class DOMParser {
        parseFromString(str) {
            return {
                documentElement: { children: [], attributes: [] },
                querySelector: () => null,
                evaluate: () => ({ result: null })
            };
        }
    };
    global.Blob = class Blob { constructor(data) { this.size = JSON.stringify(data).length; } };
    global.URL = { createObjectURL: () => 'mock-url', revokeObjectURL: () => {} };
    global.performance = { now: () => Date.now() };
}

// Load modules
const fs = require('fs');
const vm = require('vm');

function loadScript(filename) {
    const script = fs.readFileSync(filename, 'utf8');
    vm.runInThisContext(script);
}

// Load all dependencies
try {
    loadScript('./src/DocumentParser.js');
    loadScript('./src/PathExtractor.js');
    loadScript('./src/NamespaceHandler.js');
    loadScript('./src/TreeDataTransformer.js');
    loadScript('./src/VirtualizedTreeView.js');
    loadScript('./src/SelectionStateManager.js');
    loadScript('./src/InteractiveTreeView.js');
} catch (error) {
    console.error('Error loading scripts:', error.message);
    process.exit(1);
}

// Test data generators
function generateLargeXML(nodeCount = 1000) {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<root xmlns:ns1="http://example.com/ns1" xmlns:ns2="http://example.com/ns2">
    <metadata>
        <title>Large XML Test Document</title>
        <nodeCount>${nodeCount}</nodeCount>
        <generated>${new Date().toISOString()}</generated>
    </metadata>`;
    
    for (let i = 0; i < nodeCount; i++) {
        xml += `
    <ns1:item id="${i}">
        <ns1:name>Item ${i}</ns1:name>
        <ns1:value>${Math.random() * 1000}</ns1:value>
        <ns2:metadata type="test">
            <ns2:category>Category ${Math.floor(i / 100)}</ns2:category>
            <ns2:priority>${i % 5}</ns2:priority>
        </ns2:metadata>
    </ns1:item>`;
    }
    
    xml += '\n</root>';
    return xml;
}

function generateLargeJSON(nodeCount = 1000) {
    const items = [];
    
    for (let i = 0; i < nodeCount; i++) {
        items.push({
            id: i,
            name: `Item ${i}`,
            value: Math.random() * 1000,
            category: `Category ${Math.floor(i / 100)}`,
            metadata: {
                type: 'test',
                priority: i % 5,
                tags: [`tag${i % 10}`, `feature${i % 7}`],
                nested: {
                    level1: {
                        level2: {
                            deepValue: `Deep value ${i}`
                        }
                    }
                },
                array: Array.from({length: 5}, (_, j) => ({
                    index: j,
                    value: `Array item ${i}-${j}`
                }))
            }
        });
    }
    
    return {
        metadata: {
            title: 'Large JSON Test Document',
            nodeCount: items.length,
            generated: new Date().toISOString()
        },
        items: items,
        summary: {
            totalItems: items.length,
            categories: Math.ceil(items.length / 100),
            averageValue: items.reduce((sum, item) => sum + item.value, 0) / items.length
        }
    };
}

// Test suite
class Issue5TestSuite {
    constructor() {
        this.results = [];
        this.parser = new DocumentParser();
        this.pathExtractor = new PathExtractor();
        this.dataTransformer = new TreeDataTransformer();
        this.selectionManager = new SelectionStateManager();
    }
    
    async runAllTests() {
        console.log('🧪 Running Issue #5 Verification Tests\n');
        console.log('=' * 50);
        
        // Core functionality tests
        await this.testTreeDataTransformation();
        await this.testVirtualScrollingPerformance();
        await this.testSelectionManagement();
        await this.testSearchFunctionality();
        await this.testSAPIntegration();
        
        // Performance tests
        await this.testPerformanceTargets();
        await this.testMemoryUsage();
        
        // Integration tests
        await this.testFullIntegration();
        
        this.printResults();
        return this.getOverallResult();
    }
    
    async testTreeDataTransformation() {
        console.log('📊 Testing Tree Data Transformation...');
        
        try {
            // Test with XML
            const xmlData = generateLargeXML(100);
            const parsedXML = await this.parser.parse(xmlData);
            const xmlPaths = this.pathExtractor.extractXPaths(parsedXML.data);
            
            const startTime = performance.now();
            const xmlTree = this.dataTransformer.transformPathsToTree(xmlPaths, 'xml');
            const xmlTransformTime = performance.now() - startTime;
            
            this.addResult('XML Tree Transformation', xmlTransformTime < 100, {
                pathCount: xmlPaths.length,
                transformTime: xmlTransformTime,
                nodeCount: this.dataTransformer.getStats().nodeCount
            });
            
            // Test with JSON
            const jsonData = generateLargeJSON(100);
            const parsedJSON = await this.parser.parse(JSON.stringify(jsonData));
            const jsonPaths = this.pathExtractor.extractJSONPaths(parsedJSON.data);
            
            const startTime2 = performance.now();
            const jsonTree = this.dataTransformer.transformPathsToTree(jsonPaths, 'json');
            const jsonTransformTime = performance.now() - startTime2;
            
            this.addResult('JSON Tree Transformation', jsonTransformTime < 100, {
                pathCount: jsonPaths.length,
                transformTime: jsonTransformTime,
                nodeCount: this.dataTransformer.getStats().nodeCount
            });
            
            // Test flattening
            const flattened = this.dataTransformer.flattenTreeForDisplay(xmlTree);
            this.addResult('Tree Flattening', flattened.length > 0, {
                flattenedCount: flattened.length
            });
            
        } catch (error) {
            this.addResult('Tree Data Transformation', false, { error: error.message });
        }
    }
    
    async testVirtualScrollingPerformance() {
        console.log('⚡ Testing Virtual Scrolling Performance...');
        
        try {
            // Create mock container
            const mockContainer = {
                innerHTML: '',
                className: '',
                style: {},
                appendChild: () => {},
                addEventListener: () => {},
                removeEventListener: () => {},
                setAttribute: () => {},
                getBoundingClientRect: () => ({ height: 600, width: 800 }),
                dispatchEvent: () => {}
            };
            
            const virtualTreeView = new VirtualizedTreeView(mockContainer, {
                itemHeight: 28,
                overscan: 5
            });
            
            // Generate large dataset
            const largeData = generateLargeJSON(1000);
            const parsedData = await this.parser.parse(JSON.stringify(largeData));
            const paths = this.pathExtractor.extractJSONPaths(parsedData.data);
            const tree = this.dataTransformer.transformPathsToTree(paths, 'json');
            const flattened = this.dataTransformer.flattenTreeForDisplay(tree);
            
            // Test rendering performance
            const startTime = performance.now();
            virtualTreeView.setData(flattened);
            const renderTime = performance.now() - startTime;
            
            const stats = virtualTreeView.getPerformanceStats();
            
            this.addResult('Virtual Scrolling - Large Dataset', renderTime < 500, {
                nodeCount: flattened.length,
                renderTime: renderTime,
                visibleNodes: stats.visibleNodes,
                activeElements: stats.activeElements
            });
            
            // Test massive dataset (10k+ nodes)
            const massiveData = generateLargeJSON(2000); // More realistic for testing
            const parsedMassive = await this.parser.parse(JSON.stringify(massiveData));
            const massivePaths = this.pathExtractor.extractJSONPaths(parsedMassive.data);
            const massiveTree = this.dataTransformer.transformPathsToTree(massivePaths, 'json');
            const massiveFlattened = this.dataTransformer.flattenTreeForDisplay(massiveTree);
            
            const startTime2 = performance.now();
            virtualTreeView.setData(massiveFlattened);
            const massiveRenderTime = performance.now() - startTime2;
            
            this.addResult('Virtual Scrolling - Massive Dataset', massiveRenderTime < 1000, {
                nodeCount: massiveFlattened.length,
                renderTime: massiveRenderTime,
                targetPerformance: '<1000ms'
            });
            
        } catch (error) {
            this.addResult('Virtual Scrolling Performance', false, { error: error.message });
        }
    }
    
    async testSelectionManagement() {
        console.log('☑️ Testing Selection Management...');
        
        try {
            // Create test tree
            const testData = generateLargeJSON(50);
            const parsedData = await this.parser.parse(JSON.stringify(testData));
            const paths = this.pathExtractor.extractJSONPaths(parsedData.data);
            const tree = this.dataTransformer.transformPathsToTree(paths, 'json');
            
            // Setup selection manager
            this.selectionManager.setNodeLookupFunction((nodeId) => {
                return this.dataTransformer.nodeMap.get(nodeId);
            });
            
            // Test basic selection
            const nodes = Array.from(this.dataTransformer.nodeMap.values()).slice(0, 10);
            const testNode = nodes[0];
            
            this.selectionManager.setNodeSelection(testNode, true);
            const isSelected = this.selectionManager.isNodeSelected(testNode);
            
            this.addResult('Basic Selection', isSelected === true, {
                nodeId: testNode.id,
                selected: isSelected
            });
            
            // Test parent-child synchronization
            const parentNode = nodes.find(n => n.metadata.hasChildren);
            if (parentNode) {
                this.selectionManager.setNodeSelection(parentNode, true, { cascadeToChildren: true });
                const childSelected = Array.from(parentNode.children.values())
                    .some(child => this.selectionManager.isNodeSelected(child));
                
                this.addResult('Parent-Child Sync', childSelected === true, {
                    parentId: parentNode.id,
                    childrenCount: parentNode.children.size
                });
            }
            
            // Test batch operations
            const startTime = performance.now();
            this.selectionManager.selectAll(tree);
            const batchTime = performance.now() - startTime;
            
            const selectedCount = this.selectionManager.getSelectionStats().selectedCount;
            
            this.addResult('Batch Selection', batchTime < 50 && selectedCount > 0, {
                selectionTime: batchTime,
                selectedCount: selectedCount,
                totalNodes: this.dataTransformer.getStats().nodeCount
            });
            
        } catch (error) {
            this.addResult('Selection Management', false, { error: error.message });
        }
    }
    
    async testSearchFunctionality() {
        console.log('🔍 Testing Search Functionality...');
        
        try {
            // Create searchable test data
            const testData = {
                users: [
                    { name: 'John Doe', email: 'john@example.com' },
                    { name: 'Jane Smith', email: 'jane@example.com' },
                    { name: 'Bob Johnson', email: 'bob@example.com' }
                ],
                products: [
                    { name: 'Widget Alpha', category: 'widgets' },
                    { name: 'Gadget Beta', category: 'gadgets' }
                ]
            };
            
            const parsedData = await this.parser.parse(JSON.stringify(testData));
            const paths = this.pathExtractor.extractJSONPaths(parsedData.data);
            const tree = this.dataTransformer.transformPathsToTree(paths, 'json');
            const flattened = this.dataTransformer.flattenTreeForDisplay(tree);
            
            // Test search matching
            const johnNodes = flattened.filter(node => node.matchesSearch('john'));
            const widgetNodes = flattened.filter(node => node.matchesSearch('widget'));
            
            this.addResult('Search - Name Match', johnNodes.length > 0, {
                searchTerm: 'john',
                matchCount: johnNodes.length
            });
            
            this.addResult('Search - Product Match', widgetNodes.length > 0, {
                searchTerm: 'widget',
                matchCount: widgetNodes.length
            });
            
            // Test case insensitive search
            const caseInsensitiveNodes = flattened.filter(node => node.matchesSearch('JOHN'));
            
            this.addResult('Search - Case Insensitive', caseInsensitiveNodes.length > 0, {
                searchTerm: 'JOHN',
                matchCount: caseInsensitiveNodes.length
            });
            
        } catch (error) {
            this.addResult('Search Functionality', false, { error: error.message });
        }
    }
    
    async testSAPIntegration() {
        console.log('🔧 Testing SAP CI Integration...');
        
        try {
            // Test XML with namespaces
            const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://example.com/service">
    <soap:Header>
        <tns:Authentication>
            <tns:Username>admin</tns:Username>
        </tns:Authentication>
    </soap:Header>
    <soap:Body>
        <tns:Request>
            <tns:Data>test</tns:Data>
        </tns:Request>
    </soap:Body>
</soap:Envelope>`;
            
            const parsedXML = await this.parser.parse(xmlData);
            const xmlPaths = this.pathExtractor.extractXPaths(parsedXML.data);
            const xmlTree = this.dataTransformer.transformPathsToTree(xmlPaths, 'xml');
            
            // Mock InteractiveTreeView behavior for SAP output
            const selectedNodes = Array.from(this.dataTransformer.nodeMap.values()).slice(0, 3);
            this.selectionManager.clear();
            selectedNodes.forEach(node => {
                this.selectionManager.setNodeSelection(node, true, { updateParentChain: false });
            });
            
            const selectedPaths = this.selectionManager.getSelectedPaths();
            const dynamicHeader = selectedPaths.join(',');
            
            this.addResult('SAP CI - Path Format', dynamicHeader.length > 0, {
                selectedPaths: selectedPaths.length,
                dynamicHeader: dynamicHeader.substring(0, 100) + '...'
            });
            
            // Test namespace handling
            const namespaceHandler = new NamespaceHandler();
            const namespaces = namespaceHandler.extractNamespaces(parsedXML.data);
            const sapNamespaceFormat = namespaceHandler.formatForSAP(namespaces);
            
            this.addResult('SAP CI - Namespace Format', sapNamespaceFormat.includes('='), {
                namespaceCount: namespaces.size,
                sapFormat: sapNamespaceFormat
            });
            
        } catch (error) {
            this.addResult('SAP Integration', false, { error: error.message });
        }
    }
    
    async testPerformanceTargets() {
        console.log('🎯 Testing Performance Targets...');
        
        try {
            // Test large dataset processing
            const largeData = generateLargeJSON(1000);
            
            // Parse performance
            const parseStart = performance.now();
            const parsedData = await this.parser.parse(JSON.stringify(largeData));
            const parseTime = performance.now() - parseStart;
            
            this.addResult('Parse Performance - Large Dataset', parseTime < 2000, {
                dataSize: JSON.stringify(largeData).length,
                parseTime: parseTime,
                target: '<2000ms'
            });
            
            // Path extraction performance
            const extractStart = performance.now();
            const paths = this.pathExtractor.extractJSONPaths(parsedData.data);
            const extractTime = performance.now() - extractStart;
            
            this.addResult('Path Extraction Performance', extractTime < 1000, {
                pathCount: paths.length,
                extractTime: extractTime,
                target: '<1000ms'
            });
            
            // Tree transformation performance
            const transformStart = performance.now();
            const tree = this.dataTransformer.transformPathsToTree(paths, 'json');
            const transformTime = performance.now() - transformStart;
            
            this.addResult('Tree Transform Performance', transformTime < 500, {
                nodeCount: this.dataTransformer.getStats().nodeCount,
                transformTime: transformTime,
                target: '<500ms'
            });
            
        } catch (error) {
            this.addResult('Performance Targets', false, { error: error.message });
        }
    }
    
    async testMemoryUsage() {
        console.log('💾 Testing Memory Usage...');
        
        try {
            // Test with large dataset
            const initialMemory = process.memoryUsage().heapUsed;
            
            const largeData = generateLargeJSON(1000);
            const parsedData = await this.parser.parse(JSON.stringify(largeData));
            const paths = this.pathExtractor.extractJSONPaths(parsedData.data);
            const tree = this.dataTransformer.transformPathsToTree(paths, 'json');
            
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = (finalMemory - initialMemory) / (1024 * 1024); // MB
            
            this.addResult('Memory Usage - Large Dataset', memoryIncrease < 50, {
                nodeCount: this.dataTransformer.getStats().nodeCount,
                memoryIncrease: `${memoryIncrease.toFixed(2)} MB`,
                target: '<50 MB'
            });
            
            // Test cleanup
            this.dataTransformer.reset();
            this.selectionManager.clear();
            
            global.gc && global.gc(); // Force garbage collection if available
            
            const cleanupMemory = process.memoryUsage().heapUsed;
            const memoryRecovered = (finalMemory - cleanupMemory) / (1024 * 1024); // MB
            
            this.addResult('Memory Cleanup', memoryRecovered > 0, {
                memoryRecovered: `${memoryRecovered.toFixed(2)} MB`,
                finalMemory: `${(cleanupMemory / (1024 * 1024)).toFixed(2)} MB`
            });
            
        } catch (error) {
            this.addResult('Memory Usage', false, { error: error.message });
        }
    }
    
    async testFullIntegration() {
        console.log('🔗 Testing Full Integration...');
        
        try {
            // Test complete workflow
            const testData = generateLargeJSON(100);
            
            // Full workflow timing
            const workflowStart = performance.now();
            
            const parsedData = await this.parser.parse(JSON.stringify(testData));
            const paths = this.pathExtractor.extractJSONPaths(parsedData.data);
            const tree = this.dataTransformer.transformPathsToTree(paths, 'json');
            const flattened = this.dataTransformer.flattenTreeForDisplay(tree);
            
            // Select some nodes
            const nodesToSelect = Array.from(this.dataTransformer.nodeMap.values()).slice(0, 10);
            this.selectionManager.clear();
            nodesToSelect.forEach(node => {
                this.selectionManager.setNodeSelection(node, true, { updateParentChain: false });
            });
            
            const selectedPaths = this.selectionManager.getSelectedPaths();
            const workflowTime = performance.now() - workflowStart;
            
            this.addResult('Full Integration Workflow', workflowTime < 1000 && selectedPaths.length > 0, {
                totalTime: workflowTime,
                pathCount: paths.length,
                nodeCount: this.dataTransformer.getStats().nodeCount,
                selectedCount: selectedPaths.length,
                target: '<1000ms total'
            });
            
            // Test error handling
            try {
                this.dataTransformer.transformPathsToTree(null, 'json');
                this.addResult('Error Handling', false, { reason: 'Should have thrown error for null paths' });
            } catch (error) {
                this.addResult('Error Handling', error.name === 'TreeDataTransformerError', {
                    errorType: error.name,
                    errorMessage: error.message
                });
            }
            
        } catch (error) {
            this.addResult('Full Integration', false, { error: error.message });
        }
    }
    
    addResult(testName, passed, details = {}) {
        this.results.push({
            testName,
            passed,
            details,
            timestamp: new Date().toISOString()
        });
        
        const status = passed ? '✅ PASS' : '❌ FAIL';
        console.log(`   ${status} - ${testName}`);
        
        if (Object.keys(details).length > 0) {
            console.log(`      Details: ${JSON.stringify(details, null, 2).replace(/\n/g, '\n      ')}`);
        }
    }
    
    printResults() {
        console.log('\n' + '='.repeat(50));
        console.log('📋 TEST RESULTS SUMMARY');
        console.log('='.repeat(50));
        
        const passed = this.results.filter(r => r.passed).length;
        const total = this.results.length;
        const percentage = ((passed / total) * 100).toFixed(1);
        
        console.log(`Total Tests: ${total}`);
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${total - passed}`);
        console.log(`Success Rate: ${percentage}%`);
        
        if (passed === total) {
            console.log('\n🎉 ALL TESTS PASSED! Issue #5 implementation is complete and verified.');
        } else {
            console.log('\n⚠️  Some tests failed. Review the details above.');
            
            console.log('\nFailed Tests:');
            this.results.filter(r => !r.passed).forEach(result => {
                console.log(`- ${result.testName}: ${result.details.error || 'See details above'}`);
            });
        }
        
        console.log('\n📊 Performance Summary:');
        const performanceTests = this.results.filter(r => 
            r.testName.includes('Performance') || 
            r.testName.includes('Virtual Scrolling') ||
            r.testName.includes('Memory')
        );
        
        performanceTests.forEach(test => {
            const status = test.passed ? '✅' : '❌';
            console.log(`${status} ${test.testName}`);
            if (test.details.renderTime) {
                console.log(`   Render Time: ${test.details.renderTime.toFixed(2)}ms`);
            }
            if (test.details.nodeCount) {
                console.log(`   Node Count: ${test.details.nodeCount}`);
            }
        });
    }
    
    getOverallResult() {
        const passed = this.results.filter(r => r.passed).length;
        const total = this.results.length;
        
        return {
            success: passed === total,
            passedTests: passed,
            totalTests: total,
            successRate: ((passed / total) * 100).toFixed(1),
            results: this.results
        };
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const testSuite = new Issue5TestSuite();
    
    testSuite.runAllTests()
        .then(result => {
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error('❌ Test suite failed:', error);
            process.exit(1);
        });
}

module.exports = { Issue5TestSuite };