const fs = require('fs');
const path = require('path');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  content = content.replace(/\n\}\)\nstyles: \[`/g, ',\n  styles: [`');
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log('Fixed', filePath);
}

const basePath = 'C:/Users/user/OneDrive/Masaüstü/DivNet-CAISSE/Transport-Livraison/Transport-Web-Angular/src/app/features/';
fixFile(path.join(basePath, 'voyages.component.ts'));
fixFile(path.join(basePath, 'voyages-conteneurs.component.ts'));
fixFile(path.join(basePath, 'suivi-trajets.component.ts'));
