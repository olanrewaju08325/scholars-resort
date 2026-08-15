import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold">
          <img src="/scholar.jpg" alt="Scholars Resort Logo" className="h-6 w-6 rounded-sm object-cover" />
          <span>Scholars Resort</span>
        </Link>
        
        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-6">
          <Link to="/" className="text-sm font-medium transition-colors hover:text-primary">Home</Link>
          <Link to="/features" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">Features</Link>
          <Link to="/pricing" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">Pricing</Link>
          
          <ThemeToggle />

          <Button asChild variant="outline">
            <Link to="/login">Log In</Link>
          </Button>
          <Button asChild>
            <Link to="/signup">Get Started</Link>
          </Button>
        </div>

        {/* Mobile Menu Toggle */}
        <div className="md:hidden flex items-center gap-2">
          <ThemeToggle />
          <button onClick={() => setIsMobileMenuOpen(o => !o)} className="p-2">
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      
      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-background p-4 flex flex-col gap-4 absolute w-full shadow-lg z-50">
          <Link to="/" onClick={closeMobileMenu} className="text-sm font-medium">Home</Link>
          <Link to="/features" onClick={closeMobileMenu} className="text-sm font-medium text-muted-foreground">Features</Link>
          <Link to="/pricing" onClick={closeMobileMenu} className="text-sm font-medium text-muted-foreground">Pricing</Link>
          <div className="flex gap-4 pt-4 border-t border-border">
            <Button asChild variant="outline" className="flex-1" onClick={closeMobileMenu}>
              <Link to="/login">Log In</Link>
            </Button>
            <Button asChild className="flex-1" onClick={closeMobileMenu}>
              <Link to="/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
