import React from 'react';
import { Order } from '../../types/order';
import { formatINR, getFormattedDate, getFormattedTime } from '../../lib/utils';
import { QrCode, CheckCircle2 } from 'lucide-react';

interface InvoicePreviewProps {
  order: Order;
}

export const InvoicePreview: React.FC<InvoicePreviewProps> = ({ order }) => {
  return (
    <div
      className="invoice-card"
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '2.5rem',
        maxWidth: '820px',
        margin: '0 auto',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Top Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          borderBottom: '2px solid #f1f5f9',
          paddingBottom: '1.75rem',
          marginBottom: '1.75rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
            <img
              src="/images/EasyList logo.png"
              alt="Logo"
              style={{ width: '32px', height: '32px', objectFit: 'contain' }}
            />
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
              Easy<span style={{ color: '#2563eb' }}>Bill</span>
            </span>
            <span
              style={{
                backgroundColor: '#ecfdf5',
                color: '#059669',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.2rem 0.5rem',
                borderRadius: '9999px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <CheckCircle2 size={12} /> TAX INVOICE
            </span>
          </div>

          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b' }}>
            {order.store.name}
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b', maxWidth: '340px', marginTop: '2px' }}>
            {order.store.address}
          </p>
          <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>
            Phone: {order.store.phone} | GSTIN: {order.store.gstin || 'Unregistered'}
          </p>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Invoice Number
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
            {order.orderNumber}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.35rem' }}>
            Date: <strong>{getFormattedDate(order.date)}</strong>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            Time: {getFormattedTime(order.createdAt)}
          </div>
        </div>
      </div>

      {/* Bill To Info */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1.5rem',
          backgroundColor: '#f8fafc',
          padding: '1.2rem 1.5rem',
          borderRadius: '10px',
          marginBottom: '1.75rem',
        }}
      >
        <div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Billed To Customer
          </span>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
            {order.customer.name || 'Walk-in Customer'}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Phone: {order.customer.phone || 'N/A'}
          </div>
          {order.customer.address && (
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{order.customer.address}</div>
          )}
        </div>

        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Payment & Status
          </span>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#10b981', marginTop: '2px' }}>
            Digitized & Verified
          </div>
          {order.store.upiId && (
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
              UPI VPA: <span style={{ fontFamily: 'monospace', color: '#2563eb' }}>{order.store.upiId}</span>
            </div>
          )}
        </div>
      </div>

      {/* Table of items */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.75rem' }}>
        <thead>
          <tr style={{ backgroundColor: '#f1f5f9' }}>
            <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.8rem', color: '#475569', borderRadius: '6px 0 0 6px', width: '40px' }}>
              #
            </th>
            <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.8rem', color: '#475569' }}>
              Item Description
            </th>
            <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.8rem', color: '#475569', width: '90px' }}>
              Qty & Unit
            </th>
            <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.8rem', color: '#475569', width: '110px' }}>
              Rate (₹)
            </th>
            <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.8rem', color: '#475569', width: '120px', borderRadius: '0 6px 6px 0' }}>
              Amount (₹)
            </th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, idx) => (
            <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '0.65rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                {idx + 1}
              </td>
              <td style={{ padding: '0.65rem', fontSize: '0.9rem', color: '#1e293b', fontWeight: 500 }}>
                {item.name}
              </td>
              <td style={{ padding: '0.65rem', textAlign: 'center', fontSize: '0.85rem', color: '#475569' }}>
                {item.quantity} {item.unit}
              </td>
              <td style={{ padding: '0.65rem', textAlign: 'right', fontSize: '0.85rem', color: '#475569' }}>
                {formatINR(item.unitPrice)}
              </td>
              <td style={{ padding: '0.65rem', textAlign: 'right', fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>
                {formatINR(item.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary Totals & Payment Section */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: '2rem',
          borderTop: '2px solid #f1f5f9',
          paddingTop: '1.5rem',
        }}
      >
        {/* Payment info / QR code */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div
            style={{
              padding: '0.75rem',
              border: '1.5px solid #e2e8f0',
              borderRadius: '8px',
              backgroundColor: '#fafafa',
              textAlign: 'center',
            }}
          >
            <QrCode size={64} color="#0f172a" />
            <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '2px' }}>Scan to Pay</div>
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>Scan & Pay via UPI</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Supports GPay, PhonePe, Paytm</div>
            <div style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 600, marginTop: '2px' }}>
              {order.store.upiId}
            </div>
          </div>
        </div>

        {/* Calculation Lines */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#64748b' }}>
            <span>Subtotal ({order.items.length} items):</span>
            <span style={{ fontWeight: 600, color: '#334155' }}>{formatINR(order.subtotal)}</span>
          </div>

          {order.discount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#10b981' }}>
              <span>Store Discount:</span>
              <span>-{formatINR(order.discount)}</span>
            </div>
          )}

          {order.taxAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#64748b' }}>
              <span>GST ({order.taxRate}%):</span>
              <span style={{ fontWeight: 600, color: '#334155' }}>{formatINR(order.taxAmount)}</span>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              borderTop: '2px solid #e2e8f0',
              paddingTop: '0.75rem',
              marginTop: '0.5rem',
            }}
          >
            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Grand Total:</span>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2563eb' }}>
              {formatINR(order.grandTotal)}
            </span>
          </div>
        </div>
      </div>

      {/* Invoice Footer */}
      <div
        style={{
          marginTop: '2.5rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid #f1f5f9',
          textAlign: 'center',
          fontSize: '0.78rem',
          color: '#94a3b8',
        }}
      >
        Thank you for shopping at {order.store.name}! Generated digitally via EasyBill.
      </div>
    </div>
  );
};
