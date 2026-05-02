import React, { createContext, useState, useContext } from 'react';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
    const [cartItems, setCartItems] = useState([]);

    const addToCart = (food) => {
        setCartItems((prev) => {
            const existing = prev.find((item) => item._id === food._id);
            if (existing) {
                return prev.map((item) =>
                    item._id === food._id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            return [...prev, { ...food, quantity: 1 }];
        });
    };

    const removeFromCart = (foodId) => {
        setCartItems((prev) => prev.filter((item) => item._id !== foodId));
    };

    const updateQuantity = (foodId, quantity) => {
        if (quantity <= 0) {
            removeFromCart(foodId);
            return;
        }
        setCartItems((prev) =>
            prev.map((item) => (item._id === foodId ? { ...item, quantity } : item))
        );
    };

    const clearCart = () => {
        setCartItems([]);
    };

    const getTotal = () => {
        return cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    };

    const getItemCount = () => {
        return cartItems.reduce((sum, item) => sum + item.quantity, 0);
    };

    return (
        <CartContext.Provider
            value={{ cartItems, addToCart, removeFromCart, updateQuantity, clearCart, getTotal, getItemCount }}
        >
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => useContext(CartContext);
export default CartContext;
