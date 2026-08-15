import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowUpRight } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="bg-card border-t border-border pt-16 pb-12 transition-colors duration-300">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Column 1: Brand & Tagline */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-3 text-2xl font-extrabold font-display text-foreground hover:opacity-90 transition-opacity">
              <img src="/scholar.jpg" alt="Scholars Resort Logo" className="h-8 w-8 rounded-lg object-cover border border-border shadow-sm" />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-600">Scholars Resort</span>
            </Link>
            <p className="text-foreground/80 text-sm leading-relaxed">
              Nigeria's #1 JAMB UTME & CBT preparation platform. AI-powered tutoring, realistic exam simulations, and deep analytics.
            </p>
            <div className="pt-2 flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4 shrink-0" /> Official JAMB Syllabus Compliant
            </div>
          </div>
          
          {/* Column 2: Platform Links */}
          <div>
            <h4 className="font-bold mb-4 uppercase tracking-wider text-xs text-foreground font-display">Platform</h4>
            <ul className="space-y-3 text-sm">
              <li><Link to="/features" className="text-foreground/80 hover:text-primary font-medium transition-colors">Features & Tools</Link></li>
              <li><Link to="/pricing" className="text-foreground/80 hover:text-primary font-medium transition-colors">Pricing & Plans</Link></li>
              <li><Link to="/login" className="text-foreground/80 hover:text-primary font-medium transition-colors">Student Login</Link></li>
              <li><Link to="/signup" className="text-foreground/80 hover:text-primary font-medium transition-colors">Create Free Account</Link></li>
            </ul>
          </div>
          
          {/* Column 3: Portals & Resources */}
          <div>
            <h4 className="font-bold mb-4 uppercase tracking-wider text-xs text-foreground font-display">Portals & Resources</h4>
            <ul className="space-y-3 text-sm">
              <li><Link to="/guardian-info" className="text-foreground/80 hover:text-primary font-medium transition-colors flex items-center gap-1">Guardian Portal <ArrowUpRight className="w-3 h-3 text-primary" /></Link></li>
              <li><Link to="/career-guide" className="text-foreground/80 hover:text-primary font-medium transition-colors">UTME Career Guide</Link></li>
              <li><Link to="/help" className="text-foreground/80 hover:text-primary font-medium transition-colors">Help Center & FAQs</Link></li>
            </ul>
          </div>
          
          {/* Column 4: Legal & Policies */}
          <div>
            <h4 className="font-bold mb-4 uppercase tracking-wider text-xs text-foreground font-display">Legal & Compliance</h4>
            <ul className="space-y-3 text-sm">
              <li><Link to="/terms" className="text-foreground/90 hover:text-primary font-medium transition-colors">Terms of Service</Link></li>
              <li><Link to="/privacy" className="text-foreground/90 hover:text-primary font-medium transition-colors">Privacy Policy</Link></li>
              <li><Link to="/acceptable-use" className="text-foreground/90 hover:text-primary font-medium transition-colors">Acceptable Use Policy</Link></li>
            </ul>
          </div>
        </div>
        
        {/* Footer Bottom Bar */}
        <div className="border-t border-border pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-foreground/70">
          <p className="font-medium">
            &copy; {new Date().getFullYear()} Scholars Resort Education Ltd. All rights reserved.
          </p>
          <div className="flex items-center gap-4 font-semibold">
            <Link to="/privacy" className="hover:underline">Privacy</Link>
            <span>&bull;</span>
            <Link to="/terms" className="hover:underline">Terms</Link>
            <span>&bull;</span>
            <Link to="/acceptable-use" className="hover:underline">Acceptable Use</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

