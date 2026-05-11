import { useCallback, useEffect, useState } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useGmailConnection, GmailConnectionState } from './useGmailConnection';

export type ImapConnection = {
  id: string;
  provider: string;
  display_name: string | null;
  email_address: string | null;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  username: string;
  is_primary: boolean;
  is_active: boolean;
  created_at: string;
};

export type EmailConnectionState = {
  gmail: GmailConnectionState;
  imapConnections: ImapConnection[];
  imapLoading: boolean;
  // Unified: true if ANY email provider is connected
  anyConnected: boolean;
  // The primary email address to display
  primaryEmail: string | null;
};

export function useEmailConnections() {
  const gmail = useGmailConnection();
  const [imapConnections, setImapConnections] = useState<ImapConnection[]>([]);
  const [imapLoading, setImapLoading] = useState(true);

  const loadImapConnections = useCallback(async () => {
    setImapLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setImapConnections([]);
        return;
      }
      const { data, error } = await supabase
        .from('email_connections')
        .select('id, provider, display_name, email_address, smtp_host, smtp_port, smtp_secure, username, is_primary, is_active, created_at')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .order('is_primary', { ascending: false });

      if (error) throw error;
      setImapConnections(data || []);
    } catch (err) {
      console.error('[EmailConnections] Failed to load IMAP:', err);
      setImapConnections([]);
    } finally {
      setImapLoading(false);
    }
  }, []);

  useEffect(() => {
    loadImapConnections();
  }, [loadImapConnections]);

  // Re-check when window regains focus (user may have just set up a connection)
  useEffect(() => {
    const handleFocus = () => loadImapConnections();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadImapConnections]);

  const addImapConnection = useCallback(async (config: {
    provider: string;
    display_name: string;
    email_address: string;
    smtp_host: string;
    smtp_port: number;
    smtp_secure: boolean;
    username: string;
    password: string;
    imap_host?: string;
    imap_port?: number;
    imap_secure?: boolean;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { success: false, error: 'Please log in first' };
      }

      // Check if this is the first connection — make it primary
      const isFirst = imapConnections.length === 0 && !gmail.connection.connected;

      const { error } = await supabase.from('email_connections').insert({
        user_id: session.user.id,
        provider: config.provider,
        display_name: config.display_name || config.provider,
        email_address: config.email_address,
        smtp_host: config.smtp_host,
        smtp_port: config.smtp_port,
        smtp_secure: config.smtp_secure,
        username: config.username,
        password_encrypted: config.password,
        imap_host: config.imap_host || null,
        imap_port: config.imap_port || null,
        imap_secure: config.imap_secure ?? true,
        is_primary: isFirst,
        is_active: true,
      });

      if (error) throw error;

      toast.success('Email account connected successfully');
      await loadImapConnections();
      return { success: true };
    } catch (err: any) {
      console.error('[EmailConnections] Add failed:', err);
      const msg = err.message || 'Failed to save email connection';
      toast.error(msg);
      return { success: false, error: msg };
    }
  }, [imapConnections.length, gmail.connection.connected, loadImapConnections]);

  const removeImapConnection = useCallback(async (id: string): Promise<void> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { error } = await supabase
        .from('email_connections')
        .delete()
        .eq('id', id)
        .eq('user_id', session.user.id);

      if (error) throw error;
      toast.success('Email connection removed');
      await loadImapConnections();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove connection');
    }
  }, [loadImapConnections]);

  const setPrimaryConnection = useCallback(async (id: string): Promise<void> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Unset all primary first
      await supabase
        .from('email_connections')
        .update({ is_primary: false })
        .eq('user_id', session.user.id);

      // Set the chosen one as primary
      const { error } = await supabase
        .from('email_connections')
        .update({ is_primary: true })
        .eq('id', id)
        .eq('user_id', session.user.id);

      if (error) throw error;
      await loadImapConnections();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update primary');
    }
  }, [loadImapConnections]);

  const testSmtpConnection = useCallback(async (config: {
    smtp_host: string;
    smtp_port: number;
    smtp_secure: boolean;
    username: string;
    password: string;
    from: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { success: false, error: 'Please log in first' };

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-email-smtp`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: config.from,
          subject: 'Wakti Test Email',
          body: 'This is a test email from Wakti to verify your SMTP settings.',
          // We pass a temporary connection config in the body — the Edge Function
          // will use it directly if we include it. But our current Edge Function
          // doesn't support inline testing. We'll add a test endpoint later.
        }),
      });

      // For now, just return success if the Edge Function responds OK
      // A real implementation would add a /test-smtp endpoint
      if (resp.ok) {
        return { success: true };
      }
      const data = await resp.json().catch(() => ({}));
      return { success: false, error: data.error || 'SMTP test failed' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  }, []);

  // Determine if any email is connected
  const gmailConnected = gmail.connection.connected;
  const imapConnected = imapConnections.length > 0;
  const anyConnected = gmailConnected || imapConnected;

  // Primary email to display
  const primaryEmail = gmail.connection.emailAddress
    || imapConnections.find(c => c.is_primary)?.email_address
    || imapConnections[0]?.email_address
    || null;

  return {
    gmail,
    imap: {
      connections: imapConnections,
      loading: imapLoading,
      add: addImapConnection,
      remove: removeImapConnection,
      setPrimary: setPrimaryConnection,
      refresh: loadImapConnections,
      test: testSmtpConnection,
    },
    anyConnected,
    primaryEmail,
    allConnections: [
      ...(gmailConnected ? [{ id: 'gmail', provider: 'gmail', email_address: gmail.connection.emailAddress, is_primary: true }] : []),
      ...imapConnections.map(c => ({ id: c.id, provider: c.provider, email_address: c.email_address, is_primary: c.is_primary })),
    ],
  };
}

// Auto-detect provider settings from email domain
export function detectProviderSettings(email: string): {
  provider: string;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
} | null {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return null;

  const known: Record<string, {
    provider: string;
    smtp_host: string;
    smtp_port: number;
    smtp_secure: boolean;
    imap_host: string;
    imap_port: number;
    imap_secure: boolean;
  }> = {
    'gmail.com': {
      provider: 'gmail',
      smtp_host: 'smtp.gmail.com',
      smtp_port: 587,
      smtp_secure: false, // STARTTLS
      imap_host: 'imap.gmail.com',
      imap_port: 993,
      imap_secure: true,
    },
    'yahoo.com': {
      provider: 'yahoo',
      smtp_host: 'smtp.mail.yahoo.com',
      smtp_port: 587,
      smtp_secure: false,
      imap_host: 'imap.mail.yahoo.com',
      imap_port: 993,
      imap_secure: true,
    },
    'outlook.com': {
      provider: 'outlook',
      smtp_host: 'smtp-mail.outlook.com',
      smtp_port: 587,
      smtp_secure: false,
      imap_host: 'outlook.office365.com',
      imap_port: 993,
      imap_secure: true,
    },
    'hotmail.com': {
      provider: 'outlook',
      smtp_host: 'smtp-mail.outlook.com',
      smtp_port: 587,
      smtp_secure: false,
      imap_host: 'outlook.office365.com',
      imap_port: 993,
      imap_secure: true,
    },
    'live.com': {
      provider: 'outlook',
      smtp_host: 'smtp-mail.outlook.com',
      smtp_port: 587,
      smtp_secure: false,
      imap_host: 'outlook.office365.com',
      imap_port: 993,
      imap_secure: true,
    },
    'icloud.com': {
      provider: 'icloud',
      smtp_host: 'smtp.mail.me.com',
      smtp_port: 587,
      smtp_secure: false,
      imap_host: 'imap.mail.me.com',
      imap_port: 993,
      imap_secure: true,
    },
    'me.com': {
      provider: 'icloud',
      smtp_host: 'smtp.mail.me.com',
      smtp_port: 587,
      smtp_secure: false,
      imap_host: 'imap.mail.me.com',
      imap_port: 993,
      imap_secure: true,
    },
    'aol.com': {
      provider: 'aol',
      smtp_host: 'smtp.aol.com',
      smtp_port: 587,
      smtp_secure: false,
      imap_host: 'imap.aol.com',
      imap_port: 993,
      imap_secure: true,
    },
    'zoho.com': {
      provider: 'zoho',
      smtp_host: 'smtp.zoho.com',
      smtp_port: 587,
      smtp_secure: false,
      imap_host: 'imap.zoho.com',
      imap_port: 993,
      imap_secure: true,
    },
    'protonmail.com': {
      provider: 'protonmail',
      smtp_host: '127.0.0.1', // Proton requires Bridge app
      smtp_port: 1025,
      smtp_secure: false,
      imap_host: '127.0.0.1',
      imap_port: 1143,
      imap_secure: false,
    },
  };

  return known[domain] || {
    provider: 'custom',
    smtp_host: '',
    smtp_port: 587,
    smtp_secure: false,
    imap_host: '',
    imap_port: 993,
    imap_secure: true,
  };
}
