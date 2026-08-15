import React, { useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export const WhatsAppWidget = () => {
  const location = useLocation();
  const hiddenPaths = ['/exam', '/practice/session'];
  
  const [whatsappNumber, setWhatsappNumber] = useState('2349032517376');
  const [defaultMessage, setDefaultMessage] = useState('Hello Scholars Resort, I need some assistance.');

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from('admin_settings').select('setting_value').eq('setting_key', 'whatsapp_support').maybeSingle();
      if (data && data.setting_value) {
        if (data.setting_value.phone) setWhatsappNumber(data.setting_value.phone);
        if (data.setting_value.message) setDefaultMessage(data.setting_value.message);
      }
    };
    fetchSettings();
  }, []);

  if (hiddenPaths.includes(location.pathname) || location.pathname.startsWith('/admin')) return null;

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
        <MessageCircle className="w-7 h-7 text-white fill-white" />
      </a>
    </div>
  );
};
