const fs = require('fs');
const zlib = require('zlib');

const src = process.argv[2] || 'd:\\桌面\\事业编报考\\学士学位证书.pdf';
const dst = process.argv[3] || 'd:\\桌面\\事业编报考\\学士学位证书_去水印.pdf';

let buf = fs.readFileSync(src);
let text = buf.toString('latin1');

// Helper: find object by number
function findObj(text, num) {
  const re = new RegExp(`${num} 0 obj[\\s\\S]*?endobj`);
  const m = text.match(re);
  return m ? m[0] : null;
}

// Decompress a stream object
function getStream(objStr) {
  const m = objStr.match(/stream\r?\n([\s\S]*?)endstream/);
  if (!m) return null;
  return Buffer.from(m[1], 'latin1');
}

// 1. Fix content streams: remove /Im2 drawing commands
function fixContentStream(objNum) {
  const obj = findObj(text, objNum);
  if (!obj) { console.error(`Object ${objNum} not found`); return null; }
  const raw = getStream(obj);
  if (!raw) { console.error(`Stream in obj ${objNum} not found`); return null; }
  const dec = zlib.inflateSync(raw);
  let content = dec.toString('latin1');
  // Remove the Im2 drawing command: q 104 0 0 30 723 10 cm /Im2 Do Q
  content = content.replace(/\s*q\s+104\s+0\s+0\s+30\s+723\s+10\s*cm\s+\/Im2\s+Do\s+Q\s*/g, '');
  const recomp = zlib.deflateSync(content);
  return recomp;
}

const newStream1 = fixContentStream(3); // page 1 contents
const newStream2 = fixContentStream(12); // page 2 contents

if (!newStream1 || !newStream2) { process.exit(1); }

// 2. Build new PDF by replacing the two content stream objects
// We need to replace obj 3 and obj 12, then rebuild xref

function replaceStreamObject(text, objNum, newStreamBuf) {
  const oldObj = findObj(text, objNum);
  const newObj = `${objNum} 0 obj\n<< /Filter /FlateDecode /Length ${newStreamBuf.length} >>\nstream\n` +
    newStreamBuf.toString('latin1') + '\nendstream\nendobj';
  return text.replace(oldObj, newObj);
}

text = replaceStreamObject(text, 3, newStream1);
text = replaceStreamObject(text, 12, newStream2);

// 3. Also clean up metadata: remove CamScanner author
text = text.replace('(CamScanner)', '(          )');

// 4. Remove annotation references (watermark links) from pages
// Page 1: /Annots 7 0 R -> remove
text = text.replace(/\/Annots 7 0 R /, '');
text = text.replace(/\/Annots 15 0 R /, '');

// 5. Rebuild xref table
// Find all objects and their byte offsets
const objRegex = /(\d+) 0 obj/g;
const offsets = [];
let match;
const pdfBytes = Buffer.from(text, 'latin1');

// We need to find byte offsets, not character offsets
// Since we're using latin1, char offset = byte offset
let pos = 0;
const objPositions = {};
while ((match = objRegex.exec(text)) !== null) {
  const num = parseInt(match[1]);
  objPositions[num] = match.index;
}

// Find the start of xref
const xrefStart = text.lastIndexOf('xref');
const beforeXref = text.slice(0, xrefStart);

// Build new xref
const maxObj = Math.max(...Object.keys(objPositions).map(Number));
const size = maxObj + 1;

let xref = `xref\n0 ${size}\n`;
xref += '0000000000 65535 f \n';
for (let i = 1; i < size; i++) {
  if (objPositions[i] !== undefined) {
    xref += String(objPositions[i]).padStart(10, '0') + ' 00000 n \n';
  } else {
    xref += '0000000000 65535 f \n';
  }
}

const trailer = `trailer\n<< /Size ${size} /Root 17 0 R /Info 18 0 R /ID [ <5ce2399710f292de3caa9e0a04b5e9d2>\n<5ce2399710f292de3caa9e0a04b5e9d2> ] >>\nstartxref\n${beforeXref.length + xref.length}\n%%EOF`;

const finalText = beforeXref + xref + trailer;
fs.writeFileSync(dst, Buffer.from(finalText, 'latin1'));
console.log('Done! Written to:', dst);
console.log('Size:', Buffer.from(finalText, 'latin1').length);

// Verify
const verify = fs.readFileSync(dst).toString('latin1');
const v1 = verify.match(/3 0 obj[\s\S]*?endobj/);
if (v1) {
  const raw = getStream(v1[0]);
  if (raw) {
    const dec = zlib.inflateSync(raw);
    console.log('Page1 stream verified:', dec.toString('latin1'));
  }
}
const v2 = verify.match(/12 0 obj[\s\S]*?endobj/);
if (v2) {
  const raw = getStream(v2[0]);
  if (raw) {
    const dec = zlib.inflateSync(raw);
    console.log('Page2 stream verified:', dec.toString('latin1'));
  }
}
