import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export interface CartItem {
  id: string;
  vendor_id: string;
  name: string;
  price: number;
  mrp?: number | null;
  image_url?: string | null;
  stock?: number | null;
  category_id?: string | null;
  description?: string | null;
  quantity: number;
  quantity_unit?: string | null;
  loose_quantity?: number | null;
  gst_rate?: number | null;
  gst_slab?: string | null;
  is_exclusive?: boolean;
  allow_loose_quantity?: boolean;
  loose_min_quantity?: number | null;
  loose_max_quantity?: number | null;
  loose_step_quantity?: number | null;
  loose_unit?: string | null;
}

export let cart: CartItem[] = [];

let currentUserId: string | null = null;
let cartListeners: (() => void)[] = [];
let isInitialized = false;

const GUEST_KEY = 'rivo_cart_guest';

function getStorageKey(userId: string | null): string {
  return userId ? `rivo_cart_${userId}` : GUEST_KEY;
}

function notifyCartChange() {
  cartListeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error('Error in cart listener:', e);
    }
  });
}

async function saveCartLocally() {
  try {
    const key = getStorageKey(currentUserId);
    await AsyncStorage.setItem(key, JSON.stringify(cart));
  } catch (error) {
    console.error('Failed to save cart locally:', error);
  }
}

async function loadCartForUser(userId: string | null) {
  try {
    currentUserId = userId;
    const key = getStorageKey(userId);
    const stored = await AsyncStorage.getItem(key);

    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        cart = parsed.filter(
          (item) => item && typeof item === 'object' && item.id && item.vendor_id && item.quantity > 0
        );
      } else {
        cart = [];
      }
    } else {
      cart = [];
    }
  } catch (error) {
    console.error('Failed to load cart for user:', error);
    cart = [];
  } finally {
    notifyCartChange();
  }
}

// Automatically bind to auth session changes
async function initCartAuthSync() {
  if (isInitialized) return;
  isInitialized = true;

  try {
    const { data } = await supabase.auth.getUser();
    await loadCartForUser(data?.user?.id ?? null);
  } catch (e) {
    console.error('Error initializing cart auth user:', e);
    await loadCartForUser(null);
  }

  supabase.auth.onAuthStateChange(async (_event, session) => {
    const newUserId = session?.user?.id ?? null;
    if (newUserId !== currentUserId) {
      cart = []; // Flush old in-memory cart
      await loadCartForUser(newUserId);
    }
  });
}

initCartAuthSync();

export function subscribeCart(listener: () => void) {
  cartListeners.push(listener);
  // Synchronously call once to provide active state immediately
  try {
    listener();
  } catch (e) {
    console.error('Error executing initial cart subscription callback:', e);
  }
  return () => {
    cartListeners = cartListeners.filter((l) => l !== listener);
  };
}

export function addToCart(product: any) {
  if (!product || !product.id) return false;

  const productVendorId = String(product.vendor_id || '');
  const existingVendorId = cart.length > 0 ? String(cart[0].vendor_id || '') : '';

  if (existingVendorId && productVendorId && existingVendorId !== productVendorId) {
    return false;
  }

  const existingItem = cart.find((item) => String(item.id) === String(product.id));

  if (existingItem) {
    const nextQuantity = product.cart_quantity != null ? Number(product.cart_quantity) : existingItem.quantity + 1;
    existingItem.quantity = nextQuantity;
    if (product.cart_quantity != null) {
      existingItem.loose_quantity = nextQuantity;
      existingItem.quantity_unit = product.quantity_unit || existingItem.quantity_unit || null;
    }
  } else {
    cart.push({
      id: String(product.id),
      vendor_id: String(product.vendor_id || ''),
      name: product.name || 'Product',
      price: Number(product.price || 0),
      mrp: product.mrp != null ? Number(product.mrp) : null,
      image_url: product.image_url || null,
      stock: product.stock != null ? Number(product.stock) : null,
      category_id: product.category_id || null,
      description: product.description || null,
      quantity: product.cart_quantity != null ? Number(product.cart_quantity) : 1,
      loose_quantity: product.cart_quantity != null ? Number(product.cart_quantity) : null,
      quantity_unit: product.quantity_unit || null,
      gst_rate: product.gst_rate != null ? Number(product.gst_rate) : 0,
      gst_slab: product.gst_slab || null,
      is_exclusive: product.is_exclusive === true,
      allow_loose_quantity: product.allow_loose_quantity === true,
      loose_min_quantity: product.loose_min_quantity != null ? Number(product.loose_min_quantity) : null,
      loose_max_quantity: product.loose_max_quantity != null ? Number(product.loose_max_quantity) : null,
      loose_step_quantity: product.loose_step_quantity != null ? Number(product.loose_step_quantity) : null,
      loose_unit: product.loose_unit || null,
    });
  }

  saveCartLocally();
  notifyCartChange();
  return true;
}

export function increaseQuantity(productId: string) {
  const item = cart.find((item) => String(item.id) === String(productId));

  if (item) {
    if (item.allow_loose_quantity && item.loose_step_quantity != null && item.loose_max_quantity != null) {
      const next = Number((item.quantity + item.loose_step_quantity).toFixed(3));
      if (next > item.loose_max_quantity) return;
      item.quantity = next;
      item.loose_quantity = next;
    } else {
      item.quantity += 1;
    }
    saveCartLocally();
    notifyCartChange();
  }
}

export function decreaseQuantity(productId: string) {
  const itemIndex = cart.findIndex((item) => String(item.id) === String(productId));
  if (itemIndex === -1) return;

  const item = cart[itemIndex];
  if (item.allow_loose_quantity && item.loose_step_quantity != null && item.loose_min_quantity != null) {
    const next = Number((item.quantity - item.loose_step_quantity).toFixed(3));
    if (next < item.loose_min_quantity) {
      cart.splice(itemIndex, 1);
    } else {
      item.quantity = next;
      item.loose_quantity = next;
    }
  } else {
    item.quantity -= 1;
    if (item.quantity <= 0) cart.splice(itemIndex, 1);
  }

  saveCartLocally();
  notifyCartChange();
}

export function removeFromCart(productId: string) {
  const index = cart.findIndex((item) => String(item.id) === String(productId));

  if (index !== -1) {
    cart.splice(index, 1);
    saveCartLocally();
    notifyCartChange();
  }
}

export function clearCart() {
  cart = [];
  saveCartLocally();
  notifyCartChange();
}

export function getCart(): CartItem[] {
  return cart;
}