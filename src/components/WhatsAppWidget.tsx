import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export const WhatsAppWidget = () => {
  const location = useLocation();
  const hiddenPaths = ['/cbt', '/exam', '/practice/session', '/tournaments/arena', '/weakness/drill'];
  
  const [whatsappNumber, setWhatsappNumber] = useState('2349032517376');
  const [defaultMessage, setDefaultMessage] = useState('Hello Scholars Resort, I need some assistance.');
  const [isFocusMode, setIsFocusMode] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from('admin_settings').select('setting_value').eq('setting_key', 'whatsapp_support').maybeSingle();
      if (data && data.setting_value) {
        if (data.setting_value.phone) setWhatsappNumber(data.setting_value.phone);
        if (data.setting_value.message) setDefaultMessage(data.setting_value.message);
      }
    };
    fetchSettings();

    const handleFocusMode = (e: any) => {
      setIsFocusMode(!!e.detail?.active);
    };

    window.addEventListener('scholars:focus-mode', handleFocusMode);
    return () => window.removeEventListener('scholars:focus-mode', handleFocusMode);
  }, []);

  const isExamRoute = hiddenPaths.some(p => location.pathname.startsWith(p));

  if (
    isExamRoute ||
    isFocusMode ||
    location.pathname.startsWith('/admin') || 
    location.pathname.includes('scholarresortadmin') ||
    location.pathname.includes('admin')
  ) return null;

  return (
    <div className="fixed bottom-24 right-4 md:bottom-24 md:right-6 z-[80] flex items-end justify-end group pb-[72px] md:pb-0">
      {/* Tooltip */}
      <div className="absolute right-0 bottom-full mb-3 origin-bottom-right scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
        <div className="bg-card text-foreground text-sm font-medium px-4 py-2 rounded-xl shadow-premium border border-border/50 whitespace-nowrap">
          Need Help? Chat with Support
          {/* Arrow */}
          <div className="absolute top-full right-6 -mt-[1px] w-3 h-3 bg-card border-b border-r border-border/50 transform rotate-45" />
        </div>
      </div>

      {/* Button */}
      <a 
        href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(defaultMessage)}`} 
        target="_blank" 
        rel="noreferrer"
        className="w-14 h-14 bg-[#25D366] hover:bg-[#1DA851] rounded-full shadow-premium flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 group-hover:shadow-[0_0_20px_rgba(37,211,102,0.4)]"
        aria-label="Contact Support on WhatsApp"
      >
        <svg 
          className="w-8 h-8 text-white fill-current" 
          viewBox="0 0 24 24" 
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.04 14.69 2 12.04 2ZM12.04 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.16 12.04 20.16C10.66 20.16 9.3 19.8 8.09 19.11L7.81 18.94L4.69 19.76L5.52 16.71L5.32 16.4C4.55 15.17 4.14 13.56 4.14 11.91C4.14 7.37 7.84 3.67 12.04 3.67ZM8.84 6.84C8.65 6.84 8.35 6.91 8.1 7.18C7.85 7.45 7.15 8.1 7.15 9.43C7.15 10.76 8.12 12.04 8.25 12.22C8.39 12.4 10.15 15.12 12.87 16.29C13.52 16.57 14.02 16.73 14.41 16.86C15.07 17.07 15.67 17.04 16.14 16.97C16.67 16.89 17.76 16.31 17.99 15.66C18.22 15.01 18.22 14.46 18.15 14.34C18.08 14.22 17.9 14.15 17.62 14.01C17.34 13.87 15.98 13.2 15.72 13.11C15.47 13.01 15.28 12.97 15.1 13.24C14.91 13.52 14.38 14.15 14.22 14.34C14.06 14.52 13.9 14.55 13.62 14.41C13.34 14.27 12.45 13.98 11.39 13.04C10.57 12.31 10.01 11.4 9.87 11.16C9.73 10.92 9.85 10.79 9.99 10.65C10.12 10.52 10.28 10.31 10.42 10.15C10.56 9.99 10.61 9.87 10.7 9.69C10.79 9.51 10.75 9.35 10.68 9.21C10.61 9.07 10.05 7.7 9.82 7.15C9.59 6.61 9.36 6.69 9.19 6.68C9.03 6.67 8.84 6.84 8.84 6.84Z" />
        </svg>
      </a>
    </div>
  );
};

