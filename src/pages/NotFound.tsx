import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Compass, Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
      <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-8 mx-auto shadow-premium">
        <Compass className="w-12 h-12 text-primary" />
      </div>
      <h1 className="text-8xl font-display font-extrabold text-foreground mb-4">404</h1>
      <h2 className="text-2xl font-bold mb-4 font-display">Page Not Found</h2>
      <p className="text-muted-foreground max-w-md mx-auto mb-10 text-lg">
        The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Button asChild size="lg" className="rounded-xl px-8 shadow-premium h-12">
          <Link to="/dashboard"><Home className="w-5 h-5 mr-2" /> Go to Dashboard</Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="rounded-xl px-8 h-12" onClick={() => window.history.back()}>
          <button><ArrowLeft className="w-5 h-5 mr-2" /> Go Back</button>
        </Button>
      </div>
    </div>
  );
}
