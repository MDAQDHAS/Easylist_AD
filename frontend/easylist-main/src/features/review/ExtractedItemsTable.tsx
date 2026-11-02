import React from 'react';
import {
  Plus,
  Trash2,
  AlertTriangle,
  Languages,
  Loader2,
  X,
  FileQuestion,
} from 'lucide-react';
import { OrderItem, Unit } from '../../types/order';
import { parsePositiveQuantity } from '../../context/OrderWorkflowContext';

interface ExtractedItemsTableProps {
  items: OrderItem[];
  onUpdateItem: (id: string, updates: Partial<OrderItem>) => void;
  onAddItem: () => void;
  onDeleteItem: (id: string) => void;
  currentLanguage: 'ta' | 'en';
  isTranslating: boolean;
  translationError: string | null;
  onToggleLanguage: () => void;
  onDismissTranslationError: () => void;
}

const COMMON_UNITS: { value: Unit; label: string }[] = [
  { value: 'kg', label: 'kg (Kilogram)' },
  { value: 'g', label: 'g (Gram)' },
  { value: 'ltr', label: 'ltr (Litre)' },
  { value: 'ml', label: 'ml (Millilitre)' },
  { value: 'pkt', label: 'pkt (Packet)' },
  { value: 'pcs', label: 'pcs (Pieces)' },
  { value: 'box', label: 'box (Box)' },
  { value: 'bottle', label: 'bottle (Bottle)' },
  { value: 'bundle', label: 'bundle (Bundle / கட்டு)' },
  { value: 'bag', label: 'bag (Bag / மூட்டை)' },
  { value: 'tin', label: 'tin (Tin)' },
  { value: 'dozen', label: 'dozen (Dozen / டஜன்)' },
];

export const ExtractedItemsTable: React.FC<ExtractedItemsTableProps> = ({
  items,
  onUpdateItem,
  onAddItem,
  onDeleteItem,
  currentLanguage,
  isTranslating,
  translationError,
  onToggleLanguage,
  onDismissTranslationError,
}) => {
  const uncertainItemsCount = items.filter(
    (item) =>
      item.isUncertain ||
      item.hasWarning ||
      (item.confidence !== undefined && item.confidence < 0.8) ||
      !item.name.trim() ||
      parsePositiveQuantity(item.quantity) === null ||
      !item.unit
  ).length;

  return (
    <div className="w-full bg-white rounded-[22px] border border-[#DCE5F2] shadow-xs p-4 sm:p-5 flex flex-col transition-all">
      {/* Header and Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-bold font-heading text-[#111827] leading-tight">
              Extracted List
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </span>
            {uncertainItemsCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[11px] font-semibold border border-amber-200/80">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                <span>{uncertainItemsCount} needs review</span>
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#64748B] mt-0.5">
            Verify names, quantities, and units before proceeding to export.
          </p>
        </div>

        {/* Translation & Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            id="btn-toggle-language"
            type="button"
            onClick={onToggleLanguage}
            disabled={isTranslating || items.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#DCE5F2] hover:bg-slate-50 text-[#111C35] text-xs font-semibold shadow-xs disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer transition-all"
            title="Switch between extracted product names and original handwritten text"
          >
            {isTranslating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#5046F2]" />
            ) : (
              <Languages className="w-3.5 h-3.5 text-[#5046F2]" />
            )}
            <span>
              {isTranslating
                ? 'Converting...'
                : currentLanguage === 'ta'
                ? 'Show Original Text'
                : 'Show Normalized Name'}
            </span>
          </button>

          <button
            id="btn-add-item"
            type="button"
            onClick={() => onAddItem()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#5046F2] hover:bg-[#4338CA] text-white text-xs font-semibold shadow-xs cursor-pointer transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Item</span>
          </button>
        </div>
      </div>

      {/* Backend Translation Status / Notice Banner */}
      {translationError && (
        <div className="mb-3 p-2.5 rounded-xl bg-blue-50/80 border border-blue-200/80 text-blue-900 text-xs flex items-start justify-between gap-2 animate-in fade-in duration-150">
          <div className="flex items-start gap-2">
            <span className="font-semibold shrink-0 mt-0.5">Note:</span>
            <span>{translationError}</span>
          </div>
          <button
            type="button"
            onClick={onDismissTranslationError}
            className="p-0.5 text-blue-500 hover:text-blue-800 rounded transition-colors cursor-pointer shrink-0"
            aria-label="Dismiss message"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Empty State when no items are present */}
      {items.length === 0 ? (
        <div className="flex-1 min-h-[360px] flex flex-col items-center justify-center p-6 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 my-2">
          <div className="w-14 h-14 rounded-2xl bg-[#EEF2FF] text-[#5046F2] flex items-center justify-center mb-3 shadow-xs">
            <FileQuestion className="w-7 h-7 stroke-[1.8]" />
          </div>
          <h4 className="text-sm sm:text-base font-bold font-heading text-[#111827]">
            No Extracted Items Yet
          </h4>
          <p className="text-xs text-[#64748B] mt-1 mb-4 max-w-sm">
            Upload a handwritten grocery order image to extract items automatically, or add items manually below.
          </p>
          <button
            id="btn-add-first-item"
            type="button"
            onClick={() => onAddItem()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#5046F2] hover:bg-[#4338CA] text-white text-xs font-semibold shadow-xs cursor-pointer transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add First Item</span>
          </button>
        </div>
      ) : (
        /* Editable Table */
        <div className="flex-1 overflow-x-auto min-h-[380px] max-h-[520px] overflow-y-auto rounded-xl border border-slate-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#F8FAFF] text-[#64748B] font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th className="py-2.5 pl-3 pr-1 w-10 text-center">#</th>
                <th className="py-2.5 px-3 min-w-[240px]">Product Name</th>
                <th className="py-2.5 px-2 w-28 text-center">Qty</th>
                <th className="py-2.5 px-2 w-36">Unit</th>
                <th className="py-2.5 pr-3 pl-2 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {items.map((item, index) => {
                const isNameMissing = !item.name.trim();
                const isQtyMissing = parsePositiveQuantity(item.quantity) === null;
                const isUnitMissing = !item.unit || !COMMON_UNITS.some((u) => u.value === item.unit);
                const isUncertain =
                  item.isUncertain ||
                  item.hasWarning ||
                  (item.confidence !== undefined && item.confidence < 0.8) ||
                  isNameMissing ||
                  isQtyMissing ||
                  isUnitMissing;

                return (
                  <tr
                    key={item.id}
                    className={`group transition-colors align-top ${
                      isUncertain
                        ? 'bg-amber-50/50 hover:bg-amber-50/80'
                        : 'hover:bg-slate-50/70'
                    }`}
                  >
                    {/* Row Index */}
                    <td className="py-3 pl-3 pr-1 text-center font-medium text-slate-400 select-none">
                      {index + 1}
                    </td>

                    {/* Product Name + Original Text + Warning (Full width, no truncation) */}
                    <td className="py-2 px-3">
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) =>
                            onUpdateItem(item.id, { name: e.target.value })
                          }
                          placeholder="e.g. Toor Dal / துவரம் பருப்பு"
                          className={`w-full h-9 px-3 rounded-lg border text-xs sm:text-sm text-[#111827] font-medium transition-all focus:outline-none focus:ring-2 focus:ring-[#5046F2]/30 ${
                            isNameMissing || isUncertain
                              ? 'border-amber-300 bg-white pr-7'
                              : 'border-slate-200 bg-slate-50/50 focus:bg-white focus:border-[#5046F2]'
                          }`}
                        />
                        {isUncertain && (
                          <div
                            className="absolute right-2 text-amber-600"
                            title={
                              item.warningMessage ||
                              'Low OCR confidence: please verify this item against handwritten chit'
                            }
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>

                      {item.originalText && item.originalText.trim() && (
                        <div className="mt-1 text-[11px] text-slate-500 break-words leading-relaxed" title={item.originalText}>
                          Handwritten: <span className="font-medium text-slate-700">{item.originalText}</span>
                        </div>
                      )}

                      {(item.englishName || item.tamilName) && (
                        <div className="mt-0.5 flex flex-wrap gap-1.5 text-[10px]">
                          {item.englishName && item.englishName !== item.name && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                              EN: {item.englishName}
                            </span>
                          )}
                          {item.tamilName && item.tamilName !== item.name && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-medium">
                              தமிழ்: {item.tamilName}
                            </span>
                          )}
                        </div>
                      )}

                      {isUncertain && item.warningMessage && (
                        <div className="mt-1 text-[10px] text-amber-700 font-medium leading-snug">
                          {item.warningMessage}
                        </div>
                      )}
                    </td>

                    {/* Quantity */}
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={item.quantity}
                        onChange={(e) =>
                          onUpdateItem(item.id, { quantity: e.target.value })
                        }
                        placeholder="Qty"
                        className={`w-full h-9 px-2 rounded-lg border text-xs sm:text-sm text-[#111827] font-medium text-center transition-all focus:outline-none focus:ring-2 focus:ring-[#5046F2]/30 ${
                          isQtyMissing
                            ? 'border-amber-300 bg-white'
                            : 'border-slate-200 bg-slate-50/50 focus:bg-white focus:border-[#5046F2]'
                        }`}
                      />
                    </td>

                    {/* Unit Selector */}
                    <td className="py-2 px-2">
                      <select
                        value={item.unit}
                        onChange={(e) =>
                          onUpdateItem(item.id, { unit: e.target.value as Unit })
                        }
                        className={`w-full h-9 px-2 rounded-lg border text-xs sm:text-sm text-[#111827] font-medium transition-all focus:outline-none focus:ring-2 focus:ring-[#5046F2]/30 cursor-pointer ${
                          isUnitMissing
                            ? 'border-amber-300 bg-white'
                            : 'border-slate-200 bg-slate-50/50 focus:bg-white focus:border-[#5046F2]'
                        }`}
                      >
                        <option value="">-- No unit --</option>
                        {item.unit &&
                          !COMMON_UNITS.some((unit) => unit.value === item.unit) && (
                            <option value={item.unit} disabled>
                              Review: {item.unit}
                            </option>
                          )}
                        {COMMON_UNITS.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Delete Action */}
                    <td className="py-2 pr-3 pl-2 text-center">
                      <button
                        type="button"
                        onClick={() => onDeleteItem(item.id)}
                        className="p-2 min-w-[36px] min-h-[36px] inline-flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Item"
                        aria-label={`Delete ${item.name || 'item'}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Table Footer with Add Row Shortcut & Item Count */}
      {items.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748B]">
          <button
            id="btn-add-another-item"
            type="button"
            onClick={() => onAddItem()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5046F2] hover:text-[#4338CA] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add another item</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#111827]">
              {items.length} {items.length === 1 ? 'item' : 'items'} in order
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExtractedItemsTable;