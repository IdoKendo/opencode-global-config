export function receipt(orderId, logger) {
  logger.info({ event: 'receipt', orderId });
  return `Receipt ${orderId}`;
}
