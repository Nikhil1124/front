const fs = require('fs');
const files = ['tokens.check.ts', 'sheets.check.ts', 'press.check.ts', 'forms.check.ts', 'colors.check.ts', 'alerts.check.ts', 'headers.check.ts'];
files.forEach(f => {
  const p = 'src/data/' + f;
  let c = fs.readFileSync(p, 'utf8');
  c = c.replace("const rel = file.slice(ROOT.length).replace(/^\\/+/, '');", "const rel = file.slice(ROOT.length).replace(/^[\\\\\\/]+/, '').replace(/\\\\/g, '/');");
  fs.writeFileSync(p, c);
});
