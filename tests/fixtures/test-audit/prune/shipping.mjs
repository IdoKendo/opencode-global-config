export function deliveryCharge(total) {
  return total >= 50 ? 0 : 5;
}

export function shippingForTest(total) {
  return deliveryCharge(total);
}
