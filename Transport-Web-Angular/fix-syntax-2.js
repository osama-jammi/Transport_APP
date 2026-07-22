const fs = require('fs');
const path = require('path');

function fixRapports() {
  const p = 'C:/Users/user/OneDrive/Masaüstü/DivNet-CAISSE/Transport-Livraison/Transport-Web-Angular/src/app/features/rapports.component.ts';
  let c = fs.readFileSync(p, 'utf-8');
  c = c.replace("  `\n    </div>\n  `,\n  styles: [`", "    </div>\n  `,\n  styles: [`");
  fs.writeFileSync(p, c, 'utf-8');
  console.log('Fixed rapports.component.ts');
}

function fixAdmin() {
  const p = 'C:/Users/user/OneDrive/Masaüstü/DivNet-CAISSE/Transport-Livraison/Transport-Web-Angular/src/app/features/administration.component.ts';
  let c = fs.readFileSync(p, 'utf-8');
  
  // Find the exact block to remove:
  // from:
  //   `,
  //   styles: [`
  // ... to:
  //   `]
  //     </div>
  //   `,
  //   styles: [`
  
  const badStart = "  `,\n  styles: [`";
  const badEnd = "  `]\n    </div>\n  `,\n  styles: [`";
  
  const startIdx = c.indexOf(badStart);
  const endIdx = c.indexOf(badEnd);
  
  if (startIdx !== -1 && endIdx !== -1) {
    const before = c.substring(0, startIdx);
    const after = "    </div>\n  `,\n  styles: [`" + c.substring(endIdx + badEnd.length);
    fs.writeFileSync(p, before + after, 'utf-8');
    console.log('Fixed administration.component.ts');
  } else {
    console.log('Could not find exact bounds in administration.component.ts');
  }
}

fixRapports();
fixAdmin();
