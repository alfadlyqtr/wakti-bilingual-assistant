import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, User, CheckCircle, AlertCircle } from "lucide-react";

export default function AdminSetupHelper() {
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);

  const handleSetupAdmin = async () => {
    setIsSettingUp(true);
    
    try {
      console.log('[AdminSetup] Starting admin auth setup...');
      
      const { data, error } = await supabase.functions.invoke('setup-admin-auth', {
        body: {
          email: 'admin@tmw.qa',
          password: 'AdminPassword123!'
        }
      });

      console.log('[AdminSetup] Setup response:', { data, error });

      if (error) {
        console.error('[AdminSetup] Setup error:', error);
        toast.error(`Setup failed: ${error.message}`);
        return;
      }

      if (data?.success) {
        console.log('[AdminSetup] Setup successful:', data);
        toast.success('Admin auth setup completed successfully!');
        setSetupComplete(true);
      } else {
        console.error('[AdminSetup] Setup failed:', data);
        toast.error(`Setup failed: ${data?.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('[AdminSetup] Exception during setup:', err);
      toast.error('Setup failed. Please try again.');
    } finally {
      setIsSettingUp(false);
    }
  };

  if (setupComplete) {
    return (
      <div className="max-w-md mx-auto bg-green-900/20 border border-green-700 rounded-lg p-6">
        <div className="text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-green-400 mb-4" />
          <h3 className="text-lg font-semibold text-green-400 mb-2">Setup Complete!</h3>
          <p className="text-green-300 text-sm mb-4">
            Admin authentication has been successfully migrated to Supabase Auth.
          </p>
          <p className="text-green-200 text-xs">
            You can now log in using: <strong>admin@tmw.qa</strong>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-slate-800 border border-slate-700 rounded-lg p-6">
      <div className="text-center">
        <Shield className="mx-auto h-12 w-12 text-blue-400 mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Admin Auth Setup Required</h3>
        <p className="text-slate-300 text-sm mb-4">
          Click the button below to create the Supabase Auth user for admin@tmw.qa and complete the migration.
        </p>
        
        <div className="bg-yellow-900/20 border border-yellow-700 rounded-md p-3 mb-4">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5 mr-2 flex-shrink-0" />
            <div className="text-left">
              <p className="text-yellow-300 text-xs font-medium mb-1">One-time Setup</p>
              <p className="text-yellow-200 text-xs">
                This will create a Supabase Auth user and link it to your existing admin record.
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={handleSetupAdmin}
          disabled={isSettingUp}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isSettingUp ? (
            <>
              <User className="mr-2 h-4 w-4 animate-spin" />
              Setting up admin auth...
            </>
          ) : (
            <>
              <Shield className="mr-2 h-4 w-4" />
              Setup Admin Authentication
            </>
          )}
        </Button>
      </div>
    </div>
  );
}