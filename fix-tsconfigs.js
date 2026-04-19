const fs = require('fs');
const path = require('path');

const packagesDir = path.join(__dirname, 'packages');
const packages = fs.readdirSync(packagesDir);

let fixedCount = 0;

for (const pkg of packages) {
  const tsconfigPath = path.join(packagesDir, pkg, 'tsconfig.json');
  if (fs.existsSync(tsconfigPath)) {
    let content = fs.readFileSync(tsconfigPath, 'utf8');
    
    // Regular expression to match the incorrect appended block
    // block: }{   "extends": "./tsconfig.jsonc"  }
    const corruptedPattern = /\\}\\s*\\{\\s*"extends"\\s*:\\s*"\\.\\/tsconfig\\.jsonc"\\s*\\}/g;
    
    // Also try a simpler replacement since the exact spacing might differ.
    if (content.includes('}{')) {
      // Just strip the corrupted appended object completely and restore the closing brace
      content = content.replace(/\\}\\s*\\{[\\s\\S]*?"extends"[\\s\\S]*?\\}/g, '}');
      fs.writeFileSync(tsconfigPath, content);
      console.log("Fixed " + tsconfigPath);
      fixedCount++;
    }
  }
}

console.log("Done. Fixed " + fixedCount + " files.");
