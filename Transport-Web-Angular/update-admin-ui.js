const fs = require('fs');
const path = require('path');

const filePath = 'C:/Users/user/OneDrive/Masaüstü/DivNet-CAISSE/Transport-Livraison/Transport-Web-Angular/src/app/features/administration.component.ts';
let content = fs.readFileSync(filePath, 'utf-8');

if (!content.includes('premium-admin')) {
  const templateStart = content.indexOf('template: `');
  const classStart = content.indexOf('export class');
  
  if (templateStart !== -1 && classStart !== -1) {
    let beforeTemplate = content.substring(0, templateStart + 'template: `'.length);
    let templatePart = content.substring(templateStart + 'template: `'.length, classStart);
    let classContent = content.substring(classStart);

    templatePart = templatePart.replace(/}[\s\n,]*styles: \[`/g, 'styles: [`');
    templatePart = templatePart.replace(/`[\s\n,]*$/g, '');
    templatePart = templatePart.replace(/\n\}\)\n$/g, '');
    templatePart = templatePart.replace(/\n\}\)[\s\n]*$/g, '');

    templatePart = `\n    <div class="premium-admin">\n      <div class="header">\n        <h1><i class="fa-solid fa-sliders"></i> Administration</h1>\n        <p class="subtitle">Gérez les fonctionnalités et l'apparence de l'application.</p>\n      </div>\n      ` + templatePart;
    templatePart += `\n    </div>\n  \`,`;

    templatePart = templatePart
      .replace(/class="card"/g, 'class="glass-card m-t"')
      .replace(/class="card /g, 'class="glass-card ')
      .replace(/class="card"/g, 'class="glass-card"');

    const premiumStyles = `\n  styles: [\`
    .premium-admin { font-family: 'Inter', sans-serif; color: #334155; padding: 20px; max-width: 1200px; margin: 0 auto; }
    .header { margin-bottom: 25px; }
    .header h1 { margin: 0; font-size: 2rem; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 12px; }
    .header h1 i { color: #0ea5e9; }
    .subtitle { color: #64748b; margin-top: 4px; font-size: 1.05rem; }

    .glass-card {
      background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      border: 1px solid #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
      padding: 25px; margin-bottom: 20px; transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .card-head h2 { font-size: 1.25rem; font-weight: 700; color: #0f172a; margin: 0 0 15px 0; display:flex; align-items:center; gap:8px; }
    .card-head h2 i { color: #0ea5e9; }
    
    .feature-list { display:flex; flex-direction:column; gap:12px; }
    .feature-row { display:flex; align-items:center; gap:14px; padding:16px 20px; background: #fff;
      border:1px solid #e2e8f0; border-radius:12px; transition: all .2s; }
    .feature-row:hover { border-color: #bae6fd; box-shadow: 0 4px 12px rgba(14,165,233,0.08); transform: translateY(-1px); }
    .feature-row > div:first-child { flex:1 1 auto; }
    .feature-row strong { font-size: 1.05rem; color: #1e293b; display:block; margin-bottom: 4px; }
    .feature-row code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; color: #64748b; }
    
    .switch { position:relative; display:inline-block; width:50px; height:26px; flex:0 0 auto; cursor:pointer; }
    .switch input { opacity:0; width:0; height:0; }
    .switch .slider { position:absolute; inset:0; background:#cbd5e1; border-radius:26px; transition:.3s; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1); }
    .switch .slider::before { content:''; position:absolute; height:20px; width:20px; left:3px; bottom:3px;
      background:#fff; border-radius:50%; transition:.3s; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
    .switch input:checked + .slider { background: #10b981; }
    .switch input:checked + .slider::before { transform:translateX(24px); }
    
    .badge { padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; }
    .badge-green { background: #d1fae5; color: #059669; }
    .badge-gray { background: #f1f5f9; color: #64748b; }
    
    .theme-choices { display:flex; gap:16px; flex-wrap:wrap; margin-top: 15px; }
    .theme-choice { display:flex; align-items:center; gap:12px; padding:12px 20px; cursor:pointer;
      border:1.5px solid #e2e8f0; border-radius:12px; background:#fff; font-weight:600; color:#475569;
      font-size:14px; transition:all .2s; }
    .theme-choice:hover { border-color:#0ea5e9; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(14,165,233,0.1); }
    .theme-choice.active { border-color:#0ea5e9; background: #f0f9ff; color: #0284c7; }
    .theme-choice .theme-dot { width:22px; height:22px; border-radius:50%; box-shadow:0 0 0 2px #fff, 0 0 0 3px rgba(0,0,0,.1); }
    .theme-choice .fa-check { color:#0ea5e9; font-size: 16px; }
  \`]
})
`;
    content = beforeTemplate + templatePart + premiumStyles + classContent;
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log('Administration UI updated.');
  }
}
