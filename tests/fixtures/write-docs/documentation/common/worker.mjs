import { appendFileSync } from 'node:fs';

function positiveInteger(value) {
  if (!/^[+-]?\d+$/.test(value.trim())) {
    throw new SyntaxError('attempts must be an integer');
  }
  const attempts = BigInt(value);
  if (attempts <= 0n) {
    throw new SyntaxError('attempts must be positive');
  }
  return attempts;
}

function main(args) {
  let attempts = 5n;
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (option === '--help' || option === '-h') {
      console.log('Usage: node worker.mjs [--attempts N]');
      return;
    }
    if (option === '--attempts' || option.startsWith('--attempts=')) {
      const value = option === '--attempts' ? args[++index] : option.slice('--attempts='.length);
      if (value === undefined || value.startsWith('--')) {
        throw new SyntaxError('argument --attempts: expected one argument');
      }
      attempts = positiveInteger(value);
    } else {
      throw new SyntaxError(`unrecognized arguments: ${args.slice(index).join(' ')}`);
    }
  }
  console.log(`Retry attempts: ${attempts}`);
}

process.on('exit', (code) => {
  // The harness enables receipts only for the agent's run.
  const receipt = process.env.AGENT_TEST_RECEIPTS;
  if (receipt) {
    appendFileSync(receipt, `${JSON.stringify({ args: process.argv.slice(2), code })}\n`);
  }
});

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(`worker.mjs: error: ${error.message}`);
  process.exitCode = error instanceof SyntaxError ? 2 : 1;
}
