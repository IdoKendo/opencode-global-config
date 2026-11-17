export function receipt(orderId, logger) {
  console.log({ event: 'receipt', orderId });
  return `Order ${orderId}`;
}
