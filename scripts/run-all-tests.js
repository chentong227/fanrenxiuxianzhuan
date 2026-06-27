const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const testDir = path.join(__dirname, '..', 'test');
const files = fs.readdirSync(testDir)
  .filter(f => f.endsWith('.test.js') || f.endsWith('.bal.js') || f === 'run.js')
  .sort();

let pass = 0, fail = 0;
const failed = [];

for (const f of files) {
  const fp = path.join(testDir, f);
  try {
    const out = execSync(`node "${fp}"`, { encoding: 'utf8', timeout: 30000, cwd: path.join(__dirname, '..') });
    const hasFail = out.includes('失败') && !out.includes('0 项失败') && !out.includes('失败 ✗');
    const allPass = out.includes('全部通过') || out.includes('全通') || out.includes('全部通过 ✓');
    
    if (hasFail || !allPass) {
      // Check more carefully
      const failMatch = out.match(/(\d+)\s*项失败/);
      const failCount = failMatch ? parseInt(failMatch[1]) : 0;
      if (failCount > 0 || (!allPass && out.includes('✗'))) {
        fail++;
        failed.push(f);
        console.log(`✗ ${f}`);
        // Extract failure lines
        out.split('\n').forEach(line => {
          if (line.includes('✗') || line.includes('失败')) console.log(`  ${line.trim()}`);
        });
      } else {
        pass++;
        console.log(`✓ ${f}`);
      }
    } else {
      pass++;
      console.log(`✓ ${f}`);
    }
  } catch (e) {
    fail++;
    failed.push(f);
    console.log(`✗ ${f} (crash/timeout)`);
    if (e.stdout) {
      e.stdout.split('\n').forEach(line => {
        if (line.includes('✗') || line.includes('失败') || line.includes('Error')) console.log(`  ${line.trim()}`);
      });
    }
  }
}

console.log(`\n========== 总结: ${pass} 通过, ${fail} 失败 ==========`);
if (failed.length) console.log(`失败: ${failed.join(', ')}`);
process.exit(fail > 0 ? 1 : 0);
