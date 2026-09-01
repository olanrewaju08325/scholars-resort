import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 transition-colors">
      <div className="container mx-auto px-4 flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold text-foreground hover:opacity-90 transition-opacity">
          <img src="/scholar.jpg" alt="Scholars Resort Logo" className="h-7 w-7 rounded-md object-cover border border-border" />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-600 font-extrabold">Scholars Resort</span>
        </Link>
        
        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-6">
          <Link to="/" className="text-sm font-semibold text-foreground hover:text-primary transition-colors">Home</Link>
          <Link to="/features" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">Features</Link>
          <Link to="/pricing" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
          
          <div className="h-4 w-px bg-border mx-1" />
          
          <ThemeToggle />

          <Button asChild variant="outline" className="font-semibold border-border text-foreground bg-background hover:bg-accent hover:text-accent-foreground">
            <Link to="/login">Log In</Link>
          </Button>
          <Button asChild className="font-semibold shadow-sm">
            <Link to="/signup">Get Started</Link>
          </Button>
        </div>

        {/* Mobile Menu Toggle */}
        <div className="md:hidden flex items-center gap-2">
          <ThemeToggle />
          <button 
            onClick={() => setIsMobileMenuOpen(o => !o)} 
            className="p-2 rounded-lg text-foreground hover:bg-accent transition-colors"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>
      
      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-background p-4 flex flex-col gap-4 absolute w-full shadow-xl z-50">
          <Link to="/" onClick={closeMobileMenu} className="text-sm font-semibold text-foreground py-1">Home</Link>
          <Link to="/features" onClick={closeMobileMenu} className="text-sm font-semibold text-muted-foreground hover:text-foreground py-1">Features</Link>
          <Link to="/pricing" onClick={closeMobileMenu} className="text-sm font-semibold text-muted-foreground hover:text-foreground py-1">Pricing</Link>
          <div className="flex gap-3 pt-4 border-t border-border">
            <Button asChild variant="outline" className="flex-1 font-semibold" onClick={closeMobileMenu}>
              <Link to="/login">Log In</Link>
            </Button>
            <Button asChild className="flex-1 font-semibold" onClick={closeMobileMenu}>
              <Link to="/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;

