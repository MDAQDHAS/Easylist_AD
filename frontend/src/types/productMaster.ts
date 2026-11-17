/**
 * Product Master Type Definitions
 * Represents shop product catalogs imported from customer spreadsheets.
 */

export interface ProductMasterFile {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedAt: string; // ISO date string
  updatedAt: string; // ISO date string
  productCount: number;
  columns: string[]; // Original column names in exact spreadsheet order
  rows: Record<string, any>[]; // Original row records preserving column keys
  rawBase64?: string; // Optional raw base64 data for exact 1:1 original download
}

export interface ProductMasterMatchDetails {
  matched: boolean;
  matchedRow?: Record<string, any>;
  productName?: string;
  hsn?: string;
  gst?: string | number;
  unit?: string;
  packing?: string;
  rate?: number;
  confidence: number;
  isAmbiguous?: boolean;
  candidateRows?: Record<string, any>[];
}

