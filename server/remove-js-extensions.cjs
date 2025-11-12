const fs = require('fs');
const path = require('path');

function removeJsExtensions(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      removeJsExtensions(fullPath);
    } else if (file.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const updated = content.replace(/from (['"])(\.\/?|\.\.\/?)([^'"]+)\.js(['"])/g, 'from $1$2$3$4');
      
      if (content !== updated) {
        fs.writeFileSync(fullPath, updated, 'utf8');
        console.log(`✓ Updated: ${fullPath}`);
      }
    }
  }
}

removeJsExtensions('./src');
console.log('\n✅ Done! All .js extensions removed from imports.');
