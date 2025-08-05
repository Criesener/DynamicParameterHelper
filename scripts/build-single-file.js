#!/usr/bin/env node

/**
 * Build script to create a single-file HTML distribution
 * This properly handles the bundling without breaking script tags
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Paths
const projectRoot = path.join(__dirname, '..');
const srcDir = path.join(projectRoot, 'src');
const distDir = path.join(projectRoot, 'dist');
const templatePath = path.join(projectRoot, 'tree-view-demo.html');
const outputPath = path.join(distDir, 'index.html');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

console.log('🔨 Building single-file distribution...');

// Read the template HTML
let htmlContent = fs.readFileSync(templatePath, 'utf-8');

// Extract all JavaScript module imports
const scriptTags = htmlContent.match(/<script\s+src="([^"]+)"><\/script>/g) || [];
const moduleFiles = scriptTags.map(tag => {
    const match = tag.match(/src="([^"]+)"/);
    return match ? match[1] : null;
}).filter(Boolean);

console.log(`📦 Found ${moduleFiles.length} modules to bundle`);

// Read and combine all JavaScript modules
let bundledJS = '// Bundled JavaScript modules\n\n';

// Add each module
moduleFiles.forEach(file => {
    const filePath = path.join(projectRoot, file);
    if (fs.existsSync(filePath)) {
        console.log(`  - Bundling ${file}`);
        let moduleContent = fs.readFileSync(filePath, 'utf-8');
        
        // Remove module.exports statements
        moduleContent = moduleContent.replace(/module\.exports\s*=\s*[^;]+;?/g, '');
        moduleContent = moduleContent.replace(/exports\.[a-zA-Z]+\s*=\s*[^;]+;?/g, '');
        
        // Remove ES6 import/export statements
        moduleContent = moduleContent.replace(/import\s+.*from\s+['"][^'"]*['"];?/g, '');
        moduleContent = moduleContent.replace(/export\s*\{[^}]*\};?/g, '');
        
        // Wrap each module in IIFE but expose classes globally
        bundledJS += `// ${file}\n(function() {\n`;
        bundledJS += moduleContent;
        
        // Make classes available globally
        const classMatches = moduleContent.match(/class\s+([A-Z][a-zA-Z0-9]*)/g) || [];
        classMatches.forEach(match => {
            const className = match.replace('class ', '');
            bundledJS += `\nwindow.${className} = ${className};\n`;
        });
        
        bundledJS += '\n})();\n\n';
    }
});

// Extract inline script
const inlineScriptMatch = htmlContent.match(/<script>([\s\S]*?)<\/script>(?=\s*<\/body>)/);
let inlineScript = inlineScriptMatch ? inlineScriptMatch[1] : '';

// Fix the FileHandler to use the correct drop zone ID
inlineScript = inlineScript.replace(
    'this.dropZone = document.getElementById(\'fileDropZone\')',
    'this.dropZone = document.getElementById(\'treeFileDropZone\') || document.getElementById(\'fileDropZone\')'
);

// Remove all script tags
htmlContent = htmlContent.replace(/<script\s+src="[^"]+"><\/script>/g, '');
htmlContent = htmlContent.replace(/<script>([\s\S]*?)<\/script>(?=\s*<\/body>)/, '');

// Escape any </script> tags in the bundled code
bundledJS = bundledJS.replace(/<\/script>/g, '<\\/script>');

// Make functions globally accessible by moving them outside DOMContentLoaded
const globalFunctions = [
    'loadSampleXML', 'loadSampleJSON', 'loadComplexXML', 'loadLargeDataset', 
    'loadMassiveDataset', 'clearOutput', 'exportSelection', 'downloadOutput',
    'copyField', 'copyAll', 'openTreeFileDialog', 'loadDocument', 'showMessage',
    'initializeTreeView', 'initializeTreeFileHandler', 'updateMetrics'
];

// Extract function definitions from inside DOMContentLoaded and make them global
globalFunctions.forEach(func => {
    // Find function definition and move it outside DOMContentLoaded
    // Use better regex that handles nested braces correctly
    const funcRegex = new RegExp(`(async\\s+)?function\\s+${func}\\s*\\([^)]*\\)\\s*\\{`, 'g');
    const match = funcRegex.exec(inlineScript);
    
    if (match) {
        const startIndex = match.index;
        let braceCount = 0;
        let endIndex = -1;
        let inString = false;
        let stringChar = '';
        
        // Find the matching closing brace
        for (let i = startIndex; i < inlineScript.length; i++) {
            const char = inlineScript[i];
            const prevChar = i > 0 ? inlineScript[i-1] : '';
            
            // Handle string literals
            if ((char === '"' || char === "'") && prevChar !== '\\\\') {
                if (!inString) {
                    inString = true;
                    stringChar = char;
                } else if (char === stringChar) {
                    inString = false;
                }
                continue;
            }
            
            if (inString) continue;
            
            if (char === '{') {
                braceCount++;
            } else if (char === '}') {
                braceCount--;
                if (braceCount === 0) {
                    endIndex = i + 1;
                    break;
                }
            }
        }
        
        if (endIndex > startIndex) {
            const funcDef = inlineScript.substring(startIndex, endIndex);
            // Remove from inline script
            inlineScript = inlineScript.replace(funcDef, '');
            // Add to global scope
            bundledJS += `\n// Global function: ${func}\n${funcDef}\nwindow.${func} = ${func};\n\n`;
        }
    }
});

// Fix specific corruption issues by protecting problematic patterns
bundledJS = bundledJS.replace(/'\$'/g, '"$"'); // Replace '$' in single quotes with double quotes
inlineScript = inlineScript.replace(/'\$'/g, '"$"'); // Replace '$' in single quotes with double quotes

const finalScript = bundledJS + '\n\n// Original inline script\n' + inlineScript;

// Add the combined script before </body> (using regex to be more precise)
htmlContent = htmlContent.replace(/<\/body>(?=\s*<\/html>)/i, `<script>\n${finalScript}\n</script>\n</body>`);

// Add build metadata
const buildDate = new Date().toISOString();
const buildComment = `<!-- 
Built on ${buildDate}
Single-file distribution for DynamicParameterHelper
All dependencies bundled and inlined
-->\n`;

htmlContent = buildComment + htmlContent;

// Optimize CSS
htmlContent = htmlContent.replace(/<style>([\s\S]*?)<\/style>/g, (match, css) => {
    // Basic CSS minification
    const minifiedCss = css
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
        .replace(/\s+/g, ' ') // Collapse whitespace
        .replace(/;\s*}/g, '}') // Remove unnecessary semicolons
        .replace(/\s*{\s*/g, '{') // Remove spaces around braces
        .replace(/\s*}\s*/g, '}')
        .replace(/\s*:\s*/g, ':')
        .replace(/\s*;\s*/g, ';')
        .trim();
    return `<style>${minifiedCss}</style>`;
});

// Write the output file
fs.writeFileSync(outputPath, htmlContent);

// Copy test files
const testFiles = ['test-sample.json', 'test-sample.xml'];
testFiles.forEach(file => {
    const src = path.join(projectRoot, file);
    const dest = path.join(distDir, file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
    }
});

// Calculate file size
const stats = fs.statSync(outputPath);
const sizeKB = (stats.size / 1024).toFixed(2);

console.log(`\n✅ Build complete!`);
console.log(`📁 Output: ${outputPath}`);
console.log(`📏 Size: ${sizeKB} KB`);

if (stats.size > 500 * 1024) {
    console.error(`\n⚠️  Warning: File size exceeds 500KB limit!`);
    process.exit(1);
} else {
    console.log(`\n✨ File size is ${((500 - sizeKB) / 500 * 100).toFixed(1)}% under the 500KB limit`);
}