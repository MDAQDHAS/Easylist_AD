import React, { useState } from 'react';
import {
  FileDown,
  Printer,
  Share2,
  Table,
  PlusCircle,
  ArrowLeft,
  CheckCircle2,
  Copy,
} from 'lucide-react';
import { Order } from '../../types/order';
import { exportService } from '../../services/exportService';
import { Button } from '../../components/ui/Button';
import { InvoicePreview } from './InvoicePreview';
import { Toast } from '../../components/ui/Toast';

interface OrderExportProps {
  order: Order;
  onNewOrder: () => void;
  onBackToReview: () => void;
}

export const OrderExport: React.FC<OrderExportProps> = ({
  order,
  onNewOrder,
  onBackToReview,
}) => {
  const [toastMessage, setToastMessage] = useState<string | null>(
    'Order digitized and verified successfully!'
  );

  const handleCopyOrderSummary = () => {
    const text = `Order #${order.orderNumber} - ${order.customer.name || 'Walk-in'} - ${order.items.length} items - Total: ₹${order.grandTotal}`;
    navigator.clipboard.writeText(text);
    setToastMessage('Order summary copied to clipboard!');
  };

  return (
    <div>
      {/* Toast Notification */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          type="success"
          onClose={() => setToastMessage(null)}
        />
      )}

      {/* Action Header Card */}
      <div
        className="no-print"
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '1.5rem',
          marginBottom: '1.75rem',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1.25rem',
            paddingBottom: '1rem',
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#059669', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.2rem' }}>
              <CheckCircle2 size={18} />
              ORDER DIGITIZED & READY TO EXPORT
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
              Invoice {order.orderNumber}
            </h2>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={onBackToReview}
              icon={<ArrowLeft size={16} />}
            >
              Edit Items
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onNewOrder}
              icon={<PlusCircle size={16} />}
            >
              Start New Order
            </Button>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Button
            variant="primary"
            onClick={() => exportService.exportToPdf(order)}
            icon={<FileDown size={18} />}
          >
            Download PDF Invoice
          </Button>

          <Button
            variant="outline"
            onClick={() => exportService.exportToExcel(order)}
            icon={<Table size={18} />}
          >
            Download Excel (.xlsx)
          </Button>

          <Button
            variant="success"
            onClick={() => exportService.shareOnWhatsApp(order)}
            icon={<Share2 size={18} />}
            style={{ backgroundColor: '#25D366' }}
          >
            Send on WhatsApp
          </Button>

          <Button
            variant="secondary"
            onClick={() => exportService.printBill()}
            icon={<Printer size={18} />}
          >
            Print Receipt
          </Button>

          <Button
            variant="ghost"
            onClick={handleCopyOrderSummary}
            icon={<Copy size={16} />}
          >
            Copy Summary
          </Button>
        </div>
      </div>

      {/* Invoice Document Preview */}
      <div style={{ marginBottom: '2.5rem' }}>
        <InvoicePreview order={order} />
      </div>
    </div>
  );
};
