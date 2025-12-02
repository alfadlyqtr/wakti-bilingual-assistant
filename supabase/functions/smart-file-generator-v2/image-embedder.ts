// IMAGE EMBEDDING SYSTEM
// Downloads and embeds DALL-E images into Office documents and PDFs

export interface ImageData {
  url: string;
  width: number;
  height: number;
  data?: Uint8Array;
  base64?: string;
  format: 'png' | 'jpg';
}

// Download image from URL and convert to binary
export async function downloadImage(url: string): Promise<ImageData> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const base64 = btoa(String.fromCharCode(...data));
    
    // Detect format from URL or content
    const format = url.toLowerCase().includes('.jpg') || url.toLowerCase().includes('.jpeg') ? 'jpg' : 'png';
    
    return {
      url,
      width: 1024, // DALL-E 3 default
      height: 1024,
      data,
      base64,
      format
    };
  } catch (error) {
    console.error('Image download error:', error);
    throw error;
  }
}

// Download multiple images
export async function downloadImages(urls: string[]): Promise<ImageData[]> {
  const images: ImageData[] = [];
  
  for (const url of urls) {
    try {
      const imageData = await downloadImage(url);
      images.push(imageData);
      console.log(`✅ Downloaded image: ${url.substring(0, 50)}...`);
    } catch (error) {
      console.error(`❌ Failed to download: ${url}`, error);
    }
  }
  
  return images;
}

// Generate Office XML for image embedding in PPTX
export function generatePPTXImageXML(image: ImageData, imageId: number, slideId: number): Record<string, string> {
  const files: Record<string, string> = {};
  const ext = image.format;
  const imageName = `image${imageId}.${ext}`;
  
  // Add image file to media folder
  files[`ppt/media/${imageName}`] = ''; // Binary data will be added separately
  
  // Add relationship
  const relId = `rId${imageId + 10}`;
  
  // Image XML for slide (positioned in bottom right)
  const imageXML = `
    <p:pic>
      <p:nvPicPr>
        <p:cNvPr id="${imageId + 1000}" name="${imageName}"/>
        <p:cNvPicPr>
          <a:picLocks noChangeAspect="1"/>
        </p:cNvPicPr>
        <p:nvPr/>
      </p:nvPicPr>
      <p:blipFill>
        <a:blip r:embed="${relId}"/>
        <a:stretch>
          <a:fillRect/>
        </a:stretch>
      </p:blipFill>
      <p:spPr>
        <a:xfrm>
          <a:off x="5500000" y="3500000"/>
          <a:ext cx="3000000" cy="3000000"/>
        </a:xfrm>
        <a:prstGeom prst="rect">
          <a:avLst/>
        </a:prstGeom>
      </p:spPr>
    </p:pic>`;
  
  return {
    imageXML,
    relId,
    imageName,
    mediaPath: `ppt/media/${imageName}`
  };
}

// Generate Office XML for image embedding in DOCX
export function generateDOCXImageXML(image: ImageData, imageId: number): Record<string, string> {
  const files: Record<string, string> = {};
  const ext = image.format;
  const imageName = `image${imageId}.${ext}`;
  const relId = `rId${imageId + 10}`;
  
  // Image paragraph XML
  const imageXML = `
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
      </w:pPr>
      <w:r>
        <w:drawing>
          <wp:inline distT="0" distB="0" distL="0" distR="0">
            <wp:extent cx="3000000" cy="3000000"/>
            <wp:effectExtent l="0" t="0" r="0" b="0"/>
            <wp:docPr id="${imageId}" name="${imageName}"/>
            <wp:cNvGraphicFramePr>
              <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
            </wp:cNvGraphicFramePr>
            <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
              <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                  <pic:nvPicPr>
                    <pic:cNvPr id="${imageId}" name="${imageName}"/>
                    <pic:cNvPicPr/>
                  </pic:nvPicPr>
                  <pic:blipFill>
                    <a:blip r:embed="${relId}"/>
                    <a:stretch>
                      <a:fillRect/>
                    </a:stretch>
                  </pic:blipFill>
                  <pic:spPr>
                    <a:xfrm>
                      <a:off x="0" y="0"/>
                      <a:ext cx="3000000" cy="3000000"/>
                    </a:xfrm>
                    <a:prstGeom prst="rect">
                      <a:avLst/>
                    </a:prstGeom>
                  </pic:spPr>
                </pic:pic>
              </a:graphicData>
            </a:graphic>
          </wp:inline>
        </w:drawing>
      </w:r>
    </w:p>`;
  
  return {
    imageXML,
    relId,
    imageName,
    mediaPath: `word/media/${imageName}`
  };
}

// Generate PDF image embedding code
export function generatePDFImageCode(image: ImageData, imageId: number, yPos: number): string {
  // PDF image embedding using base64
  const pdfCode = `
% Image ${imageId}
q
200 0 0 200 50 ${yPos} cm
/Im${imageId} Do
Q
`;
  
  return pdfCode;
}

// Generate PDF image object
export function generatePDFImageObject(image: ImageData, imageId: number, objectNum: number): string {
  const width = 200;
  const height = 200;
  
  // Simplified PDF image object
  const imageObj = `${objectNum} 0 obj
<<
  /Type /XObject
  /Subtype /Image
  /Width ${width}
  /Height ${height}
  /ColorSpace /DeviceRGB
  /BitsPerComponent 8
  /Filter /DCTDecode
  /Length ${image.data?.length || 0}
>>
stream
${image.base64 || ''}
endstream
endobj
`;
  
  return imageObj;
}

// Create image relationship XML for Office documents
export function createImageRelationship(relId: string, target: string): string {
  return `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"/>`;
}

// Update Content Types for images
export function addImageContentType(ext: string): string {
  const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
  return `<Default Extension="${ext}" ContentType="${mimeType}"/>`;
}

// Resize image to fit constraints
export function calculateImageDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  const aspectRatio = originalWidth / originalHeight;
  
  let width = originalWidth;
  let height = originalHeight;
  
  if (width > maxWidth) {
    width = maxWidth;
    height = width / aspectRatio;
  }
  
  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }
  
  return { width: Math.round(width), height: Math.round(height) };
}

// Convert image to different format if needed
export async function convertImageFormat(
  imageData: Uint8Array,
  fromFormat: string,
  toFormat: string
): Promise<Uint8Array> {
  // For now, return as-is (conversion would require image processing library)
  // In production, use sharp or similar library
  return imageData;
}

// Optimize image size
export async function optimizeImage(
  imageData: Uint8Array,
  maxSizeKB: number = 500
): Promise<Uint8Array> {
  // For now, return as-is
  // In production, implement compression
  const sizeKB = imageData.length / 1024;
  
  if (sizeKB <= maxSizeKB) {
    return imageData;
  }
  
  console.warn(`Image size ${sizeKB.toFixed(0)}KB exceeds ${maxSizeKB}KB, but optimization not implemented yet`);
  return imageData;
}

// Generate placeholder image if download fails
export function generatePlaceholderImage(): ImageData {
  // Simple 1x1 transparent PNG
  const placeholderBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const placeholderData = Uint8Array.from(atob(placeholderBase64), c => c.charCodeAt(0));
  
  return {
    url: 'placeholder',
    width: 1,
    height: 1,
    data: placeholderData,
    base64: placeholderBase64,
    format: 'png'
  };
}

// Validate image data
export function validateImage(image: ImageData): boolean {
  if (!image.data || image.data.length === 0) {
    console.error('Invalid image: no data');
    return false;
  }
  
  if (image.width <= 0 || image.height <= 0) {
    console.error('Invalid image: invalid dimensions');
    return false;
  }
  
  return true;
}
