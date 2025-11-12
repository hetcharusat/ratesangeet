const fs = require('fs');
const path = require('path');

function addJsExtensions(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      addJsExtensions(fullPath);
    } else if (file.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      // Add .js extension to relative imports that don't have it
      const updated = content.replace(/from (['"])(\.\/?|\.\.\/?)([^'"]+)(['"])/g, (match, q1, prefix, modulePath, q2) => {
        // Skip if already has extension or is a package import
        if (modulePath.includes('.js') || modulePath.includes('.json') || !prefix.startsWith('.')) {
          return match;
        }
        return `from ${q1}${prefix}${modulePath}.js${q2}`;
      });
      
      if (content !== updated) {
        fs.writeFileSync(fullPath, updated, 'utf8');
        console.log(`✓ Updated: ${fullPath}`);
      }
    }
  }
}

addJsExtensions('./src');
console.log('\n✅ Done! All relative imports now have .js extensions.');
