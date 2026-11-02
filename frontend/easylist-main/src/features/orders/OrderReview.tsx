import React, { useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  FileCheck,
  User,
  Phone,
  Sparkles,
} from 'lucide-react';
import { CustomerInfo, OrderItem, Unit } from '../../types/order';
import { AVAILABLE_UNITS } from '../../lib/constants';
import { formatINR } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

interface OrderReviewProps {
  imageSrc: string | null;
  items: OrderItem[];
  customer: CustomerInfo;
  taxRate: number;
  discount: number;
  totals: {
    subtotal: number;
    taxAmount: number;
    discountAmount: number;
    grandTotal: number;
  };
  onUpdateItem: (id: string, updates: Partial<OrderItem>) => void;
  onAddItem: () => void;
  onDeleteItem: (id: string) => void;
  onUpdateCustomer: (customer: CustomerInfo) => void;
  onUpdateTaxRate: (rate: number) => void;
  onUpdateDiscount: (discount: number) => void;
  onProceedToExport: () => void;
  onBackToUpload: () => void;
}

export const OrderReview: React.FC<OrderReviewProps> = ({
  imageSrc,
  items,
  customer,
  taxRate,
  discount,
  totals,
  onUpdateItem,
  onAddItem,
  onDeleteItem,
  onUpdateCustomer,
  onUpdateTaxRate,
  onUpdateDiscount,
  onProceedToExport,
  onBackToUpload,
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 2.5));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.75));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleResetView = () => {
    setZoom(1);
    setRotation(0);
  };

  return (
    <div>
      {/* Step Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>
            Extract & Review Order
          </h2>
          <p style={{ fontSize: '0.88rem', color: '#64748b' }}>
            Verify handwritten recognition, adjust quantities, units, and rates before generating the invoice.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Button variant="outline" size="sm" onClick={onBackToUpload} icon={<ArrowLeft size={16} />}>
            Back to Upload
          </Button>
          <Button variant="primary" size="sm" onClick={onProceedToExport} icon={<ArrowRight size={16} />}>
            Proceed to Export
          </Button>
        </div>
      </div>

      {/* Split Grid */}
      <div className="review-grid">
        {/* Left Column: Image Inspector */}
        <div className="image-inspector-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Original Handwritten Note</span>
            <Badge variant="info">
              <Sparkles size={12} /> {items.length} items detected
            </Badge>
          </div>

          <div className="inspector-image-frame">
            {imageSrc ? (
              <img
                src={imageSrc}
                alt="Uploaded Handwritten Chit"
                className="inspector-image"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                }}
              />
            ) : (
              <div style={{ color: '#94a3b8' }}>No image loaded</div>
            )}
          </div>

          <div className="inspector-controls">
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Zoom: {Math.round(zoom * 100)}%</span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                type="button"
                className="btn-icon-danger"
                style={{ color: '#475569' }}
                onClick={handleZoomIn}
                title="Zoom In"
              >
                <ZoomIn size={16} />
              </button>
              <button
                type="button"
                className="btn-icon-danger"
                style={{ color: '#475569' }}
                onClick={handleZoomOut}
                title="Zoom Out"
              >
                <ZoomOut size={16} />
              </button>
              <button
                type="button"
                className="btn-icon-danger"
                style={{ color: '#475569' }}
                onClick={handleRotate}
                title="Rotate 90°"
              >
                <RotateCw size={16} />
              </button>
              <button
                type="button"
                style={{
                  background: 'none',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.5rem',
                  cursor: 'pointer',
                  color: '#475569',
                }}
                onClick={handleResetView}
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Editable Items Table & Customer Details */}
        <div className="items-table-card">
          {/* Customer Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
              padding: '0.85rem 1rem',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              marginBottom: '1rem',
            }}
          >
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}>
                <User size={14} /> Customer Name
              </label>
              <input
                type="text"
                className="table-input"
                placeholder="Walk-in Customer"
                value={customer.name}
                onChange={(e) => onUpdateCustomer({ ...customer, name: e.target.value })}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}>
                <Phone size={14} /> Mobile Number (for WhatsApp Invoice)
              </label>
              <input
                type="text"
                className="table-input"
                placeholder="+91 XXXXX XXXXX"
                value={customer.phone}
                onChange={(e) => onUpdateCustomer({ ...customer, phone: e.target.value })}
              />
            </div>
          </div>

          {/* Table Header & Add Item Button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileCheck size={18} color="#2563eb" />
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
                Extracted Products ({items.length})
              </span>
            </div>

            <Button variant="outline" size="sm" onClick={onAddItem} icon={<Plus size={15} />}>
              Add Product
            </Button>
          </div>

          {/* Table */}
          <div className="table-responsive" style={{ maxHeight: '440px', overflowY: 'auto' }}>
            <table className="items-table">
              <thead>
                <tr>
                  <th style={{ width: '38px', textAlign: 'center' }}>#</th>
                  <th>Product Name / Description</th>
                  <th style={{ width: '85px' }}>Qty</th>
                  <th style={{ width: '110px' }}>Unit</th>
                  <th style={{ width: '100px' }}>Rate (₹)</th>
                  <th style={{ width: '110px' }}>Total (₹)</th>
                  <th style={{ width: '45px', textAlign: 'center' }}>Del</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                      No items in this order. Click "Add Product" or upload an image.
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => (
                    <tr key={item.id}>
                      <td style={{ textAlign: 'center', color: '#94a3b8', fontWeight: 600 }}>
                        {index + 1}
                      </td>
                      <td>
                        <input
                          type="text"
                          className="table-input"
                          value={item.name}
                          onChange={(e) => onUpdateItem(item.id, { name: e.target.value })}
                          placeholder="e.g. Rice (அரிசி)"
                        />
                        {item.originalText && (
                          <div style={{ fontSize: '0.72rem', color: '#6366f1', marginTop: '2px' }}>
                            Handwritten: <span style={{ fontWeight: 500 }}>{item.originalText}</span>
                          </div>
                        )}
                      </td>
                      <td>
                        <input
                          type="number"
                          step="any"
                          min="0.1"
                          className="table-input"
                          value={item.quantity}
                          onChange={(e) => onUpdateItem(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                        />
                      </td>
                      <td>
                        <select
                          className="table-select"
                          value={item.unit}
                          onChange={(e) => onUpdateItem(item.id, { unit: e.target.value as Unit })}
                        >
                          {AVAILABLE_UNITS.map((u) => (
                            <option key={u.value} value={u.value}>
                              {u.value}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          className="table-input"
                          value={item.unitPrice}
                          onChange={(e) => onUpdateItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                        />
                      </td>
                      <td style={{ fontWeight: 700, color: '#0f172a' }}>
                        {formatINR(item.total)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn-icon-danger"
                          onClick={() => onDeleteItem(item.id)}
                          title="Delete Item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Totals Summary Bar */}
          <div className="totals-summary-bar">
            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Subtotal</span>
                <span style={{ fontWeight: 600, color: '#334155', fontSize: '1rem' }}>
                  {formatINR(totals.subtotal)}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>GST Rate</span>
                <select
                  className="table-select"
                  value={taxRate}
                  onChange={(e) => onUpdateTaxRate(parseFloat(e.target.value) || 0)}
                  style={{ width: '85px', padding: '0.3rem 0.5rem' }}
                >
                  <option value={0}>0%</option>
                  <option value={5}>5%</option>
                  <option value={12}>12%</option>
                  <option value={18}>18%</option>
                </select>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Discount (₹)</span>
                <input
                  type="number"
                  min="0"
                  style={{ width: '80px', padding: '0.3rem 0.5rem' }}
                  className="table-input"
                  value={discount}
                  onChange={(e) => onUpdateDiscount(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Grand Total
              </span>
              <span className="total-pill-big">{formatINR(totals.grandTotal)}</span>
            </div>
          </div>

          {/* Footer action */}
          <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button variant="outline" onClick={onBackToUpload}>
              Back
            </Button>
            <Button
              variant="primary"
              size="lg"
              onClick={onProceedToExport}
              icon={<ArrowRight size={18} />}
            >
              Confirm & Generate Invoice
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
