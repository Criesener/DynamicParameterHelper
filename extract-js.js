const fs = require('fs');

const content = fs.readFileSync('dist/index.html', 'utf-8');
const scriptMatch = content.match(/<script>([\s\S]*)<\/script>/);

if (scriptMatch) {
    const jsContent = scriptMatch[1];
    
    // Write to temp file for syntax checking
    fs.writeFileSync('temp-script.js', jsContent);
    console.log('JavaScript extracted to temp-script.js');
    
    // Try to find syntax issues
    const lines = jsContent.split('\n');
    for (let i = 0; i < Math.min(lines.length, 50); i++) {
        const line = lines[i];
        if (line.includes('import ') || line.includes('export ') || line.includes('</script>')) {
            console.log(`Line ${i + 1}: ${line.trim()}`);
        }
    }
} else {
    console.log('No script tag found');
}