// Helper for e2e-local.sh: extracts a value from JSON on stdin.
// Usage: cat body.json | node test/jget.mjs '.products.length'
let d = '';
process.stdin.on('data', (c) => (d += c));
process.stdin.on('end', () => {
  try {
    const j = JSON.parse(d);
    const v = new Function('j', 'return j' + (process.argv[2] || ''))(j);
    console.log(typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v));
  } catch {
    console.log('PARSE_ERR');
  }
});
