const fs = require('fs');
const path = 'src/components/business-card/BusinessCardBuilder.tsx';

try {
  let content = fs.readFileSync(path, 'utf8');

  // Find the main handleAddToWallet function
  // We look for the one that is async and does validation
  const mainFuncRegex = /(const handleAddToWallet = async \(\) => {\s+)(\/\/ Validate required fields)/;
  
  if (mainFuncRegex.test(content)) {
    console.log('Found main handleAddToWallet, adding logging...');
    content = content.replace(mainFuncRegex, '$1console.log("handleAddToWallet called");\n    $2');
    
    fs.writeFileSync(path, content, 'utf8');
    console.log('Successfully added logging to BusinessCardBuilder.tsx');
  } else {
    console.log('Main handleAddToWallet not found with expected pattern');
    // Try simpler pattern
    const simpleRegex = /(const handleAddToWallet = async \(\) => {)/;
    if (simpleRegex.test(content)) {
        console.log('Found with simple pattern, adding logging...');
        content = content.replace(simpleRegex, '$1\n    console.log("handleAddToWallet called");');
        fs.writeFileSync(path, content, 'utf8');
        console.log('Successfully added logging to BusinessCardBuilder.tsx');
    } else {
        console.log('Could not find handleAddToWallet function signature');
    }
  }

} catch (err) {
  console.error('Error:', err);
}
