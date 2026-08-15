import React, { useEffect, useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const MobileInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:max-w-md p-4 rounded-xl bg-primary text-primary-foreground shadow-xl border border-primary-foreground/20 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-5">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-white/10">
          <Smartphone className="w-5 h-5 text-white" />
        </div>
        <div>
          <h4 className="font-semibold text-xs">Install CBT Mobile App</h4>
          <p className="text-[11px] text-primary-foreground/80">Offline practice & instant exam loading</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={handleInstall} className="text-xs h-8">
          <Download className="w-3.5 h-3.5 mr-1" /> Install
        </Button>
        <button onClick={() => setShowPrompt(false)} className="text-primary-foreground/70 hover:text-white p-1">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
