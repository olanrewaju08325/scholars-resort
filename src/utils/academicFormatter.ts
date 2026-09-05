import katex from 'katex';

/**
 * Academic & Mathematical Text Formatter for Nigerian UTME / CBT questions.
 * Intelligently identifies LaTeX, raw algebraic powers (e.g. 4a^2-9b^2),
 * chemistry formulas (H2SO4, CaCO3), physics equations, and renders them
 * with crisp KaTeX typography.
 */

// Known common chemical compound formulas to auto-format with proper subscripts
const COMMON_CHEM_FORMULAS = [
  'H2SO4', 'H2SO3', 'HNO3', 'HNO2', 'H3PO4', 'HCl', 'HBr', 'HI', 'HF',
  'NaOH', 'KOH', 'Ca(OH)2', 'Mg(OH)2', 'Al(OH)3', 'NH4OH', 'Fe(OH)3',
  'CaCO3', 'NaHCO3', 'Na2CO3', 'K2CO3', 'MgCO3', 'BaCO3',
  'CO2', 'CO', 'SO2', 'SO3', 'NO2', 'N2O', 'NO', 'P4O10', 'P2O5',
  'H2O', 'H2O2', 'NH3', 'CH4', 'C2H6', 'C2H4', 'C2H2', 'C3H8', 'C4H10', 'C6H6', 'C2H5OH', 'CH3COOH', 'CH3OH',
  'NaCl', 'KCl', 'CaCl2', 'MgCl2', 'AlCl3', 'FeCl2', 'FeCl3', 'CuCl2', 'ZnCl2', 'AgCl', 'BaCl2',
  'CuSO4', 'FeSO4', 'Fe2(SO4)3', 'MgSO4', 'ZnSO4', 'Na2SO4', 'K2SO4', 'Al2(SO4)3', 'PbSO4',
  'AgNO3', 'Cu(NO3)2', 'Pb(NO3)2', 'NaNO3', 'KNO3', 'Ca(NO3)2',
  'KMnO4', 'K2Cr2O7', 'K2CrO4', 'MnO2', 'Fe2O3', 'Fe3O4', 'FeO', 'CuO', 'Cu2O', 'ZnO', 'Al2O3', 'PbO', 'PbO2'
];

/**
 * Converts a raw chemical formula string like H2SO4 to LaTeX \mathrm{H_2SO_4}
 */
export function formatChemicalFormulaToLatex(formula: string): string {
  // Replace numbers following elements with subscripts
  const formatted = formula.replace(/([A-Za-z\)])(\d+)/g, '$1_{$2}');
  return `\\mathrm{${formatted}}`;
}

/**
 * Transforms raw algebraic expressions with ^ (like 4a^2-9b^2 or (4a+6b)^2) into valid LaTeX
 */
export function formatRawMathToLatex(expr: string): string {
  let res = expr.trim();
  
  // Replace ^ followed by digit(s) or (parenthesized expression)
  res = res.replace(/\^([0-9a-zA-Z\+\-]+)/g, '^{$1}');
  res = res.replace(/\^\{([0-9a-zA-Z\+\-]+)\}/g, '^{$1}');
  
  // Replace simple * with \times or \cdot
  res = res.replace(/(\d+)\s*\*\s*(\d+)/g, '$1 \\times $2');
  res = res.replace(/(\d+)\s*[xX]\s*10\^/g, '$1 \\times 10^');
  
  // Replace sqrt(...) with \sqrt{...}
  res = res.replace(/sqrt\(([^)]+)\)/gi, '\\sqrt{$1}');
  
  // Replace degrees like 30° -> 30^\circ
  res = res.replace(/(\d+)\s*°([CF]?)/gi, (_, deg, unit) => {
    return unit ? `${deg}^{\\circ}\\text{${unit}}` : `${deg}^{\\circ}`;
  });

  return res;
}

/**
 * Renders a single math string using KaTeX safely
 */
export function renderKaTeXToString(math: string, displayMode = false): string {
  try {
    let cleanMath = math.trim();
    
    // Fix unescaped greek letters or common symbols
    cleanMath = cleanMath
      .replace(/(?<!\\)\b(alpha|beta|gamma|theta|lambda|pi|mu|omega|sigma|Delta|Omega|Phi)\b/g, '\\$1')
      .replace(/(?<!\\)\b(approx|neq|le|ge|pm|times|div|rightarrow|leftarrow)\b/g, '\\$1');

    return katex.renderToString(cleanMath, {
      displayMode,
      throwOnError: false,
      output: 'htmlAndMathml'
    });
  } catch (err) {
    console.warn('KaTeX render error fallback:', err);
    return `<span class="katex-fallback font-mono text-sm">${escapeHtml(math)}</span>`;
  }
}

export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Universal Academic Text Parser:
 * Processes rich text containing natural English, explicit LaTeX ($...$, $$...$$),
 * un-delimited mathematical expressions (4a^2-9b^2), and chemical formulas.
 */
export function processAcademicContent(rawText: string): string {
  if (!rawText) return '';

  let text = String(rawText);

  // 1. If text already has LaTeX delimiters, process standard LaTeX blocks
  const latexDelimiterRegex = /(\$\$[\s\S]+?\$\$|\$[^\$]+?\$|\\\[[\s\S]+?\\\]|\\\([^\)]+?\\\))/g;
  
  if (latexDelimiterRegex.test(text)) {
    const parts = text.split(latexDelimiterRegex);
    return parts.map(part => {
      if (!part) return '';
      if (part.startsWith('$$') && part.endsWith('$$')) {
        return renderKaTeXToString(part.slice(2, -2), true);
      }
      if (part.startsWith('$') && part.endsWith('$')) {
        return renderKaTeXToString(part.slice(1, -1), false);
      }
      if (part.startsWith('\\[') && part.endsWith('\\]')) {
        return renderKaTeXToString(part.slice(2, -2), true);
      }
      if (part.startsWith('\\(') && part.endsWith('\\)')) {
        return renderKaTeXToString(part.slice(2, -2), false);
      }
      // Process remaining non-delimited text for chemistry & powers
      return processUnDelimitedFormulas(part);
    }).join('');
  }

  // 2. No explicit delimiters present: auto-detect and format math / chemistry segments
  return processUnDelimitedFormulas(text);
}

/**
 * Auto-detects and formats formulas in natural text
 */
function processUnDelimitedFormulas(text: string): string {
  if (!text) return '';

  let result = text;

  // 1. First, check if the ENTIRE text is a standalone algebraic expression (e.g. in option buttons like "4a+6b", "2a+3b", "4a^2-9b^2")
  const trimmed = text.trim();
  const isPureAlgebraicOption = /^[0-9a-zA-Z\^_\+\-\*\/\(\)\s\.,]+$/.test(trimmed) && 
    /[\+\-\*\/\^]/.test(trimmed) && 
    !/\b(the|is|of|and|which|what|where|who|when|or|none|all|both)\b/i.test(trimmed);

  if (isPureAlgebraicOption) {
    // Format entire string as KaTeX math
    const latexExpr = formatRawMathToLatex(trimmed);
    return renderKaTeXToString(latexExpr, false);
  }

  // Check for options with annotations like "2a-3b (or: none)"
  const annotatedMatch = trimmed.match(/^([0-9a-zA-Z\^_\+\-\*\/\(\)\s]+)(\s*\(.*?\))$/);
  if (annotatedMatch && /[\+\-\*\/\^]/.test(annotatedMatch[1])) {
    const mathPart = renderKaTeXToString(formatRawMathToLatex(annotatedMatch[1].trim()), false);
    const textPart = escapeHtml(annotatedMatch[2]);
    return `${mathPart} ${textPart}`;
  }

  // 2. Identify chemical formulas in text and wrap them in KaTeX \mathrm{...}
  for (const formula of COMMON_CHEM_FORMULAS) {
    // Escape parens for regex
    const escapedFormula = formula.replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    const chemRegex = new RegExp(`\\b${escapedFormula}\\b`, 'g');
    if (chemRegex.test(result)) {
      const chemLatex = formatChemicalFormulaToLatex(formula);
      const renderedChem = renderKaTeXToString(chemLatex, false);
      result = result.replace(chemRegex, `___CHEM_${formula}___`);
      result = result.replace(new RegExp(`___CHEM_${escapedFormula}___`, 'g'), renderedChem);
    }
  }

  // 3. Match inline mathematical expressions with powers, roots, or algebraic operators
  // e.g. "4a^2-9b^2", "a^3+27b^3", "(4a+6b)^2", "x^2 + 5x + 6", "10^-3", "m/s^2", "cm^3"
  // Tokenize words/clauses:
  const mathClauseRegex = /((?:\(?[0-9a-zA-Z]+(?:\^[0-9a-zA-Z\+\-]+|\_[0-9a-zA-Z]+)?(?:\s*[\+\-\*\/=]\s*\(?[0-9a-zA-Z]+(?:\^[0-9a-zA-Z\+\-]+|\_[0-9a-zA-Z]+)?\)?)+|\(?[0-9a-zA-Z\+\-]+\)\^[0-9a-zA-Z]+|[0-9a-zA-Z]+\^[0-9a-zA-Z\+\-]+|\d+\s*[xX×]\s*10\^[\-+]?\d+|\b\d+\s*°[CF]?\b|\\(?:frac|sqrt|sum|int|alpha|beta|gamma|theta|pi|omega|lambda|Delta|pm|times|div)[a-zA-Z0-9\{\}\\\s\+\-\*\/\^_\(\)]+)/g;

  result = result.replace(mathClauseRegex, (match) => {
    // Avoid formatting plain English words that happen to match simple letters
    if (/^[a-zA-Z]+$/.test(match) && match.length > 2) {
      return escapeHtml(match);
    }
    const formattedLatex = formatRawMathToLatex(match);
    return renderKaTeXToString(formattedLatex, false);
  });

  return escapeHtmlPreservingKaTeX(result);
}

/**
 * Escapes HTML while preserving KaTeX DOM elements (<span class="katex">...</span>)
 */
function escapeHtmlPreservingKaTeX(htmlWithKaTeX: string): string {
  // If string contains katex spans, split by katex tags
  if (htmlWithKaTeX.includes('<span class="katex') || htmlWithKaTeX.includes('<span class="katex-fallback')) {
    const parts = htmlWithKaTeX.split(/(<span class="katex[\s\S]*?<\/span>|<span class="katex-fallback[\s\S]*?<\/span>)/g);
    return parts.map(part => {
      if (part.startsWith('<span class="katex')) {
        return part; // keep raw KaTeX HTML
      }
      return escapeHtml(part);
    }).join('');
  }

  return escapeHtml(htmlWithKaTeX);
}
