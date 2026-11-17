/**
 * Product Master Service
 * Handles parsing, persistence, downloading, and matching of shop product spreadsheets.
 */

import * as XLSXModule from 'xlsx-js-style';
import { ProductMasterFile, ProductMasterMatchDetails } from '../types/productMaster';
import { OrderItem } from '../types/order';
import { storage } from '../lib/storage';
import { generateId } from '../lib/utils';

const XLSX = (
  (XLSXModule as unknown as { default?: typeof XLSXModule }).default || XLSXModule
) as typeof XLSXModule;

/**
 * Triggers browser download of a Blob.
 */
function triggerBrowserDownload(blob: Blob, fileName: string): void {
  if (typeof window === 'undefined') return;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Convert ArrayBuffer to Base64 safely in browser
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return typeof window !== 'undefined' ? window.btoa(binary) : '';
}

/**
 * Convert Base64 to Blob
 */
function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

export const productMasterService = {
  /**
   * Parse an uploaded Excel or CSV file, preserving exact original headers and row order.
   */
  async parseSpreadsheetFile(file: File): Promise<ProductMasterFile> {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('The uploaded file does not contain any readable sheets.');
    }

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    if (!worksheet) {
      throw new Error('The uploaded sheet is empty or damaged.');
    }

    // Convert sheet to array of rows (header: 1 gives raw 2D array of cells)
    const rawMatrix: any[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });

    if (!rawMatrix || rawMatrix.length === 0) {
      throw new Error('The spreadsheet has no data rows.');
    }

    // Find the first row that has non-empty text to use as column headers
    let headerRowIndex = 0;
    while (
      headerRowIndex < rawMatrix.length &&
      rawMatrix[headerRowIndex].filter((c) => String(c).trim().length > 0).length === 0
    ) {
      headerRowIndex++;
    }

    if (headerRowIndex >= rawMatrix.length) {
      throw new Error('Could not identify any valid column headers in the spreadsheet.');
    }

    const rawHeaderRow = rawMatrix[headerRowIndex];

    // Determine actual column headers in their original order
    const columns: string[] = [];
    let lastNonEmptyCol = -1;
    for (let c = 0; c < rawHeaderRow.length; c++) {
      if (String(rawHeaderRow[c]).trim().length > 0) {
        lastNonEmptyCol = c;
      }
    }

    if (lastNonEmptyCol === -1) {
      throw new Error('No column headers detected in the file.');
    }

    const seenColCounts: Record<string, number> = {};
    for (let c = 0; c <= lastNonEmptyCol; c++) {
      let rawName = String(rawHeaderRow[c] ?? '').trim();
      if (!rawName) {
        rawName = `Column_${c + 1}`;
      }
      // Ensure unique header key if duplicate header names exist in original sheet
      if (seenColCounts[rawName] !== undefined) {
        seenColCounts[rawName] += 1;
        columns.push(`${rawName}_${seenColCounts[rawName]}`);
      } else {
        seenColCounts[rawName] = 0;
        columns.push(rawName);
      }
    }

    // Parse data rows starting after headerRowIndex
    const rows: Record<string, any>[] = [];
    for (let r = headerRowIndex + 1; r < rawMatrix.length; r++) {
      const rowData = rawMatrix[r];
      // Check if row has at least one cell with content
      const hasContent = rowData.some((cell) => cell !== undefined && cell !== null && String(cell).trim().length > 0);
      if (!hasContent) continue;

      const rowObj: Record<string, any> = { _rowIndex: rows.length + 1, _rowId: generateId() };
      for (let c = 0; c < columns.length; c++) {
        const colKey = columns[c];
        const cellVal = rowData[c];
        rowObj[colKey] = cellVal !== undefined && cellVal !== null ? cellVal : '';
      }
      rows.push(rowObj);
    }

    if (rows.length === 0) {
      throw new Error('No product data rows found under the spreadsheet headers.');
    }

    // Capture raw base64 representation for exact 1:1 original download
    let rawBase64: string | undefined;
    try {
      rawBase64 = arrayBufferToBase64(arrayBuffer);
    } catch {
      // Safe fallback if buffer is huge
      rawBase64 = undefined;
    }

    const now = new Date().toISOString();
    const productMaster: ProductMasterFile = {
      id: generateId(),
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || (file.name.endsWith('.csv') ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
      uploadedAt: now,
      updatedAt: now,
      productCount: rows.length,
      columns,
      rows,
      rawBase64,
    };

    return productMaster;
  },

  /**
   * Save Product Master to local storage
   */
  saveProductMaster(master: ProductMasterFile): void {
    storage.saveProductMaster(master);
  },

  /**
   * Retrieve Product Master from local storage
   */
  getProductMaster(): ProductMasterFile | null {
    return storage.getProductMaster();
  },

  /**
   * Remove Product Master from local storage
   */
  deleteProductMaster(): void {
    storage.deleteProductMaster();
  },

  /**
   * Add a new product row into an existing Product Master.
   * Immediately updates rows, product count, and saves to storage.
   */
  addProductItem(master: ProductMasterFile, newItemData: Record<string, any>): ProductMasterFile {
    const newRowId = generateId();
    const newRow: Record<string, any> = {
      _rowIndex: master.rows.length + 1,
      _rowId: newRowId,
    };

    // Ensure all columns exist in the new row
    for (const col of master.columns) {
      newRow[col] = newItemData[col] !== undefined && newItemData[col] !== null ? newItemData[col] : '';
    }

    const updatedRows = [...master.rows, newRow];
    const updatedMaster: ProductMasterFile = {
      ...master,
      rows: updatedRows,
      productCount: updatedRows.length,
      updatedAt: new Date().toISOString(),
      rawBase64: undefined, // Clear raw base64 cache so downloads include the new product
    };

    this.saveProductMaster(updatedMaster);
    return updatedMaster;
  },

  /**
   * Update an existing product row in the Product Master.
   */
  updateProductItem(
    master: ProductMasterFile,
    rowIdentifier: string | number,
    updatedData: Record<string, any>
  ): ProductMasterFile {
    const updatedRows = master.rows.map((row) => {
      const isMatch =
        row._rowId === rowIdentifier ||
        String(row._rowIndex) === String(rowIdentifier) ||
        row.id === rowIdentifier;

      if (!isMatch) return row;

      const updatedRow: Record<string, any> = { ...row };
      for (const col of master.columns) {
        if (updatedData[col] !== undefined) {
          updatedRow[col] = updatedData[col];
        }
      }
      return updatedRow;
    });

    const updatedMaster: ProductMasterFile = {
      ...master,
      rows: updatedRows,
      updatedAt: new Date().toISOString(),
      rawBase64: undefined,
    };

    this.saveProductMaster(updatedMaster);
    return updatedMaster;
  },

  /**
   * Delete a product row from the Product Master after confirmation.
   */
  deleteProductItem(
    master: ProductMasterFile,
    rowIdentifier: string | number
  ): ProductMasterFile {
    const updatedRows = master.rows
      .filter((row) => {
        const isMatch =
          row._rowId === rowIdentifier ||
          String(row._rowIndex) === String(rowIdentifier) ||
          row.id === rowIdentifier;
        return !isMatch;
      })
      .map((row, idx) => ({ ...row, _rowIndex: idx + 1 }));

    const updatedMaster: ProductMasterFile = {
      ...master,
      rows: updatedRows,
      productCount: updatedRows.length,
      updatedAt: new Date().toISOString(),
      rawBase64: undefined,
    };

    this.saveProductMaster(updatedMaster);
    return updatedMaster;
  },

  /**
   * Download the original uploaded Excel / CSV file without altering its structure.
   */
  downloadOriginalFile(master: ProductMasterFile): void {
    if (master.rawBase64) {
      const mime = master.fileType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const blob = base64ToBlob(master.rawBase64, mime);
      triggerBrowserDownload(blob, master.fileName);
      return;
    }

    // Fallback: reconstruct workbook preserving original column headers & order
    const wb = XLSX.utils.book_new();
    // Prepare clean row objects containing only original columns
    const cleanRows = master.rows.map((row) => {
      const r: Record<string, any> = {};
      for (const col of master.columns) {
        r[col] = row[col] ?? '';
      }
      return r;
    });

    const ws = XLSX.utils.json_to_sheet(cleanRows, { header: master.columns });
    XLSX.utils.book_append_sheet(wb, ws, 'Product Master');

    const isCsv = master.fileName.toLowerCase().endsWith('.csv');
    if (isCsv) {
      const csvOutput = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
      triggerBrowserDownload(blob, master.fileName);
    } else {
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      triggerBrowserDownload(blob, master.fileName);
    }
  },

  /**
   * Match an extracted order product against the uploaded Product Master.
   * Never invents HSN codes, GST, or rates. Returns actual values from the sheet if found.
   */
  matchProductAgainstMaster(
    extractedName: string,
    master: ProductMasterFile | null
  ): ProductMasterMatchDetails {
    if (!master || !master.rows || master.rows.length === 0 || !extractedName.trim()) {
      return {
        matched: false,
        confidence: 0,
      };
    }

    const query = extractedName.trim().toLowerCase();

    // Identify candidate name columns
    const nameCols = master.columns.filter((c) =>
      /product|item|name|description|particular|பொருள்/i.test(c)
    );
    const candidateCols = nameCols.length > 0 ? nameCols : [master.columns[0]];

    // Identify optional detail columns
    const hsnCol = master.columns.find((c) => /hsn|sac/i.test(c));
    const gstCol = master.columns.find((c) => /gst|tax|vat/i.test(c));
    const unitCol = master.columns.find((c) => /unit|uom/i.test(c));
    const packCol = master.columns.find((c) => /pack|pkg/i.test(c));
    const rateCol = master.columns.find((c) => /rate|price|mrp|cost|selling/i.test(c));

    // 1. Exact match
    let matchedRow: Record<string, any> | undefined;
    let matchedName: string | undefined;

    for (const row of master.rows) {
      for (const col of candidateCols) {
        const val = String(row[col] ?? '').trim().toLowerCase();
        if (val && val === query) {
          matchedRow = row;
          matchedName = String(row[col]);
          break;
        }
      }
      if (matchedRow) break;
    }

    // 2. Substring / Token overlap match if not exact
    const candidateMatches: { row: Record<string, any>; name: string; score: number }[] = [];

    if (!matchedRow) {
      const queryTokens = query.split(/\s+/).filter((t) => t.length >= 2);
      if (queryTokens.length > 0) {
        for (const row of master.rows) {
          for (const col of candidateCols) {
            const val = String(row[col] ?? '').trim().toLowerCase();
            if (!val) continue;

            let score = 0;
            if (val === query) {
              score = 1.0;
            } else if (val.startsWith(query)) {
              score = 0.90;
            } else if (val.includes(query)) {
              score = 0.82;
            } else {
              const matchedTokens = queryTokens.filter((token) => val.includes(token));
              if (matchedTokens.length > 0) {
                score = (matchedTokens.length / queryTokens.length) * 0.8;
              }
            }

            if (score >= 0.7) {
              candidateMatches.push({ row, name: String(row[col]), score });
              break; // Don't add duplicate row for multiple cols
            }
          }
        }
      }

      // Sort candidate matches by score descending
      candidateMatches.sort((a, b) => b.score - a.score);

      // If multiple different products match (e.g. "Good Day" matches Butter 100g, Cashew 100g, etc.)
      // and none is an exact match: treat as Ambiguous / Needs Review so staff can select the exact variation!
      if (candidateMatches.length > 1 && candidateMatches[0].score < 0.95) {
        return {
          matched: false,
          isAmbiguous: true,
          candidateRows: candidateMatches.slice(0, 15).map((m) => m.row),
          confidence: 0.5,
        };
      }

      if (candidateMatches.length === 1 && candidateMatches[0].score >= 0.75) {
        matchedRow = candidateMatches[0].row;
        matchedName = candidateMatches[0].name;
      }
    }

    if (!matchedRow) {
      return {
        matched: false,
        confidence: 0,
      };
    }

    // Extract genuine fields from the actual sheet without guessing
    const rawRate = rateCol ? Number(String(matchedRow[rateCol]).replace(/[^0-9.]/g, '')) : undefined;
    const rate = !isNaN(rawRate as number) && rawRate! > 0 ? (rawRate as number) : undefined;

    return {
      matched: true,
      matchedRow,
      productName: matchedName,
      hsn: hsnCol && matchedRow[hsnCol] ? String(matchedRow[hsnCol]).trim() : undefined,
      gst: gstCol && matchedRow[gstCol] ? String(matchedRow[gstCol]).trim() : undefined,
      unit: unitCol && matchedRow[unitCol] ? String(matchedRow[unitCol]).trim() : undefined,
      packing: packCol && matchedRow[packCol] ? String(matchedRow[packCol]).trim() : undefined,
      rate,
      confidence: 0.95,
    };
  },

  /**
   * Search Product Master by name, brand, variation, code, or HSN code.
   * Returns matching row records for searchable dropdowns.
   */
  searchProductMaster(
    master: ProductMasterFile | null,
    query: string,
    limit: number = 30
  ): Record<string, any>[] {
    if (!master || !master.rows || master.rows.length === 0) {
      return [];
    }

    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return master.rows.slice(0, limit);
    }

    const tokens = trimmed.split(/\s+/).filter(Boolean);

    const scoredRows = master.rows
      .map((row) => {
        let maxScore = 0;
        let combinedText = '';

        for (const col of master.columns) {
          const val = String(row[col] ?? '').toLowerCase();
          combinedText += ' ' + val;

          if (val === trimmed) {
            maxScore = Math.max(maxScore, 100);
          } else if (val.startsWith(trimmed)) {
            maxScore = Math.max(maxScore, 75);
          } else if (val.includes(trimmed)) {
            maxScore = Math.max(maxScore, 50);
          }
        }

        // Token match
        let tokenHits = 0;
        for (const t of tokens) {
          if (combinedText.includes(t)) {
            tokenHits++;
          }
        }

        if (tokenHits > 0) {
          const tokenScore = (tokenHits / tokens.length) * 45;
          maxScore = Math.max(maxScore, tokenScore);
        }

        return { row, score: maxScore };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    return scoredRows.slice(0, limit).map((item) => item.row);
  },

  /**
   * Apply Product Master details to an OrderItem if a genuine match is found.
   */
  enhanceOrderItemWithMaster(item: OrderItem, master: ProductMasterFile | null): OrderItem {
    if (!master) return item;
    const match = this.matchProductAgainstMaster(item.name, master);

    if (match.matched && match.productName) {
      return {
        ...item,
        name: match.productName || item.name,
        unit: (match.unit || item.unit) as any,
        unitPrice: match.rate !== undefined && match.rate > 0 ? match.rate : item.unitPrice,
        confidence: Math.max(item.confidence || 0, match.confidence),
        hasWarning: false,
        isUncertain: false,
      };
    }

    // Flag unmatched/uncertain products for manual review
    return {
      ...item,
      isUncertain: true,
    };
  },
};

