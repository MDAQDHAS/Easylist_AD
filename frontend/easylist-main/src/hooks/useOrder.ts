import { useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { CustomerInfo, Order, OrderItem, OrderWorkflowStep, StoreInfo, Unit } from '../types/order';
import { calculateTotals, fileToBase64, generateId, generateOrderNumber } from '../lib/utils';
import { ocrService, ScanProgressUpdate } from '../services/ocrService';
import { storage } from '../lib/storage';

export function useOrder(currentStore: StoreInfo) {
  const [step, setStep] = useState<OrderWorkflowStep>('upload');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string>('');

  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgressUpdate>({
    stageNumber: 1,
    stageName: 'Initializing',
    detail: 'Preparing scanner...',
    percent: 0,
  });

  const [orderId] = useState<string>(() => generateId('order'));
  const [orderNumber, setOrderNumber] = useState<string>(() => generateOrderNumber());
  const [items, setItems] = useState<OrderItem[]>([]);
  const [customer, setCustomer] = useState<CustomerInfo>({
    name: 'Ganesh Kumar',
    phone: '+91 94432 87654',
    address: 'Near Old Bus Stand, Salem',
  });
  const [taxRate, setTaxRate] = useState<number>(5);
  const [discount, setDiscount] = useState<number>(0);

  // Totals
  const totals = calculateTotals(items, taxRate, discount);

  // Process image with OCR
  const processImageOcr = useCallback(async (imageSrc: string, fileName?: string) => {
    setUploadedImage(imageSrc);
    setImageFileName(fileName || 'handwritten_chit.png');
    setIsScanning(true);

    try {
      const extractedItems = await ocrService.scanHandwrittenChit(imageSrc, (progress) => {
        setScanProgress(progress);
      });

      setItems(extractedItems);
      setIsScanning(false);
      setStep('review');
    } catch (err) {
      console.error('OCR Error:', err);
      setIsScanning(false);
    }
  }, []);

  // Handle file selected from file picker or drag and drop
  const handleFileUpload = useCallback(
    async (file: File) => {
      try {
        const base64 = await fileToBase64(file);
        await processImageOcr(base64, file.name);
      } catch (err) {
        console.error('File read error:', err);
      }
    },
    [processImageOcr]
  );

  // Quick action: use the preloaded Tamil grocery handwritten sample chit
  const handleUseSampleChit = useCallback(async () => {
    // Uses the image provided in public/images/EasyList login image.png
    await processImageOcr('/images/EasyList login image.png', 'Tamil-Handwritten-Grocery-Chit.png');
  }, [processImageOcr]);

  // Update item field
  const updateItem = useCallback(
    (id: string, updates: Partial<OrderItem>) => {
      setItems((prevItems) =>
        prevItems.map((item) => {
          if (item.id !== id) return item;

          const updated = { ...item, ...updates };
          const qty = Number(updated.quantity) || 0;
          const rate = Number(updated.unitPrice) || 0;
          updated.total = Math.round(qty * rate * 100) / 100;
          return updated;
        })
      );
    },
    []
  );

  // Add new blank or custom item
  const addItem = useCallback(() => {
    const newItem: OrderItem = {
      id: generateId('item'),
      name: '',
      quantity: 1,
      unit: 'kg' as Unit,
      unitPrice: 50,
      total: 50,
      confidence: 1.0,
    };
    setItems((prev) => [...prev, newItem]);
  }, []);

  // Delete item
  const deleteItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Build the complete Order object
  const getOrderObject = useCallback((): Order => {
    const today = new Date();
    return {
      id: orderId,
      orderNumber,
      date: today.toISOString().split('T')[0],
      time: today.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      customer,
      store: currentStore,
      items,
      subtotal: totals.subtotal,
      taxRate,
      taxAmount: totals.taxAmount,
      discount: totals.discountAmount,
      grandTotal: totals.grandTotal,
      status: 'reviewed',
      originalImageUrl: uploadedImage || undefined,
      imageFileName,
      createdAt: today.toISOString(),
    };
  }, [
    orderId,
    orderNumber,
    customer,
    currentStore,
    items,
    totals,
    taxRate,
    uploadedImage,
    imageFileName,
  ]);

  // Transition to Export step and save order to history
  const proceedToExport = useCallback(() => {
    const currentOrder = getOrderObject();
    storage.saveOrder(currentOrder);
    setStep('export');

    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch {
      // ignore
    }
  }, [getOrderObject]);

  // Start fresh order
  const resetOrder = useCallback(() => {
    setStep('upload');
    setUploadedImage(null);
    setImageFileName('');
    setItems([]);
    setOrderNumber(generateOrderNumber());
    setDiscount(0);
  }, []);

  // Load past order for viewing / editing
  const loadOrder = useCallback((order: Order) => {
    setOrderNumber(order.orderNumber);
    setCustomer(order.customer);
    setItems(order.items);
    setTaxRate(order.taxRate);
    setDiscount(order.discount);
    if (order.originalImageUrl) {
      setUploadedImage(order.originalImageUrl);
    }
    setStep('review');
  }, []);

  return {
    step,
    setStep,
    uploadedImage,
    imageFileName,
    isScanning,
    scanProgress,
    orderNumber,
    items,
    customer,
    setCustomer,
    taxRate,
    setTaxRate,
    discount,
    setDiscount,
    totals,
    handleFileUpload,
    handleUseSampleChit,
    updateItem,
    addItem,
    deleteItem,
    proceedToExport,
    resetOrder,
    loadOrder,
    getOrderObject,
  };
}
