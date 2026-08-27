import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, RotateCw } from 'lucide-react';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const emailParam = searchParams.get('email') || sessionStorage.getItem('scholars_recovery_email') || '';
    const codeParam = searchParams.get('code') || searchParams.get('pin') || '';
    const query = new URLSearchParams();
    if (emailParam) query.set('email', emailParam);
    if (codeParam) query.set('code', codeParam);

    navigate(`/forgot-password?${query.toString()}`, { replace: true });
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="flex items-center gap-3 bg-card border border-border p-6 rounded-2xl shadow-lg">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground">
          <KeyRound className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
            <RotateCw className="w-4 h-4 animate-spin text-primary" /> Redirecting to Verification...
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Opening secure OTP reset screen...</p>
        </div>
      </div>
    </div>
  );
}

