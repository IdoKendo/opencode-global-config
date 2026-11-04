export function invoiceLabel(id) {
  if (id) {
    return 'Invoice ' + id;
  } else {
    return 'Draft';
  }
}
