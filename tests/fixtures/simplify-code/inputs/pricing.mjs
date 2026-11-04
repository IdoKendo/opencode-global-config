export function process(amount, member = false) {
  if (amount < 0) {
    throw new RangeError('amount must be non-negative');
  } else {
    if (member) {
      if (amount >= 100) {
        return amount - 20;
      } else {
        return amount;
      }
    } else {
      if (amount >= 100) {
        return amount - 10;
      } else {
        return amount;
      }
    }
  }
}
