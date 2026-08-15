import { supabase } from './supabase';

export const sendNotification = async (userId: string, title: string, message: string, type: 'info' | 'success' | 'warning' = 'info') => {
  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      title,
      message,
      type
    });
    
    if (error) {
      console.error('Failed to send notification:', error);
    }
  } catch (err) {
    console.error('Notification error:', err);
  }
};
