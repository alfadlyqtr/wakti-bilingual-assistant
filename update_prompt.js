const fs = require('fs');
let content = fs.readFileSync('supabase/functions/text-generator/index.ts', 'utf8');

const newPrompt = \Extract the meaningful content from this document and format it nicely into structured Markdown. 
CRITICAL INSTRUCTIONS:
1. Ignore and exclude all UI boilerplate, system text, phone status bars (time, battery, signal), navigation menus, and repetitive icons.
2. Focus ONLY on the actual content, presentation slides, paragraphs, and core messages.
3. Clean up any weird line breaks or formatting artifacts.
4. Organize the text with appropriate Markdown headers (##), bullet points, and paragraphs to make it highly readable.
5. Return ONLY a valid JSON object using this exact structure:
{\\"isScreenshot\\":false,\\"sourceType\\":\\"document\\",\\"deviceType\\":\\"unknown\\",\\"isForm\\":false,\\"formType\\":\\"other\\",\\"fields\\":{},\\"rawText\\":\\"your beautifully formatted markdown text goes here\\"}
Do NOT wrap the JSON in markdown code blocks. Just return the raw JSON.\;

// The regex matches the text: "Extract all text from this document... here" }"
content = content.replace(/\{ text: "Extract all text from this document[\s\S]*?here\\"\}" \}/, '{ text: ' + JSON.stringify(newPrompt) + ' }');

fs.writeFileSync('supabase/functions/text-generator/index.ts', content);
console.log('Done');
