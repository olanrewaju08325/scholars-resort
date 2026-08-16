import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Delete, RefreshCw, Calculator as CalcIcon } from 'lucide-react';

interface JambCalculatorProps {
  onClose?: () => void;
}

export const JambCalculator = ({ onClose }: JambCalculatorProps) => {
  const [display, setDisplay] = useState('0');
  const [prevVal, setPrevVal] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [resetNext, setResetNext] = useState(false);

  const handleDigit = (digit: string) => {
    if (display === '0' || resetNext) {
      setDisplay(digit);
      setResetNext(false);
    } else {
      if (display.length < 12) {
        setDisplay(display + digit);
      }
    }
  };

  const handleDecimal = () => {
    if (resetNext) {
      setDisplay('0.');
      setResetNext(false);
      return;
    }
    if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setPrevVal(null);
    setOperation(null);
    setResetNext(false);
  };

  const handleBackspace = () => {
    if (resetNext) return;
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  };

  const handleOp = (op: string) => {
    const current = parseFloat(display);
    if (prevVal === null) {
      setPrevVal(current);
    } else if (operation) {
      const result = calculate(prevVal, current, operation);
      setDisplay(String(result));
      setPrevVal(result);
    }
    setOperation(op);
    setResetNext(true);
  };

  const calculate = (a: number, b: number, op: string): number => {
    let res = 0;
    switch (op) {
      case '+': res = a + b; break;
      case '-': res = a - b; break;
      case '*': res = a * b; break;
      case '/': res = b !== 0 ? a / b : 0; break;
      default: res = b;
    }
    return Math.round(res * 1000000) / 1000000;
  };

  const handleEquals = () => {
    if (prevVal !== null && operation) {
      const current = parseFloat(display);
      const res = calculate(prevVal, current, operation);
      setDisplay(String(res));
      setPrevVal(null);
      setOperation(null);
      setResetNext(true);
    }
  };

  const handleSqrt = () => {
    const val = parseFloat(display);
    if (val >= 0) {
      setDisplay(String(Math.round(Math.sqrt(val) * 1000000) / 1000000));
      setResetNext(true);
    } else {
      setDisplay('Error');
      setResetNext(true);
    }
  };

  return (
    <Card className="w-72 bg-slate-900 border-2 border-primary/40 text-white shadow-2xl rounded-2xl overflow-hidden select-none animate-in fade-in zoom-in-95 duration-150">
      {/* Header */}
      <div className="bg-slate-950 px-4 py-3 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <CalcIcon className="w-4 h-4 text-primary" />
          <span className="text-xs font-black uppercase tracking-wider text-slate-200">JAMB 8-Button Calculator</span>
        </div>
        {onClose && (
          <Button size="icon" variant="ghost" onClick={onClose} className="h-6 w-6 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Screen Display */}
      <div className="p-4 bg-slate-950/80">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-right">
          <div className="text-[10px] font-mono text-slate-400 h-4 uppercase tracking-widest">
            {prevVal !== null ? `${prevVal} ${operation || ''}` : ''}
          </div>
          <div className="text-2xl font-black font-mono text-primary tracking-wider overflow-x-auto whitespace-nowrap">
            {display}
          </div>
        </div>
      </div>

      {/* 8-Button Layout (Authentic JAMB Exam Format) */}
      <div className="p-4 pt-1 grid grid-cols-4 gap-2 bg-slate-900">
        <Button onClick={handleClear} variant="destructive" className="font-extrabold text-xs h-10 bg-red-600 hover:bg-red-700 text-white">
          C
        </Button>
        <Button onClick={handleSqrt} className="font-extrabold text-xs h-10 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700">
          √
        </Button>
        <Button onClick={handleBackspace} className="font-extrabold text-xs h-10 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700">
          <Delete className="w-3.5 h-3.5" />
        </Button>
        <Button onClick={() => handleOp('/')} className="font-extrabold text-sm h-10 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30">
          ÷
        </Button>

        <Button onClick={() => handleDigit('7')} className="font-bold text-base h-11 bg-slate-800/80 hover:bg-slate-700 text-white border border-slate-700/60">7</Button>
        <Button onClick={() => handleDigit('8')} className="font-bold text-base h-11 bg-slate-800/80 hover:bg-slate-700 text-white border border-slate-700/60">8</Button>
        <Button onClick={() => handleDigit('9')} className="font-bold text-base h-11 bg-slate-800/80 hover:bg-slate-700 text-white border border-slate-700/60">9</Button>
        <Button onClick={() => handleOp('*')} className="font-extrabold text-sm h-11 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30">×</Button>

        <Button onClick={() => handleDigit('4')} className="font-bold text-base h-11 bg-slate-800/80 hover:bg-slate-700 text-white border border-slate-700/60">4</Button>
        <Button onClick={() => handleDigit('5')} className="font-bold text-base h-11 bg-slate-800/80 hover:bg-slate-700 text-white border border-slate-700/60">5</Button>
        <Button onClick={() => handleDigit('6')} className="font-bold text-base h-11 bg-slate-800/80 hover:bg-slate-700 text-white border border-slate-700/60">6</Button>
        <Button onClick={() => handleOp('-')} className="font-extrabold text-sm h-11 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30">−</Button>

        <Button onClick={() => handleDigit('1')} className="font-bold text-base h-11 bg-slate-800/80 hover:bg-slate-700 text-white border border-slate-700/60">1</Button>
        <Button onClick={() => handleDigit('2')} className="font-bold text-base h-11 bg-slate-800/80 hover:bg-slate-700 text-white border border-slate-700/60">2</Button>
        <Button onClick={() => handleDigit('3')} className="font-bold text-base h-11 bg-slate-800/80 hover:bg-slate-700 text-white border border-slate-700/60">3</Button>
        <Button onClick={() => handleOp('+')} className="font-extrabold text-sm h-11 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30">+</Button>

        <Button onClick={() => handleDigit('0')} className="font-bold text-base h-11 bg-slate-800/80 hover:bg-slate-700 text-white border border-slate-700/60">0</Button>
        <Button onClick={handleDecimal} className="font-bold text-base h-11 bg-slate-800/80 hover:bg-slate-700 text-white border border-slate-700/60">.</Button>
        <Button onClick={handleEquals} className="col-span-2 font-black text-lg h-11 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20">
          =
        </Button>
      </div>
      <div className="px-4 py-2 bg-slate-950 text-[10px] text-center text-slate-400 border-t border-slate-800">
        Authentic JAMB UTME Onscreen Calculator
      </div>
    </Card>
  );
};
