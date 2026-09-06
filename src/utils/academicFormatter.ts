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
  const formatted = formula.replace(/([A-Za-z\)])(\d+)/g, '$1_{$2}');
  return `\\mathrm{${formatted}}`;
}

/**
 * Transforms raw algebraic expressions with ^ (like 4a^2-9b^2 or (4a+6b)^2) into valid LaTeX
 */
export function formatRawMathToLatex(expr: string): string {
  let res = expr.trim();
  
  // Replace ^ followed by digit(s) or (parenthesized expression)
  res = res.replace(/\^([0-9a-zA-Z+-]+)/g, '^{$1}');
  res = res.replace(/\^\{([0-9a-zA-Z+-]+)\}/g, '^{$1}');
  
  // Replace simple * with \times
  res = res.replace(/(\d+)\s*\*\s*(\d+)/g, '$1 \\times $2');
  res = res.replace(/(\d+)\s*[xX×]\s*10\^/g, '$1 \\times 10^');
  
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
 * Uses placeholder token substitution to completely prevent HTML tag corruption or regex collisions.
 */
export function processAcademicContent(rawText: string): string {
  if (!rawText) return '';

  let text = String(rawText);
  const renderedSlots: string[] = [];

  const addSlot = (mathLatex: string, display = false): string => {
    const rendered = renderKaTeXToString(mathLatex, display);
    const id = renderedSlots.length;
    renderedSlots.push(rendered);
    return `___SCHOLARS_MATH_SLOT_${id}___`;
  };

  // 1. Explicit LaTeX blocks
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => addSlot(math, true));
  text = text.replace(/\\\[([\s\S]+?)\\\]/g, (_, math) => addSlot(math, true));
  text = text.replace(/\$([^\$\n]+?)\$/g, (_, math) => addSlot(math, false));
  text = text.replace(/\\\(([\s\S]+?)\\\)/g, (_, math) => addSlot(math, false));

  // 2. Pure algebraic options (e.g. "4a+6b", "4a^2-9b^2", "x^2+5x+6")
  const trimmed = text.trim();
  const isPureAlgebraic = /^[0-9a-zA-Z^_/*().,\s+-]+$/.test(trimmed) && 
    /[+*/^-]/.test(trimmed) && 
    !/\b(the|is|of|and|which|what|where|who|when|or|none|all|both)\b/i.test(trimmed);

  if (isPureAlgebraic) {
    const formatted = formatRawMathToLatex(trimmed);
    const token = addSlot(formatted, false);
    return token.replace(/___SCHOLARS_MATH_SLOT_(\d+)___/g, (_, idx) => renderedSlots[Number(idx)] || '');
  }

  // 3. Chemical formulas
  for (const formula of COMMON_CHEM_FORMULAS) {
    if (text.includes(formula)) {
      const chemLatex = formatChemicalFormulaToLatex(formula);
      const token = addSlot(chemLatex, false);
      // Replace standalone word matches
      const escapedFormula = formula.replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      text = text.replace(new RegExp(`\\b${escapedFormula}\\b`, 'g'), token);
    }
  }

  // 4. Inline mathematical clauses (powers, roots, scientific notation, LaTeX macros)
  const mathClauseRegex = /(?:\\(?:frac|sqrt|sum|int|alpha|beta|gamma|theta|pi|omega|lambda|Delta|pm|times|div)(?:\{[^}]*\}|[a-zA-Z0-9\s()_^*+-])+|\(?[0-9a-zA-Z+-]+\)?\^[0-9a-zA-Z+-]+|\d+(?:\.\d+)?\s*[xX×]\s*10\^[-+]?\d+|\b\d+(?:\.\d+)?\s*°[CF]?\b)/g;

  text = text.replace(mathClauseRegex, (match) => {
    // Avoid turning normal short words into math
    if (/^[a-zA-Z]+$/.test(match) && match.length > 2) {
      return match;
    }
    const formattedLatex = formatRawMathToLatex(match);
    return addSlot(formattedLatex, false);
  });

  // 5. Escape remaining HTML around formulas
  let escaped = escapeHtml(text);

  // 6. Substitute rendered KaTeX back into slots
  escaped = escaped.replace(/___SCHOLARS_MATH_SLOT_(\d+)___/g, (_, idx) => renderedSlots[Number(idx)] || '');

  return escaped;
}
