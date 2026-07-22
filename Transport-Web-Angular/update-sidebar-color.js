const fs = require('fs');
const path = require('path');

const stylesPath = 'C:/Users/user/OneDrive/Masaüstü/DivNet-CAISSE/Transport-Livraison/Transport-Web-Angular/src/styles.css';
let stylesContent = fs.readFileSync(stylesPath, 'utf-8');

const oldSidebar = `.sidebar {
  width: 250px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(25px);
  -webkit-backdrop-filter: blur(25px);
  color: #334155;
  display: flex; flex-direction: column; position: fixed; inset: 0 auto 0 0;
  height: 100vh; z-index: 50; overflow: hidden;
  border-right: 1px solid rgba(0, 0, 0, 0.04);
  box-shadow: 10px 0 30px rgba(0, 0, 0, 0.02);
}
/* Halo décoratif dans la sidebar */
.sidebar::before {
  content: ""; position: absolute; top: -100px; right: -80px; width: 250px; height: 250px;
  background: radial-gradient(circle, rgba(14, 165, 233, 0.07) 0%, transparent 70%);
  border-radius: 50%; pointer-events: none; animation: floatBlob 10s ease-in-out infinite;
}
.sidebar::after {
  content: ""; position: absolute; bottom: -50px; left: -50px; width: 200px; height: 200px;
  background: radial-gradient(circle, rgba(16, 185, 129, 0.05) 0%, transparent 70%);
  border-radius: 50%; pointer-events: none;
}
.sidebar .brand {
  display: flex; align-items: center; justify-content: center; gap: 12px; padding: 22px 20px;
  font-weight: 800; font-size: 17px; color: #0f172a; letter-spacing: .2px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.03); position: relative; z-index: 1;
}
/* Logo Riche Bois */
.sidebar .brand-logo {
  width: 100%; max-width: 160px; height: auto; display: block;
}
.sidebar .brand > i {
  color: #0ea5e9; font-size: 18px; width: 40px; height: 40px; flex: 0 0 40px;
  display: grid; place-items: center; border-radius: 12px;
  background: #f0f9ff;
}
.sidebar .brand small { display:block; font-weight:500; font-size:11px; color: #64748b; margin-top: 3px; }
.nav { padding: 15px 15px; flex: 1; overflow-y: auto; position: relative; z-index: 1; }
.nav .group-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: .15em;
  color: #94a3b8; padding: 20px 12px 10px; font-weight: 700; }
.nav a {
  position: relative;
  display: flex; align-items: center; gap: 14px; padding: 12px 16px; border-radius: 12px;
  color: #475569; font-weight: 600; font-size: 14px; margin-bottom: 6px;
  transition: all .25s ease;
}
.nav a i { width: 20px; text-align: center; font-size: 16px; color: #94a3b8; transition: all .25s; }
.nav a:hover { background: #f8fafc; color: #0f172a; transform: translateX(3px); }
.nav a:hover i { color: #0ea5e9; transform: scale(1.15); }
/* Barre indicatrice à gauche de l'item actif */
.nav a.active {
  background: #f0f9ff; color: #0284c7; font-weight: 700;
  box-shadow: 0 4px 10px rgba(14, 165, 233, 0.05);
}
.nav a.active::before {
  content: ""; position: absolute; left: -15px; top: 50%; transform: translateY(-50%);
  width: 5px; height: 24px; border-radius: 0 4px 4px 0; background: #0ea5e9;
}
.nav a.active i { color: #0ea5e9; }
.sidebar .foot { padding: 18px 20px; border-top: 1px solid rgba(0, 0, 0, 0.03);
  font-size: 12px; color: #64748b; position: relative; z-index: 1; display: flex; align-items: center; gap: 8px; }
.sidebar .foot::before { content: "\\f023"; font-family: "Font Awesome 6 Free"; font-weight: 900; opacity: .6; color: #0ea5e9; }`;

const newSidebar = `.sidebar {
  width: 250px;
  background: linear-gradient(170deg, #1e3a8a 0%, #1e40af 50%, #1d4ed8 100%);
  color: #ffffff;
  display: flex; flex-direction: column; position: fixed; inset: 0 auto 0 0;
  height: 100vh; z-index: 50; overflow: hidden;
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.15);
}
/* Halo décoratif dans la sidebar */
.sidebar::before {
  content: ""; position: absolute; top: -90px; right: -70px; width: 240px; height: 240px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
  border-radius: 50%; pointer-events: none; animation: floatBlob 9s ease-in-out infinite;
}
.sidebar::after {
  content: ""; position: absolute; bottom: -60px; left: -40px; width: 180px; height: 180px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.08) 0%, transparent 70%);
  border-radius: 50%; pointer-events: none;
}
.sidebar .brand {
  display: flex; align-items: center; justify-content: center; gap: 12px; padding: 22px 20px;
  font-weight: 800; font-size: 17px; color: #ffffff; letter-spacing: .2px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.15); position: relative; z-index: 1;
}
/* Logo Riche Bois - Fond blanc avec léger padding pour faire ressortir sur fond bleu roi */
.sidebar .brand-logo {
  width: 100%; max-width: 160px; height: auto; display: block;
  background: #ffffff; padding: 8px 12px; border-radius: 8px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.15);
}
.sidebar .brand > i {
  color: #1e3a8a; font-size: 18px; width: 40px; height: 40px; flex: 0 0 40px;
  display: grid; place-items: center; border-radius: 12px;
  background: #ffffff;
}
.sidebar .brand small { display:block; font-weight:500; font-size:11px; color: #93c5fd; margin-top: 3px; }
.nav { padding: 15px 15px; flex: 1; overflow-y: auto; position: relative; z-index: 1; }
.nav .group-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: .15em;
  color: #93c5fd; padding: 20px 12px 10px; font-weight: 700; opacity: 0.8; }
.nav a {
  position: relative;
  display: flex; align-items: center; gap: 14px; padding: 12px 16px; border-radius: 12px;
  color: #bfdbfe; font-weight: 600; font-size: 14px; margin-bottom: 6px;
  transition: all .25s ease;
}
.nav a i { width: 20px; text-align: center; font-size: 16px; color: #bfdbfe; transition: all .25s; }
.nav a:hover { background: rgba(255,255,255,0.1); color: #ffffff; transform: translateX(3px); }
.nav a:hover i { color: #ffffff; transform: scale(1.15); }
/* Barre indicatrice à gauche de l'item actif */
.nav a.active {
  background: #ffffff; color: #1e3a8a; font-weight: 700;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}
.nav a.active::before {
  content: ""; position: absolute; left: -15px; top: 50%; transform: translateY(-50%);
  width: 5px; height: 24px; border-radius: 0 4px 4px 0; background: #ffffff;
  box-shadow: 0 0 10px #ffffff;
}
.nav a.active i { color: #1e3a8a; }
.sidebar .foot { padding: 18px 20px; border-top: 1px solid rgba(255, 255, 255, 0.15);
  font-size: 12px; color: #bfdbfe; position: relative; z-index: 1; display: flex; align-items: center; gap: 8px; }
.sidebar .foot::before { content: "\\f023"; font-family: "Font Awesome 6 Free"; font-weight: 900; opacity: .8; color: #ffffff; }`;

stylesContent = stylesContent.replace(oldSidebar, newSidebar);
fs.writeFileSync(stylesPath, stylesContent, 'utf-8');
console.log('Sidebar updated to vibrant royal blue color theme');
