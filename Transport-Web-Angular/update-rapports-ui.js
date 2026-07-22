const fs = require('fs');
const path = require('path');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');

  // Skip if already processed
  if (content.includes('premium-rapports')) return;

  const templateStart = content.indexOf('template: `');
  const classStart = content.indexOf('export class');

  if (templateStart === -1 || classStart === -1) {
    console.error(`Could not find template or class in ${filePath}`);
    return;
  }

  let beforeTemplate = content.substring(0, templateStart + 'template: `'.length);
  let templatePart = content.substring(templateStart + 'template: `'.length, classStart);
  let classContent = content.substring(classStart);

  // Strip trailing whitespace/newlines and })
  templatePart = templatePart.replace(/}[\s\n,]*styles: \[`/g, 'styles: [`');
  templatePart = templatePart.replace(/`[\s\n,]*$/g, '');
  templatePart = templatePart.replace(/\n\}\)\n$/g, ''); // if ends with })
  templatePart = templatePart.replace(/\n\}\)[\s\n]*$/g, '');

  templatePart = `\n    <div class="premium-rapports">\n      <div class="header">\n        <h1><i class="fa-solid fa-file-excel"></i> Rapports et Exports</h1>\n        <p class="subtitle">Générateur d'extractions statistiques multi-formats.</p>\n      </div>\n      ` + templatePart;
  templatePart += `\n    </div>\n  \`,`;

  templatePart = templatePart
    .replace(/class="card"/g, 'class="glass-card m-t"')
    .replace(/class="card /g, 'class="glass-card ')
    .replace(/class="card"/g, 'class="glass-card"')
    .replace(/class="btn /g, 'class="p-btn ')
    .replace(/class="btn"/g, 'class="p-btn"')
    .replace(/btn-primary/g, 'p-btn-primary')
    .replace(/btn-outline/g, 'p-btn-light');

  const premiumStyles = `\n  styles: [\`
    .premium-rapports {
      font-family: 'Inter', 'Segoe UI', Roboto, sans-serif;
      color: #334155;
      padding: 20px;
      max-width: 1500px;
      margin: 0 auto;
    }

    .header { margin-bottom: 25px; }
    .header h1 { margin: 0; font-size: 2rem; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 12px; }
    .header h1 i { color: #0ea5e9; }
    .subtitle { color: #64748b; margin-top: 4px; font-size: 1.05rem; }

    .glass-panel, .glass-card {
      background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      border: 1px solid #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
      padding: 25px; margin-bottom: 20px; transition: transform 0.2s, box-shadow 0.2s;
    }
    .glass-card:hover { box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08); transform: translateY(-2px); }

    .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
    .field label { display: block; font-size: 0.9rem; font-weight: 600; color: #475569; margin-bottom: 6px; }
    input[type="date"] {
      width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px;
      font-size: 0.95rem; color: #0f172a; transition: all 0.2s; background: #fff;
    }
    input[type="date"]:focus { outline: none; border-color: #0ea5e9; box-shadow: 0 0 0 3px #e0f2fe; }

    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
    .stat {
      background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(20px);
      border: 1px solid #ffffff; border-radius: 16px; padding: 20px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04); display: flex; align-items: center; gap: 16px;
      transition: all 0.2s ease; position: relative; overflow: hidden;
    }
    .stat:hover { box-shadow: 0 10px 25px rgba(14, 165, 233, 0.15); transform: translateY(-3px); border-color: #bae6fd; }
    
    .stat .ic {
      width: 55px; height: 55px; border-radius: 14px; display: grid; place-items: center;
      font-size: 24px; color: #fff; flex: 0 0 55px; position: relative; z-index: 1;
    }
    .stat .ic.blue { background: linear-gradient(135deg, #38bdf8, #0284c7); box-shadow: 0 8px 18px rgba(2, 132, 199, 0.25); }
    .stat .ic.cyan { background: linear-gradient(135deg, #22d3ee, #0891b2); box-shadow: 0 8px 18px rgba(8, 145, 178, 0.25); }
    .stat .ic.orange { background: linear-gradient(135deg, #fb923c, #ea580c); box-shadow: 0 8px 18px rgba(234, 88, 12, 0.25); }
    .stat .ic.green { background: linear-gradient(135deg, #4ade80, #16a34a); box-shadow: 0 8px 18px rgba(22, 163, 74, 0.25); }
    
    .stat .lbl { color: #64748b; font-size: 0.9rem; margin-top: 4px; font-weight: 500; line-height: 1.3; }
  \`]
})
`;

  const newContent = beforeTemplate + templatePart + premiumStyles + classContent;
  fs.writeFileSync(filePath, newContent, 'utf-8');
  console.log('Processed', filePath);
}

const basePath = 'C:/Users/user/OneDrive/Masaüstü/DivNet-CAISSE/Transport-Livraison/Transport-Web-Angular/src/app/features/';
processFile(path.join(basePath, 'rapports.component.ts'));
