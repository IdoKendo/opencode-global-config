import { writeFile } from 'node:fs/promises';
import path from 'node:path';

export function exportLedger(downloads, month, csv) {
  return writeFile(path.join(downloads, `ledger-${month}.csv`), csv);
}
