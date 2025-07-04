
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, Smartphone, AlertTriangle, CheckCircle, Clock, RefreshCw } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PaymentSystemStatusProps {
  fawranStats: {
    totalPayments: number;
    pendingPayments: number;
    approvedPayments: number;
    rejectedPayments: number;
    autoApprovedPayments: number;
    avgProcessingTimeMs: number;
    tamperingDetected: number;
    duplicateDetected: number;
    timeValidationFailed: number;
  };
}

export const PaymentSystemStatus = ({ fawranStats }: PaymentSystemStatusProps) => {
  const [isTesting, setIsTesting] = useState(false);

  const testPaymentSystem = async () => {
    setIsTesting(true);
    try {
      console.log('[DEBUG] Testing Fawran payment system...');
      
      // Test edge function availability
      const { data, error } = await supabase.functions.invoke('analyze-payment-screenshot', {
        body: { test: true }
      });

      if (error) {
        console.error('[DEBUG] Payment system test failed:', error);
        toast.error('Payment system test failed: ' + error.message);
      } else {
        console.log('[DEBUG] Payment system test successful:', data);
        toast.success('Payment system is operational');
      }
    } catch (error) {
      console.error('[DEBUG] Payment system test error:', error);
      toast.error('Payment system test failed');
    } finally {
      setIsTesting(false);
    }
  };

  const autoApprovalRate = fawranStats.totalPayments > 0 
    ? Math.round((fawranStats.autoApprovedPayments / fawranStats.totalPayments) * 100)
    : 0;

  const securityScore = fawranStats.totalPayments > 0 
    ? Math.round(((fawranStats.totalPayments - fawranStats.tamperingDetected - fawranStats.duplicateDetected) / fawranStats.totalPayments) * 100)
    : 100;

  const avgProcessingTime = Math.round(fawranStats.avgProcessingTimeMs / 1000);

  const systemHealth = () => {
    if (fawranStats.pendingPayments > 10) return { status: 'warning', message: 'High pending queue' };
    if (avgProcessingTime > 90) return { status: 'warning', message: 'Slow processing' };
    if (securityScore < 95) return { status: 'error', message: 'Security issues detected' };
    return { status: 'success', message: 'All systems operational' };
  };

  const health = systemHealth();

  return (
    <Card className="enhanced-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-accent-blue" />
            <CardTitle className="text-enhanced-heading">Fawran Payment System</CardTitle>
          </div>
          <Button
            onClick={testPaymentSystem}
            disabled={isTesting}
            variant="outline"
            size="sm"
          >
            {isTesting ? (
              <>
                <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-1" />
                Test System
              </>
            )}
          </Button>
        </div>
        <CardDescription>
          AI-powered payment verification system status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* System Health Status */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-accent/5">
          <div className="flex items-center gap-2">
            {health.status === 'success' ? (
              <CheckCircle className="h-5 w-5 text-accent-green" />
            ) : health.status === 'warning' ? (
              <AlertTriangle className="h-5 w-5 text-accent-orange" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-accent-red" />
            )}
            <span className="font-medium">System Status</span>
          </div>
          <Badge 
            variant="outline" 
            className={`${
              health.status === 'success' ? 'border-accent-green text-accent-green' :
              health.status === 'warning' ? 'border-accent-orange text-accent-orange' :
              'border-accent-red text-accent-red'
            }`}
          >
            {health.message}
          </Badge>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center p-3 rounded-lg bg-accent-green/10">
            <div className="flex items-center justify-center mb-2">
              <Smartphone className="h-4 w-4 text-accent-green" />
            </div>
            <div className="text-2xl font-bold text-accent-green">{autoApprovalRate}%</div>
            <div className="text-xs text-muted-foreground">Auto-Approval Rate</div>
          </div>

          <div className="text-center p-3 rounded-lg bg-accent-blue/10">
            <div className="flex items-center justify-center mb-2">
              <Clock className="h-4 w-4 text-accent-blue" />
            </div>
            <div className="text-2xl font-bold text-accent-blue">{avgProcessingTime}s</div>
            <div className="text-xs text-muted-foreground">Avg Processing</div>
          </div>

          <div className="text-center p-3 rounded-lg bg-accent-purple/10">
            <div className="flex items-center justify-center mb-2">
              <Shield className="h-4 w-4 text-accent-purple" />
            </div>
            <div className="text-2xl font-bold text-accent-purple">{securityScore}%</div>
            <div className="text-xs text-muted-foreground">Security Score</div>
          </div>

          <div className="text-center p-3 rounded-lg bg-accent-orange/10">
            <div className="flex items-center justify-center mb-2">
              <AlertTriangle className="h-4 w-4 text-accent-orange" />
            </div>
            <div className="text-2xl font-bold text-accent-orange">{fawranStats.pendingPayments}</div>
            <div className="text-xs text-muted-foreground">Pending Review</div>
          </div>
        </div>

        {/* Security Alerts */}
        {(fawranStats.tamperingDetected > 0 || fawranStats.duplicateDetected > 0 || fawranStats.timeValidationFailed > 0) && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="font-medium text-red-800 dark:text-red-300">Security Alerts</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="text-center">
                <div className="font-bold text-red-600">{fawranStats.tamperingDetected}</div>
                <div className="text-red-700 dark:text-red-400">Tampering Detected</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-red-600">{fawranStats.duplicateDetected}</div>
                <div className="text-red-700 dark:text-red-400">Duplicates Blocked</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-red-600">{fawranStats.timeValidationFailed}</div>
                <div className="text-red-700 dark:text-red-400">Time Validation Failed</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
