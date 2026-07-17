const fs = require('fs');

const filePath = 'c:/Users/ritzy/Desktop/backstage/docs/api/catalog-backend-module-wso2-apim/openapi.yaml';
let content = fs.readFileSync(filePath, 'utf8');

const originalLineEndings = content.includes('\r\n') ? '\r\n' : '\n';
content = content.replace(/\r\n/g, '\n');

// 1. Remove the misplaced examples section.
// The misplaced section is around line 1209, starting with "  examples:\n    CountryInfoServiceWsdl:"
// and ending with "</definitions>"
const misplacedStart = '\n  examples:\n    CountryInfoServiceWsdl:';
const misplacedStartIndex = content.indexOf(misplacedStart);

if (misplacedStartIndex === -1) {
  console.error('Could not find misplaced examples section');
  process.exit(1);
}

const definitionsEnd = '</definitions>';
const misplacedEndIndex = content.indexOf(definitionsEnd, misplacedStartIndex);
if (misplacedEndIndex === -1) {
  console.error('Could not find end of misplaced definitions');
  process.exit(1);
}

const misplacedFullEndIndex = misplacedEndIndex + definitionsEnd.length;

// Extract WSDL content for later use
const wsdlContentBlock = content.substring(misplacedStartIndex, misplacedFullEndIndex);

// Remove the misplaced block from the content
content = content.substring(0, misplacedStartIndex) + content.substring(misplacedFullEndIndex);
console.log('Removed misplaced examples block.');

// 2. Now find the root-level components section.
// The root level components section looks like "\ncomponents:\n"
const componentsMarker = '\ncomponents:\n';
const componentsIndex = content.indexOf(componentsMarker);

if (componentsIndex === -1) {
  console.error('Could not find root-level components definition');
  process.exit(1);
}

// Insert the WSDL examples block right under components:
const insertIndex = componentsIndex + componentsMarker.length;

// We need to format the wsdlContentBlock to fit under components:
// Currently it is:
//   examples:
//     CountryInfoServiceWsdl:
//       summary: ...
//       value: |
//         ... (indented by 8 spaces)
// Under components:, it needs to be indented by 2 spaces for "examples:" and 4 for "CountryInfoServiceWsdl:", etc.
// Let's check how the wsdlContentBlock is indented. It starts with "\n  examples:\n    CountryInfoServiceWsdl:"
// So it already has 2 spaces for "examples" and 4 for "CountryInfoServiceWsdl"!
// Let's trim any leading newline and insert it
const examplesSectionToInsert = wsdlContentBlock.trim() + '\n';

content = content.substring(0, insertIndex) + '  ' + examplesSectionToInsert + content.substring(insertIndex);
console.log('Successfully inserted examples block under root-level components.');

// Restore original line endings
if (originalLineEndings === '\r\n') {
  content = content.replace(/\n/g, '\r\n');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Finished updating openapi.yaml');
