const fs = require('fs');
const path = require('path');

function fixComma(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  content = content.replace(/`\nstyles: \[`/g, '`,\n  styles: [`');
  content = content.replace(/`,\n  styles: \[`/g, '`,\n  styles: [`'); // in case it was already replaced
  // Also check if there are any remaining `\n})\nstyles: [`
  content = content.replace(/\n\}\)\nstyles: \[`/g, ',\n  styles: [`');
  
  // Actually, wait, let's just make sure there is a comma before styles.
  content = content.replace(/([^,])(\s*)styles: \[`/g, '$1,\n  styles: [`');

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log('Fixed comma in', filePath);
}

const basePath = 'C:/Users/user/OneDrive/Masaüstü/DivNet-CAISSE/Transport-Livraison/Transport-Web-Angular/src/app/features/';
fixComma(path.join(basePath, 'voyages.component.ts'));
fixComma(path.join(basePath, 'voyages-conteneurs.component.ts'));
fixComma(path.join(basePath, 'suivi-trajets.component.ts'));
