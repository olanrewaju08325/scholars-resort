import { useState } from 'react';
import { ShieldCheck, Smartphone, Info, RefreshCw, X, CheckCircle2, ChevronRight, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const SingleDeviceNotice = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem('scholars_dismissed_device_notice') === 'true';
    } catch {
      return false;
    }
  });

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem('scholars_dismissed_device_notice', 'true');
    } catch {}
  };

  return (
    <>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-blue-950/40 via-slate-900/80 to-indigo-950/40 border border-blue-800/30 rounded-2xl p-4 shadow-lg backdrop-blur-sm relative overflow-hidden"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 text-blue-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-blue-200">Single-Device Protection Active</h4>
                  <span className="bg-blue-500/10 text-blue-300 text-[10px] px-2 py-0.5 rounded-full border border-blue-500/20 font-medium">
                    1 Account = 1 Device
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Your study profile and UTME mock ranking are securely tied to this active device.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={() => setIsOpen(true)}
                className="text-xs font-semibold text-blue-400 hover:text-blue-300 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition-all flex items-center gap-1"
              >
                <Info className="w-3.5 h-3.5" />
                Device Policy & Switching
              </button>
              <button
                onClick={handleDismiss}
                className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                title="Dismiss banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Educational Modal: Single Device & Session Switching Instructions */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-slate-200"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Single-Device Account Policy</h3>
                    <p className="text-xs text-slate-400">Why and how device security works</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs leading-relaxed text-slate-300">
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm">
                    <Lock className="w-4 h-4" /> Why is my account tied to one device?
                  </div>
                  <p className="text-slate-400">
                    To maintain strict examination integrity for UTME practice tests, prevent fraudulent leaderboard manipulation, and secure your personal study progress, every student account is bound to <strong>one primary hardware device</strong> at a time.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-amber-400" /> How to Switch to a New Device:
                  </h4>

                  <div className="space-y-2.5">
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-800/40 border border-slate-800">
                      <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                      <div>
                        <strong className="text-slate-200">Log in on your new phone or PC:</strong>
                        <p className="text-slate-400 text-[11px] mt-0.5">
                          When you sign into a new device, our security system detects the new session.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-800/40 border border-slate-800">
                      <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                      <div>
                        <strong className="text-slate-200">Click "Request Device Reset":</strong>
                        <p className="text-slate-400 text-[11px] mt-0.5">
                          If you see the Device Security screen on your new device, click the 1-click reset button. Our system reviews and unlocks your new device within 24 hours (or immediately via support).
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-800/40 border border-slate-800">
                      <span className="w-5 h-5 rounded-full bg-green-500/20 text-green-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
                      <div>
                        <strong className="text-slate-200">Seamlessly continue studying:</strong>
                        <p className="text-slate-400 text-[11px] mt-0.5">
                          Once approved, your coins, XP, UTME subjects, notes, and study streaks continue exactly where you left off.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-blue-950/30 border border-blue-800/40 rounded-xl text-blue-300 text-[11px]">
                  <strong>Need immediate assistance?</strong> Reach out via the in-app chat or email support at <code>support@scholarsresort.com</code>.
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                >
                  Got It, Continue Studying
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
