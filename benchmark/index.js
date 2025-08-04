/**
 * Performance benchmarks for DynamicParameterHelper
 * Tests parsing speed, path extraction performance, and memory usage
 */

const Benchmark = require('benchmark');
const fs = require('fs');
const path = require('path');

// Import modules to test
const DocumentParser = require('../src/DocumentParser');
const PathExtractor = require('../src/PathExtractor');
const NamespaceHandler = require('../src/NamespaceHandler');
const OutputFormatter = require('../src/OutputFormatter');

// Performance test data
const createLargeXML = (elementCount = 1000) => {
    let xml = '<?xml version="1.0"?><root>';
    for (let i = 0; i < elementCount; i++) {
        xml += `<item id="${i}"><name>Item ${i}</name><value>${Math.random()}</value></item>`;
    }
    xml += '</root>';
    return xml;
};

const createLargeJSON = (itemCount = 1000) => {
    const items = [];
    for (let i = 0; i < itemCount; i++) {
        items.push({
            id: i,
            name: `Item ${i}`,
            value: Math.random(),
            metadata: {
                created: new Date().toISOString(),
                tags: [`tag${i}`, `category${i % 10}`]
            }
        });
    }
    return JSON.stringify({ items, total: itemCount });
};

const createComplexXMLWithNamespaces = (elementCount = 500) => {
    let xml = `<?xml version="1.0"?>
    <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
                   xmlns:req="http://example.com/request"
                   xmlns:auth="http://example.com/auth">
        <soap:Header>
            <auth:Authentication>
                <auth:Token>sample-token</auth:Token>
            </auth:Authentication>
        </soap:Header>
        <soap:Body>
            <req:Request>`;
    
    for (let i = 0; i < elementCount; i++) {
        xml += `<req:Item id="${i}">
                    <req:Name>Item ${i}</req:Name>
                    <req:Data>${Math.random()}</req:Data>
                </req:Item>`;
    }
    
    xml += `    </req:Request>
        </soap:Body>
    </soap:Envelope>`;
    return xml;
};

// Test data
const testData = {
    smallXML: createLargeXML(100),
    mediumXML: createLargeXML(1000),
    largeXML: createLargeXML(5000),
    smallJSON: createLargeJSON(100),
    mediumJSON: createLargeJSON(1000),
    largeJSON: createLargeJSON(5000),
    namespacedXML: createComplexXMLWithNamespaces(500)
};

// Initialize components
const parser = new DocumentParser();
const pathExtractor = new PathExtractor();
const namespaceHandler = new NamespaceHandler();
const outputFormatter = new OutputFormatter();

// Benchmark suites
const parsingBenchmark = new Benchmark.Suite('Document Parsing');
const pathExtractionBenchmark = new Benchmark.Suite('Path Extraction');
const namespaceBenchmark = new Benchmark.Suite('Namespace Handling');
const outputBenchmark = new Benchmark.Suite('Output Formatting');

// Parsing benchmarks
parsingBenchmark
    .add('Parse Small XML (100 elements)', () => {
        parser.parseXML(testData.smallXML);
    })
    .add('Parse Medium XML (1000 elements)', () => {
        parser.parseXML(testData.mediumXML);
    })
    .add('Parse Large XML (5000 elements)', () => {
        parser.parseXML(testData.largeXML);
    })
    .add('Parse Small JSON (100 items)', () => {
        parser.parseJSON(testData.smallJSON);
    })
    .add('Parse Medium JSON (1000 items)', () => {
        parser.parseJSON(testData.mediumJSON);
    })
    .add('Parse Large JSON (5000 items)', () => {
        parser.parseJSON(testData.largeJSON);
    });

// Path extraction benchmarks
pathExtractionBenchmark
    .add('Extract XPaths from Small XML', () => {
        const doc = parser.parseXML(testData.smallXML);
        pathExtractor.generateXPaths(doc);
    })
    .add('Extract XPaths from Medium XML', () => {
        const doc = parser.parseXML(testData.mediumXML);
        pathExtractor.generateXPaths(doc);
    })
    .add('Extract JSONPaths from Small JSON', () => {
        const data = JSON.parse(testData.smallJSON);
        pathExtractor.generateJSONPaths(data);
    })
    .add('Extract JSONPaths from Medium JSON', () => {
        const data = JSON.parse(testData.mediumJSON);
        pathExtractor.generateJSONPaths(data);
    });

// Namespace handling benchmarks
namespaceBenchmark
    .add('Extract Namespaces from Complex XML', () => {
        const doc = parser.parseXML(testData.namespacedXML);
        namespaceHandler.extractNamespaces(doc);
    })
    .add('Process Namespace Mappings', () => {
        const doc = parser.parseXML(testData.namespacedXML);
        const namespaces = namespaceHandler.extractNamespaces(doc);
        namespaceHandler.createNamespaceMap(namespaces);
    });

// Output formatting benchmarks
outputBenchmark
    .add('Format Small Path Set', () => {
        const paths = Array.from({ length: 10 }, (_, i) => `/root/item[${i}]/name`);
        const namespaces = new Map([['http://example.com', 'ex']]);
        outputFormatter.formatForSAP(paths, namespaces);
    })
    .add('Format Large Path Set', () => {
        const paths = Array.from({ length: 100 }, (_, i) => `/root/item[${i}]/name`);
        const namespaces = new Map([
            ['http://example.com', 'ex'],
            ['http://schemas.xmlsoap.org/soap/envelope/', 'soap'],
            ['http://example.com/auth', 'auth']
        ]);
        outputFormatter.formatForSAP(paths, namespaces);
    });

// Memory usage monitoring
const getMemoryUsage = () => {
    if (typeof process !== 'undefined' && process.memoryUsage) {
        return process.memoryUsage();
    }
    return null;
};

// Event handlers
const addEventHandlers = (suite) => {
    suite
        .on('start', () => {
            console.log(`\n🚀 Starting ${suite.name}...`);
            console.log('================================================');
        })
        .on('cycle', (event) => {
            const benchmark = event.target;
            const memBefore = getMemoryUsage();
            
            console.log(`✓ ${benchmark.name}`);
            console.log(`  ${benchmark.toString()}`);
            
            if (memBefore) {
                console.log(`  Memory: ${Math.round(memBefore.heapUsed / 1024 / 1024)} MB heap used`);
            }
            console.log('');
        })
        .on('complete', function() {
            const fastest = this.filter('fastest')[0];
            const slowest = this.filter('slowest')[0];
            
            console.log(`🏆 Fastest: ${fastest.name}`);
            console.log(`🐌 Slowest: ${slowest.name}`);
            
            if (fastest && slowest && fastest !== slowest) {
                const ratio = (fastest.hz / slowest.hz).toFixed(2);
                console.log(`📊 Performance difference: ${ratio}x faster`);
            }
            
            console.log('================================================\n');
        })
        .on('error', (event) => {
            console.error(`❌ Error in ${event.target.name}:`, event.target.error);
        });
};

// Memory stress test
const memoryStressTest = () => {
    console.log('🧠 Memory Stress Test');
    console.log('================================================');
    
    const initialMemory = getMemoryUsage();
    if (initialMemory) {
        console.log(`Initial memory: ${Math.round(initialMemory.heapUsed / 1024 / 1024)} MB`);
    }
    
    // Process increasingly large documents
    const sizes = [1000, 5000, 10000];
    sizes.forEach(size => {
        console.log(`\nProcessing ${size} elements...`);
        
        const largeXML = createLargeXML(size);
        const doc = parser.parseXML(largeXML);
        const paths = pathExtractor.generateXPaths(doc);
        const formatted = outputFormatter.formatForSAP(paths);
        
        const currentMemory = getMemoryUsage();
        if (currentMemory) {
            console.log(`Memory usage: ${Math.round(currentMemory.heapUsed / 1024 / 1024)} MB`);
            console.log(`Memory increase: ${Math.round((currentMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024)} MB`);
        }
        
        // Clear variables to allow garbage collection
        delete largeXML;
        delete doc;
        delete paths;
        delete formatted;
        
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }
    });
    
    console.log('================================================\n');
};

// Real-world scenario benchmark
const realWorldScenario = () => {
    console.log('🌍 Real-world Scenario Benchmark');
    console.log('================================================');
    
    const scenario = new Benchmark.Suite('Complete Workflow');
    
    scenario
        .add('Complete XML Workflow (Parse → Extract → Format)', () => {
            const doc = parser.parseXML(testData.mediumXML);
            const paths = pathExtractor.generateXPaths(doc);
            const formatted = outputFormatter.formatForSAP(paths);
            return formatted;
        })
        .add('Complete JSON Workflow (Parse → Extract → Format)', () => {
            const data = JSON.parse(testData.mediumJSON);
            const paths = pathExtractor.generateJSONPaths(data);
            const formatted = outputFormatter.formatForSAP(paths);
            return formatted;
        })
        .add('Complex Namespaced XML Workflow', () => {
            const doc = parser.parseXML(testData.namespacedXML);
            const namespaces = namespaceHandler.extractNamespaces(doc);
            const paths = pathExtractor.generateXPaths(doc, { preserveNamespaces: true });
            const formatted = outputFormatter.formatForSAP(paths, namespaces);
            return formatted;
        });
    
    addEventHandlers(scenario);
    scenario.run();
};

// Performance thresholds
const performanceThresholds = {
    xmlParsing: 100, // ops/sec minimum
    jsonParsing: 500, // ops/sec minimum
    pathExtraction: 50, // ops/sec minimum
    outputFormatting: 1000 // ops/sec minimum
};

const checkPerformanceThresholds = (results) => {
    console.log('📊 Performance Threshold Check');
    console.log('================================================');
    
    let allPassed = true;
    
    Object.entries(performanceThresholds).forEach(([category, threshold]) => {
        const categoryResults = results.filter(r => 
            r.name.toLowerCase().includes(category) || 
            r.name.toLowerCase().includes(category.replace(/([A-Z])/g, ' $1').toLowerCase())
        );
        
        if (categoryResults.length > 0) {
            const avgHz = categoryResults.reduce((sum, r) => sum + r.hz, 0) / categoryResults.length;
            const passed = avgHz >= threshold;
            
            console.log(`${passed ? '✅' : '❌'} ${category}: ${avgHz.toFixed(2)} ops/sec (threshold: ${threshold})`);
            
            if (!passed) allPassed = false;
        }
    });
    
    console.log(`\n${allPassed ? '🎉' : '⚠️'} Overall performance: ${allPassed ? 'PASSED' : 'NEEDS ATTENTION'}`);
    console.log('================================================\n');
    
    return allPassed;
};

// Main execution
const runBenchmarks = async () => {
    console.log('🔥 Dynamic Parameter Helper - Performance Benchmarks');
    console.log('====================================================');
    console.log(`📅 Started at: ${new Date().toISOString()}`);
    console.log(`🖥️ Node.js version: ${process.version || 'unknown'}`);
    console.log(`💾 Platform: ${process.platform || 'unknown'}\n`);
    
    const allResults = [];
    
    // Add event handlers to all suites
    [parsingBenchmark, pathExtractionBenchmark, namespaceBenchmark, outputBenchmark].forEach(suite => {
        addEventHandlers(suite);
        
        suite.on('cycle', (event) => {
            allResults.push({
                name: event.target.name,
                hz: event.target.hz,
                suite: suite.name
            });
        });
    });
    
    try {
        // Run memory stress test first
        memoryStressTest();
        
        // Run all benchmark suites
        parsingBenchmark.run();
        pathExtractionBenchmark.run();
        namespaceBenchmark.run();
        outputBenchmark.run();
        
        // Run real-world scenarios
        realWorldScenario();
        
        // Check performance thresholds
        checkPerformanceThresholds(allResults);
        
        console.log('✅ All benchmarks completed successfully!');
        
    } catch (error) {
        console.error('❌ Benchmark failed:', error);
        process.exit(1);
    }
};

// Export for programmatic use
module.exports = {
    runBenchmarks,
    testData,
    performanceThresholds
};

// Run if called directly
if (require.main === module) {
    runBenchmarks();
}