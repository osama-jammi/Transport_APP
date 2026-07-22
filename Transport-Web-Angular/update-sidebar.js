const fs = require('fs');
const path = require('path');

const filePath = 'C:/Users/user/OneDrive/Masaüstü/DivNet-CAISSE/Transport-Livraison/Transport-Web-Angular/src/styles.css';
let content = fs.readFileSync(filePath, 'utf-8');

const oldSidebar = `.sidebar {
  width: 250px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  color: #334155;
  display: flex; flex-direction: column; position: fixed; inset: 0 auto 0 0;
  height: 100vh; z-index: 50; overflow: hidden;
  border-right: 1px solid #ffffff;
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.04);
}
/* Halo décoratif dans la sidebar */
.sidebar::before {
  content: ""; position: absolute; top: -90px; right: -70px; width: 240px; height: 240px;
  background: radial-gradient(circle, rgba(14, 165, 233, 0.08) 0%, transparent 70%);
  border-radius: 50%; pointer-events: none; animation: floatBlob 9s ease-in-out infinite;
}
.sidebar::after {
  content: ""; position: absolute; bottom: -60px; left: -40px; width: 180px; height: 180px;
  background: radial-gradient(circle, rgba(14, 165, 233, 0.06) 0%, transparent 70%);
  border-radius: 50%; pointer-events: none;
}
.sidebar .brand {
  display: flex; align-items: center; justify-content: center; gap: 12px; padding: 20px;
  font-weight: 800; font-size: 16px; color: #0f172a; letter-spacing: .2px;
  border-bottom: 1px solid #f1f5f9; position: relative; z-index: 1;
}
/* Logo Riche Bois */
.sidebar .brand-logo {
  width: 100%; max-width: 170px; height: auto; display: block;
}
.sidebar .brand > i {
  color: #0ea5e9; font-size: 18px; width: 40px; height: 40px; flex: 0 0 40px;
  display: grid; place-items: center; border-radius: 12px;
  background: #f0f9ff;
}
.sidebar .brand small { display:block; font-weight:500; font-size:11px; color: #64748b; margin-top: 2px; }
.nav { padding: 10px 15px; flex: 1; overflow-y: auto; position: relative; z-index: 1; }
.nav .group-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: .1em;
  color: #94a3b8; padding: 20px 12px 8px; font-weight: 700; }
.nav a {
  position: relative;
  display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-radius: 10px;
  color: #475569; font-weight: 500; margin-bottom: 4px;
  transition: all .2s ease;
}
.nav a i { width: 20px; text-align: center; font-size: 15px; color: #94a3b8; transition: all .2s; }
.nav a:hover { background: #f8fafc; color: #0f172a; }
.nav a:hover i { color: #0ea5e9; transform: scale(1.1); }
/* Barre indicatrice à gauche de l'item actif */
.nav a.active {
  background: #e0f2fe; color: #0284c7; font-weight: 700;
}
.nav a.active::before {
  content: ""; position: absolute; left: -15px; top: 50%; transform: translateY(-50%);
  width: 4px; height: 22px; border-radius: 0 4px 4px 0; background: #0ea5e9;
}
.nav a.active i { color: #0ea5e9; }
.sidebar .foot { padding: 15px 20px; border-top: 1px solid #f1f5f9;
  font-size: 11.5px; color: #64748b; position: relative; z-index: 1; display: flex; align-items: center; gap: 8px; }
.sidebar .foot::before { content: "\\f023"; font-family: "Font Awesome 6 Free"; font-weight: 900; opacity: .6; color: #0ea5e9; }`;

const newSidebar = `.sidebar {
  width: 250px;
  background: linear-gradient(170deg, #0B1120 0%, #0F172A 55%, #0C3C56 100%);
  color: #e2e8f0;
  display: flex; flex-direction: column; position: fixed; inset: 0 auto 0 0;
  height: 100vh; z-index: 50; overflow: hidden;
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.15);
}
/* Halo décoratif dans la sidebar */
.sidebar::before {
  content: ""; position: absolute; top: -90px; right: -70px; width: 240px; height: 240px;
  background: radial-gradient(circle, rgba(14, 165, 233, 0.15) 0%, transparent 70%);
  border-radius: 50%; pointer-events: none; animation: floatBlob 9s ease-in-out infinite;
}
.sidebar::after {
  content: ""; position: absolute; bottom: -60px; left: -40px; width: 180px; height: 180px;
  background: radial-gradient(circle, rgba(14, 165, 233, 0.12) 0%, transparent 70%);
  border-radius: 50%; pointer-events: none;
}
.sidebar .brand {
  display: flex; align-items: center; justify-content: center; gap: 12px; padding: 20px;
  font-weight: 800; font-size: 16px; color: #f8fafc; letter-spacing: .2px;
  border-bottom: 1px solid rgba(255,255,255,0.06); position: relative; z-index: 1;
}
/* Logo Riche Bois - Fond blanc avec léger padding pour faire ressortir sur fond sombre */
.sidebar .brand-logo {
  width: 100%; max-width: 170px; height: auto; display: block;
  background: #ffffff; padding: 8px 12px; border-radius: 8px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.3);
}
.sidebar .brand > i {
  color: #38bdf8; font-size: 18px; width: 40px; height: 40px; flex: 0 0 40px;
  display: grid; place-items: center; border-radius: 12px;
  background: rgba(14, 165, 233, 0.15);
}
.sidebar .brand small { display:block; font-weight:500; font-size:11px; color: #94a3b8; margin-top: 2px; }
.nav { padding: 10px 15px; flex: 1; overflow-y: auto; position: relative; z-index: 1; }
.nav .group-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: .1em;
  color: #64748b; padding: 20px 12px 8px; font-weight: 700; }
.nav a {
  position: relative;
  display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-radius: 10px;
  color: #94a3b8; font-weight: 500; margin-bottom: 4px;
  transition: all .2s ease;
}
.nav a i { width: 20px; text-align: center; font-size: 15px; color: #64748b; transition: all .2s; }
.nav a:hover { background: rgba(255,255,255,0.06); color: #f8fafc; }
.nav a:hover i { color: #38bdf8; transform: scale(1.1); }
/* Barre indicatrice à gauche de l'item actif */
.nav a.active {
  background: rgba(14, 165, 233, 0.15); color: #38bdf8; font-weight: 700;
  box-shadow: inset 0 0 15px rgba(14, 165, 233, 0.05);
}
.nav a.active::before {
  content: ""; position: absolute; left: -15px; top: 50%; transform: translateY(-50%);
  width: 4px; height: 22px; border-radius: 0 4px 4px 0; background: #38bdf8;
  box-shadow: 0 0 10px #38bdf8;
}
.nav a.active i { color: #38bdf8; }
.sidebar .foot { padding: 15px 20px; border-top: 1px solid rgba(255,255,255,0.06);
  font-size: 11.5px; color: #64748b; position: relative; z-index: 1; display: flex; align-items: center; gap: 8px; }
.sidebar .foot::before { content: "\\f023"; font-family: "Font Awesome 6 Free"; font-weight: 900; opacity: .6; color: #38bdf8; }`;

content = content.replace(oldSidebar, newSidebar);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Sidebar styles updated successfully.');
