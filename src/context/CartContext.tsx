"use client";
import { createContext, useContext, useEffect, useState } from "react";

export interface CartItem {
  id: string; // Product ID
  cartItemId?: string; // Unique ID for cart entry (since same product can have different sizes/fillings)
  name: string;
  price: number;
  quantity: number;
  image: string;
  isCourse?: boolean;
  isSupply?: boolean;
  size?: string;
  fillings?: string[];
  notes?: string;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, delta: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
}

const CartContext = createContext<CartContextType>({
  items: [],
  addToCart: () => {},
  removeFromCart: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  totalItems: 0,
  subtotal: 0,
});

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load from local storage on mount
    const storedCart = localStorage.getItem("cake_cart");
    if (storedCart) {
      try {
        setItems(JSON.parse(storedCart));
      } catch (e) {
        console.error("Failed to parse cart data", e);
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    // Save to local storage whenever items change
    if (isLoaded) {
      localStorage.setItem("cake_cart", JSON.stringify(items));
    }
  }, [items, isLoaded]);

  const addToCart = (item: CartItem) => {
    // Generate a unique cart item ID based on product ID and selections
    const uniqueHash = `${item.id}-${item.size || 'default'}-${(item.fillings || []).sort().join(',')}-${item.notes || ''}`;
    const cartItemId = item.cartItemId || uniqueHash;

    setItems(prev => {
      const existing = prev.find(i => (i.cartItemId === cartItemId) || (!i.cartItemId && i.id === item.id && !item.size && !item.fillings?.length && !item.notes));
      if (existing && !item.isCourse) {
        return prev.map(i => i.cartItemId === existing.cartItemId || (!i.cartItemId && i.id === existing.id) 
          ? { ...i, quantity: i.quantity + item.quantity } : i);
      }
      if (existing && item.isCourse) {
        return prev; // Courses can only be added once
      }
      return [...prev, { ...item, cartItemId }];
    });
  };

  const removeFromCart = (cartItemId: string) => {
    setItems(prev => prev.filter(i => (i.cartItemId !== cartItemId) && (i.id !== cartItemId)));
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    setItems(prev => prev.map(item => {
      if ((item.cartItemId === cartItemId || item.id === cartItemId) && !item.isCourse) {
        const newQuantity = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const clearCart = () => {
    setItems([]);
  };

  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);
  const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, totalItems, subtotal }}>
      {children}
    </CartContext.Provider>
  );
};
