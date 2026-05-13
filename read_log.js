const fs = require('fs');
try {
    const content = fs.readFileSync('yarn-start-output.txt', 'utf16le');
    const lines = content.split('\n');
    const tail = lines.slice(-200).join('\n');
    fs.writeFileSync('yarn-start-output-tail.txt', tail, 'utf8');
    console.log('Successfully wrote tail to yarn-start-output-tail.txt');
} catch (e) {
    console.error('Error reading file:', e);
}
