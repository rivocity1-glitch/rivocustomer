export let cart: any[] = [];

let cartListeners: (() => void)[] = [];

export function subscribeCart(listener: () => void) {
  cartListeners.push(listener);
  return () => {
    cartListeners = cartListeners.filter((l) => l !== listener);
  };
}

function notifyCartChange() {
  cartListeners.forEach((listener) => listener());
}

export function addToCart(product: any) {
  const existingItem = cart.find(
    (item) => item.id === product.id
  );

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({
      id: product.id,
      vendor_id: product.vendor_id,
      name: product.name,
      price: product.price,
      quantity: 1,
    });
  }
  notifyCartChange();
}

export function increaseQuantity(productId: string) {
  const item = cart.find(
    (item) => item.id === productId
  );

  if (item) {
    item.quantity += 1;
    notifyCartChange();
  }
}

export function decreaseQuantity(productId: string) {
  const item = cart.find(
    (item) => item.id === productId
  );

  if (!item) return;

  item.quantity -= 1;

  if (item.quantity <= 0) {
    const index = cart.findIndex(
      (item) => item.id === productId
    );

    if (index !== -1) {
      cart.splice(index, 1);
    }
  }
  notifyCartChange();
}

export function removeFromCart(productId: string) {
  const index = cart.findIndex(
    (item) => item.id === productId
  );

  if (index !== -1) {
    cart.splice(index, 1);
    notifyCartChange();
  }
}

export function clearCart() {
  cart = [];
  notifyCartChange();
}

export function getCart() {
  return cart;
}