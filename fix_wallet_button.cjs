const fs = require('fs');
const path = 'src/components/business-card/BusinessCardBuilder.tsx';

try {
  let content = fs.readFileSync(path, 'utf8');

  // 1. Remove the dummy handleAddToWallet function
  const dummyFuncRegex = /const handleAddToWallet = \(\) => {\s+toast\.info\("Generating your Apple Wallet pass\.\.\.", {\s+description: "This will add the card to your personal Apple Wallet for offline sharing\."\s+}\);\s+};/g;
  if (dummyFuncRegex.test(content)) {
    console.log('Found dummy function, removing...');
    content = content.replace(dummyFuncRegex, '// Dummy handleAddToWallet removed');
  } else {
    console.log('Dummy function not found (might have been removed already)');
  }

  // 2. Update CardPreviewLiveProps interface
  const interfaceRegex = /interface CardPreviewLiveProps {\s+data: BusinessCardData;\s+isFlipped: boolean;\s+handleFlip: \(\) => void;\s+}/g;
  if (interfaceRegex.test(content)) {
    console.log('Found interface, updating...');
    content = content.replace(interfaceRegex, `interface CardPreviewLiveProps {
  data: BusinessCardData;
  isFlipped: boolean;
  handleFlip: () => void;
  handleAddToWallet: () => void;
}`);
  } else {
    console.log('Interface not found or already updated');
  }

  // 3. Update CardPreviewLive component signature
  const signatureRegex = /const CardPreviewLive = \({ data, isFlipped, handleFlip }: CardPreviewLiveProps\) => {/g;
  if (signatureRegex.test(content)) {
    console.log('Found component signature, updating...');
    content = content.replace(signatureRegex, 'const CardPreviewLive = ({ data, isFlipped, handleFlip, handleAddToWallet }: CardPreviewLiveProps) => {');
  } else {
    console.log('Component signature not found or already updated');
  }

  // 4. Update usage of CardPreviewLive (both instances)
  // We look for the closing tag /> and check if handleAddToWallet is missing before it
  // This is a bit tricky with regex, let's target the exact blocks we saw in read_file
  
  const usageRegex = /<CardPreviewLive\s+data={formData}\s+isFlipped={isPreviewFlipped}\s+handleFlip={\(\) => setIsPreviewFlipped\(!isPreviewFlipped\)}\s+\/>/g;
  
  if (usageRegex.test(content)) {
    console.log('Found CardPreviewLive usage, updating...');
    content = content.replace(usageRegex, `<CardPreviewLive 
            data={formData} 
            isFlipped={isPreviewFlipped} 
            handleFlip={() => setIsPreviewFlipped(!isPreviewFlipped)}
            handleAddToWallet={handleAddToWallet}
          />`);
  } else {
    console.log('CardPreviewLive usage not found or already updated');
  }

  fs.writeFileSync(path, content, 'utf8');
  console.log('Successfully updated BusinessCardBuilder.tsx');

} catch (err) {
  console.error('Error:', err);
}
