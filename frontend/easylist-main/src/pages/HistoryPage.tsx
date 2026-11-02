import React, { useState } from 'react';
import { Search, FileText, Download, Trash2, Calendar, User, Phone, Eye, PlusCircle } from 'lucide-react';
import { useOrdersHistory } from '../hooks/useOrdersHistory';
import { formatINR, getFormattedDate } from '../lib/utils';
import { exportService } from '../services/exportService';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { InvoicePreview } from '../features/export/InvoicePreview';
import { Order } from '../types/order';

interface HistoryPageProps {
  onStartNewOrder: () => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({ onStartNewOrder }) => {
  const { orders, totalCount, searchQuery, setSearchQuery, removeOrder } = useOrdersHistory();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>
            Order History
          </h2>
          <p style={{ fontSize: '0.9rem', color: '#64748b' }}>
            Browse and retrieve previous digitized orders and generated invoices.
          </p>
        </div>

        <Button variant="primary" onClick={onStartNewOrder} icon={<PlusCircle size={16} />}>
          New Order
        </Button>
      </div>

      {/* Search Input Bar */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '0.75rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1.5rem',
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        <Search size={18} color="#94a3b8" />
        <input
          type="text"
          placeholder="Search by order number, customer name, phone, or date..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            border: 'none',
            outline: 'none',
            fontSize: '0.95rem',
            width: '100%',
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Orders List / Cards */}
      {orders.length === 0 ? (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '4rem 2rem',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
            }}
          >
            <FileText size={32} />
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
            {totalCount === 0 ? 'No digitized orders yet' : 'No matching orders found'}
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
            {totalCount === 0
              ? 'Upload handwritten store orders to digitize them and build your digital order archive.'
              : 'Try searching with a different customer name or order number.'}
          </p>
          {totalCount === 0 && (
            <Button variant="primary" onClick={onStartNewOrder} icon={<PlusCircle size={16} />}>
              Digitize Your First Order
            </Button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {orders.map((order) => (
            <div
              key={order.id}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                boxShadow: 'var(--shadow-xs)',
                transition: 'all 150ms ease',
              }}
            >
              {/* Order Info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    backgroundColor: '#eff6ff',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FileText size={22} />
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>
                      {order.orderNumber}
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '9999px',
                      }}
                    >
                      {order.items.length} items
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1.25rem',
                      fontSize: '0.82rem',
                      color: '#64748b',
                      marginTop: '0.25rem',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Calendar size={13} /> {getFormattedDate(order.date)}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <User size={13} /> {order.customer.name || 'Walk-in'}
                    </span>
                    {order.customer.phone && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Phone size={13} /> {order.customer.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Price & Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Total Amount</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#2563eb' }}>
                    {formatINR(order.grandTotal)}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedOrder(order)}
                    icon={<Eye size={15} />}
                  >
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportService.exportToPdf(order)}
                    icon={<Download size={15} />}
                  >
                    PDF
                  </Button>
                  <button
                    type="button"
                    className="btn-icon-danger"
                    onClick={() => {
                      if (confirm(`Delete order ${order.orderNumber}?`)) {
                        removeOrder(order.id);
                      }
                    }}
                    title="Delete Order"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Invoice Viewer Modal */}
      {selectedOrder && (
        <Modal
          isOpen={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          title={`Invoice ${selectedOrder.orderNumber}`}
          maxWidth="850px"
        >
          <InvoicePreview order={selectedOrder} />
          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button variant="outline" onClick={() => setSelectedOrder(null)}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={() => exportService.exportToPdf(selectedOrder)}
              icon={<Download size={16} />}
            >
              Download PDF
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};
