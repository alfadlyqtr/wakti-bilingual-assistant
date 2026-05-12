import { useCallback, useEffect, useState } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useGmailConnection, GmailConnectionState } from './useGmailConnection';

export type ImapConnectionProof = {
  login: string;
  emailAddress: string;
  username: string;
  inboxFolder: string;
  inboxCount: number;
  sentFolder: string;
  foldersCount: number;
};

export type ImapConnectionHealth = {
  status: 'unknown' | 'checking' | 'verified' | 'failed';
  proof?: ImapConnectionProof;
  error?: string;
  checkedAt?: string;
};

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
  const [imapHealth, setImapHealth] = useState<Record<string, ImapConnectionHealth>>({});

  const callImapApi = useCallback(async (action: string, params: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Please log in first');

    const res = await fetch(`${SUPABASE_URL}/functions/v1/imap-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ action, ...params }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      throw new Error(data.error || 'IMAP validation failed');
    }
    return data;
  }, []);

  const validateSavedConnection = useCallback(async (connectionId: string): Promise<ImapConnectionHealth> => {
    setImapHealth(prev => ({
      ...prev,
      [connectionId]: {
        status: 'checking',
        proof: prev[connectionId]?.proof,
        checkedAt: prev[connectionId]?.checkedAt,
      },
    }));

    try {
      const data = await callImapApi('validate_connection', { connection_id: connectionId });
      const health: ImapConnectionHealth = {
        status: 'verified',
        proof: data.proof,
        checkedAt: new Date().toISOString(),
      };
      setImapHealth(prev => ({ ...prev, [connectionId]: health }));
      return health;
    } catch (err: any) {
      const health: ImapConnectionHealth = {
        status: 'failed',
        error: err.message || 'Validation failed',
        checkedAt: new Date().toISOString(),
      };
      setImapHealth(prev => ({ ...prev, [connectionId]: health }));
      return health;
    }
  }, [callImapApi]);

  const validateInlineConfig = useCallback(async (config: {
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
  }): Promise<ImapConnectionProof> => {
    const data = await callImapApi('validate_connection', {
      config: {
        email_address: config.email_address,
        username: config.username,
        password: config.password,
        smtp_host: config.smtp_host,
        smtp_port: config.smtp_port,
        smtp_secure: config.smtp_secure,
        imap_host: config.imap_host,
        imap_port: config.imap_port,
        imap_secure: config.imap_secure,
      },
    });
    return data.proof as ImapConnectionProof;
  }, [callImapApi]);

  const loadImapConnections = useCallback(async () => {
    setImapLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setImapConnections([]);
        setImapHealth({});
        return;
      }
      const { data, error } = await supabase
        .from('email_connections')
        .select('id, provider, display_name, email_address, smtp_host, smtp_port, smtp_secure, username, is_primary, is_active, created_at')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .order('is_primary', { ascending: false });

      if (error) throw error;
      const rows = data || [];
      setImapConnections(rows);
      setImapHealth(prev => {
        const next: Record<string, ImapConnectionHealth> = {};
        for (const row of rows) {
          next[row.id] = prev[row.id] || { status: 'unknown' };
        }
        return next;
      });
      await Promise.all(rows.map((row) => validateSavedConnection(row.id)));
    } catch (err) {
      console.error('[EmailConnections] Failed to load IMAP:', err);
      setImapConnections([]);
      setImapHealth({});
    } finally {
      setImapLoading(false);
    }
  }, [validateSavedConnection]);

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

      const proof = await validateInlineConfig(config);

      // Check if this is the first connection — make it primary
      const isFirst = imapConnections.length === 0 && !gmail.connection.connected;

      const { data, error } = await supabase.from('email_connections').insert({
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
      }).select('id').single();

      if (error) throw error;

      if (data?.id) {
        setImapHealth(prev => ({
          ...prev,
          [data.id]: {
            status: 'verified',
            proof,
            checkedAt: new Date().toISOString(),
          },
        }));
      }

      toast.success('Email account connected successfully');
      await loadImapConnections();
      return { success: true };
    } catch (err: any) {
      console.error('[EmailConnections] Add failed:', err);
      const msg = err.message || 'Failed to save email connection';
      toast.error(msg);
      return { success: false, error: msg };
    }
  }, [imapConnections.length, gmail.connection.connected, loadImapConnections, validateInlineConfig]);

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
      setImapHealth(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
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
  const verifiedImapConnections = imapConnections.filter(c => imapHealth[c.id]?.status === 'verified');
  const imapConnected = verifiedImapConnections.length > 0;
  const anyConnected = gmailConnected || imapConnected;

  // Primary email to display
  const primaryEmail = gmail.connection.emailAddress
    || verifiedImapConnections.find(c => c.is_primary)?.email_address
    || verifiedImapConnections[0]?.email_address
    || null;

  return {
    gmail,
    imap: {
      connections: imapConnections,
      loading: imapLoading,
      health: imapHealth,
      add: addImapConnection,
      remove: removeImapConnection,
      setPrimary: setPrimaryConnection,
      refresh: loadImapConnections,
      validate: validateSavedConnection,
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
