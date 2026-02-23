import fs from 'fs';
const file = 'supabase/functions/text-generator/index.ts';
let content = fs.readFileSync(file, 'utf8');

const startIndex = content.indexOf('role: "user",');
const partsIndex = content.indexOf('parts: [', startIndex);
const textIndex = content.indexOf('{ text: Extract the meaningful', partsIndex);
const inlineDataIndex = content.indexOf('{ inlineData:', textIndex);

if (textIndex !== -1 && inlineDataIndex !== -1) {
    const newText = '{ text: ' + JSON.stringify('Extract the meaningful content from this document and format it nicely into structured Markdown. CRITICAL INSTRUCTIONS: 1. Ignore and exclude all UI boilerplate, system text, phone status bars (time, battery, signal), navigation menus, and repetitive icons. 2. Focus ONLY on the actual content, presentation slides, paragraphs, and core messages. 3. Clean up any weird line breaks or formatting artifacts. 4. Organize the text with appropriate Markdown headers (##), bullet points, and paragraphs to make it highly readable. 5. Return ONLY a valid JSON object using this exact structure: {"isScreenshot":false,"sourceType":"document","deviceType":"unknown","isForm":false,"formType":"other","fields":{},"rawText":"your beautifully formatted markdown text goes here"} Do NOT wrap the JSON in markdown code blocks. Just return the raw JSON.') + ' },\n                        ';
    
    content = content.substring(0, textIndex) + newText + content.substring(inlineDataIndex);
    fs.writeFileSync(file, content);
    console.log('Success!');
} else {
    console.log('Could not find indices', textIndex, inlineDataIndex);
}
