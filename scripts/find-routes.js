const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../src/server/api/controllers');
for (const file of fs.readdirSync(dir)) {
  if (!file.endsWith('.ts')) continue;
  const content = fs.readFileSync(path.join(dir, file), 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('route(')) {
      console.log(`${file}:${idx + 1}: ${line.trim()}`);
    }
  });
}

