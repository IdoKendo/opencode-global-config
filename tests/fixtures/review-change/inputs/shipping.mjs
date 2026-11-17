export function shipping(subtotal) {
  return subtotal > 5000 ? 0 : 500;
}
