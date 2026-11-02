import { OrderItem, StoreInfo, Unit } from '../types/order';

export const DEFAULT_STORE: StoreInfo = {
  id: 'store-1',
  name: 'Sri Gokulakkannan Stores',
  tagline: 'Wholesale & Retail Provision Merchants',
  ownerName: 'Gokulakkannan',
  phone: '+91 98420 12345',
  email: 'gokul@srigokulstores.com',
  address: '124, Bazaar Street, Salem, Tamil Nadu - 636001',
  gstin: '33AAAAA0000A1Z5',
  upiId: 'srigokulstores@okhdfcbank',
  logoUrl: undefined,
};

export const AVAILABLE_UNITS: { label: string; value: Unit }[] = [
  { label: 'kg (Kilogram)', value: 'kg' },
  { label: 'g (Gram)', value: 'g' },
  { label: 'ltr (Liter)', value: 'ltr' },
  { label: 'ml (Milliliter)', value: 'ml' },
  { label: 'pkt (Packet)', value: 'pkt' },
  { label: 'pcs (Pieces)', value: 'pcs' },
  { label: 'box (Box)', value: 'box' },
  { label: 'bottle (Bottle)', value: 'bottle' },
  { label: 'bundle (Bundle)', value: 'bundle' },
];

export const OCR_SCAN_STAGES = [
  { id: 1, label: 'Image Preprocessing', detail: 'Adjusting contrast, deskewing & handwriting contour isolation...' },
  { id: 2, label: 'Handwriting Recognition', detail: 'Detecting Tamil and English cursive letterforms...' },
  { id: 3, label: 'Entity Extraction', detail: 'Classifying grocery items, numeric counts & unit indicators...' },
  { id: 4, label: 'Catalog Normalization', detail: 'Matching product nomenclature & applying store pricing...' },
  { id: 5, label: 'Finalizing Bill List', detail: 'Structuring digital order table ready for review...' },
];

export const SAMPLE_CHIT_ITEMS: Omit<OrderItem, 'id'>[] = [
  { name: 'Rice (பொன்னி அரிசி)', originalText: 'அரிசி', quantity: 10, unit: 'kg', unitPrice: 58, total: 580, confidence: 0.98, category: 'Grains & Pulses' },
  { name: 'Sugar (சர்க்கரை)', originalText: 'சர்க்கரை', quantity: 2, unit: 'kg', unitPrice: 44, total: 88, confidence: 0.97, category: 'Essentials' },
  { name: 'Toor Dal (துவரம் பருப்பு)', originalText: 'துவரம் பருப்பு', quantity: 5, unit: 'kg', unitPrice: 165, total: 825, confidence: 0.95, category: 'Grains & Pulses' },
  { name: 'Maida (மைதா)', originalText: 'மைதா', quantity: 1, unit: 'kg', unitPrice: 46, total: 46, confidence: 0.96, category: 'Flours' },
  { name: 'Cooking Oil (கடலை எண்ணெய்)', originalText: 'எண்ணெய்', quantity: 2, unit: 'ltr', unitPrice: 155, total: 310, confidence: 0.94, category: 'Oils' },
  { name: 'Salt (கல் உப்பு)', originalText: 'உப்பு', quantity: 1, unit: 'kg', unitPrice: 22, total: 22, confidence: 0.99, category: 'Spices & Seasoning' },
  { name: 'Chilli Powder (மிளகாய் தூள்)', originalText: 'மிளகாய் தூள்', quantity: 500, unit: 'g', unitPrice: 0.28, total: 140, confidence: 0.92, category: 'Spices & Seasoning' },
  { name: 'Turmeric Powder (மஞ்சள் தூள்)', originalText: 'மஞ்சள் தூள்', quantity: 200, unit: 'g', unitPrice: 0.35, total: 70, confidence: 0.95, category: 'Spices & Seasoning' },
  { name: 'Tea (தேயிலை)', originalText: 'தேயிலை', quantity: 1, unit: 'pkt', unitPrice: 115, total: 115, confidence: 0.93, category: 'Beverages' },
  { name: 'Soap (குளியல் சோப்பு)', originalText: 'சோப்பு', quantity: 6, unit: 'pcs', unitPrice: 38, total: 228, confidence: 0.96, category: 'Personal Care' },
  { name: 'Biscuit (மாரி பிஸ்கட்)', originalText: 'பிஸ்கட்', quantity: 2, unit: 'pkt', unitPrice: 30, total: 60, confidence: 0.91, category: 'Snacks' },
  { name: 'Drinking Water Can (குடிநீர் கேன்)', originalText: 'குடிநீர் கேன்', quantity: 2, unit: 'pkt', unitPrice: 35, total: 70, confidence: 0.90, category: 'Beverages' },
  { name: 'Onion (பெரிய வெங்காயம்)', originalText: 'வெங்காயம்', quantity: 3, unit: 'kg', unitPrice: 42, total: 126, confidence: 0.97, category: 'Vegetables' },
  { name: 'Tomato (நாட்டு தக்காளி)', originalText: 'தக்காளி', quantity: 4, unit: 'kg', unitPrice: 32, total: 128, confidence: 0.96, category: 'Vegetables' },
  { name: 'Potato (உருளைக்கிழங்கு)', originalText: 'உருளைக்கிழங்கு', quantity: 5, unit: 'kg', unitPrice: 36, total: 180, confidence: 0.98, category: 'Vegetables' },
  { name: 'Milk (ஆவின் பால்)', originalText: 'பால்', quantity: 4, unit: 'ltr', unitPrice: 30, total: 120, confidence: 0.94, category: 'Dairy' },
  { name: 'Curd (தயிர்)', originalText: 'தயிர்', quantity: 2, unit: 'pkt', unitPrice: 22, total: 44, confidence: 0.93, category: 'Dairy' },
  { name: 'Semiya (சேமியா)', originalText: 'சேமியா', quantity: 1, unit: 'pkt', unitPrice: 28, total: 28, confidence: 0.95, category: 'Flours & Pasta' },
  { name: 'Chana Dal (கடலை பருப்பு)', originalText: 'கடலை பருப்பு', quantity: 1, unit: 'kg', unitPrice: 98, total: 98, confidence: 0.96, category: 'Grains & Pulses' },
  { name: 'Pepper (கருப்பு மிளகு)', originalText: 'மிளகு', quantity: 100, unit: 'g', unitPrice: 1.15, total: 115, confidence: 0.91, category: 'Spices & Seasoning' },
  { name: 'Cumin Seeds (சீரகம்)', originalText: 'சீரகம்', quantity: 100, unit: 'g', unitPrice: 0.75, total: 75, confidence: 0.92, category: 'Spices & Seasoning' },
  { name: 'Coffee Powder (காப்பி தூள்)', originalText: 'காப்பி தூள்', quantity: 250, unit: 'g', unitPrice: 0.72, total: 180, confidence: 0.94, category: 'Beverages' },
];

export const DEMO_USER = {
  id: 'usr-101',
  name: 'Gokulakkannan S.',
  email: 'gokul@easybill.com',
  role: 'owner' as const,
  store: DEFAULT_STORE,
};
