export function legacyLabel(value) {
  if (value) {
    return String(value);
  } else {
    return 'unknown';
  }
}

export function process(amount, member = false) {
  if (amount < 0) {
    throw new RangeError('amount must be non-negative');
  }
  if (amount >= 100) {
    return amount - discount(member);
  }
  return amount;
}

function discount(member) {
  return member ? 20 : 10;
}
