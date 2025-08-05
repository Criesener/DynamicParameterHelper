const fs = require('fs');

const content = fs.readFileSync('dist/index.html', 'utf-8');

// Extract script content
const scriptMatch = content.match(/<script>([\s\S]*)<\/script>/);
if (!scriptMatch) {
    console.log('No script tag found');
    process.exit(1);
}

const scriptContent = scriptMatch[1];

// Try to parse the JavaScript
try {
    new Function(scriptContent);
    console.log('JavaScript syntax is valid');
} catch (error) {
    console.log('Syntax error found:');
    console.log('Error:', error.message);
    
    // Try to find the approximate line number
    const lines = scriptContent.split('\n');
    
    // If we have line info in error message
    const lineMatch = error.message.match(/line (\d+)/);
    if (lineMatch) {
        const lineNum = parseInt(lineMatch[1]);
        console.log(`Problem around line ${lineNum}:`);
        console.log(lines.slice(Math.max(0, lineNum - 3), lineNum + 2).map((line, i) => 
            `${lineNum - 2 + i}: ${line}`
        ).join('\n'));
    } else {
        // Try to find common syntax issues
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('import ') || line.includes('export ')) {
                console.log(`Potential issue at line ${i + 1}: ${line.trim()}`);
            }
        }
    }
}