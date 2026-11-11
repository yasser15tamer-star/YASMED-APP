// Arabic text normalization and fuzzy matching for product comparison.

const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

function normalizeArabic(text: string): string {
  return text
    .replace(/[٠-٩]/g, d => String(ARABIC_INDIC_DIGITS.indexOf(d)))
    .replace(/[۰-۹]/g, d => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\u0640/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

function removePunctuation(text: string): string {
  return text.replace(/[.,/#!$%^&*;:{}=\-_`~()'"«»+\[\]|?\\@]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Packaging and price info that is not part of the product identity (pack counts, carton codes, per-piece prices)
function stripPackagingNoise(text: string): string {
  return text
    .replace(/(باكو|باكت|باكيت|بكو|كرتونه|كرتون)\s*\d+/g, ' ')
    .replace(/\d+\s*س\s*\d+\s*ج(?=\s|$)/g, ' ')
    .replace(/س\s*\d+\s*ج(?=\s|$)/g, ' ')
    .replace(/#\s*\d+(\.\d+)?\s*جنيه/g, ' ');
}

const STOP_WORDS = new Set(
  [
    'في', 'من', 'على', 'عن', 'مع', 'الى', 'او',
    'السعر', 'سعر', 'جديد', 'جنيه', 'ج', 'م', 'ر', 'شرايط', 'شرط', 'اقراص', 'قرص',
    'علبه', 'علب', 'كرتون', 'كرتونه', 'قطعه', 'حبه', 'عبوه', 'باكو', 'باكت', 'باكيت',
    'the', 'a', 'an', 'and', 'or', 'of', 'for', 'with', 'in', 'on',
    'price', 'egp', 'eg', 'le', 'box', 'boxes', 'carton', 'pack',
  ].map(normalizeArabic)
);

// Spelling variants used across supplier sheets for the same word (keys and values are normalized)
const TOKEN_VARIANTS: Record<string, string> = {
  'فلتر': 'فلتر',
  'فلتره': 'فلتر',
  'فلاتر': 'فلتر',
  'فتله': 'فلتر',
  'فتلر': 'فلتر',
  'فتلا': 'فلتر',
  'فتل': 'فلتر',
};

const NOISE_PATTERNS = [
  /\d+\s*(شرايط|شرائط|شرط|اقراص|قرص|علبه|علب|كرتون|كرتونه|قطعه|حبه|عبوه|امبول|مل|جم|مجم|ملي|وحده|قطع|صندوق|شريط)\b/g,
  /\d+\s*(EGP|egp|LE|le|جنيه|ج\.?)\b/g,
  /\b(EGP|egp|LE|le|جنيه)\b/g,
];

const IMPORTANT_FORMS = [
  'شراب', 'كبسول', 'كبسوله', 'كبسولات', 'اقراص', 'قرص', 'امبول',
  'حقن', 'كريم', 'مرهم', 'جيل', 'بخاخ', 'تحاميل', 'لبوس', 'نقط', 'قطره',
  'مستحلب', 'باودر', 'مسحوق',
];

function canonicalToken(token: string): string {
  const base = token.length > 3 && token.startsWith('ال') ? token.slice(2) : token;
  return TOKEN_VARIANTS[base] ?? base;
}

function tokenize(text: string): string[] {
  let cleaned = stripPackagingNoise(normalizeArabic(text));
  cleaned = removePunctuation(cleaned);
  for (const pattern of NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, ' ');
  }
  cleaned = removePunctuation(cleaned);

  const tokens = cleaned
    .split(/\s+/)
    .map(canonicalToken)
    .filter(t => t.length > 1 && !STOP_WORDS.has(t));
  return Array.from(new Set(tokens));
}

function extractImportantTokens(text: string): { tokens: string[]; forms: string[]; numbers: string[] } {
  const normalized = normalizeArabic(text);
  const tokens = tokenize(text);

  const forms: string[] = [];
  for (const form of IMPORTANT_FORMS) {
    const normForm = normalizeArabic(form);
    if (tokens.some(t => t.includes(normForm) || normForm.includes(t))) {
      forms.push(normForm);
    }
  }

  const numbers: string[] = [];
  const concMatches = normalized.match(/\d+(\.\d+)?\s*(مجم|ملجم|mg|mgm|مللي|جرام|جم|gm)/gi);
  if (concMatches) {
    for (const m of concMatches) {
      const norm = normalizeArabic(m).replace(/\s+/g, '');
      if (!numbers.includes(norm)) numbers.push(norm);
    }
  }

  return { tokens, forms, numbers };
}

export type MatchStatus = 'found' | 'similar' | 'not_found';

export interface ComparisonResult {
  shortageItem: string;
  status: MatchStatus;
  matches: Array<{
    productName: string;
    supplierId: string;
    supplierAlias: string;
    price: number;
    discount: number;
    finalPrice: number;
    quantity: number;
    similarity: number;
  }>;
}

function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// Two words count as the same when they differ by a single letter (typos like كركديه/كركدية)
function wordsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  return a.length >= 4 && b.length >= 4 && levenshtein(a, b) <= 1;
}

// Dice-style score: shared words count fully, partial overlaps count 0.7
function tokenSimilarity(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const usedB = new Set<string>();
  let common = 0;
  for (const a of tokensA) {
    const exact = tokensB.find(b => !usedB.has(b) && wordsMatch(a, b));
    if (exact) {
      usedB.add(exact);
      common += 1;
      continue;
    }
    const partial = tokensB.find(b => !usedB.has(b) && a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a)));
    if (partial) {
      usedB.add(partial);
      common += 0.7;
    }
  }

  return (2 * common) / (tokensA.length + tokensB.length);
}

// Two products with different specification numbers (12 vs 20 filters) are different products
function specNumbersConflict(a: string[], b: string[]): boolean {
  const numsA = a.filter(t => /^\d+$/.test(t));
  const numsB = b.filter(t => /^\d+$/.test(t));
  if (numsA.length === 0 || numsB.length === 0) return false;
  return !numsA.some(n => numsB.includes(n));
}

function isCompatible(item: ReturnType<typeof extractImportantTokens>, product: ReturnType<typeof extractImportantTokens>): boolean {
  if (specNumbersConflict(item.tokens, product.tokens)) return false;
  if (item.numbers.length > 0 && product.numbers.length > 0 && !item.numbers.some(n => product.numbers.includes(n))) return false;
  if (item.forms.length > 0 && product.forms.length > 0 && !item.forms.some(f => product.forms.includes(f))) return false;
  return true;
}

export function compareShortageWithSuppliers(
  shortageItems: string[],
  supplierProducts: Array<{
    product_name: string;
    supplier_id: string;
    supplier_alias: string;
    price: number;
    discount: number;
    final_price: number;
    quantity: number;
  }>
): ComparisonResult[] {
  const processedSuppliers = supplierProducts.map(p => ({
    product: p,
    important: extractImportantTokens(p.product_name),
  }));

  return shortageItems.map(item => {
    const itemImportant = extractImportantTokens(item);

    const candidates = processedSuppliers
      .map(({ product: sp, important }) => ({
        sp,
        similarity: tokenSimilarity(itemImportant.tokens, important.tokens),
        compatible: isCompatible(itemImportant, important),
      }))
      .filter(c => c.similarity > 0);

    candidates.sort((a, b) => Number(b.compatible) - Number(a.compatible) || b.similarity - a.similarity);

    const bestCompatible = candidates.find(c => c.compatible);
    const bestAny = candidates[0];

    let status: MatchStatus;
    if (bestCompatible && bestCompatible.similarity >= 0.65) {
      status = 'found';
    } else if (bestAny && bestAny.similarity >= 0.35) {
      status = 'similar';
    } else {
      status = 'not_found';
    }

    return {
      shortageItem: item,
      status,
      matches: candidates.slice(0, 5).map(c => ({
        productName: c.sp.product_name,
        supplierId: c.sp.supplier_id,
        supplierAlias: c.sp.supplier_alias,
        price: c.sp.price,
        discount: c.sp.discount,
        finalPrice: c.sp.final_price,
        quantity: c.sp.quantity,
        similarity: c.similarity,
      })),
    };
  });
}
