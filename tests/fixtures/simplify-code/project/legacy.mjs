export function enabled(value) {
  if (value) {
    if (value === 'yes') {
      return true;
    } else {
      return false;
    }
  } else {
    return false;
  }
}
