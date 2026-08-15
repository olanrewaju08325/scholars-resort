import { Link } from 'react-router-dom';
import { BookOpen, ShieldCheck } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="bg-card border-t border-border pt-20 pb-10">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          <div>
            <Link to="/" className="flex items-center gap-3 text-2xl font-bold font-display text-primary mb-6">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
                <BookOpen className="w-4 h-4" />
              </div>
              <span>Scholars Resort</span>
            </Link>
            <p className="text-muted-foreground leading-relaxed mb-6">
              The ultimate JAMB UTME preparation platform. AI-powered tutoring, realistic CBT simulations, and deep analytics.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold mb-6 uppercase tracking-wider text-sm">Platform</h4>
            <ul className="space-y-4">
              <li><Link to="/features" className="text-muted-foreground hover:text-primary transition-colors">Features</Link></li>
              <li><Link to="/login" className="text-muted-foreground hover:text-primary transition-colors">Student Login</Link></li>
              <li><Link to="/signup" className="text-muted-foreground hover:text-primary transition-colors">Create Account</Link></li>
              <li><Link to="/pricing" className="text-muted-foreground hover:text-primary transition-colors">Pricing Plans</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold mb-6 uppercase tracking-wider text-sm">Resources</h4>
            <ul className="space-y-4">
              <li><Link to="/guardian" className="text-muted-foreground hover:text-primary transition-colors">Guardian Portal</Link></li>
              <li><Link to="/career-guide" className="text-muted-foreground hover:text-primary transition-colors">Career Guide</Link></li>
              <li><Link to="/help" className="text-muted-foreground hover:text-primary transition-colors">Help Center</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold mb-6 uppercase tracking-wider text-sm">Legal & Company</h4>
            <ul className="space-y-4">
              <li><Link to="/features#about" className="text-muted-foreground hover:text-primary transition-colors">About Us</Link></li>
              <li><Link to="/terms" className="text-muted-foreground hover:text-primary transition-colors">Terms of Service</Link></li>
              <li><Link to="/privacy" className="text-muted-foreground hover:text-primary transition-colors">Privacy Policy</Link></li>
              <li><Link to="/acceptable-use" className="text-muted-foreground hover:text-primary transition-colors">Acceptable Use</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-border pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm">
            &copy; {new Date().getFullYear()} Scholars Resort. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-green-500" /> Secure platform
          </div>
        </div>
      </div>
    </footer>
  );
};
