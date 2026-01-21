/**
 * Natively Wallet Bridge
 * Provides integration with Apple Wallet via Natively SDK
 */

declare global {
  interface Window {
    NativelyWallet?: any;
  }
}

export interface WalletPassData {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  website?: string;
  cardUrl: string;
  profilePhotoUrl?: string;
  logoUrl?: string;
}

export interface WalletResult {
  status: 'SUCCESS' | 'FAILED';
  error?: string;
}

function getInstance(): any | null {
  try {
    if (typeof window === 'undefined') return null;
    const Ctor = (window as any).NativelyWallet;
    if (!Ctor) return null;
    return new Ctor();
  } catch {
    return null;
  }
}

/**
 * Check if Natively Wallet SDK is available (running in native app)
 */
export function isWalletSupported(): boolean {
  return getInstance() !== null;
}

/**
 * Add a pass to Apple Wallet using the Natively SDK
 * This will be used when running in the native app
 */
export function addToWallet(
  passData: WalletPassData,
  callback?: (result: WalletResult) => void
): void {
  const wallet = getInstance();
  
  if (!wallet) {
    console.warn('[NativelyWallet] SDK not available - not running in native app');
    callback?.({ status: 'FAILED', error: 'Wallet SDK not available. Please use Safari browser.' });
    return;
  }

  try {
    // Natively SDK addToWallet method
    const addPass = wallet.addToWallet || wallet.addPass || wallet.addBusinessCard;
    
    if (typeof addPass !== 'function') {
      console.warn('[NativelyWallet] addToWallet method not available');
      callback?.({ status: 'FAILED', error: 'Wallet feature not available in this app version.' });
      return;
    }

    // Call the native method
    addPass.call(wallet, passData, (response: any) => {
      if (response?.status === 'SUCCESS' || response?.success) {
        callback?.({ status: 'SUCCESS' });
      } else {
        callback?.({ 
          status: 'FAILED', 
          error: response?.error || response?.message || 'Failed to add to wallet' 
        });
      }
    });
  } catch (err) {
    console.error('[NativelyWallet] Error adding to wallet:', err);
    callback?.({ status: 'FAILED', error: String(err) });
  }
}

/**
 * Generate a business card pass for Apple Wallet
 */
export function addBusinessCardToWallet(
  cardData: WalletPassData,
  callback?: (result: WalletResult) => void
): void {
  addToWallet(cardData, callback);
}
