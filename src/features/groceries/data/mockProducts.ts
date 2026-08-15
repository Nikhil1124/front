import { productImages } from './productAssets';

export interface PricingOption {
  unit: string;
  price: number;
  originalPrice?: number;
}

export interface EnrichedProduct {
  id: string;
  name: string;
  category: string;
  image: any;
  rating: number;
  guestVisible: boolean;
  ownerVisible: boolean;
  guestOptions: PricingOption[];
  ownerOptions: PricingOption[];
  timeTag?: string;
  description?: string;
  images?: any[];
  ingredients?: string;
  origin?: string;
  storage?: string;
  nutrition?: { label: string; value: string }[];
  relatedIds?: string[];
}

export interface Category {
  id: string;
  name: string;
  image: string;
  bgColor: string;
}

export const mockCategories: Category[] = [
  // Grocery & Kitchen
  { id: 'cat-fruitsveg', name: 'Vegetables & Fruits', image: productImages.cat_fruits_veg, bgColor: '#EBF6F6' },
  { id: 'cat-flours', name: 'Atta, Rice & Dal', image: productImages.cat_1, bgColor: '#EBF6F6' },
  { id: 'cat-oils', name: 'Oil, Ghee & Masala', image: productImages.cat_3, bgColor: '#EBF6F6' },
  { id: 'cat-dairy', name: 'Dairy, Bread & Eggs', image: productImages.cat_dairy, bgColor: '#EBF6F6' },
  { id: 'cat-bakery', name: 'Bakery & Biscuits', image: productImages.d11, bgColor: '#EBF6F6' },
  { id: 'cat-pulses', name: 'Dry Fruits & Cereals', image: productImages.cat_2, bgColor: '#EBF6F6' },
  { id: 'cat-chicken', name: 'Chicken, Meat & Fish', image: productImages.cat_chicken_eggs, bgColor: '#EBF6F6' },
  { id: 'cat-addons', name: 'PG Kitchen Needs', image: productImages.cat_addons, bgColor: '#EBF6F6' },

  // Snacks & Drinks
  { id: 'cat-canned', name: 'Chips & Namkeen', image: productImages.m5, bgColor: '#EBF6F6' },
  { id: 'cat-sweets', name: 'Sweets & Chocolates', image: productImages.m1, bgColor: '#EBF6F6' },
  { id: 'cat-beverages', name: 'Drinks & Juices', image: productImages.c1, bgColor: '#EBF6F6' },
  { id: 'cat-frozen', name: 'Instant & Frozen', image: productImages.cat_5, bgColor: '#EBF6F6' },
  { id: 'cat-sauces', name: 'Sauces & Spreads', image: productImages.cat_masala, bgColor: '#EBF6F6' },

  // Household & Essentials
  { id: 'cat-cleaning', name: 'Cleaning & Essentials', image: productImages.cl1, bgColor: '#EBF6F6' },
  { id: 'cat-packaging', name: 'Packaging Materials', image: productImages.cat_3, bgColor: '#EBF6F6' },
  { id: 'cat-custom', name: 'Custom Packing Supplies', image: productImages.cat_4, bgColor: '#EBF6F6' },
];

export const mockBanners = [
  { id: 'b1', image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80', title: 'Fresh Produce' },
  { id: 'b2', image: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=800&q=80', title: 'Daily Essentials' },
];

export const mockProducts: EnrichedProduct[] = [
  {
    id: 'rice-001',
    name: 'Sona Masoori Rice',
    category: 'Flours',
    image: productImages.cat_1,
    rating: 4.6,
    guestVisible: true,
    ownerVisible: true,
    description: 'Premium aged Sona Masoori raw rice, ideal for daily PG meals or household cooking.',
    guestOptions: [
      { unit: '1 kg', price: 65, originalPrice: 80 },
      { unit: '5 kg', price: 310, originalPrice: 380 },
    ],
    ownerOptions: [
      { unit: '10 kg', price: 480, originalPrice: 600 },
      { unit: '25 kg', price: 1180, originalPrice: 1440 },
      { unit: '50 kg', price: 2050, originalPrice: 2800 },
    ],
  },
  {
    id: 'dal-001',
    name: 'Premium Toor Dal',
    category: 'Pulses',
    image: productImages.cat_2,
    rating: 4.5,
    guestVisible: true,
    ownerVisible: true,
    description: 'Unpolished and high-protein yellow pigeon peas (Toor Dal).',
    guestOptions: [
      { unit: '500 g', price: 75, originalPrice: 90 },
      { unit: '1 kg', price: 140, originalPrice: 170 },
    ],
    ownerOptions: [
      { unit: '5 kg', price: 680, originalPrice: 800 },
      { unit: '10 kg', price: 1320, originalPrice: 1600 },
    ],
  },
  {
    id: 'oil-001',
    name: 'Sunflower Cooking Oil',
    category: 'Edible Oils',
    image: productImages.cat_3,
    rating: 4.7,
    guestVisible: true,
    ownerVisible: true,
    description: 'Refined sunflower oil for healthy deep frying and daily cooking.',
    guestOptions: [
      { unit: '1 L', price: 125, originalPrice: 150 },
    ],
    ownerOptions: [
      { unit: '5 L', price: 590, originalPrice: 720 },
      { unit: '15 L', price: 1650, originalPrice: 2100 },
    ],
  },
  {
    id: 'onion-001',
    name: 'Fresh Red Onions',
    category: 'Fruits & Vegetables',
    image: productImages.v2,
    rating: 4.4,
    guestVisible: true,
    ownerVisible: true,
    description: 'Pungent, crispy fresh pink onions from local Karnataka farms.',
    guestOptions: [
      { unit: '1 kg', price: 35, originalPrice: 45 },
      { unit: '2 kg', price: 65, originalPrice: 90 },
    ],
    ownerOptions: [
      { unit: '10 kg', price: 290, originalPrice: 400 },
      { unit: '25 kg', price: 680, originalPrice: 950 },
    ],
  },
  {
    id: 'potato-001',
    name: 'Fresh Potatoes',
    category: 'Fruits & Vegetables',
    image: productImages.v3,
    rating: 4.3,
    guestVisible: true,
    ownerVisible: true,
    description: 'High quality local potatoes, great for general boiling and curries.',
    guestOptions: [
      { unit: '1 kg', price: 30, originalPrice: 40 },
    ],
    ownerOptions: [
      { unit: '10 kg', price: 250, originalPrice: 380 },
    ],
  },
  {
    id: 'egg-001',
    name: 'Fresh Farm Eggs',
    category: 'Chicken & Eggs',
    image: productImages.d19,
    rating: 4.8,
    guestVisible: true,
    ownerVisible: true,
    description: 'High protein farm fresh white eggs.',
    guestOptions: [
      { unit: '6 pcs', price: 35, originalPrice: 44 },
      { unit: '12 pcs', price: 68, originalPrice: 85 },
    ],
    ownerOptions: [
      { unit: '30 pcs (1 tray)', price: 160, originalPrice: 200 },
      { unit: '10 dozen (120 pcs)', price: 610, originalPrice: 800 },
    ],
  },
  {
    id: 'flour-001',
    name: 'Chakki Wheat Flour (Atta)',
    category: 'Flours',
    image: productImages.cat_1,
    rating: 4.6,
    guestVisible: true,
    ownerVisible: true,
    description: '100% whole wheat flour for soft rotis and chapatis.',
    guestOptions: [
      { unit: '1 kg', price: 55, originalPrice: 65 },
      { unit: '5 kg', price: 260, originalPrice: 310 },
    ],
    ownerOptions: [
      { unit: '10 kg', price: 490, originalPrice: 580 },
      { unit: '20 kg', price: 920, originalPrice: 1100 },
    ],
  },
  {
    id: 'milk-001',
    name: 'Nandini Fresh Milk',
    category: 'Dairy',
    image: productImages.d1,
    rating: 4.9,
    guestVisible: true,
    ownerVisible: true,
    description: 'Fresh pasteurized cow milk, standard in Bangalore properties.',
    guestOptions: [
      { unit: '500 ml', price: 24, originalPrice: 25 },
      { unit: '1 L', price: 46, originalPrice: 48 },
    ],
    ownerOptions: [
      { unit: '5 L', price: 220, originalPrice: 230 },
      { unit: '20 L (Bulk Pack)', price: 840, originalPrice: 920 },
    ],
  },
  {
    id: 'water-001',
    name: 'Kinley Mineral Water',
    category: 'Beverages & Mixers',
    image: productImages.c1,
    rating: 4.8,
    guestVisible: true,
    ownerVisible: true,
    description: 'Clean bottled drinking water with added minerals.',
    guestOptions: [
      { unit: '1 L', price: 20, originalPrice: 20 },
      { unit: '2 L', price: 35, originalPrice: 35 },
    ],
    ownerOptions: [
      { unit: '20 L (Bubble Can)', price: 70, originalPrice: 90 },
    ],
  },
  {
    id: 'maggi-001',
    name: 'Maggi Masala Noodles',
    category: 'Frozen & Instant Food',
    image: productImages.cat_5,
    rating: 4.9,
    guestVisible: true,
    ownerVisible: false,
    description: '2-Minute instant noodles with signature taste-maker.',
    guestOptions: [
      { unit: '2-pack (140g)', price: 28, originalPrice: 32 },
      { unit: '4-pack (280g)', price: 54, originalPrice: 60 },
    ],
    ownerOptions: [],
  },
  {
    id: 'chips-001',
    name: 'Lays Potato Chips (Classic)',
    category: 'Frozen & Instant Food',
    image: productImages.m5,
    rating: 4.5,
    guestVisible: true,
    ownerVisible: false,
    description: 'Crispy salted potato chips.',
    guestOptions: [
      { unit: '50 g', price: 20, originalPrice: 20 },
    ],
    ownerOptions: [],
  },
  {
    id: 'biscuits-001',
    name: 'Britannia Good Day Cookies',
    category: 'Bakery & Chocolates',
    image: productImages.m1,
    rating: 4.6,
    guestVisible: true,
    ownerVisible: false,
    description: 'Rich butter cookies topped with almonds and cashews.',
    guestOptions: [
      { unit: '100 g', price: 25, originalPrice: 30 },
    ],
    ownerOptions: [],
  },
  {
    id: 'bread-001',
    name: 'Sandwich White Bread',
    category: 'Bakery & Chocolates',
    image: productImages.d11,
    rating: 4.7,
    guestVisible: true,
    ownerVisible: false,
    description: 'Soft sliced white bread for breakfast toasts.',
    guestOptions: [
      { unit: '400 g', price: 40, originalPrice: 45 },
    ],
    ownerOptions: [],
  },
  {
    id: 'bananas-001',
    name: 'Robusta Bananas',
    category: 'Fruits & Vegetables',
    image: productImages.v19,
    rating: 4.4,
    guestVisible: true,
    ownerVisible: false,
    description: 'Sweet ripe local bananas.',
    guestOptions: [
      { unit: '4 pcs', price: 25, originalPrice: 30 },
    ],
    ownerOptions: [],
  },
  {
    id: 'soap-001',
    name: 'Dettol Liquid Soap / Bar',
    category: 'Cleaning & Consumables',
    image: productImages.cl9,
    rating: 4.7,
    guestVisible: true,
    ownerVisible: false,
    description: 'Germ protection bathing soap bar.',
    guestOptions: [
      { unit: '1 pc (75g)', price: 38, originalPrice: 42 },
    ],
    ownerOptions: [],
  },
  {
    id: 'toothpaste-001',
    name: 'Colgate Strong Teeth',
    category: 'Cleaning & Consumables',
    image: productImages.cl10,
    rating: 4.6,
    guestVisible: true,
    ownerVisible: false,
    description: 'Fluoride toothpaste for fresh breath and strong teeth.',
    guestOptions: [
      { unit: '100 g', price: 55, originalPrice: 65 },
    ],
    ownerOptions: [],
  },
  {
    id: 'clean-001',
    name: 'Vim Dishwash Gel',
    category: 'Cleaning & Consumables',
    image: productImages.cl1,
    rating: 4.8,
    guestVisible: true,
    ownerVisible: true,
    description: 'Lemon dishwashing liquid gel for squeaky clean utensils.',
    guestOptions: [
      { unit: '250 ml', price: 55, originalPrice: 60 },
    ],
    ownerOptions: [
      { unit: '250 ml', price: 55, originalPrice: 60 },
      { unit: '2 L (Bulk Bottle)', price: 340, originalPrice: 400 },
      { unit: '5 L (Can)', price: 780, originalPrice: 950 },
    ],
  },
  {
    id: 'chicken-001',
    name: 'Fresh Broiler Chicken',
    category: 'Chicken & Eggs',
    image: productImages.cat_chicken_eggs,
    rating: 4.7,
    guestVisible: true,
    ownerVisible: true,
    description: 'Freshly cut, tender skinless broiler chicken.',
    guestOptions: [
      { unit: '1 kg', price: 180, originalPrice: 220 },
    ],
    ownerOptions: [
      { unit: '5 kg', price: 850, originalPrice: 1000 },
    ],
  },
  {
    id: 'paneer-001',
    name: 'Fresh Malai Paneer',
    category: 'Dairy',
    image: productImages.cat_dairy,
    rating: 4.8,
    guestVisible: true,
    ownerVisible: true,
    description: 'Soft and fresh malai paneer, made from pure milk.',
    guestOptions: [
      { unit: '200 g', price: 90, originalPrice: 105 },
      { unit: '1 kg', price: 420, originalPrice: 480 },
    ],
    ownerOptions: [
      { unit: '5 kg', price: 450, originalPrice: 550 },
    ],
  },
  {
    id: 'mushroom-001',
    name: 'Fresh Button Mushrooms',
    category: 'Fruits & Vegetables',
    image: productImages.cat_fruits_veg,
    rating: 4.5,
    guestVisible: true,
    ownerVisible: true,
    description: 'Clean button mushrooms packed in a hygienic punnet.',
    guestOptions: [
      { unit: '200 g', price: 50, originalPrice: 60 },
    ],
    ownerOptions: [
      { unit: '3 kg', price: 300, originalPrice: 360 },
    ],
  },
  {
    id: 'mixveg-001',
    name: 'Mixed Vegetables Combo',
    category: 'Fruits & Vegetables',
    image: productImages.cat_fruits_veg,
    rating: 4.6,
    guestVisible: true,
    ownerVisible: true,
    description: 'A pre-packed combo of carrot, beans, peas, and cauliflower.',
    guestOptions: [
      { unit: '1 kg', price: 60, originalPrice: 75 },
    ],
    ownerOptions: [
      { unit: '10 kg', price: 400, originalPrice: 520 },
    ],
  },
  {
    id: 'gingargarlic-001',
    name: 'Ginger & Garlic Combo',
    category: 'Fruits & Vegetables',
    image: productImages.v7,
    rating: 4.4,
    guestVisible: true,
    ownerVisible: true,
    description: 'Freshly sourced high-pungency ginger and garlic combo.',
    guestOptions: [
      { unit: '250 g', price: 45, originalPrice: 55 },
    ],
    ownerOptions: [
      { unit: '2 kg', price: 180, originalPrice: 220 },
    ],
  },
  {
    id: 'greenchilli-001',
    name: 'Fresh Green Chillies',
    category: 'Fruits & Vegetables',
    image: productImages.v8,
    rating: 4.5,
    guestVisible: true,
    ownerVisible: true,
    description: 'Spicy green chillies from local Bangalore farms.',
    guestOptions: [
      { unit: '100 g', price: 15, originalPrice: 20 },
    ],
    ownerOptions: [
      { unit: '1 kg', price: 90, originalPrice: 110 },
    ],
  },
  {
    id: 'coriander-001',
    name: 'Fresh Coriander Leaves',
    category: 'Fruits & Vegetables',
    image: productImages.v9,
    rating: 4.7,
    guestVisible: true,
    ownerVisible: true,
    description: 'Aromatic green coriander leaves.',
    guestOptions: [
      { unit: '100 g', price: 12, originalPrice: 15 },
    ],
    ownerOptions: [
      { unit: '500 g', price: 50, originalPrice: 65 },
    ],
  },
  {
    id: 'curd-001',
    name: 'Premium Set Curd',
    category: 'Dairy',
    image: productImages.cat_dairy,
    rating: 4.8,
    guestVisible: true,
    ownerVisible: true,
    description: 'Thick and creamy set curd, perfect for PG kitchens.',
    guestOptions: [
      { unit: '500 g', price: 35, originalPrice: 40 },
    ],
    ownerOptions: [
      { unit: '5 kg', price: 250, originalPrice: 300 },
    ],
  },
  {
    id: 'leafygreens-001',
    name: 'Fresh Palak / Spinach',
    category: 'Fruits & Vegetables',
    image: productImages.v2,
    rating: 4.6,
    guestVisible: true,
    ownerVisible: true,
    description: 'Hygienically sorted fresh leafy green spinach bundles.',
    guestOptions: [
      { unit: '250 g', price: 18, originalPrice: 22 },
    ],
    ownerOptions: [
      { unit: '3 kg', price: 150, originalPrice: 180 },
    ],
  },
];

const CATEGORY_ALIAS_MAP: Record<string, string[]> = {
  'Vegetables & Fruits': ['Fruits & Vegetables'],
  'Atta, Rice & Dal': ['Flours', 'Pulses'],
  'Oil, Ghee & Masala': ['Edible Oils', 'Masala, Salt & Sugar'],
  'Dairy, Bread & Eggs': ['Dairy', 'Chicken & Eggs', 'Bakery & Chocolates'],
  'Bakery & Biscuits': ['Bakery & Chocolates'],
  'Dry Fruits & Cereals': ['Pulses'],
  'Chicken, Meat & Fish': ['Chicken & Eggs'],
  'PG Kitchen Needs': ['Your Menu Add-ons', 'Masala, Salt & Sugar'],
  'Chips & Namkeen': ['Frozen & Instant Food', 'Bakery & Chocolates'],
  'Sweets & Chocolates': ['Bakery & Chocolates'],
  'Drinks & Juices': ['Beverages & Mixers'],
  'Instant & Frozen': ['Frozen & Instant Food'],
  'Sauces & Spreads': ['Sauces & Seasoning', 'Masala, Salt & Sugar'],
  'Cleaning & Essentials': ['Cleaning & Consumables'],
  'Packaging Materials': ['Packaging Material'],
  'Custom Packing Supplies': ['Custom Packaging'],
};

export const getProductsByCategory = (categoryName: string, mode: 'owner' | 'guest'): EnrichedProduct[] => {
  const allowedCategories = CATEGORY_ALIAS_MAP[categoryName] || [categoryName];
  return mockProducts.filter((p) => {
    const isVisible = mode === 'owner' ? p.ownerVisible : p.guestVisible;
    return isVisible && allowedCategories.includes(p.category);
  });
};

export const getDealsProducts = (mode: 'owner' | 'guest'): EnrichedProduct[] => {
  return mockProducts.filter((p) => {
    const options = mode === 'owner' ? p.ownerOptions : p.guestOptions;
    const isVisible = mode === 'owner' ? p.ownerVisible : p.guestVisible;
    if (!isVisible) return false;
    return options.some(
      (o) => o.originalPrice && (o.originalPrice - o.price) / o.originalPrice >= 0.15
    );
  });
};

export const getProductById = (id: string): EnrichedProduct | undefined =>
  mockProducts.find((p) => p.id === id);

export const getCollectionProducts = (collectionId: string, mode: 'owner' | 'guest'): EnrichedProduct[] => {
  const baseList = mockProducts.filter((p) => mode === 'owner' ? p.ownerVisible : p.guestVisible);

  switch (collectionId) {
    case 'kitchen-essentials':
      // Show Rice & Grains, Pulses & Dal, Cooking Oil, Vegetables, Spices, Dairy, Eggs, Flour
      return baseList.filter((p) => 
        ['Flours', 'Pulses', 'Edible Oils', 'Fruits & Vegetables', 'Chicken & Eggs', 'Dairy', 'Masala, Salt & Sugar'].includes(p.category)
      );

    case 'fresh-everyday':
      // Show Vegetables, Fruits, Leafy Greens, Fresh Herbs, Dairy
      return baseList.filter((p) => 
        ['Fruits & Vegetables', 'Chicken & Eggs', 'Dairy'].includes(p.category)
      );

    case 'monthly-stock-up':
      // Show bulk friendly categories: Flours, Pulses, Edible Oils, Cleaning, Masala/Sugar/Salt
      return baseList.filter((p) => 
        ['Flours', 'Pulses', 'Edible Oils', 'Cleaning & Consumables', 'Masala, Salt & Sugar'].includes(p.category)
      );

    case 'smart-savings': {
      // Show items with discount, sorted by highest percentage savings first
      const discounted = baseList.filter((p) => {
        const opts = mode === 'owner' ? p.ownerOptions : p.guestOptions;
        return opts.some((o) => o.originalPrice && o.originalPrice > o.price);
      });
      
      return discounted.sort((a, b) => {
        const optA = mode === 'owner' ? a.ownerOptions[0] : a.guestOptions[0];
        const optB = mode === 'owner' ? b.ownerOptions[0] : b.guestOptions[0];
        const pctA = optA?.originalPrice ? (optA.originalPrice - optA.price) / optA.originalPrice : 0;
        const pctB = optB?.originalPrice ? (optB.originalPrice - optB.price) / optB.originalPrice : 0;
        return pctB - pctA;
      });
    }

    default:
      return [];
  }
};
