import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Wallet, Loader2, CheckCircle, XCircle } from 'lucide-react';

/**
 * WalletPass Page - Branded loading screen for Apple Wallet pass generation
 * This page shows a nice Wakti-branded UI while downloading the .pkpass file
 */
export default function WalletPass() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const generatePass = async () => {
      const data = searchParams.get('data');
      
      if (!data) {
        setStatus('error');
        setErrorMessage('Missing card data');
        return;
      }

      try {
        // Fetch the .pkpass file from the Edge Function
        const response = await fetch(
          `https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/generate-wallet-pass?data=${data}`
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || 'Failed to generate pass');
        }

        // Get the blob
        const blob = await response.blob();
        
        // Create a download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'wakti-card.pkpass';
        
        // Trigger download - iOS Safari will handle .pkpass and show "Add to Wallet"
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        window.URL.revokeObjectURL(url);
        
        setStatus('success');
      } catch (err) {
        console.error('Wallet pass error:', err);
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Something went wrong');
      }
    };

    // Small delay to show the loading screen
    const timer = setTimeout(generatePass, 500);
    return () => clearTimeout(timer);
  }, [searchParams]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{
        background: 'linear-gradient(135deg, #0c0f14 0%, hsl(235, 25%, 8%) 30%, hsl(250, 20%, 10%) 70%, #0c0f14 100%)'
      }}
    >
      {/* Wakti Logo/Brand */}
      <div className="mb-8">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, hsl(210, 100%, 65%) 0%, hsl(280, 70%, 65%) 50%, hsl(25, 95%, 60%) 100%)',
            boxShadow: '0 0 40px hsla(210, 100%, 65%, 0.5), 0 0 80px hsla(280, 70%, 65%, 0.3)'
          }}
        >
          <Wallet className="w-10 h-10 text-white" />
        </div>
      </div>

      {/* Status Content */}
      <div className="text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">
              Preparing Your Card
            </h1>
            <p className="text-gray-400">
              Adding to Apple Wallet...
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">
              Card Ready!
            </h1>
            <p className="text-gray-400 mb-6">
              Tap "Add" to save to your Apple Wallet
            </p>
            <button
              onClick={() => window.close()}
              className="px-6 py-3 rounded-xl text-white font-medium"
              style={{
                background: 'linear-gradient(135deg, hsl(210, 100%, 65%) 0%, hsl(280, 70%, 65%) 100%)'
              }}
            >
              Done
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">
              Oops!
            </h1>
            <p className="text-gray-400 mb-2">
              {errorMessage || 'Failed to generate wallet pass'}
            </p>
            <button
              onClick={() => window.history.back()}
              className="mt-4 px-6 py-3 rounded-xl text-white font-medium"
              style={{
                background: 'linear-gradient(135deg, hsl(210, 100%, 65%) 0%, hsl(280, 70%, 65%) 100%)'
              }}
            >
              Go Back
            </button>
          </>
        )}
      </div>

      {/* Wakti Branding */}
      <div className="absolute bottom-8 text-center">
        <p className="text-gray-500 text-sm">
          Powered by <span className="text-gray-400 font-medium">Wakti AI</span>
        </p>
      </div>
    </div>
  );
}
