/**
 * vCard Generator for Wakti Business Cards
 * Generates standard vCard (VCF) format that works on both iOS and Android
 */

// Define BusinessCardData interface here to avoid import issues
interface BusinessCardData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName: string;
  jobTitle: string;
  website: string;
  logoUrl: string;
  profilePhotoUrl: string;
  coverPhotoUrl?: string;
  department?: string;
  headline?: string;
  address?: string;
  socialLinks?: Array<{ id: string; type: string; url: string; label?: string }>;
  template?: 'geometric' | 'professional' | 'fashion' | 'minimal' | 'clean';
  primaryColor?: string;
  mosaicPaletteId?: string;
  mosaicColors?: any;
  professionalColors?: any;
  fashionColors?: any;
  minimalColors?: any;
  cleanColors?: any;
  logoPosition?: string;
  photoShape?: string;
  nameStyle?: any;
  titleStyle?: any;
  companyStyle?: any;
  iconStyle?: {
    showBackground?: boolean;
    backgroundColor?: string;
    iconColor?: string;
    useBrandColors?: boolean;
    colorIntensity?: number;
  };
}

/**
 * Generate a vCard string from business card data
 * @param data The business card data
 * @returns vCard formatted string (VCF format)
 */
export function generateVCard(data: BusinessCardData): string {
  // Basic vCard structure - START and VERSION are required
  const lines: string[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
  ];

  // Full name (FN) is a required field
  lines.push(`FN:${(data.firstName || '')} ${(data.lastName || '')}`);
  
  // Name parts (N) - Last;First;Middle;Prefix;Suffix
  lines.push(`N:${data.lastName || ''};${data.firstName || ''};;;`);

  // Organization info
  if (data.companyName) {
    lines.push(`ORG:${escapeVCardValue(data.companyName)}`);
  }

  // Job title
  if (data.jobTitle) {
    lines.push(`TITLE:${escapeVCardValue(data.jobTitle)}`);
  }

  // Department (if available)
  if (data.department) {
    lines.push(`X-DEPARTMENT:${escapeVCardValue(data.department)}`);
  }

  // Phone number (add mobile type)
  if (data.phone) {
    lines.push(`TEL;type=CELL:${escapeVCardValue(data.phone)}`);
  }

  // Email
  if (data.email) {
    lines.push(`EMAIL:${escapeVCardValue(data.email)}`);
  }

  // Website (as URL)
  if (data.website) {
    // Make sure it has a scheme
    const url = data.website.startsWith('http') 
      ? data.website 
      : `https://${data.website}`;
    lines.push(`URL:${escapeVCardValue(url)}`);
  }

  // Physical address if available
  if (data.address) {
    lines.push(`ADR:;;${escapeVCardValue(data.address)};;;`);
  }

  // Add social links as URLs with labels
  if (data.socialLinks?.length) {
    data.socialLinks.forEach(link => {
      if (!link.url) return;
      
      // Format URL properly
      let url = link.url;
      if (!url.startsWith('http') && !url.startsWith('tel:') && !url.startsWith('mailto:')) {
        // Handle common patterns
        if (link.type === 'email' && !url.startsWith('mailto:')) {
          url = `mailto:${url}`;
        } else if (link.type === 'phone' && !url.startsWith('tel:')) {
          url = `tel:${url}`;
        } else {
          url = `https://${url}`;
        }
      }
      
      // Add as URL with type label
      const label = link.label || capitalizeFirstLetter(link.type);
      lines.push(`URL;type=${link.type.toUpperCase()};CHARSET=UTF-8:${escapeVCardValue(url)}`);
      lines.push(`X-SOCIALPROFILE;TYPE=${link.type.toUpperCase()};x-user=${escapeVCardValue(url)}:${escapeVCardValue(label)}`);
    });
  }

  // Add profile photo if available (BASE64 encoded)
  if (data.profilePhotoUrl) {
    // If it's a data URL, extract the base64 part
    if (data.profilePhotoUrl.startsWith('data:image')) {
      try {
        const base64Data = data.profilePhotoUrl.split(',')[1];
        const imageType = data.profilePhotoUrl.match(/data:image\/(.*?);/)?.[1]?.toUpperCase() || 'JPEG';
        lines.push(`PHOTO;ENCODING=BASE64;TYPE=${imageType}:${base64Data}`);
      } catch (e) {
        // Skip photo if there's an issue
        console.error('Error processing photo for vCard:', e);
      }
    } else {
      // For external URLs, add as URL
      lines.push(`PHOTO;VALUE=URL:${escapeVCardValue(data.profilePhotoUrl)}`);
    }
  }

  // Add any notes/headline as NOTE
  if (data.headline) {
    lines.push(`NOTE:${escapeVCardValue(data.headline)}`);
  }

  // Add Wakti branding as generator
  lines.push('PRODID:-//Wakti AI//Business Card//EN');
  
  // Required END
  lines.push('END:VCARD');

  return lines.join('\\r\\n');
}

/**
 * Create a downloadable vCard file
 * @param data The business card data
 * @returns Object with file URL and filename
 */
export function createDownloadableVCard(data: BusinessCardData): { url: string, filename: string } {
  const vCardString = generateVCard(data);
  const blob = new Blob([vCardString], { type: 'text/vcard' });
  const url = URL.createObjectURL(blob);
  const filename = `${data.firstName || 'contact'}_${data.lastName || ''}.vcf`.replace(/\\s+/g, '_');
  
  return { url, filename };
}

/**
 * Helper function to escape vCard special characters
 * @param value String to escape
 * @returns Escaped string
 */
function escapeVCardValue(value: string): string {
  return value
    .replace(/\\;/g, '\\\\;')
    .replace(/\\,/g, '\\\\,')
    .replace(/\\n/g, '\\\\n')
    .replace(/\\r/g, '')
    .replace(/</g, '')
    .replace(/>/g, '');
}

/**
 * Helper to capitalize first letter
 */
function capitalizeFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
