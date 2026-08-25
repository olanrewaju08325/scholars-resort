import React, { useRef, useEffect, useState } from 'react';
import { 
  Pencil, 
  Eraser, 
  Minus, 
  Square, 
  Circle as CircleIcon, 
  Trash2, 
  Download, 
  Type, 
  Palette,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { WhiteboardStroke } from '@/types/studyRoomTypes';

interface WhiteboardCanvasProps {
  strokes: WhiteboardStroke[];
  onAddStroke: (stroke: WhiteboardStroke) => void;
  onClearBoard: () => void;
  userName: string;
}

export const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = ({
  strokes,
  onAddStroke,
  onClearBoard,
  userName
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeTool, setActiveTool] = useState<'pen' | 'line' | 'rect' | 'circle' | 'eraser' | 'text'>('pen');
  const [activeColor, setActiveColor] = useState<string>('#3b82f6');
  const [strokeWidth, setStrokeWidth] = useState<number>(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const [textInputVal, setTextInputVal] = useState('');
  const [showTextInputModal, setShowTextInputModal] = useState(false);
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);

  const colors = [
    '#3b82f6', // Primary Blue
    '#10b981', // Emerald Green
    '#ef4444', // Crimson Red
    '#f59e0b', // Amber
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#ffffff', // White
    '#1e293b'  // Dark Slate
  ];

  // Render canvas strokes whenever strokes prop changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas background
    ctx.fillStyle = '#0f172a'; // Deep slate dark mode canvas
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid background lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const gridSize = 30;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Render all saved strokes
    strokes.forEach((stroke) => {
      ctx.save();
      ctx.strokeStyle = stroke.type === 'eraser' ? '#0f172a' : stroke.color;
      ctx.fillStyle = stroke.color;
      ctx.lineWidth = stroke.type === 'eraser' ? stroke.width * 4 : stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.type === 'pen' || stroke.type === 'eraser') {
        if (stroke.points && stroke.points.length > 0) {
          ctx.beginPath();
          ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
          for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
          }
          ctx.stroke();
        }
      } else if (stroke.type === 'line' && stroke.startPoint && stroke.endPoint) {
        ctx.beginPath();
        ctx.moveTo(stroke.startPoint.x, stroke.startPoint.y);
        ctx.lineTo(stroke.endPoint.x, stroke.endPoint.y);
        ctx.stroke();
      } else if (stroke.type === 'rect' && stroke.startPoint && stroke.endPoint) {
        const w = stroke.endPoint.x - stroke.startPoint.x;
        const h = stroke.endPoint.y - stroke.startPoint.y;
        ctx.strokeRect(stroke.startPoint.x, stroke.startPoint.y, w, h);
      } else if (stroke.type === 'circle' && stroke.startPoint && stroke.endPoint) {
        const radius = Math.hypot(stroke.endPoint.x - stroke.startPoint.x, stroke.endPoint.y - stroke.startPoint.y);
        ctx.beginPath();
        ctx.arc(stroke.startPoint.x, stroke.startPoint.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (stroke.type === 'text' && stroke.startPoint && stroke.text) {
        ctx.font = `${stroke.width * 5 + 14}px sans-serif`;
        ctx.fillText(stroke.text, stroke.startPoint.x, stroke.startPoint.y);
      } else if (stroke.type === 'question_overlay' && stroke.questionData) {
        // Draw UTME Question Card overlay onto canvas
        const q = stroke.questionData;
        const cardX = 40;
        const cardY = 40;
        const cardW = canvas.width - 80;
        const cardH = 220;

        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#3b82f6';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(`SHARED JAMB PRACTICE QUESTION • ${q.subject_name || 'UTME'}`, cardX + 20, cardY + 30);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 15px sans-serif';
        
        // Wrap text
        const words = (q.question_text || '').split(' ');
        let line = '';
        let lineY = cardY + 60;
        words.forEach((word: string) => {
          const testLine = line + word + ' ';
          if (ctx.measureText(testLine).width > cardW - 40) {
            ctx.fillText(line, cardX + 20, lineY);
            line = word + ' ';
            lineY += 24;
          } else {
            line = testLine;
          }
        });
        ctx.fillText(line, cardX + 20, lineY);

        // Draw options
        if (q.options) {
          ctx.font = '13px sans-serif';
          ctx.fillStyle = '#94a3b8';
          let optY = lineY + 30;
          Object.entries(q.options).forEach(([optKey, optVal]) => {
            if (optY < cardY + cardH - 10) {
              ctx.fillText(`${optKey.toUpperCase()}) ${optVal}`, cardX + 20, optY);
              optY += 22;
            }
          });
        }
      }

      ctx.restore();
    });
  }, [strokes]);

  // Handle Canvas Mouse Events
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasCoords(e);
    if (activeTool === 'text') {
      setTextPos(pos);
      setShowTextInputModal(true);
      return;
    }

    setIsDrawing(true);
    setStartPos(pos);
    setCurrentPoints([pos]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const pos = getCanvasCoords(e);
    setCurrentPoints((prev) => [...prev, pos]);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const endPos = getCanvasCoords(e);

    if (!startPos) return;

    let newStroke: WhiteboardStroke | null = null;

    if (activeTool === 'pen' || activeTool === 'eraser') {
      newStroke = {
        id: `stroke_${Date.now()}`,
        type: activeTool === 'eraser' ? 'eraser' : 'pen',
        color: activeColor,
        width: strokeWidth,
        points: currentPoints
      };
    } else if (activeTool === 'line') {
      newStroke = {
        id: `stroke_${Date.now()}`,
        type: 'line',
        color: activeColor,
        width: strokeWidth,
        startPoint: startPos,
        endPoint: endPos
      };
    } else if (activeTool === 'rect') {
      newStroke = {
        id: `stroke_${Date.now()}`,
        type: 'rect',
        color: activeColor,
        width: strokeWidth,
        startPoint: startPos,
        endPoint: endPos
      };
    } else if (activeTool === 'circle') {
      newStroke = {
        id: `stroke_${Date.now()}`,
        type: 'circle',
        color: activeColor,
        width: strokeWidth,
        startPoint: startPos,
        endPoint: endPos
      };
    }

    if (newStroke) {
      onAddStroke(newStroke);
    }

    setStartPos(null);
    setCurrentPoints([]);
  };

  const handleSubmitText = () => {
    if (textPos && textInputVal.trim()) {
      onAddStroke({
        id: `stroke_${Date.now()}`,
        type: 'text',
        color: activeColor,
        width: strokeWidth,
        startPoint: textPos,
        text: textInputVal.trim()
      });
      setTextInputVal('');
      setShowTextInputModal(false);
      setTextPos(null);
    }
  };

  const handleExportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `whiteboard_session_${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Top Toolbar Controls */}
      <div className="p-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-white">
        {/* Tool Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTool('pen')}
            className={`p-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTool === 'pen' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Freehand Pen"
          >
            <Pencil className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTool('line')}
            className={`p-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTool === 'line' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Straight Line"
          >
            <Minus className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTool('rect')}
            className={`p-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTool === 'rect' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Rectangle"
          >
            <Square className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTool('circle')}
            className={`p-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTool === 'circle' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Circle"
          >
            <CircleIcon className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTool('text')}
            className={`p-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTool === 'text' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Text Tool"
          >
            <Type className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTool('eraser')}
            className={`p-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTool === 'eraser' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            title="Eraser"
          >
            <Eraser className="w-4 h-4" />
          </button>
        </div>

        {/* Color Palette */}
        <div className="flex items-center gap-1.5">
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => setActiveColor(c)}
              style={{ backgroundColor: c }}
              className={`w-6 h-6 rounded-full transition-transform border border-slate-700 ${
                activeColor === c ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-950' : 'hover:scale-110'
              }`}
            />
          ))}
        </div>

        {/* Stroke Width Slider & Clear / Export Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Thickness:</span>
            <input
              type="range"
              min="1"
              max="12"
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
              className="w-16 accent-blue-500 cursor-pointer"
            />
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={onClearBoard}
            className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 text-xs font-bold"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear
          </Button>

          <Button
            size="sm"
            onClick={handleExportPNG}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
          >
            <Download className="w-3.5 h-3.5 mr-1" /> Save PNG
          </Button>
        </div>
      </div>

      {/* Main Canvas HTML5 Element */}
      <div className="relative flex-1 bg-slate-900 overflow-hidden cursor-crosshair">
        <canvas
          ref={canvasRef}
          width={1000}
          height={650}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="w-full h-full object-contain"
        />

        {/* Text Input Modal Popup when clicking Text Tool */}
        {showTextInputModal && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-950 border border-slate-800 p-4 rounded-xl shadow-2xl z-20 space-y-3 w-80">
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Type className="w-4 h-4 text-blue-400" /> Add Text to Whiteboard
            </h4>
            <input
              type="text"
              autoFocus
              placeholder="Type equation or notes..."
              value={textInputVal}
              onChange={(e) => setTextInputVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmitText()}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowTextInputModal(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSubmitText} className="bg-blue-600 text-white">
                Place Text
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
