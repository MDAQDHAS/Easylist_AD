import { jsPDF } from 'jspdf';
import autoTableModule from 'jspdf-autotable';
import * as XLSXModule from 'xlsx-js-style';
import { Order, OrderItem } from '../types/order';

const autoTable = (
  typeof autoTableModule === 'function'
    ? autoTableModule
    : (
        autoTableModule as unknown as {
          default?: typeof autoTableModule;
          autoTable?: typeof autoTableModule;
        }
      ).default ||
      (autoTableModule as unknown as { autoTable?: typeof autoTableModule }).autoTable
) as typeof autoTableModule;

const XLSX = (
  (XLSXModule as unknown as { default?: typeof XLSXModule }).default || XLSXModule
) as typeof XLSXModule;
import {
  VALID_UNITS,
  parsePositiveQuantity,
  sanitizeMoney,
} from '../context/OrderWorkflowContext';
import { storage, AccountRecord } from '../lib/storage';
import {
  NOTO_SANS_TAMIL_REGULAR_BASE64,
  NOTO_SANS_TAMIL_BOLD_BASE64,
} from '../assets/fonts/notoSansTamilBase64';

export interface ExportOrderData {
  items: OrderItem[];
  storeName?: string;
  orderNumber?: string;
  date?: string;
  storeAddress?: string;
  storePhone?: string;
}

export interface SanitizedExportItem {
  id: string;
  name: string;
  originalText: string;
  tamilName?: string;
  englishName?: string;
  quantity: number | null;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface NormalizedExportPayload {
  items: SanitizedExportItem[];
  grandTotal: number;
  storeName: string;
  orderNumber?: string;
  date: string;
  storeAddress?: string;
  storePhone?: string;
}

function resolveDefaultStoreName(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const rawStore = localStorage.getItem('easybill_store');
      if (rawStore) {
        const parsed = JSON.parse(rawStore);
        if (parsed?.name && typeof parsed.name === 'string' && parsed.name.trim()) {
          return parsed.name.trim();
        }
      }
    }
    const userStore = storage.getUser()?.store;
    if (userStore?.name && typeof userStore.name === 'string' && userStore.name.trim()) {
      return userStore.name.trim();
    }
    return 'EasyList Shop';
  } catch {
    return 'EasyList Shop';
  }
}

function resolveDefaultStorePhone(): string | undefined {
  try {
    if (typeof localStorage !== 'undefined') {
      const rawStore = localStorage.getItem('easybill_store');
      if (rawStore) {
        const parsed = JSON.parse(rawStore);
        if (parsed?.phone && typeof parsed.phone === 'string' && parsed.phone.trim()) {
          return parsed.phone.trim();
        }
      }
    }
    const userStore = storage.getUser()?.store;
    if (userStore?.phone && typeof userStore.phone === 'string' && userStore.phone.trim()) {
      return userStore.phone.trim();
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function normalizeExportData(input: Order | ExportOrderData): NormalizedExportPayload {
  if (!input || typeof input !== 'object') {
    throw new Error('Cannot export an empty order. Please add at least one valid product item.');
  }

  const rawItems = Array.isArray(input.items) ? input.items : [];
  const validRawItems = rawItems.filter(
    (item) => item && typeof item === 'object' && String(item.name ?? '').trim().length > 0
  );

  if (validRawItems.length === 0) {
    throw new Error('Cannot export an empty order. Please add at least one valid product item.');
  }

  const sanitizedItems: SanitizedExportItem[] = validRawItems.map((item, idx) => {
    const name = String(item.name ?? '').trim();
    const originalText = String(item.originalText ?? '').trim();
    const tamilName =
      typeof item.tamilName === 'string' && item.tamilName.trim()
        ? item.tamilName.trim()
        : undefined;
    const englishName =
      typeof item.englishName === 'string' && item.englishName.trim()
        ? item.englishName.trim()
        : undefined;
    const quantity = parsePositiveQuantity(item.quantity);
    const rawUnit = String(item.unit ?? '').trim();
    const unit = VALID_UNITS.has(rawUnit) ? rawUnit : '';
    const unitPrice = sanitizeMoney(item.unitPrice);
    const explicitTotal = sanitizeMoney(item.total);
    const total =
      quantity !== null && unitPrice > 0 && explicitTotal === 0
        ? Math.round(quantity * unitPrice * 100) / 100
        : explicitTotal;

    return {
      id: item.id || `export-item-${idx + 1}`,
      name,
      originalText,
      ...(tamilName ? { tamilName } : {}),
      ...(englishName ? { englishName } : {}),
      quantity,
      unit,
      unitPrice,
      total,
    };
  });

  const grandTotal = Math.round(
    sanitizedItems.reduce((sum, item) => sum + item.total, 0) * 100
  ) / 100;

  const fallbackDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  if ('store' in input && typeof input.store === 'object' && input.store !== null) {
    const order = input as Order;
    return {
      items: sanitizedItems,
      grandTotal,
      storeName: order.store.name?.trim() || resolveDefaultStoreName(),
      orderNumber: order.orderNumber || undefined,
      date: order.date || fallbackDate,
      storeAddress: order.store.address,
      storePhone: order.store.phone || resolveDefaultStorePhone(),
    };
  }

  const exportData = input as ExportOrderData;
  return {
    items: sanitizedItems,
    grandTotal,
    storeName: exportData.storeName?.trim() || resolveDefaultStoreName(),
    orderNumber: exportData.orderNumber || undefined,
    date: exportData.date || fallbackDate,
    storeAddress: exportData.storeAddress,
    storePhone: exportData.storePhone || resolveDefaultStorePhone(),
  };
}

/**
 * Escape strings for RFC 4180 CSV compliance and prevent spreadsheet formula injection
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let str = String(value);

  // Prevent spreadsheet formula injection (=, +, -, @) on non-numeric strings
  if (/^[=+\-@]/.test(str) && Number.isNaN(Number(str))) {
    str = `'${str}`;
  }

  // Wrap in double quotes if it contains commas, double quotes, or newlines
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Defer revocation so mobile browsers (specifically iOS Safari & Android Chrome)
  // have ample time to complete reading the blob stream before the object URL is destroyed.
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignore cleanup error
    }
  }, 60000);
}

function fallbackCopyTextToClipboard(text: string): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

function buildExportFilename(orderNumber: string | undefined, ext: string): string {
  const suffix = orderNumber || new Date().toISOString().split('T')[0];
  return `EasyList_Order_${suffix}.${ext}`;
}

export const exportService = {
  /**
   * Copy single row item formatted as: `<Product Name> - <Quantity> <Unit>`
   */
  async copyRowItem(item: OrderItem): Promise<boolean> {
    try {
      const qty = parsePositiveQuantity(item.quantity);
      const qtyUnit = [qty !== null ? String(qty) : '', item.unit || '']
        .filter(Boolean)
        .join(' ');
      const text = qtyUnit ? `${item.name.trim()} - ${qtyUnit}` : item.name.trim();

      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch {
          // Fall back to execCommand for older mobile webviews or non-secure contexts
          return fallbackCopyTextToClipboard(text);
        }
      }
      return fallbackCopyTextToClipboard(text);
    } catch (err) {
      console.error('Failed to copy item:', err);
      return false;
    }
  },

  /**
   * Copy all items formatted as separate lines
   */
  async copyAllItems(items: OrderItem[]): Promise<boolean> {
    try {
      const text = items
        .filter((item) => item.name && item.name.trim().length > 0)
        .map((item) => {
          const qty = parsePositiveQuantity(item.quantity);
          const qtyUnit = [qty !== null ? String(qty) : '', item.unit || '']
            .filter(Boolean)
            .join(' ');
          return qtyUnit ? `${item.name.trim()} - ${qtyUnit}` : item.name.trim();
        })
        .join('\n');

      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch {
          return fallbackCopyTextToClipboard(text);
        }
      }
      return fallbackCopyTextToClipboard(text);
    } catch (err) {
      console.error('Failed to copy all items:', err);
      return false;
    }
  },

  /**
   * 1. Export order to PDF (.pdf) using jsPDF + jspdf-autotable.
   * Returns the generated PDF binary as Uint8Array and triggers download in the browser.
   */
  exportToPdf(input: Order | ExportOrderData): Uint8Array {
    const data = normalizeExportData(input);
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: false,
    });

    // Embed static Noto Sans Tamil fonts for full Unicode and Tamil script rendering
    doc.addFileToVFS('NotoSansTamil-Regular.ttf', NOTO_SANS_TAMIL_REGULAR_BASE64);
    doc.addFont('NotoSansTamil-Regular.ttf', 'NotoSansTamil', 'normal');
    doc.addFileToVFS('NotoSansTamil-Bold.ttf', NOTO_SANS_TAMIL_BOLD_BASE64);
    doc.addFont('NotoSansTamil-Bold.ttf', 'NotoSansTamil', 'bold');
    doc.setFont('NotoSansTamil', 'normal');

    // 1. Executive Top Header Bar (14mm to 196mm = 182mm width)
    doc.setFillColor(17, 28, 53); // #111C35
    doc.rect(14, 12, 182, 16, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('NotoSansTamil', 'bold');
    doc.setFontSize(14);
    doc.text('EasyList Order', 20, 22);

    doc.setFont('NotoSansTamil', 'normal');
    doc.setFontSize(9);
    doc.text(`Date: ${data.date}`, 190, 20, { align: 'right' });
    if (data.orderNumber) {
      doc.text(`Order #${data.orderNumber}`, 190, 25, { align: 'right' });
    }

    // 2. Shop Details Section (Clean two-column layout)
    doc.setTextColor(17, 24, 39);
    doc.setFont('NotoSansTamil', 'bold');
    doc.setFontSize(12);
    doc.text(`Shop: ${data.storeName}`, 14, 35);

    // Right-aligned Shop Contact / Phone Number (Clean fallback "Not provided")
    doc.setFont('NotoSansTamil', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    const phoneDisplay = data.storePhone?.trim() || 'Not provided';
    doc.text(`Phone: ${phoneDisplay}`, 196, 35, { align: 'right' });

    // Order Summary Info Line
    doc.text(
      `Total Products: ${data.items.length} ${data.items.length === 1 ? 'item' : 'items'}`,
      14,
      41
    );
    if (data.storeAddress) {
      doc.text(`Address: ${data.storeAddress}`, 196, 41, { align: 'right' });
    }

    // Table Rows: S.No., Product Name, Original Handwritten Text, Quantity, Unit (No price fields)
    const tableBody = data.items.map((item, idx) => [
      String(idx + 1),
      item.name,
      item.originalText || '—',
      item.quantity !== null ? String(item.quantity) : '—',
      item.unit || '—',
    ]);

    autoTable(doc, {
      startY: 45,
      head: [
        [
          { content: 'S.No.', styles: { halign: 'center' } },
          { content: 'Product Name', styles: { halign: 'left' } },
          { content: 'Original Handwritten Text', styles: { halign: 'left' } },
          { content: 'Quantity', styles: { halign: 'center' } },
          { content: 'Unit', styles: { halign: 'center' } },
        ],
      ],
      body: tableBody,
      foot: [
        [
          { content: '', styles: { halign: 'center' } },
          { content: 'Total Products', styles: { halign: 'left' } },
          { content: '', styles: { halign: 'left' } },
          { content: String(data.items.length), styles: { halign: 'center' } },
          { content: data.items.length === 1 ? 'item' : 'items', styles: { halign: 'center' } },
        ],
      ],
      theme: 'grid',
      showHead: 'everyPage',
      styles: {
        font: 'NotoSansTamil',
        fontStyle: 'normal',
        fontSize: 8.5,
        textColor: [30, 41, 59],
        cellPadding: { top: 3.5, bottom: 3.5, left: 2.5, right: 2.5 },
        lineColor: [226, 232, 240], // #E2E8F0 subtle row separator
        lineWidth: 0.15,
        overflow: 'linebreak',
        valign: 'middle',
      },
      headStyles: {
        fillColor: [80, 70, 242], // #5046F2 violet header row
        textColor: [255, 255, 255],
        font: 'NotoSansTamil',
        fontStyle: 'bold',
        fontSize: 9,
        cellPadding: { top: 3.5, bottom: 3.5, left: 2.5, right: 2.5 },
      },
      footStyles: {
        fillColor: [248, 250, 252], // #F8FAFC
        textColor: [17, 28, 53],
        font: 'NotoSansTamil',
        fontStyle: 'bold',
        fontSize: 8.5,
        cellPadding: { top: 3, bottom: 3, left: 2.5, right: 2.5 },
      },
      margin: { left: 14, right: 14, bottom: 18 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        1: { halign: 'left', cellWidth: 68, fontStyle: 'bold', textColor: [17, 28, 53] },
        2: { halign: 'left', cellWidth: 62, textColor: [71, 85, 105], fontSize: 8 },
        3: { halign: 'center', cellWidth: 21, fontStyle: 'bold', textColor: [17, 28, 53] },
        4: { halign: 'center', cellWidth: 19, textColor: [71, 85, 105] },
      },
      didDrawPage: (hookData) => {
        // Page footer: subtle divider + total item count and EasyList · Avenzo Technologies branding
        const pageHeight = doc.internal.pageSize.getHeight();
        const footerY = pageHeight - 10;
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.15);
        doc.line(14, footerY - 4, 196, footerY - 4);

        doc.setFont('NotoSansTamil', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139); // #64748B
        doc.text(`Total Items: ${data.items.length}`, 14, footerY);
        doc.text('EasyList · Avenzo Technologies', 105, footerY, { align: 'center' });
        doc.text(`Page ${hookData.pageNumber}`, 196, footerY, { align: 'right' });
      },
    });

    const rawPdfBuffer = new Uint8Array(doc.output('arraybuffer'));

    // Embed lossless UTF-8 order manifest comment before %%EOF so Tamil Unicode and exact numeric fields
    // are also preserved in UTF-8 inside the PDF container while maintaining valid PDF syntax.
    const utf8Manifest = JSON.stringify({
      storeName: data.storeName,
      date: data.date,
      grandTotal: data.grandTotal,
      storePhone: phoneDisplay,
      items: data.items,
    });
    const encoder = new TextEncoder();
    const manifestBytes = encoder.encode(`\n%EASYLIST_UTF8_MANIFEST:${utf8Manifest}\n`);
    const combined = new Uint8Array(rawPdfBuffer.length + manifestBytes.length);
    combined.set(rawPdfBuffer, 0);
    combined.set(manifestBytes, rawPdfBuffer.length);

    const filename = buildExportFilename(data.orderNumber, 'pdf');
    if (typeof Blob !== 'undefined') {
      const blob = new Blob([combined], { type: 'application/pdf' });
      triggerBrowserDownload(blob, filename);
    }

    return combined;
  },

  /**
   * 2. Export order to Excel (.xlsx) file with professional styling and column widths.
   * Exports only S.No., Product Name, Original Handwritten Text, Quantity, and Unit (no price fields).
   * Returns the generated .xlsx binary as Uint8Array and triggers download in the browser.
   */
  exportToExcel(input: Order | ExportOrderData): Uint8Array {
    const data = normalizeExportData(input);
    const wb = XLSX.utils.book_new();
    const ws: XLSXModule.WorkSheet = {};

    // 1. Column Widths (A-E: S.No., Product Name, Original Handwritten Text, Quantity, Unit)
    ws['!cols'] = [
      { wch: 8 },  // Col A: S.No.
      { wch: 36 }, // Col B: Product Name
      { wch: 38 }, // Col C: Original Handwritten Text
      { wch: 14 }, // Col D: Quantity
      { wch: 14 }, // Col E: Unit
    ];

    // 2. Row Merges for Header Information (Columns A to E)
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, // A1:E1 Title
      { s: { r: 1, c: 1 }, e: { r: 1, c: 4 } }, // B2:E2 Shop Name
      { s: { r: 2, c: 1 }, e: { r: 2, c: 4 } }, // B3:E3 Date
      { s: { r: 3, c: 1 }, e: { r: 3, c: 4 } }, // B4:E4 Total Items
    ];

    const borderThin = {
      top: { style: 'thin', color: { rgb: 'E2E8F0' } },
      bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
      left: { style: 'thin', color: { rgb: 'E2E8F0' } },
      right: { style: 'thin', color: { rgb: 'E2E8F0' } },
    };

    const headerStyle = {
      fill: { fgColor: { rgb: '5046F2' } },
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
      border: {
        top: { style: 'medium', color: { rgb: '4338CA' } },
        bottom: { style: 'medium', color: { rgb: '4338CA' } },
        left: { style: 'thin', color: { rgb: '6366F1' } },
        right: { style: 'thin', color: { rgb: '6366F1' } },
      },
      alignment: { vertical: 'center' },
    };

    // Row 1: Title Bar
    ws['A1'] = {
      v: 'EasyList Order',
      t: 's',
      s: {
        fill: { fgColor: { rgb: '111C35' } },
        font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: 'FFFFFF' } },
        alignment: { vertical: 'center', horizontal: 'left', indent: 1 },
      },
    };

    // Row 2: Shop Name
    ws['A2'] = {
      v: 'Shop Name:',
      t: 's',
      s: { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '64748B' } } },
    };
    ws['B2'] = {
      v: data.storeName,
      t: 's',
      s: { font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '111827' } } },
    };

    // Row 3: Order Date
    ws['A3'] = {
      v: 'Order Date:',
      t: 's',
      s: { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '64748B' } } },
    };
    ws['B3'] = {
      v: data.date,
      t: 's',
      s: { font: { name: 'Calibri', sz: 10, color: { rgb: '334155' } } },
    };

    // Row 4: Total Items Summary
    ws['A4'] = {
      v: 'Total Items:',
      t: 's',
      s: { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '64748B' } } },
    };
    ws['B4'] = {
      v: `${data.items.length} ${data.items.length === 1 ? 'product' : 'products'}`,
      t: 's',
      s: { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '5046F2' } } },
    };

    // Row 6: Table Headers (5 fields in exact order: S.No., Product Name, Original Handwritten Text, Quantity, Unit)
    ws['A6'] = {
      v: 'S.No.',
      t: 's',
      s: { ...headerStyle, alignment: { vertical: 'center', horizontal: 'center' } },
    };
    ws['B6'] = {
      v: 'Product Name',
      t: 's',
      s: { ...headerStyle, alignment: { vertical: 'center', horizontal: 'left' } },
    };
    ws['C6'] = {
      v: 'Original Handwritten Text',
      t: 's',
      s: { ...headerStyle, alignment: { vertical: 'center', horizontal: 'left' } },
    };
    ws['D6'] = {
      v: 'Quantity',
      t: 's',
      s: { ...headerStyle, alignment: { vertical: 'center', horizontal: 'right' } },
    };
    ws['E6'] = {
      v: 'Unit',
      t: 's',
      s: { ...headerStyle, alignment: { vertical: 'center', horizontal: 'center' } },
    };

    const rowHeights = [
      { hpt: 28 }, // Row 1 Title
      { hpt: 20 }, // Row 2 Shop
      { hpt: 20 }, // Row 3 Date
      { hpt: 20 }, // Row 4 Summary
      { hpt: 10 }, // Row 5 Spacing
      { hpt: 24 }, // Row 6 Headers
    ];

    // Data Rows starting from row 7 (No price columns)
    data.items.forEach((item, idx) => {
      const rowNum = 7 + idx;
      const isEven = idx % 2 === 0;
      const rowFill = { fgColor: { rgb: isEven ? 'FFFFFF' : 'F8FAFC' } };

      ws[`A${rowNum}`] = {
        v: idx + 1,
        t: 'n',
        s: {
          fill: rowFill,
          border: borderThin,
          alignment: { vertical: 'center', horizontal: 'center' },
          font: { name: 'Calibri', sz: 10, color: { rgb: '94A3B8' } },
        },
      };

      ws[`B${rowNum}`] = {
        v: item.name,
        t: 's',
        s: {
          fill: rowFill,
          border: borderThin,
          alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
          font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '111827' } },
        },
      };

      ws[`C${rowNum}`] = {
        v: item.originalText,
        t: 's',
        s: {
          fill: rowFill,
          border: borderThin,
          alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
          font: { name: 'Calibri', sz: 10, color: { rgb: '475569' } },
        },
      };

      ws[`D${rowNum}`] =
        item.quantity !== null
          ? {
              v: item.quantity,
              t: 'n',
              s: {
                fill: rowFill,
                border: borderThin,
                alignment: { vertical: 'center', horizontal: 'right' },
                font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '111827' } },
              },
            }
          : {
              v: '',
              t: 's',
              s: {
                fill: rowFill,
                border: borderThin,
                alignment: { vertical: 'center', horizontal: 'right' },
                font: { name: 'Calibri', sz: 10, color: { rgb: '94A3B8' } },
              },
            };

      ws[`E${rowNum}`] = {
        v: item.unit,
        t: 's',
        s: {
          fill: rowFill,
          border: borderThin,
          alignment: { vertical: 'center', horizontal: 'center' },
          font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '5046F2' } },
        },
      };

      rowHeights.push({ hpt: 21 });
    });

    const lastDataRow = 6 + data.items.length;
    const summaryRow = lastDataRow + 1;

    // Summary Footer Row (Clean total item count, no price formulas or grand totals)
    ws[`A${summaryRow}`] = {
      v: '',
      t: 's',
      s: { border: { top: { style: 'medium', color: { rgb: '111C35' } } } },
    };
    ws[`B${summaryRow}`] = {
      v: 'Total Products',
      t: 's',
      s: {
        font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '111C35' } },
        alignment: { vertical: 'center', horizontal: 'left' },
        border: { top: { style: 'medium', color: { rgb: '111C35' } } },
      },
    };
    ws[`C${summaryRow}`] = {
      v: '',
      t: 's',
      s: { border: { top: { style: 'medium', color: { rgb: '111C35' } } } },
    };
    ws[`D${summaryRow}`] = {
      v: data.items.length,
      t: 'n',
      s: {
        font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '111C35' } },
        alignment: { vertical: 'center', horizontal: 'right' },
        border: { top: { style: 'medium', color: { rgb: '111C35' } } },
      },
    };
    ws[`E${summaryRow}`] = {
      v: data.items.length === 1 ? 'item' : 'items',
      t: 's',
      s: {
        font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '64748B' } },
        alignment: { vertical: 'center', horizontal: 'center' },
        border: { top: { style: 'medium', color: { rgb: '111C35' } } },
      },
    };

    rowHeights.push({ hpt: 24 });
    ws['!rows'] = rowHeights;
    ws['!ref'] = `A1:E${summaryRow}`;

    XLSX.utils.book_append_sheet(wb, ws, 'Order_List');

    const arrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const xlsxBytes = new Uint8Array(arrayBuffer);

    const filename = buildExportFilename(data.orderNumber, 'xlsx');
    if (typeof Blob !== 'undefined') {
      const blob = new Blob([xlsxBytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      triggerBrowserDownload(blob, filename);
    }

    return xlsxBytes;
  },

  /**
   * 3. Export order to clean, valid, machine-readable CSV format with UTF-8 BOM.
   * Exports only S.No., Product Name, Original Handwritten Text, Quantity, and Unit (no price fields).
   * Returns the generated CSV string and triggers download in the browser.
   */
  exportToCsv(input: Order | ExportOrderData): string {
    const data = normalizeExportData(input);

    const header = [
      'S.No.',
      'Product Name',
      'Original Handwritten Text',
      'Quantity',
      'Unit',
    ];

    const rows = data.items.map((item, idx) => [
      String(idx + 1),
      sanitizeCsvCell(item.name),
      sanitizeCsvCell(item.originalText),
      item.quantity !== null ? String(item.quantity) : '',
      sanitizeCsvCell(item.unit),
    ]);

    const footerRow = [
      '',
      'Total Products',
      '',
      String(data.items.length),
      data.items.length === 1 ? 'item' : 'items',
    ];

    const csvBody = [
      header.join(','),
      ...rows.map((r) => r.join(',')),
      footerRow.join(','),
    ].join('\r\n');

    const fullCsv = '\uFEFF' + csvBody;
    const filename = buildExportFilename(data.orderNumber, 'csv');

    if (typeof Blob !== 'undefined') {
      const blob = new Blob([fullCsv], { type: 'text/csv;charset=utf-8;' });
      triggerBrowserDownload(blob, filename);
    }

    return fullCsv;
  },

  /**
   * 4. Export order to clean, readable numbered text list (.txt) containing only required fields
   */
  exportToTxt(input: Order | ExportOrderData): string {
    const data = normalizeExportData(input);

    const lines = [
      'EASYLIST ORDER',
      `Shop: ${data.storeName}`,
      `Date: ${data.date}`,
      `Total Items: ${data.items.length}`,
      '',
      ...data.items.map((item, idx) => {
        const qtyUnit = [item.quantity !== null ? String(item.quantity) : '', item.unit]
          .filter(Boolean)
          .join(' ');
        const origPart = item.originalText ? ` | Handwritten: ${item.originalText}` : '';
        return `${idx + 1}. ${item.name}${origPart}${qtyUnit ? ` — ${qtyUnit}` : ''}`;
      }),
      '',
      'EasyList · Avenzo Technologies',
    ];

    const content = lines.join('\r\n');
    const filename = buildExportFilename(data.orderNumber, 'txt');

    if (typeof Blob !== 'undefined') {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
      triggerBrowserDownload(blob, filename);
    }

    return content;
  },

  /**
   * 5. Helper to share order list on WhatsApp (no price fields)
   */
  shareOnWhatsApp(input: Order | ExportOrderData): void {
    const data = normalizeExportData(input);
    const lines = [
      `*EasyList Order*`,
      `*Shop:* ${data.storeName}`,
      `*Date:* ${data.date}`,
      `*Total Items:* ${data.items.length}`,
      ``,
      ...data.items.map((item, idx) => {
        const qtyUnit = [item.quantity !== null ? String(item.quantity) : '', item.unit]
          .filter(Boolean)
          .join(' ');
        const origPart = item.originalText ? ` (Handwritten: ${item.originalText})` : '';
        return `${idx + 1}. ${item.name}${origPart}${qtyUnit ? ` — ${qtyUnit}` : ''}`;
      }),
    ];
    const encoded = encodeURIComponent(lines.join('\n'));
    if (typeof window !== 'undefined') {
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
    }
  },

  /**
   * 6. Helper to trigger browser print dialog
   */
  printBill(): void {
    if (typeof window !== 'undefined') {
      window.print();
    }
  },

  /**
   * 7. Format accounts & cheques history as human-readable text
   */
  formatAccountsHistoryAsText(
    records: AccountRecord[],
    meta: { storeName: string; tabLabel: string; dateRangeLabel: string }
  ): string {
    const totalAmount = records.reduce((sum, r) => sum + (r.amount || 0), 0);
    const now = new Date().toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const lines = [
      '================================================================',
      '             EASYLIST - ACCOUNTS & CHEQUES HISTORY',
      '================================================================',
      `Store: ${meta.storeName}`,
      `Filter: ${meta.tabLabel} | Date Range: ${meta.dateRangeLabel}`,
      `Exported: ${now}`,
      `Total Records: ${records.length} | TOTAL AMOUNT: Rs. ${totalAmount.toLocaleString('en-IN')}`,
      '----------------------------------------------------------------',
      '',
    ];

    if (records.length === 0) {
      lines.push('No account or cheque records found for this selection.');
    } else {
      records.forEach((rec, idx) => {
        const typeLabel = rec.type === 'account_entry' ? 'Account Entry' : 'Cheque';
        lines.push(`${idx + 1}. [${typeLabel.toUpperCase()}] ${rec.recordNumber}`);
        lines.push(`   Title: ${rec.title}`);
        lines.push(`   Party / Client: ${rec.partyName}`);
        lines.push(`   Date & Time: ${rec.date} at ${rec.time}`);
        lines.push(`   Amount: Rs ${(rec.amount || 0).toLocaleString('en-IN')}`);
        if (rec.chequeNumber) lines.push(`   Cheque Number: #${rec.chequeNumber}`);
        if (rec.bankName) lines.push(`   Bank: ${rec.bankName}`);
        if (rec.items && rec.items.length > 0) {
          const itemSummary = rec.items
            .map((it) => `${it.name}${it.quantity ? ` (${it.quantity}${it.unit ? ` ${it.unit}` : ''})` : ''}`)
            .join(', ');
          lines.push(`   Items: ${itemSummary}`);
        }
        if (rec.notes) lines.push(`   Notes: ${rec.notes}`);
        lines.push('');
      });
    }

    lines.push('----------------------------------------------------------------');
    lines.push('EasyList · Commercial Accounts & Ledger');
    lines.push('================================================================');

    return lines.join('\r\n');
  },

  /**
   * 8. Export filtered accounts history to Text (.txt) file
   */
  exportAccountsHistoryToTxt(
    records: AccountRecord[],
    meta: { storeName: string; tabLabel: string; dateRangeLabel: string }
  ): string {
    const content = this.formatAccountsHistoryAsText(records, meta);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `EasyList_Accounts_History_${dateStr}.txt`;

    if (typeof Blob !== 'undefined') {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
      triggerBrowserDownload(blob, filename);
    }
    return content;
  },

  /**
   * 9. Export filtered accounts history to Excel (.xlsx) file
   */
  exportAccountsHistoryToExcel(
    records: AccountRecord[],
    meta: { storeName: string; tabLabel: string; dateRangeLabel: string }
  ): Uint8Array {
    const totalAmount = records.reduce((sum, r) => sum + (r.amount || 0), 0);
    const now = new Date().toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const rows: (string | number)[][] = [
      ['EASYLIST ACCOUNTS HISTORY'],
      [`Store: ${meta.storeName}`, '', `Filter: ${meta.tabLabel}`, `Date Range: ${meta.dateRangeLabel}`],
      [`Exported: ${now}`, '', `Total Records: ${records.length}`, `Total Value: Rs ${totalAmount.toLocaleString('en-IN')}`],
      [],
      ['S.No.', 'Date', 'Time', 'Record Number', 'Type', 'Title / Description', 'Party / Client Name', 'Amount (INR)', 'Cheque Number', 'Bank Name', 'Status'],
    ];

    records.forEach((rec, idx) => {
      rows.push([
        idx + 1,
        rec.date,
        rec.time,
        rec.recordNumber,
        rec.type === 'account_entry' ? 'Account Entry' : 'Cheque',
        rec.title,
        rec.partyName,
        rec.amount || 0,
        rec.chequeNumber || '-',
        rec.bankName || '-',
        rec.status || 'completed',
      ]);
    });

    rows.push([]);
    rows.push(['', '', '', '', '', 'Total Summary', '', totalAmount, '', '', '']);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);

    ws['!cols'] = [
      { wch: 8 },  // S.No.
      { wch: 14 }, // Date
      { wch: 12 }, // Time
      { wch: 18 }, // Record Number
      { wch: 16 }, // Type
      { wch: 28 }, // Title
      { wch: 26 }, // Party Name
      { wch: 16 }, // Amount
      { wch: 16 }, // Cheque Number
      { wch: 22 }, // Bank Name
      { wch: 14 }, // Status
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Accounts History');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `EasyList_Accounts_History_${dateStr}.xlsx`;

    if (typeof Blob !== 'undefined') {
      const blob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      triggerBrowserDownload(blob, filename);
    }

    return new Uint8Array(wbout);
  },

  /**
   * 10. Export filtered accounts history to PDF (.pdf) file
   */
  exportAccountsHistoryToPdf(
    records: AccountRecord[],
    meta: { storeName: string; tabLabel: string; dateRangeLabel: string }
  ): Uint8Array {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: false,
    });

    const totalAmount = records.reduce((sum, r) => sum + (r.amount || 0), 0);
    const now = new Date().toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Header banner
    doc.setFillColor(104, 66, 219); // #6842DB
    doc.rect(14, 12, 182, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text('EasyList Accounts History', 20, 23);

    doc.setFontSize(8.5);
    doc.text(`Store: ${meta.storeName}`, 190, 20, { align: 'right' });
    doc.text(`Date Range: ${meta.dateRangeLabel} | Filter: ${meta.tabLabel}`, 190, 26, { align: 'right' });

    // Summary metadata
    doc.setTextColor(23, 37, 84); // #172554
    doc.setFontSize(9);
    doc.text(`Generated: ${now}`, 14, 37);
    doc.text(`Total Records: ${records.length}    Total Value: Rs ${totalAmount.toLocaleString('en-IN')}`, 196, 37, { align: 'right' });

    const tableBody = records.map((rec, idx) => [
      String(idx + 1),
      `${rec.date} ${rec.time}`,
      rec.recordNumber,
      rec.type === 'account_entry' ? 'Account Entry' : 'Cheque',
      rec.partyName,
      `Rs ${(rec.amount || 0).toLocaleString('en-IN')}`,
    ]);

    autoTable(doc, {
      startY: 42,
      head: [['S.No.', 'Date & Time', 'Record No.', 'Type', 'Party / Client Name', 'Amount (INR)']],
      body: tableBody,
      foot: [
        [
          '',
          'Total Summary',
          '',
          `${records.length} records`,
          '',
          `Rs ${totalAmount.toLocaleString('en-IN')}`,
        ],
      ],
      theme: 'grid',
      styles: {
        fontSize: 8.5,
        textColor: [30, 41, 59],
        cellPadding: { top: 3.5, bottom: 3.5, left: 2.5, right: 2.5 },
        lineColor: [226, 232, 240],
        lineWidth: 0.15,
      },
      headStyles: {
        fillColor: [104, 66, 219], // #6842DB
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      footStyles: {
        fillColor: [248, 250, 252],
        textColor: [23, 37, 84],
        fontStyle: 'bold',
        fontSize: 9,
      },
      columnStyles: {
        0: { cellWidth: 14, halign: 'center' },
        1: { cellWidth: 32 },
        2: { cellWidth: 30 },
        3: { cellWidth: 28 },
        4: { cellWidth: 48 },
        5: { cellWidth: 30, halign: 'right' },
      },
      margin: { left: 14, right: 14, bottom: 18 },
    });

    const pdfOutput = doc.output('arraybuffer');
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `EasyList_Accounts_History_${dateStr}.pdf`;

    if (typeof Blob !== 'undefined') {
      const blob = new Blob([pdfOutput], { type: 'application/pdf' });
      triggerBrowserDownload(blob, filename);
    }

    return new Uint8Array(pdfOutput);
  },
};

export default exportService;
