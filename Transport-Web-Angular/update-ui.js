const fs = require('fs');
const path = require('path');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');

  // Extract template and styles boundaries
  const templateStart = content.indexOf('template: `');
  const stylesStart = content.indexOf('styles: [`');
  const classStart = content.indexOf('export class');

  if (templateStart === -1 || classStart === -1) {
    console.error(`Could not find template or class in ${filePath}`);
    return;
  }

  let beforeTemplate = content.substring(0, templateStart + 'template: `'.length);
  let templateAndStyles = content.substring(templateStart + 'template: `'.length, classStart);
  let classContent = content.substring(classStart);

  let templatePart = templateAndStyles;
  let stylesPart = '';

  if (stylesStart !== -1) {
    templatePart = content.substring(templateStart + 'template: `'.length, stylesStart);
    stylesPart = content.substring(stylesStart, classStart);
  }

  // --- Process Template ---
  // Wrap with premium container if not already
  const wrapperClass = path.basename(filePath, '.component.ts');
  if (!templatePart.includes(`premium-${wrapperClass}`)) {
    templatePart = `\n    <div class="premium-${wrapperClass}">\n      ` + templatePart.replace(/`\s*,\s*$/, '\n    `,\n');
    templatePart = templatePart.replace(/`\s*$/, '\n    </div>\n  `');
  }

  // Replacements
  templatePart = templatePart
    .replace(/class="card"/g, 'class="glass-card m-t"')
    .replace(/class="card /g, 'class="glass-card ')
    .replace(/class="toolbar"/g, 'class="toolbar glass-panel"')
    .replace(/class="table-wrap"/g, 'class="modern-table"')
    .replace(/class="table-wrap /g, 'class="modern-table ')
    .replace(/class="btn /g, 'class="p-btn ')
    .replace(/class="btn"/g, 'class="p-btn"')
    .replace(/btn-primary/g, 'p-btn-primary')
    .replace(/btn-outline/g, 'p-btn-light')
    .replace(/btn-danger/g, 'p-btn-icon danger')
    .replace(/btn-sm/g, 'p-btn-sm')
    .replace(/class="badge /g, 'class="p-badge ')
    .replace(/class="badge"/g, 'class="p-badge"')
    .replace(/badge-gray/g, 'light')
    .replace(/badge-blue/g, 'blue')
    .replace(/badge-green/g, 'green')
    .replace(/badge-red/g, 'red')
    .replace(/badge-orange/g, 'orange')
    .replace(/class="search"/g, 'class="search-box"')
    .replace(/class="modal"/g, 'class="modal p-modal"');

  // Add headers based on component
  if (!templatePart.includes('<div class="header">')) {
    if (filePath.includes('voyages.component.ts')) {
      templatePart = templatePart.replace('<div class="toolbar glass-panel">', 
        `<div class="header">
        <h1><i class="fa-solid fa-route"></i> Livraisons</h1>
        <p class="subtitle">Gestion des livraisons et bons de livraison.</p>
      </div>\n      <div class="toolbar glass-panel">`);
    } else if (filePath.includes('voyages-conteneurs.component.ts')) {
      templatePart = templatePart.replace('<div class="toolbar glass-panel">', 
        `<div class="header">
        <h1><i class="fa-solid fa-truck-fast"></i> Voyages</h1>
        <p class="subtitle">Gestion globale des voyages, livraisons et matières premières.</p>
      </div>\n      <div class="toolbar glass-panel">`);
    } else if (filePath.includes('suivi-trajets.component.ts')) {
      templatePart = templatePart.replace('<div class="toolbar glass-panel">', 
        `<div class="header">
        <h1><i class="fa-solid fa-map-location-dot"></i> Suivi des trajets</h1>
        <p class="subtitle">Suivi GPS des chauffeurs en temps réel.</p>
      </div>\n      <div class="toolbar glass-panel">`);
    }
  }

  // --- Process Styles ---
  // Replace the entire styles array with the new premium styles
  const premiumStyles = `styles: [\`
    .premium-${wrapperClass} {
      font-family: 'Inter', 'Segoe UI', Roboto, sans-serif;
      color: #334155;
      padding: 20px;
      max-width: 1500px;
      margin: 0 auto;
    }

    .header { margin-bottom: 25px; }
    .header h1 {
      margin: 0; font-size: 2rem; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 12px;
    }
    .header h1 i { color: #0ea5e9; }
    .subtitle { color: #64748b; margin-top: 4px; font-size: 1.05rem; }

    /* Glass Panels */
    .glass-panel, .glass-card {
      background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      border: 1px solid #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
      padding: 20px;
    }

    /* Toolbar */
    .toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 15px; margin-bottom: 25px; padding: 15px 20px; }
    
    .search-box {
      display: flex; align-items: center; background: #f1f5f9; border-radius: 8px; padding: 0 15px; width: 320px; border: 1px solid transparent; transition: border 0.3s;
    }
    .search-box:focus-within { border-color: #bae6fd; background: #fff; box-shadow: 0 0 0 3px #e0f2fe; }
    .search-box i { color: #94a3b8; }
    .search-box input { border: none; background: transparent; padding: 10px; width: 100%; color: #0f172a; font-size: 0.95rem; outline: none; }
    .actions { display: flex; gap: 10px; }

    /* Buttons */
    .p-btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 0.9rem;
      cursor: pointer; border: none; transition: all 0.2s ease; text-decoration: none;
    }
    .p-btn-sm { padding: 5px 10px; font-size: 0.8rem; }
    .p-btn-primary { background: #0ea5e9; color: #fff; box-shadow: 0 2px 10px rgba(14,165,233,0.3); }
    .p-btn-primary:hover { background: #0284c7; box-shadow: 0 4px 15px rgba(14,165,233,0.4); }
    .p-btn-primary[disabled] { opacity: 0.5; pointer-events: none; }
    .p-btn-light { background: #f1f5f9; color: #475569; }
    .p-btn-light:hover { background: #e2e8f0; }
    .p-btn-light.active { background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; }

    .p-btn-icon { padding: 6px; border-radius: 6px; background: transparent; color: #64748b; font-size: 1rem; }
    .p-btn-icon:hover { background: #f1f5f9; color: #0f172a; }
    .p-btn-icon.danger { color: #ef4444; }
    .p-btn-icon.danger:hover { background: #fee2e2; }

    /* Tables */
    .m-t { margin-top: 25px; }
    .modern-table table { width: 100%; border-collapse: separate; border-spacing: 0; }
    .modern-table th {
      text-align: left; padding: 12px 15px; color: #64748b; font-weight: 600; font-size: 0.85rem;
      text-transform: uppercase; border-bottom: 2px solid #f1f5f9;
    }
    .modern-table td { padding: 15px; color: #334155; font-weight: 500; font-size: 0.9rem; border-bottom: 1px solid #f1f5f9; }
    .modern-table tr:hover td { background: #f8fafc; }
    .modern-table tr.row-link { cursor: pointer; }
    .modern-table tr.row-active td { background: #f0f9ff; }

    .p-badge {
      padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 700;
      background: #f1f5f9; color: #64748b; text-transform: uppercase; display: inline-flex; align-items: center; gap: 6px;
    }
    .p-badge.blue { background: #e0f2fe; color: #0284c7; }
    .p-badge.green { background: #dcfce7; color: #16a34a; }
    .p-badge.red { background: #fee2e2; color: #ef4444; }
    .p-badge.orange { background: #ffedd5; color: #ea580c; }
    .p-badge.light { background: #f8fafc; color: #94a3b8; border: 1px solid #e2e8f0; }

    .empty { padding: 40px; text-align: center; color: #94a3b8; font-size: 1.1rem; display:flex; flex-direction:column; align-items:center; gap: 15px; }
    .empty i { font-size: 3rem; color: #cbd5e1; }
    .muted { color: #94a3b8; }
    .mono { font-family: monospace; }
    .color-primary { color: #0ea5e9; }

    /* Modals */
    .p-modal { border: none; border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.15); overflow: hidden; background: white; }
    .p-modal .m-head { background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 20px; }
    .p-modal .m-head h3 { color: #0f172a; font-weight: 700; font-size: 1.2rem; margin:0; }
    .p-modal .m-body { padding: 25px; max-height: 70vh; overflow-y: auto; }
    .p-modal .m-foot { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; display: flex; justify-content: flex-end; gap: 10px; }
    
    .p-input, .filtre-input, input[type="date"], input[type="time"] {
      width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px;
      font-size: 0.95rem; color: #0f172a; transition: all 0.2s; background: #fff;
    }
    .p-input:focus, .filtre-input:focus, input[type="date"]:focus, input[type="time"]:focus { 
      outline: none; border-color: #0ea5e9; box-shadow: 0 0 0 3px #e0f2fe; 
    }
    
    .spinner-modern {
      width: 40px; height: 40px; margin: 40px auto; border: 3px solid #e0f2fe; border-radius: 50%;
      border-top-color: #0ea5e9; animation: spin 1s ease-in-out infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Specific to components */
    .detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
    .detail-grid .dk { display: block; font-size: 0.85rem; color: #64748b; margin-bottom: 4px; text-transform: uppercase; font-weight: 600; }
    .detail-grid .dv { display: block; font-size: 1rem; color: #0f172a; font-weight: 500; }
    
    .ligne-section { background: #f1f5f9; padding: 12px; border-radius: 8px; margin: 10px 0; }
    
    .map-legend { display:flex; gap:18px; flex-wrap:wrap; margin-bottom:12px; font-size:12.5px; color:#64748b; }
    .map-legend .dot { display:inline-block; width:11px; height:11px; border-radius:50%; margin-right:6px; vertical-align:middle; }
    .map-legend .leg { cursor:pointer; padding:4px 8px; border-radius:6px; transition: all 0.2s; }
    .map-legend .leg:hover { background: #f1f5f9; }
    .map-legend .leg.active { background:#e0f2fe; font-weight:700; color:#0284c7; }
    
    .map-holder { position: relative; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
    #suivi-map { height: calc(100dvh - 430px); min-height: 400px; }
    .map-fs { position: absolute; top: 12px; right: 12px; z-index: 1000; background: #fff; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
  \`]
})
`;

  // Write back
  const newContent = beforeTemplate + templatePart + premiumStyles + classContent;
  fs.writeFileSync(filePath, newContent, 'utf-8');
  console.log('Processed', filePath);
}

const basePath = 'C:/Users/user/OneDrive/Masaüstü/DivNet-CAISSE/Transport-Livraison/Transport-Web-Angular/src/app/features/';
processFile(path.join(basePath, 'voyages.component.ts'));
processFile(path.join(basePath, 'voyages-conteneurs.component.ts'));
processFile(path.join(basePath, 'suivi-trajets.component.ts'));

console.log('All files processed.');
