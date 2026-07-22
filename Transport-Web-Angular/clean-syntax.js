const fs = require('fs');
const path = require('path');

function cleanFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // 1. Remove `}),` or `})` right before `styles: [`
  content = content.replace(/\}\)[\s\n,]*styles: \[`/g, 'styles: [`');
  
  // 2. Remove any extra commas or spaces after the template closing backtick, right before `styles: [`
  content = content.replace(/`[\s\n,]*styles: \[`/g, '`,\n  styles: [`');

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log('Cleaned', filePath);
}

const basePath = 'C:/Users/user/OneDrive/Masaüstü/DivNet-CAISSE/Transport-Livraison/Transport-Web-Angular/src/app/features/';
cleanFile(path.join(basePath, 'voyages.component.ts'));
cleanFile(path.join(basePath, 'voyages-conteneurs.component.ts'));
cleanFile(path.join(basePath, 'suivi-trajets.component.ts'));
