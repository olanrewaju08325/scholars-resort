import { useState, useEffect, useCallback } from 'react';
import { Users, Link2, Trash2, Copy, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { QRCodeDisplay } from '@/components/QRCodeDisplay';

export const GuardianConnections = () => {
  const { profile } = useAuth();
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchLinks = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('guardian_links')
        .select('*')
        .eq('student_id', profile.id)
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        // Enrich guardian profiles safely if guardian_id exists
        const enriched = await Promise.all(data.map(async (link) => {
          if (link.guardian_id) {
            try {
              const { data: gProfile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', link.guardian_id)
                .maybeSingle();
              return { ...link, guardian: gProfile || { full_name: 'Guardian' } };
            } catch {
              return { ...link, guardian: { full_name: 'Guardian' } };
            }
          }
          return link;
        }));
        setLinks(enriched);
      }
    } catch (err) {
      console.warn('[GuardianConnections] Failed to fetch links:', err);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    fetchLinks();
  }, [profile, fetchLinks]);

  const generateLink = async () => {
    if (!profile) return;
    setGenerating(true);
    
    // Generate a secure 8-character alphanumeric code
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now
    
    try {
      const { error } = await supabase.from('guardian_links').insert({
        student_id: profile.id,
        invitation_code: code,
        expires_at: expiresAt.toISOString(),
      });
      
      if (error) throw error;
      
      toast.success("Guardian invitation code generated!");
      fetchLinks();
    } catch (err: any) {
      toast.error("Failed to generate link: " + err.message);
    }
    setGenerating(false);
  };

  const copyToClipboard = (code: string) => {
    const inviteLink = `${window.location.origin}/signup?invite=${code}&role=guardian`;
    navigator.clipboard.writeText(inviteLink);
    setCopiedCode(code);
    toast.success("Invite link copied to clipboard!");
    setTimeout(() => setCopiedCode(null), 3000);
  };

  const shareViaWhatsApp = (code: string) => {
    const inviteLink = `${window.location.origin}/signup?invite=${code}&role=guardian`;
    const text = encodeURIComponent(`Hello! I've invited you to track my JAMB preparation on Scholars Resort. Click this link to accept the invitation and link your account: ${inviteLink}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const shareViaSMS = (code: string) => {
    const inviteLink = `${window.location.origin}/signup?invite=${code}&role=guardian`;
    const text = encodeURIComponent(`Track my JAMB prep on Scholars Resort: ${inviteLink}`);
    window.open(`sms:?body=${text}`, '_self');
  };

  const shareViaTelegram = (code: string) => {
    const inviteLink = `${window.location.origin}/signup?invite=${code}&role=guardian`;
    const text = encodeURIComponent(`Track my JAMB prep on Scholars Resort: ${inviteLink}`);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${text}`, '_blank');
  };

  const revokeLink = async (id: string) => {
    try {
      const { error } = await supabase.from('guardian_links').update({ status: 'revoked' }).eq('id', id);
      if (error) throw error;
      toast.success("Access revoked successfully.");
      fetchLinks();
    } catch (err: any) {
      console.error('Failed to revoke link:', err);
      toast.error("Failed to revoke access.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> Guardian Connections
          </h2>
          <p className="text-muted-foreground">Manage parents or sponsors who can view your academic progress.</p>
        </div>
        <Button onClick={generateLink} disabled={generating} className="gap-2">
          <Link2 className="w-4 h-4" /> {generating ? 'Generating...' : 'Generate New Link'}
        </Button>
      </div>

      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle>Active & Pending Invitations</CardTitle>
          <CardDescription>Share these codes with your guardian so they can link their account to yours.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading connections...</div>
          ) : links.length === 0 ? (
            <div className="text-center py-12 border rounded-lg border-dashed bg-muted/30">
              <Users className="w-12 h-12 text-muted-foreground opacity-50 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Guardians Linked</h3>
              <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                Generate an invitation link and share it with your parent or sponsor so they can track your JAMB readiness.
              </p>
              <Button onClick={generateLink} variant="outline">Generate First Link</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {links.map((link) => (
                <div key={link.id} className="flex flex-col md:flex-row items-center justify-between p-4 border border-border rounded-lg bg-muted/20">
                  <div className="mb-4 md:mb-0 w-full md:w-auto">
                    <div className="flex items-center gap-3 mb-1">
                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                        link.status === 'active' ? 'bg-green-500/20 text-green-500' :
                        link.status === 'pending' ? 'bg-amber-500/20 text-amber-500' :
                        'bg-red-500/20 text-red-500'
                      }`}>
                        {link.status}
                      </span>
                      {link.status === 'active' && link.guardian && (
                        <span className="font-semibold text-foreground">{link.guardian.full_name}</span>
                      )}
                    </div>
                    {link.status === 'pending' && (
                      <p className="text-sm text-muted-foreground">
                        Expires: {new Date(link.expires_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  
                  {link.status === 'pending' && (
                    <div className="flex-shrink-0 mx-4 hidden md:block bg-white p-2 rounded-xl">
                      <QRCodeDisplay value={`${window.location.origin}/signup?invite=${link.invitation_code}&role=guardian`} size={100} />
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                    {link.status === 'pending' && (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="gap-2" onClick={() => copyToClipboard(link.invitation_code)}>
                          {copiedCode === link.invitation_code ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                          {copiedCode === link.invitation_code ? 'Copied' : 'Copy'}
                        </Button>
                        <Button size="sm" variant="outline" className="gap-2 text-green-600 hover:text-green-700 hover:bg-green-500/10 border-green-500/20" onClick={() => shareViaWhatsApp(link.invitation_code)}>
                          WhatsApp
                        </Button>
                        <Button size="sm" variant="outline" className="gap-2 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 border-blue-500/20" onClick={() => shareViaSMS(link.invitation_code)}>
                          SMS
                        </Button>
                        <Button size="sm" variant="outline" className="gap-2 text-sky-500 hover:text-sky-600 hover:bg-sky-500/10 border-sky-500/20" onClick={() => shareViaTelegram(link.invitation_code)}>
                          Telegram
                        </Button>
                      </div>
                    )}
                    
                    {link.status !== 'revoked' && (
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => revokeLink(link.id)} title="Revoke Access">
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
