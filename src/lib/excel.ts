import * as XLSX from 'xlsx';

export interface ParsedExcelRow {
  [key: string]: string | number;
}

export interface ParsedExcelData {
  headers: string[];
  rows: ParsedExcelRow[];
}

export async function parseExcelFile(file: File): Promise<ParsedExcelData> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  const jsonData = XLSX.utils.sheet_to_json<Record<string, string | number>>(worksheet, {
    defval: '',
    raw: false,
  });

  if (jsonData.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = Object.keys(jsonData[0]);
  return { headers, rows: jsonData };
}

// Extract product names from parsed Excel - tries to find a name column
export function extractProductNames(data: ParsedExcelData): string[] {
  if (data.rows.length === 0) return [];

  const headers = data.headers;
  // Look for common product name column names (Arabic + English)
  const nameKeywords = [
    'اسم', 'المنتج', 'اسم المنتج', 'الدواء', 'الصنف', 'الصنف', 'الوصف',
    'product', 'name', 'product name', 'item', 'item name', 'description',
    'الصنف', 'السلعة', 'السلعة', 'المادة',
  ];

  let nameColumn: string | null = null;
  for (const keyword of nameKeywords) {
    const found = headers.find(h =>
      h.toLowerCase().includes(keyword.toLowerCase()) ||
      h.includes(keyword)
    );
    if (found) {
      nameColumn = found;
      break;
    }
  }

  // If no name column found, use the first column
  if (!nameColumn) {
    nameColumn = headers[0];
  }

  return data.rows
    .map(row => String(row[nameColumn!] || '').trim())
    .filter(name => name.length > 0);
}

// Extract full product data from supplier Excel
export interface SupplierProductRow {
  product_name: string;
  price: number;
  discount: number;
  final_price: number;
  quantity: number;
}

export function extractSupplierProducts(data: ParsedExcelData): SupplierProductRow[] {
  if (data.rows.length === 0) return [];

  const headers = data.headers.map(h => h.toLowerCase().trim());

  // Find column indices
  const findColumn = (keywords: string[]): string | null => {
    for (const kw of keywords) {
      const found = data.headers.find(h =>
        h.toLowerCase().trim().includes(kw.toLowerCase())
      );
      if (found) return found;
    }
    return null;
  };

  const nameCol = findColumn(['اسم', 'المنتج', 'الدواء', 'الصنف', 'الوصف', 'product', 'name', 'item', 'description', 'المادة']);
  const priceCol = findColumn(['السعر', 'سعر', 'price', 'cost']);
  const discountCol = findColumn(['الخصم', 'خصم', 'discount', 'off']);
  const finalPriceCol = findColumn(['السعر النهائي', 'النهائي', 'final', 'net', 'الصافي', 'صافي']);
  const quantityCol = findColumn(['الكمية', 'كمية', 'الكميه', 'quantity', 'qty', 'stock', 'المتوفر', 'المخزون']);

  if (!nameCol) {
    // Fallback: first column is name
    return data.rows.map(row => {
      const productName = String(row[data.headers[0]] || '').trim();
      return {
        product_name: productName,
        price: 0,
        discount: 0,
        final_price: 0,
        quantity: 0,
      };
    }).filter(r => r.product_name.length > 0);
  }

  const toNumber = (val: string | number | undefined): number => {
    if (val === undefined || val === null || val === '') return 0;
    const num = parseFloat(String(val).replace(/[^\d.-]/g, ''));
    return isNaN(num) ? 0 : num;
  };

  return data.rows.map(row => {
    const productName = String(row[nameCol!] || '').trim();
    const price = toNumber(priceCol ? row[priceCol] : 0);
    const discount = toNumber(discountCol ? row[discountCol] : 0);
    let finalPrice = toNumber(finalPriceCol ? row[finalPriceCol] : 0);
    if (finalPrice === 0 && price > 0) {
      finalPrice = discount > 0 ? price * (1 - discount / 100) : price;
    }
    const quantity = toNumber(quantityCol ? row[quantityCol] : 0);

    return {
      product_name: productName,
      price,
      discount,
      final_price: finalPrice,
      quantity,
    };
  }).filter(r => r.product_name.length > 0);
}
