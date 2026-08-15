import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Medal, Search, Loader2, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

const Leaderboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [boardData, setBoardData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        // We'll aggregate exam sessions per user and get their top score
        // Or aggregate total score. For JAMB CBT, usually highest score per student is best.
        
        // Fetch all submitted exams
        const { data: exams } = await supabase
          .from('exam_sessions')
          .select('user_id, score, total_questions, profiles(full_name)')
          .eq('status', 'submitted');
          
        if (exams) {
          const userBestScores = new Map();
          
          exams.forEach(exam => {
            const currentBest = userBestScores.get(exam.user_id)?.score || 0;
            const scorePercentage = Math.round(((exam.score || 0) / (exam.total_questions || 1)) * 400); // Out of 400
            
            if (scorePercentage > currentBest) {
              // Anonymize name: "Olamide Olanrewaju" -> "Olamide O."
              const nameParts = ((exam.profiles as any)?.full_name || 'Unknown Student').split(' ');
              const anonName = nameParts.length > 1 
                ? `${nameParts[0]} ${nameParts[1].charAt(0)}.`
                : nameParts[0];

              userBestScores.set(exam.user_id, {
                id: exam.user_id,
                name: anonName,
                score: scorePercentage
              });
            }
          });
          
          const sortedBoard = Array.from(userBestScores.values())
            .sort((a, b) => b.score - a.score)
            .map((student, i) => ({
              ...student,
              rank: i + 1,
              prize: i === 0 ? '₦5,000 Recharge Card' : i === 1 ? '₦3,000 Recharge Card' : i === 2 ? '₦1,000 Recharge Card' : null
            }));
            
          setBoardData(sortedBoard);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchLeaderboard();
  }, []);

  const filteredBoard = boardData.filter(student => 
    student.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
        <Link to="/dashboard" className="flex items-center gap-2 text-xl font-bold font-display">
          <img src="/scholar.jpg" alt="Scholars Resort Logo" className="h-6 w-6 rounded-sm object-cover" />
          <span>Scholars Resort</span>
        </Link>
        <Button variant="ghost" asChild>
          <Link to="/dashboard" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
        </Button>
      </header>

      <main className="flex-1 p-6 md:p-10 max-w-4xl mx-auto w-full">
        <div className="mb-10 text-center">
          <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(245,158,11,0.2)]">
            <Trophy className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-display font-bold mb-4">Global Leaderboard</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
            Top performers from the latest Mock Exams. Names are anonymized for privacy.
          </p>
        </div>

        <div className="relative max-w-md mx-auto mb-10">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Card className="border-border bg-card/40">
          <CardHeader className="bg-muted/30 border-b border-border py-4">
            <div className="grid grid-cols-12 gap-4 text-sm font-semibold text-muted-foreground">
              <div className="col-span-2 text-center">Rank</div>
              <div className="col-span-6">Student</div>
              <div className="col-span-4 text-right">Highest Score</div>
            </div>
          </CardHeader>
          <CardContent className="p-0 min-h-[300px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                <p>Loading Leaderboard...</p>
              </div>
            ) : filteredBoard.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No students found.</div>
            ) : (
              <div className="divide-y divide-border">
                {filteredBoard.map((student) => (
                  <div 
                    key={student.id} 
                    className={`grid grid-cols-12 gap-4 items-center p-4 transition-colors hover:bg-muted/30 ${
                      student.rank <= 3 ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="col-span-2 flex justify-center">
                      {student.rank === 1 ? (
                        <Medal className="h-6 w-6 text-yellow-500" />
                      ) : student.rank === 2 ? (
                        <Medal className="h-6 w-6 text-gray-400" />
                      ) : student.rank === 3 ? (
                        <Medal className="h-6 w-6 text-amber-700" />
                      ) : (
                        <span className="font-mono font-bold text-muted-foreground">#{student.rank}</span>
                      )}
                    </div>
                    
                    <div className="col-span-6 flex flex-col">
                      <span className="font-bold text-foreground">{student.name}</span>
                      {student.prize && (
                        <span className="text-xs text-amber-500 font-medium mt-0.5 flex items-center gap-1">
                          <Trophy className="h-3 w-3" /> {student.prize}
                        </span>
                      )}
                    </div>

                    <div className="col-span-4 text-right font-display font-bold text-lg text-primary">
                      {student.score}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Leaderboard;
