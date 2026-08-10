/* Client-side price computation, used only to update the UI in real time.
 * The server always recomputes and validates prices independently: this is just for display. */

// Unit price of one configured sandwich, given the chosen number of optional ingredients.
// Each ingredient beyond the size's included count adds 30% of the base price.
export function unitPrice(size, ingredientsCount, sizes) {
  const info = sizes.find(s => s.size === size);
  if (!info) return 0;
  const extra = Math.max(0, ingredientsCount - info.includedIngredients);
  return info.basePrice * (1 + 0.30 * extra);
}

// Order subtotal before any discount (sum of unit price times quantity over all lines).
export function orderSubtotal(cart, sizes) {
  return cart.reduce((sum, s) => sum + unitPrice(s.size, s.ingredients.length, sizes) * s.quantity, 0);
}

// Discount amount applied to the order: 20% of the subtotal when it has 4 or more sandwiches.
export function orderDiscount(cart, sizes) {
  return totalUnits(cart) >= 4 ? orderSubtotal(cart, sizes) * 0.20 : 0;
}

// Total price of the order (subtotal minus the discount, if any).
export function orderTotal(cart, sizes) {
  return orderSubtotal(cart, sizes) - orderDiscount(cart, sizes);
}

// Total number of sandwiches (units) in the cart.
export function totalUnits(cart) {
  return cart.reduce((sum, s) => sum + s.quantity, 0);
}

// Units of a given size currently in the cart (optionally ignoring one cart entry being edited).
export function unitsOfSizeInCart(cart, size, ignoreKey = null) {
  return cart
    .filter(s => s.size === size && s.key !== ignoreKey)
    .reduce((sum, s) => sum + s.quantity, 0);
}

// Formats a number as a price string with 2 decimals.
export function euro(n) {
  return `€ ${n.toFixed(2)}`;
}

// Human-readable labels for the sandwich sizes.
export const SIZE_LABELS = { S: 'Small', M: 'Medium', L: 'Large' };
