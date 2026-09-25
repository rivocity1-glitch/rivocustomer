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
  gst_rate?: number | null;
  gst_slab?: string | null;
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
  if (!product || !product.id) return;

  const existingItem = cart.find((item) => String(item.id) === String(product.id));

  if (existingItem) {
    existingItem.quantity += 1;
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
      quantity: 1,
      gst_rate: product.gst_rate != null ? Number(product.gst_rate) : 0,
      gst_slab: product.gst_slab || null,
    });
  }

  saveCartLocally();
  notifyCartChange();
}

export function increaseQuantity(productId: string) {
  const item = cart.find((item) => String(item.id) === String(productId));

  if (item) {
    item.quantity += 1;
    saveCartLocally();
    notifyCartChange();
  }
}

export function decreaseQuantity(productId: string) {
  const itemIndex = cart.findIndex((item) => String(item.id) === String(productId));
  if (itemIndex === -1) return;

  const item = cart[itemIndex];
  item.quantity -= 1;

  if (item.quantity <= 0) {
    cart.splice(itemIndex, 1);
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