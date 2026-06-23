const fs = require('fs');
const src = fs.readFileSync('d:/fanrenxiuxianzhuan/js/story.js', 'utf8');
const lines = src.split('\n');
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  const m = l.match(/id:\s*["']([^"']+)["']/);
  if (m) {
    let ctx = '';
    for (let j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 5); j++) {
      const t = lines[j].trim();
      if (/(cond|skipIf|title|cg|where|bgm|objTitle)/.test(t) && !t.startsWith('//')) {
        ctx += t + '  ';
      }
    }
    console.log(`L${i + 1}: ${m[1]}  ${ctx.trim()}`);
  }
}
