#!/usr/bin/env node

/**
 * Bundle Analysis Script
 * Analyzes the built bundles and provides detailed size information
 */

const fs = require('fs');
const path = require('path');

const BYTES_PER_KB = 1024;
const MAX_SIZE_BYTES = 500 * BYTES_PER_KB; // 500KB limit

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function analyzeBuild(buildPath, buildName) {
    console.log(`\n📊 ${buildName} Build Analysis`);
    console.log('='.repeat(40));
    
    if (!fs.existsSync(buildPath)) {
        console.log(`❌ Build directory not found: ${buildPath}`);
        return null;
    }
    
    const files = fs.readdirSync(buildPath);
    let totalSize = 0;
    const analysis = {
        name: buildName,
        path: buildPath,
        files: [],
        totalSize: 0,
        withinLimit: false
    };
    
    files.forEach(file => {
        const filePath = path.join(buildPath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile()) {
            const size = stats.size;
            totalSize += size;
            
            const fileInfo = {
                name: file,
                size: size,
                formattedSize: formatBytes(size),
                percentage: 0 // Will calculate after total
            };
            
            analysis.files.push(fileInfo);
            
            console.log(`📄 ${file.padEnd(30)} ${formatBytes(size).padStart(10)}`);
        }
    });
    
    // Calculate percentages
    analysis.files.forEach(file => {
        file.percentage = ((file.size / totalSize) * 100).toFixed(1);
    });
    
    analysis.totalSize = totalSize;
    analysis.withinLimit = totalSize <= MAX_SIZE_BYTES;
    
    console.log('-'.repeat(40));
    console.log(`📦 Total Size: ${formatBytes(totalSize)}`);
    console.log(`🎯 Size Limit: ${formatBytes(MAX_SIZE_BYTES)}`);
    console.log(`${analysis.withinLimit ? '✅' : '❌'} Within Limit: ${analysis.withinLimit ? 'YES' : 'NO'}`);
    
    if (!analysis.withinLimit) {
        const excess = totalSize - MAX_SIZE_BYTES;
        console.log(`⚠️  Exceeds limit by: ${formatBytes(excess)}`);
    }
    
    return analysis;
}

function compareBuilds(builds) {
    console.log('\n🔍 Build Comparison');
    console.log('='.repeat(60));
    
    builds.forEach(build => {
        if (build) {
            console.log(`${build.name.padEnd(15)} ${formatBytes(build.totalSize).padStart(10)} ${build.withinLimit ? '✅' : '❌'}`);
        }
    });
    
    // Find smallest build
    const validBuilds = builds.filter(b => b !== null);
    if (validBuilds.length > 1) {
        const smallest = validBuilds.reduce((min, build) => 
            build.totalSize < min.totalSize ? build : min
        );
        console.log(`\n🏆 Smallest Build: ${smallest.name} (${formatBytes(smallest.totalSize)})`);
    }
}

function generateReport(builds) {
    const report = {
        timestamp: new Date().toISOString(),
        builds: builds.filter(b => b !== null),
        summary: {
            allWithinLimit: builds.every(b => b === null || b.withinLimit),
            totalBuilds: builds.filter(b => b !== null).length
        }
    };
    
    const reportPath = path.join(__dirname, '../build-analysis.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📋 Report saved to: ${reportPath}`);
    
    return report;
}

function main() {
    console.log('🔧 DynamicParameterHelper Bundle Analysis');
    console.log('==========================================');
    
    const builds = [
        analyzeBuild('./dist', 'Rollup'),
        analyzeBuild('./dist-webpack', 'Webpack')
    ];
    
    compareBuilds(builds);
    const report = generateReport(builds);
    
    console.log('\n📈 Size Breakdown by File Type:');
    console.log('-'.repeat(40));
    
    builds.forEach(build => {
        if (build) {
            console.log(`\n${build.name}:`);
            const htmlFiles = build.files.filter(f => f.name.endsWith('.html'));
            const jsFiles = build.files.filter(f => f.name.endsWith('.js'));
            const otherFiles = build.files.filter(f => !f.name.endsWith('.html') && !f.name.endsWith('.js'));
            
            if (htmlFiles.length > 0) {
                const htmlSize = htmlFiles.reduce((sum, f) => sum + f.size, 0);
                console.log(`  HTML: ${formatBytes(htmlSize)} (${((htmlSize / build.totalSize) * 100).toFixed(1)}%)`);
            }
            
            if (jsFiles.length > 0) {
                const jsSize = jsFiles.reduce((sum, f) => sum + f.size, 0);
                console.log(`  JS:   ${formatBytes(jsSize)} (${((jsSize / build.totalSize) * 100).toFixed(1)}%)`);
            }
            
            if (otherFiles.length > 0) {
                const otherSize = otherFiles.reduce((sum, f) => sum + f.size, 0);
                console.log(`  Other: ${formatBytes(otherSize)} (${((otherSize / build.totalSize) * 100).toFixed(1)}%)`);
            }
        }
    });
    
    // Exit with error code if any build exceeds limit
    if (!report.summary.allWithinLimit) {
        console.log('\n❌ Some builds exceed the 500KB size limit!');
        process.exit(1);
    } else {
        console.log('\n✅ All builds are within the size limit!');
    }
}

if (require.main === module) {
    main();
}