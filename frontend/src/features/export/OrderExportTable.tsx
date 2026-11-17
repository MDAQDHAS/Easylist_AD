import React, { useState } from 'react';
import { Copy, Check, ArrowLeft, Layers } from 'lucide-react';
import { OrderItem } from '../../types/order';
import { exportService } from '../../services/exportService';
import { parsePositiveQuantity } from '../../context/OrderWorkflowContext';

interface OrderExportTableProps {
  items: OrderItem[];
  onEditItems?: () => void;
  onToast?: (message: string, isError?: boolean) => void;
}

export const OrderExportTable: React.FC<OrderExportTableProps> = ({
  items,
  onEditItems,
  onToast,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);

  const handleCopyRow = async (item: OrderItem) => {
    const success = await exportService.copyRowItem(item);
    if (success) {
      setCopiedId(item.id);
      if (onToast) {
        onToast(`Copied to clipboard: ${item.name.trim()} - ${item.quantity} ${item.unit}`);
      }
      setTimeout(() => setCopiedId(null), 2000);
    } else {
      if (onToast) {
        onToast('Failed to copy to clipboard', true);
      }
    }
  };

  const handleCopyAll = async () => {
    const success = await exportService.copyAllItems(items);
    if (success) {
      setCopiedAll(true);
      if (onToast) {
        onToast('Copied all items to clipboard');
      }
      setTimeout(() => setCopiedAll(false), 2000);
    } else {
      if (onToast) {
        onToast('Failed to copy to clipboard', true);
      }
    }
  };

  return (
    <div className="w-full bg-white rounded-[22px] border border-[#DCE5F2] shadow-xs overflow-hidden transition-all flex flex-col">
      {/* 1. Header: Final Order List, Product Count & Edit Items */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] text-[#5046F2] flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold font-heading text-[#111827]">
                Final Order List
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-[#EEF2FF] text-[#5046F2] text-xs font-bold border border-[#C7D2FE]/60">
                {items.length} {items.length === 1 ? 'product' : 'products'}
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Verified items from Extract & Review ready for export
            </p>
          </div>
        </div>

        {onEditItems && (
          <button
            id="btn-edit-items"
            type="button"
            onClick={onEditItems}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-[#DCE5F2] hover:bg-slate-50 text-[#111C35] text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Edit Items</span>
          </button>
        )}
      </div>

      {/* 2. Structured Product Table: #, Product Name, Quantity, Unit, Copy Action (No Price / Line Total columns) */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="bg-[#F8FAFF] text-[#475569] font-bold text-[11px] sm:text-xs uppercase tracking-wider border-b border-slate-200">
              <th className="py-3 px-3 sm:px-4 w-12 text-center">#</th>
              <th className="py-3 px-3 sm:px-4">Product Name</th>
              <th className="py-3 px-3 sm:px-4 w-24 sm:w-28 text-center">Quantity</th>
              <th className="py-3 px-3 sm:px-4 w-24 sm:w-28 text-center">Unit</th>
              <th className="py-3 px-3 w-14 text-center">Copy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {items.map((item, index) => {
              const isItemCopied = copiedId === item.id;
              const qty = parsePositiveQuantity(item.quantity);

              return (
                <tr
                  key={item.id || index}
                  className="hover:bg-slate-50/70 transition-colors group"
                >
                  {/* 1. Item Number (#) */}
                  <td className="py-3 px-3 sm:px-4 text-center font-medium text-slate-400 select-none">
                    {index + 1}
                  </td>

                  {/* 2. Product Name + Original Handwritten Text (No truncation) */}
                  <td className="py-3 px-3 sm:px-4 text-[#111827]">
                    <span className="font-semibold break-words leading-snug block">
                      {item.name || '—'}
                    </span>
                    {item.originalText && item.originalText.trim() && (
                      <span className="text-[11px] text-slate-500 block mt-0.5 break-words font-tamil">
                        Handwritten: {item.originalText}
                      </span>
                    )}
                  </td>

                  {/* 3. Quantity */}
                  <td className="py-3 px-3 sm:px-4 text-center">
                    <span className="inline-block px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800 text-xs sm:text-sm font-bold min-w-[32px]">
                      {qty !== null ? qty : '—'}
                    </span>
                  </td>

                  {/* 4. Unit */}
                  <td className="py-3 px-3 sm:px-4 text-center">
                    <span className="inline-block px-2.5 py-0.5 rounded-md bg-[#EEF2FF] text-[#5046F2] text-[11px] sm:text-xs font-bold uppercase tracking-wider border border-[#C7D2FE]/50 min-w-[38px]">
                      {item.unit || '—'}
                    </span>
                  </td>

                  {/* 5. Copy Action */}
                  <td className="py-2.5 px-2 sm:px-3 text-center">
                    <button
                      id={`btn-copy-item-${index}`}
                      type="button"
                      onClick={() => handleCopyRow(item)}
                      title={`Copy "${item.name} - ${item.quantity} ${item.unit}"`}
                      aria-label={`Copy ${item.name}`}
                      className={`p-2 min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                        isItemCopied
                          ? 'bg-emerald-50 text-emerald-600 scale-105'
                          : 'text-slate-400 hover:text-[#5046F2] hover:bg-slate-100'
                      }`}
                    >
                      {isItemCopied ? (
                        <Check className="w-4 h-4 stroke-[2.5]" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 3. Footer: Product Count + Copy All Items Button (No monetary Grand Total) */}
      <div className="p-4 bg-[#F8FAFF] border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div>
          <span className="text-sm font-bold text-[#111827] block">
            {items.length} {items.length === 1 ? 'Product' : 'Products'} in Order
          </span>
          <span className="text-[11px] text-[#64748B] block mt-0.5">
            Verified items ready for export
          </span>
        </div>

        <button
          id="btn-copy-all-items"
          type="button"
          onClick={handleCopyAll}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer ${
            copiedAll
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
              : 'bg-[#5046F2] hover:bg-[#4338CA] text-white shadow-sm'
          }`}
        >
          {copiedAll ? (
            <>
              <Check className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
              <span>Copied All Items!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copy All Items</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default OrderExportTable;