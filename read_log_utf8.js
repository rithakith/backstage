const fs = require('fs');
try {
    const content = fs.readFileSync('yarn-start-output.txt', 'utf8');
    const lines = content.split('\n');
    const tail = lines.slice(-50).join('\n');
    console.log(tail);
} catch (e) {
    console.error('Error reading file:', e);
}
