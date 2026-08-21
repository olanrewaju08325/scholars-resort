import React from 'react';
import { Sun, Moon, Eye, Monitor } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface AdminThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export const AdminThemeToggle: React.FC<AdminThemeToggleProps> = ({ 
  className = '',
  showLabel = true
}) => {
  const { theme, setTheme } = useTheme();

  const toggleAdminTheme = () => {
    if (theme === 'dark') {
      setTheme('light');
    } else {
      setTheme('dark');
    }
  };

  const isDark = theme === 'dark';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        variant="outline"
        size="sm"
        onClick={toggleAdminTheme}
        className="h-9 px-3 gap-2 rounded-xl bg-card border-border hover:bg-muted text-foreground transition-all shadow-xs"
        aria-label="Toggle Admin High-Visibility Theme"
        title={isDark ? "Switch to Light High-Contrast Canvas" : "Switch to Eye-Safe Dark Canvas"}
      >
        {isDark ? (
          <Moon className="w-4 h-4 text-purple-400 fill-purple-400/20" />
        ) : (
          <Sun className="w-4 h-4 text-amber-500 fill-amber-500/20" />
        )}
        
        {showLabel && (
          <span className="text-xs font-semibold hidden sm:inline-block">
            {isDark ? 'Admin Dark' : 'Admin Light'}
          </span>
        )}

        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-mono font-normal opacity-80">
          <Eye className="w-2.5 h-2.5 mr-0.5" />
          {isDark ? 'Eye-Safe' : 'High-Contrast'}
        </Badge>
      </Button>
    </div>
  );
};
