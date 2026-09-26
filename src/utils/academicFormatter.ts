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
 * Converts a raw chemical formula string like H2SO4 or Ca(OH)2 or Fe2(SO4)3 to LaTeX \mathrm{...}
 */
export function formatChemicalFormulaToLatex(formula: string): string {
  // Convert numbers after elements or closing parens to subscripts
  let formatted = formula.replace(/([A-Za-z)])(\d+)/g, '$1_{$2}');
  // Handle charges like 2+, 3+, 2-, +, -
  formatted = formatted.replace(/\^?(\d*[+-])/g, '^{$1}');
  return `\\mathrm{${formatted}}`;
}

/**
 * Sanitizes and repairs common LaTeX/OCR mathematical formatting errors:
 * - Fixes double superscripts like a^{2v}^{2} -> {a^{2v}}^{2}
 * - Fixes double subscripts like x_{1}_{2} -> {x_1}_2
 * - Strips all OCR notes, disclaimers, and verify notices (e.g. [Note: computed value is...])
 * - Converts "cube root of [X]" -> \sqrt[3]{X}
 * - Converts "square root of [X]" -> \sqrt{X}
 * - Converts raw "sqrt(c)" -> \sqrt{c}
 */
export function sanitizeAndRepairMathLatex(expr: string): string {
  if (!expr) return '';
  let s = String(expr).trim();

  // Strip all bracketed/parenthesized notes, disclaimers, verify notices from OCR or scrape databases
  s = s.replace(/\[\s*(?:Note|note|NOTE|verify|Verify|VERIFY|Source|source|Answer|Comment|Disclaim|disclaimer)[^\]]*\]/gi, '');
  s = s.replace(/\(\s*(?:Note|note|NOTE|verify|Verify|VERIFY|Source|source)[^\)]*\)/gi, '');
  s = s.replace(/\[\s*verify\s*\]/gi, '');

  // Fix glued words from bad OCR/AI generation (e.g., correcttotwodecimalplaces -> correct to two decimal places)
  s = s
    .replace(/correcttotwodecimalplaces/gi, 'correct to two decimal places')
    .replace(/decimalplaces/gi, 'decimal places')
    .replace(/Find,/gi, 'Find, ')
    .replace(/([a-z])([A-Z])/g, '$1 $2');

  // Convert arrows in chemical or physics reactions
  s = s.replace(/\s*(?:->|-->|\\rightarrow)\s*/g, ' \\rightarrow ');
  s = s.replace(/\s*(?:<=>|<==>|\\rightleftharpoons)\s*/g, ' \\rightleftharpoons ');

  // Convert roots in natural language
  s = s.replace(/cube\s+root\s+of\s+\[([^\]]+)\]/gi, '\\sqrt[3]{$1}');
  s = s.replace(/cube\s+root\s+of\s+\(([^)]+)\)/gi, '\\sqrt[3]{$1}');
  s = s.replace(/square\s+root\s+of\s+\[([^\]]+)\]/gi, '\\sqrt{$1}');
  s = s.replace(/square\s+root\s+of\s+\(([^)]+)\)/gi, '\\sqrt{$1}');
  s = s.replace(/nth\s+root\s+of\s+\[([^\]]+)\]/gi, '\\sqrt[n]{$1}');

  // Convert sqrt(c) or sqrt{c} or sqrt x
  s = s.replace(/\bsqrt\s*\(([^)]+)\)/gi, '\\sqrt{$1}');
  s = s.replace(/\bsqrt\s*\{([^}]+)\}/gi, '\\sqrt{$1}');
  s = s.replace(/\bsqrt\s+([a-zA-Z0-9]+)/gi, '\\sqrt{$1}');

  // Fix consecutive/nested superscripts like a^{2v}^{2} or a^{4v}^3 -> {a^{2v}}^{2}
  for (let i = 0; i < 4; i++) {
    s = s.replace(/([a-zA-Z0-9\)\}\]]+)\^\{([^}]+)\}\^\{([^}]+)\}/g, '{$1^{$2}}^{$3}');
    s = s.replace(/([a-zA-Z0-9\)\}\]]+)\^\{([^}]+)\}\^([0-9a-zA-Z]+)/g, '{$1^{$2}}^{$3}');
    s = s.replace(/([a-zA-Z0-9\)\}\]]+)\^([0-9a-zA-Z]+)\^\{([^}]+)\}/g, '{$1^{$2}}^{$3}');
    s = s.replace(/([a-zA-Z0-9\)\}\]]+)\^([0-9a-zA-Z]+)\^([0-9a-zA-Z]+)/g, '{$1^{$2}}^{$3}');
  }

  // Fix consecutive subscripts like x_{1}_{2} -> {x_1}_2
  for (let i = 0; i < 4; i++) {
    s = s.replace(/([a-zA-Z0-9\)\}\]]+)_\{([^}]+)\}_\{([^}]+)\}/g, '{$1_{$2}}_{$3}');
    s = s.replace(/([a-zA-Z0-9\)\}\]]+)_([0-9a-zA-Z]+)_([0-9a-zA-Z]+)/g, '{$1_{$2}}_{$3}');
  }

  return s;
}

/**
 * Transforms raw algebraic expressions with ^ (like 4a^2-9b^2 or (4a+6b)^2 or (a^3-b^3-sqrt(c))/(b-1-c)) into valid KaTeX LaTeX
 */
export function formatRawMathToLatex(expr: string): string {
  let res = sanitizeAndRepairMathLatex(expr);
  
  // Handle caret exponents safely:
  // 1. Parenthesized exponent: ^(x+1) -> ^{x+1}
  res = res.replace(/\^\(([^)]+)\)/g, '^{$1}');
  // 2. Single token or negative number: ^3, ^2, ^n, ^-1, ^-2 -> ^{3}, etc.
  res = res.replace(/\^(-?\d+|[a-zA-Z])/g, '^{$1}');

  // Convert parenthesized division fractions: (A) / (B) or (A)/(B) -> \frac{A}{B}
  res = res.replace(/\(\s*([^\/()]+(?:\([^()]+\)[^\/()]*)*)\s*\)\s*\/\s*\(\s*([^\/()]+(?:\([^()]+\)[^\/()]*)*)\s*\)/g, (_, p1, p2) => {
    return `\\frac{${p1.trim()}}{${p2.trim()}}`;
  });
  
  // Replace simple * with \times
  res = res.replace(/(\d+)\s*\*\s*(\d+)/g, '$1 \\times $2');
  res = res.replace(/(\d+)\s*[xX×]\s*10\^/g, '$1 \\times 10^');
  
  // Replace sqrt(...) if any remaining
  res = res.replace(/\bsqrt\(([^)]+)\)/gi, '\\sqrt{$1}');
  
  // Replace degrees like 30° -> 30^\circ
  res = res.replace(/(\d+)\s*°([CF]?)/gi, (_, deg, unit) => {
    return unit ? `${deg}^{\\circ}\\text{${unit}}` : `${deg}^{\\circ}`;
  });

  // Repair again after replacements
  res = sanitizeAndRepairMathLatex(res);

  return res;
}

/**
 * Renders a single math string using KaTeX safely
 */
export function renderKaTeXToString(math: string, displayMode = false): string {
  try {
    let cleanMath = sanitizeAndRepairMathLatex(math.trim());
    
    // Fix unescaped greek letters or common symbols
    cleanMath = cleanMath
      .replace(/(?<!\\)\b(alpha|beta|gamma|theta|lambda|pi|mu|omega|sigma|Delta|Omega|Phi)\b/g, '\\$1')
      .replace(/(?<!\\)\b(approx|neq|le|ge|pm|times|div|rightarrow|leftarrow)\b/g, '\\$1');

    const result = katex.renderToString(cleanMath, {
      displayMode,
      throwOnError: false,
      output: 'htmlAndMathml'
    });

    // If KaTeX still output a parse error markup, fallback gracefully to clean styled typography
    if (result.includes('katex-error')) {
      const fallbackClean = cleanMath.replace(/[{}/\\]/g, '');
      return `<span class="katex-fallback font-mono text-sm tracking-wide">${escapeHtml(fallbackClean)}</span>`;
    }

    return result;
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
 * un-delimited mathematical expressions (4a^2-9b^2), physics units & variables,
 * chemistry reaction arrows & molecular formulas, and biology nomenclature.
 * Uses placeholder token substitution to completely prevent HTML tag corruption or regex collisions.
 */
export function processAcademicContent(rawText: string, subjectHint?: string): string {
  if (!rawText) return '';

  let text = sanitizeAndRepairMathLatex(String(rawText));
  const renderedSlots: string[] = [];

  const addSlot = (mathLatex: string, display = false): string => {
    const rendered = renderKaTeXToString(mathLatex, display);
    const id = renderedSlots.length;
    renderedSlots.push(rendered);
    return `___SCHOLARS_MATH_SLOT_${id}___`;
  };

  const normSub = subjectHint ? subjectHint.toLowerCase() : '';

  // 1. Explicit LaTeX blocks ($$...$$, \[...\], $...$, \(...\))
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => addSlot(math, true));
  text = text.replace(/\\\[([\s\S]+?)\\\]/g, (_, math) => addSlot(math, true));
  text = text.replace(/\$([^\$\n]+?)\$/g, (_, math) => addSlot(math, false));
  text = text.replace(/\\\(([\s\S]+?)\\\)/g, (_, math) => addSlot(math, false));

  // 2. Pure algebraic options (e.g. "4a+6b", "4a^2-9b^2", "x^2+5x+6", "1/2 mv^2") - strict check
  const trimmed = text.trim();
  const englishWordCount = (trimmed.match(/\b[a-zA-Z]{3,}\b/g) || []).length;
  const isPureAlgebraic = englishWordCount <= 1 && 
    /^[0-9a-zA-Z^_/*().,\s+-]+$/.test(trimmed) && 
    /[+*/^-]/.test(trimmed) && 
    !/\b(the|is|of|and|which|what|where|who|when|or|none|all|both|because|since|when|with|find|correct|decimal|places|state|define|calculate|explain)\b/i.test(trimmed);

  if (isPureAlgebraic) {
    const formatted = formatRawMathToLatex(trimmed);
    const token = addSlot(formatted, false);
    return token.replace(/___SCHOLARS_MATH_SLOT_(\d+)___/g, (_, idx) => renderedSlots[Number(idx)] || '');
  }

  // 3. Chemistry specific enhancements (Reaction equations, reversible arrows, ions, equilibrium)
  if (!normSub || normSub.includes('chem') || normSub.includes('science')) {
    for (const formula of COMMON_CHEM_FORMULAS) {
      if (text.includes(formula)) {
        const chemLatex = formatChemicalFormulaToLatex(formula);
        const token = addSlot(chemLatex, false);
        const escapedFormula = formula.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        text = text.replace(new RegExp(`(?<=^|[^a-zA-Z0-9])${escapedFormula}(?=[^a-zA-Z0-9]|$)`, 'g'), token);
      }
    }

    // Convert ions like Ca2+, SO4 2-, Fe3+, OH-, Na+, Cl-
    text = text.replace(/\b([A-Z][a-z]?(?:\d+)?)\s*(\d*[+-])\b/g, (match, elem, charge) => {
      return addSlot(`\\mathrm{${elem}^{${charge}}}`, false);
    });

    // Format reversible arrows or state symbols (aq), (s), (g), (l)
    text = text.replace(/\((aq|s|g|l)\)/gi, '_{( $1 )}');
  }

  // 4. Physics specific enhancements (Ohms, micro-units, velocities, accelerations)
  if (!normSub || normSub.includes('phys') || normSub.includes('math') || normSub.includes('further')) {
    // Format units like m/s^2, kg*m/s, rad/s
    text = text.replace(/\b(\d+(?:\.\d+)?)\s*(m\/s\^2|ms\^-2|m\/s|ms\^-1|kg\/m\^3|N\/m\^2|N\/m|J\/s|W\/m\^2)\b/gi, (_, val, unit) => {
      const formattedUnit = unit.replace(/\^2/g, '^{2}').replace(/\^-1/g, '^{-1}').replace(/\^-2/g, '^{-2}').replace(/\^3/g, '^{3}');
      return addSlot(`${val}\\text{ ${formattedUnit}}`, false);
    });

    // Format micro Farads, micro Coulombs, Ohms, Volts, Amperes (e.g. 50uF, 20 uC, 100 ohms, 100 \Omega)
    text = text.replace(/\b(\d+(?:\.\d+)?)\s*(uF|uC|mA|kV|MHz|kHz|GHz|ohms?|k\u03A9|M\u03A9|\u03A9)\b/gi, (_, val, unit) => {
      let latexUnit = unit;
      if (unit.toLowerCase().startsWith('ohm') || unit === 'Ω') latexUnit = '\\Omega';
      if (unit === 'uF') latexUnit = '\\mu\\text{F}';
      if (unit === 'uC') latexUnit = '\\mu\\text{C}';
      return addSlot(`${val}\\text{ }${latexUnit}`, false);
    });
  }

  // 5. Inline mathematical clauses (powers, roots, division fractions, scientific notation, LaTeX macros)
  const mathClauseRegex = /(?:\\(?:frac|sqrt|sum|int|alpha|beta|gamma|theta|pi|omega|lambda|Delta|pm|times|div)(?:\{[^}]*\}|[a-zA-Z0-9\s()_^*+-])+|\(\s*[a-zA-Z0-9\s()_^*+-\/\\^{}]+\s*\)\s*\/\s*\(\s*[a-zA-Z0-9\s()_^*+-\/\\^{}]+\s*\)|\(?[0-9a-zA-Z+-]+\)?\^[0-9a-zA-Z+-]+|\bsqrt\s*\([^)]+\)|\d+(?:\.\d+)?\s*[xX×]\s*10\^[-+]?\d+|\b\d+(?:\.\d+)?\s*°[CF]?\b)/g;

  text = text.replace(mathClauseRegex, (match) => {
    // Avoid turning normal short words into math
    if (/^[a-zA-Z]+$/.test(match) && match.length > 2) {
      return match;
    }
    const formattedLatex = formatRawMathToLatex(match);
    return addSlot(formattedLatex, false);
  });

  // 6. Escape remaining HTML around formulas
  let escaped = escapeHtml(text);

  // 7. Substitute rendered KaTeX back into slots
  escaped = escaped.replace(/___SCHOLARS_MATH_SLOT_(\d+)___/g, (_, idx) => renderedSlots[Number(idx)] || '');

  return escaped;
}
