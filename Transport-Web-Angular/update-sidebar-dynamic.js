const fs = require('fs');
const path = require('path');

const stylesPath = 'C:/Users/user/OneDrive/Masaüstü/DivNet-CAISSE/Transport-Livraison/Transport-Web-Angular/src/styles.css';
let stylesContent = fs.readFileSync(stylesPath, 'utf-8');

const replacements = [
  {
    from: 'background: linear-gradient(170deg, #1e3a8a 0%, #1e40af 50%, #1d4ed8 100%);',
    to: 'background: linear-gradient(170deg, var(--sidebar-bg, #1e3a8a) 0%, var(--sidebar-bg2, #1d4ed8) 100%);'
  },
  {
    from: 'color: #1e3a8a; font-size: 18px; width: 40px; height: 40px; flex: 0 0 40px;',
    to: 'color: var(--sidebar-bg, #1e3a8a); font-size: 18px; width: 40px; height: 40px; flex: 0 0 40px;'
  },
  {
    from: 'background: #ffffff; color: #1e3a8a; font-weight: 700;',
    to: 'background: #ffffff; color: var(--sidebar-bg, #1e3a8a); font-weight: 700;'
  },
  {
    from: '.nav a.active i { color: #1e3a8a; }',
    to: '.nav a.active i { color: var(--sidebar-bg, #1e3a8a); }'
  }
];

let success = true;
for (const r of replacements) {
  if (stylesContent.includes(r.from)) {
    stylesContent = stylesContent.replace(r.from, r.to);
  } else {
    console.error("Could not find:", r.from);
    success = false;
  }
}

if (success) {
  fs.writeFileSync(stylesPath, stylesContent, 'utf-8');
  console.log('Sidebar updated to use dynamic Apparence theme variables!');
}
