import { deliveryCharge } from './shipping.mjs';

export function checkoutTotal(subtotal) {
  return subtotal + deliveryCharge(subtotal);
}
