import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const directions = [
  {
    id: 'A',
    name: 'Dark Medical',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0d0f11;color:#e2e8f0;font-family:'Inter',sans-serif;display:flex;height:100vh;overflow:hidden}
.sidebar{width:220px;background:#111418;border-right:1px solid #1e2530;padding:20px 0;flex-shrink:0}
.logo{padding:0 20px 24px;font-family:'JetBrains Mono',monospace;font-size:13px;color:#00d4ff;letter-spacing:2px;text-transform:uppercase;border-bottom:1px solid #1e2530}
.logo span{display:block;font-size:10px;color:#4a5568;margin-top:4px;letter-spacing:1px}
.nav{padding:16px 0}
.nav-item{display:flex;align-items:center;gap:10px;padding:10px 20px;font-size:13px;color:#718096;cursor:pointer;transition:all 0.15s}
.nav-item.active{color:#00d4ff;background:rgba(0,212,255,0.06);border-right:2px solid #00d4ff}
.nav-item:hover{color:#a0aec0;background:rgba(255,255,255,0.03)}
.nav-icon{width:16px;height:16px;opacity:0.7;font-family:'JetBrains Mono',monospace;font-size:12px}
.main{flex:1;display:flex;flex-direction:column;overflow:hidden}
.topbar{height:52px;background:#111418;border-bottom:1px solid #1e2530;display:flex;align-items:center;padding:0 24px;gap:16px}
.search{flex:1;max-width:400px;background:#1a1f2a;border:1px solid #2d3748;border-radius:6px;padding:8px 14px;font-family:'JetBrains Mono',monospace;font-size:12px;color:#a0aec0;display:flex;align-items:center;gap:8px}
.search-key{background:#0d0f11;border:1px solid #2d3748;border-radius:3px;padding:1px 5px;font-size:10px;color:#4a5568}
.topbar-actions{display:flex;gap:8px;margin-left:auto}
.btn{padding:7px 14px;border-radius:5px;font-size:12px;font-family:'JetBrains Mono',monospace;cursor:pointer;border:none}
.btn-primary{background:#00d4ff;color:#0d0f11;font-weight:700;letter-spacing:0.5px}
.content{flex:1;padding:24px;overflow-y:auto;background:#0d0f11}
.page-title{font-family:'JetBrains Mono',monospace;font-size:11px;color:#4a5568;letter-spacing:2px;text-transform:uppercase;margin-bottom:20px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
.stat{background:#111418;border:1px solid #1e2530;border-radius:8px;padding:16px}
.stat-val{font-family:'JetBrains Mono',monospace;font-size:24px;font-weight:700;color:#00d4ff}
.stat-label{font-size:11px;color:#4a5568;margin-top:4px;letter-spacing:0.5px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.card{background:#111418;border:1px solid #1e2530;border-radius:8px;padding:16px;cursor:pointer}
.card:hover{border-color:#2d3748}
.card-tag{font-family:'JetBrains Mono',monospace;font-size:10px;color:#00d4ff;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px}
.card-title{font-size:14px;color:#e2e8f0;margin-bottom:6px}
.card-meta{font-size:11px;color:#4a5568;font-family:'JetBrains Mono',monospace}
.badge{display:inline-block;padding:2px 8px;border-radius:3px;font-size:10px;font-family:'JetBrains Mono',monospace;letter-spacing:0.5px}
.badge-invoice{background:rgba(0,212,255,0.1);color:#00d4ff;border:1px solid rgba(0,212,255,0.2)}
.badge-report{background:rgba(74,222,128,0.1);color:#4ade80;border:1px solid rgba(74,222,128,0.2)}
.badge-rx{background:rgba(251,191,36,0.1);color:#fbbf24;border:1px solid rgba(251,191,36,0.2)}
</style></head><body>
<div class="sidebar">
  <div class="logo">myHealth<span>v2.0.0 // local</span></div>
  <nav class="nav">
    <div class="nav-item active"><span class="nav-icon">▣</span> Documents</div>
    <div class="nav-item"><span class="nav-icon">◈</span> Timeline</div>
    <div class="nav-item"><span class="nav-icon">◉</span> Appointments</div>
    <div class="nav-item"><span class="nav-icon">◎</span> Contacts</div>
    <div class="nav-item"><span class="nav-icon">⊟</span> Clinics</div>
    <div class="nav-item"><span class="nav-icon">◇</span> Notes</div>
    <div class="nav-item"><span class="nav-icon">⊕</span> Symptoms</div>
    <div class="nav-item"><span class="nav-icon">⊛</span> Medications</div>
    <div class="nav-item" style="margin-top:auto"><span class="nav-icon">⚙</span> Settings</div>
  </nav>
</div>
<div class="main">
  <div class="topbar">
    <div class="search">⌕ &nbsp;search records... <span class="search-key">⌘K</span></div>
    <div class="topbar-actions">
      <button class="btn btn-primary">+ Upload</button>
    </div>
  </div>
  <div class="content">
    <div class="page-title">// documents — all records</div>
    <div class="stats">
      <div class="stat"><div class="stat-val">47</div><div class="stat-label">DOCUMENTS</div></div>
      <div class="stat"><div class="stat-val">12</div><div class="stat-label">APPOINTMENTS</div></div>
      <div class="stat"><div class="stat-val">8</div><div class="stat-label">CONTACTS</div></div>
      <div class="stat"><div class="stat-val">3</div><div class="stat-label">CLINICS</div></div>
    </div>
    <div class="grid">
      <div class="card"><div class="card-tag"><span class="badge badge-invoice">invoice</span></div><div class="card-title">Physio Session — April</div><div class="card-meta">2024-04-15 · Dr. Chen</div></div>
      <div class="card"><div class="card-tag"><span class="badge badge-report">report</span></div><div class="card-title">MRI Scan Results</div><div class="card-meta">2024-03-22 · Royal London</div></div>
      <div class="card"><div class="card-tag"><span class="badge badge-rx">prescription</span></div><div class="card-title">Amoxicillin 500mg</div><div class="card-meta">2024-02-10 · Dr. Patel</div></div>
      <div class="card"><div class="card-tag"><span class="badge badge-invoice">invoice</span></div><div class="card-title">Cardiology Consultation</div><div class="card-meta">2024-01-30 · The Heart Clinic</div></div>
      <div class="card"><div class="card-tag"><span class="badge badge-report">report</span></div><div class="card-title">Blood Panel — Q1</div><div class="card-meta">2024-01-15 · NHS Lab</div></div>
      <div class="card"><div class="card-tag"><span class="badge badge-rx">prescription</span></div><div class="card-title">Lisinopril 10mg</div><div class="card-meta">2023-12-05 · Dr. Okafor</div></div>
    </div>
  </div>
</div>
</body></html>`
  },
  {
    id: 'B',
    name: 'Editorial Health',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=Source+Serif+4:ital,wght@0,300;0,400;1,300&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#f7f4ef;color:#1a1612;font-family:'Source Serif 4',Georgia,serif;display:flex;height:100vh;overflow:hidden}
.sidebar{width:260px;background:#1a1612;padding:32px 28px;flex-shrink:0;display:flex;flex-direction:column}
.logo{font-family:'Playfair Display',serif;font-size:22px;color:#f7f4ef;margin-bottom:4px}
.logo-sub{font-size:11px;color:#6b5e4e;letter-spacing:2px;text-transform:uppercase;margin-bottom:40px;font-family:'Inter',sans-serif}
.nav-section{font-size:9px;color:#4a3f35;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;font-family:'Inter',sans-serif}
.nav-item{display:flex;align-items:center;gap:12px;padding:10px 0;font-size:14px;color:#8a7a6a;cursor:pointer;border-bottom:1px solid #2a231c;font-family:'Source Serif 4',serif}
.nav-item.active{color:#c8b89a}
.nav-num{font-size:10px;color:#4a3f35;font-family:'Inter',sans-serif;width:16px}
.main{flex:1;display:flex;flex-direction:column;overflow:hidden}
.topbar{height:64px;background:#f7f4ef;border-bottom:2px solid #1a1612;display:flex;align-items:center;padding:0 40px;gap:24px}
.topbar-title{font-family:'Playfair Display',serif;font-size:20px;flex:1}
.search{background:transparent;border:none;border-bottom:1px solid #c8b89a;padding:6px 0;font-size:13px;font-family:'Source Serif 4',serif;color:#1a1612;width:220px;outline:none}
.btn-upload{background:#1a1612;color:#f7f4ef;padding:10px 20px;font-family:'Inter',sans-serif;font-size:12px;letter-spacing:1px;text-transform:uppercase;border:none;cursor:pointer}
.content{flex:1;padding:40px;overflow-y:auto;display:grid;grid-template-columns:2fr 1fr;gap:40px}
.main-col{}
.aside-col{}
.section-label{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#8a7a6a;margin-bottom:20px;font-family:'Inter',sans-serif;padding-bottom:8px;border-bottom:1px solid #d4cdc4}
.feature-card{background:#fff;padding:24px;margin-bottom:16px;border-left:3px solid #1a1612}
.feature-date{font-size:11px;color:#8a7a6a;font-family:'Inter',sans-serif;margin-bottom:6px;letter-spacing:0.5px}
.feature-title{font-family:'Playfair Display',serif;font-size:18px;margin-bottom:6px}
.feature-tag{font-size:11px;color:#8a7a6a;font-style:italic}
.list-item{padding:14px 0;border-bottom:1px solid #e8e2d9;display:flex;align-items:baseline;gap:16px}
.list-num{font-size:11px;color:#c8b89a;font-family:'Inter',sans-serif;min-width:20px}
.list-title{font-size:14px;color:#1a1612}
.list-meta{font-size:11px;color:#8a7a6a;font-style:italic;margin-top:2px}
.aside-stat{margin-bottom:24px}
.stat-big{font-family:'Playfair Display',serif;font-size:48px;color:#1a1612;line-height:1}
.stat-label{font-size:11px;color:#8a7a6a;letter-spacing:1px;text-transform:uppercase;font-family:'Inter',sans-serif;margin-top:4px}
</style></head><body>
<div class="sidebar">
  <div class="logo">myHealth</div>
  <div class="logo-sub">Personal Records</div>
  <div class="nav-section">Navigation</div>
  <div class="nav-item active"><span class="nav-num">01</span> Documents</div>
  <div class="nav-item"><span class="nav-num">02</span> Timeline</div>
  <div class="nav-item"><span class="nav-num">03</span> Appointments</div>
  <div class="nav-item"><span class="nav-num">04</span> Contacts</div>
  <div class="nav-item"><span class="nav-num">05</span> Notes</div>
  <div class="nav-item"><span class="nav-num">06</span> Symptoms</div>
</div>
<div class="main">
  <div class="topbar">
    <div class="topbar-title">Documents</div>
    <input class="search" placeholder="Search records…">
    <button class="btn-upload">Upload</button>
  </div>
  <div class="content">
    <div class="main-col">
      <div class="section-label">Recent Documents</div>
      <div class="feature-card">
        <div class="feature-date">15 April 2024</div>
        <div class="feature-title">Physiotherapy Session Invoice</div>
        <div class="feature-tag">Dr. Sarah Chen — London Physio Clinic · invoice</div>
      </div>
      <div class="feature-card" style="border-left-color:#c8b89a">
        <div class="feature-date">22 March 2024</div>
        <div class="feature-title">MRI Scan — Lumbar Spine Results</div>
        <div class="feature-tag">Royal London Hospital · diagnostic report</div>
      </div>
      <div class="section-label" style="margin-top:32px">All Records</div>
      <div class="list-item"><span class="list-num">03</span><div><div class="list-title">Amoxicillin Prescription</div><div class="list-meta">10 Feb 2024 · Dr. Patel</div></div></div>
      <div class="list-item"><span class="list-num">04</span><div><div class="list-title">Cardiology Consultation</div><div class="list-meta">30 Jan 2024 · The Heart Clinic</div></div></div>
      <div class="list-item"><span class="list-num">05</span><div><div class="list-title">Blood Panel — Q1 2024</div><div class="list-meta">15 Jan 2024 · NHS Laboratory</div></div></div>
    </div>
    <div class="aside-col">
      <div class="section-label">Overview</div>
      <div class="aside-stat"><div class="stat-big">47</div><div class="stat-label">Documents</div></div>
      <div class="aside-stat"><div class="stat-big">12</div><div class="stat-label">Appointments</div></div>
      <div class="aside-stat"><div class="stat-big">8</div><div class="stat-label">Contacts</div></div>
    </div>
  </div>
</div>
</body></html>`
  },
  {
    id: 'C',
    name: 'Swiss Precision',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#fff;color:#000;font-family:'Inter',-apple-system,sans-serif;display:flex;height:100vh;overflow:hidden;font-weight:300}
.sidebar{width:200px;background:#fff;border-right:1px solid #000;padding:0;flex-shrink:0}
.logo-bar{height:60px;border-bottom:1px solid #000;display:flex;align-items:center;padding:0 20px}
.logo{font-size:13px;font-weight:600;letter-spacing:3px;text-transform:uppercase}
.nav{padding:0}
.nav-item{display:flex;align-items:center;padding:14px 20px;font-size:12px;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid #e8e8e8;color:#888;cursor:pointer}
.nav-item.active{color:#000;background:#000;color:#fff}
.nav-item:hover:not(.active){background:#f5f5f5}
.main{flex:1;display:flex;flex-direction:column;overflow:hidden}
.topbar{height:60px;border-bottom:1px solid #000;display:flex;align-items:center;padding:0 32px;gap:0}
.topbar-title{font-size:12px;font-weight:600;letter-spacing:3px;text-transform:uppercase;flex:1}
.search{border:none;border-left:1px solid #000;padding:0 20px;font-size:12px;font-family:'Inter',sans-serif;color:#000;height:60px;width:280px;outline:none;letter-spacing:0.5px}
.btn-upload{height:60px;padding:0 24px;background:#e63329;color:#fff;font-family:'Inter',sans-serif;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;border:none;border-left:1px solid #000;cursor:pointer}
.content{flex:1;overflow-y:auto}
.table-header{display:grid;grid-template-columns:60px 1fr 160px 120px 80px;height:40px;background:#f5f5f5;border-bottom:1px solid #000;align-items:center;padding:0 32px;font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#666;gap:24px}
.table-row{display:grid;grid-template-columns:60px 1fr 160px 120px 80px;height:52px;border-bottom:1px solid #e8e8e8;align-items:center;padding:0 32px;font-size:13px;gap:24px;cursor:pointer}
.table-row:hover{background:#f9f9f9}
.row-num{font-size:10px;color:#aaa;font-weight:500;letter-spacing:1px}
.row-title{font-size:13px}
.row-provider{font-size:12px;color:#666}
.row-date{font-size:12px;color:#666;letter-spacing:0.3px}
.badge{display:inline-block;padding:3px 8px;font-size:9px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;border:1px solid}
.badge-invoice{border-color:#e63329;color:#e63329}
.badge-report{border-color:#000;color:#000}
.badge-rx{border-color:#888;color:#888}
.stats-bar{height:48px;background:#000;display:flex;align-items:center;padding:0 32px;gap:40px;border-bottom:1px solid #000}
.stat-item{font-size:11px;color:#fff;letter-spacing:1px;display:flex;gap:12px;align-items:baseline}
.stat-val{font-size:16px;font-weight:500}
</style></head><body>
<div class="sidebar">
  <div class="logo-bar"><div class="logo">myHealth</div></div>
  <nav class="nav">
    <div class="nav-item active">Documents</div>
    <div class="nav-item">Timeline</div>
    <div class="nav-item">Appointments</div>
    <div class="nav-item">Contacts</div>
    <div class="nav-item">Clinics</div>
    <div class="nav-item">Notes</div>
    <div class="nav-item">Symptoms</div>
    <div class="nav-item">Medications</div>
    <div class="nav-item">Settings</div>
  </nav>
</div>
<div class="main">
  <div class="topbar">
    <div class="topbar-title">Documents</div>
    <input class="search" placeholder="Search…">
    <button class="btn-upload">Upload</button>
  </div>
  <div class="stats-bar">
    <div class="stat-item"><span class="stat-val">47</span> <span>DOCUMENTS</span></div>
    <div class="stat-item"><span class="stat-val">12</span> <span>APPOINTMENTS</span></div>
    <div class="stat-item"><span class="stat-val">8</span> <span>CONTACTS</span></div>
    <div class="stat-item"><span class="stat-val">3</span> <span>CLINICS</span></div>
  </div>
  <div class="table-header">
    <span>#</span><span>Title</span><span>Provider</span><span>Date</span><span>Type</span>
  </div>
  <div class="table-row"><span class="row-num">001</span><span class="row-title">Physiotherapy Session Invoice</span><span class="row-provider">Dr. Sarah Chen</span><span class="row-date">2024-04-15</span><span><div class="badge badge-invoice">Invoice</div></span></div>
  <div class="table-row"><span class="row-num">002</span><span class="row-title">MRI Scan — Lumbar Spine</span><span class="row-provider">Royal London Hospital</span><span class="row-date">2024-03-22</span><span><div class="badge badge-report">Report</div></span></div>
  <div class="table-row"><span class="row-num">003</span><span class="row-title">Amoxicillin 500mg Prescription</span><span class="row-provider">Dr. Patel</span><span class="row-date">2024-02-10</span><span><div class="badge badge-rx">Rx</div></span></div>
  <div class="table-row"><span class="row-num">004</span><span class="row-title">Cardiology Consultation</span><span class="row-provider">The Heart Clinic</span><span class="row-date">2024-01-30</span><span><div class="badge badge-invoice">Invoice</div></span></div>
  <div class="table-row"><span class="row-num">005</span><span class="row-title">Blood Panel — Q1 2024</span><span class="row-provider">NHS Laboratory</span><span class="row-date">2024-01-15</span><span><div class="badge badge-report">Report</div></span></div>
  <div class="table-row"><span class="row-num">006</span><span class="row-title">Lisinopril 10mg</span><span class="row-provider">Dr. Okafor</span><span class="row-date">2023-12-05</span><span><div class="badge badge-rx">Rx</div></span></div>
  <div class="table-row"><span class="row-num">007</span><span class="row-title">Dermatology Follow-up</span><span class="row-provider">Skin Health London</span><span class="row-date">2023-11-18</span><span><div class="badge badge-invoice">Invoice</div></span></div>
</div>
</body></html>`
  },
  {
    id: 'D',
    name: 'Soft Wellness',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&family=DM+Serif+Display:ital@0;1&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#f5f0eb;color:#3d3530;font-family:'DM Sans',sans-serif;display:flex;height:100vh;overflow:hidden}
.sidebar{width:240px;background:#fff;border-right:1px solid #e8e0d6;padding:28px 0;flex-shrink:0;display:flex;flex-direction:column}
.logo{padding:0 24px 28px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #f0ebe4}
.logo-icon{width:36px;height:36px;background:#4a7c59;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px}
.logo-text{font-family:'DM Serif Display',serif;font-size:18px;color:#3d3530}
.logo-sub{font-size:10px;color:#a09080;letter-spacing:0.5px}
.nav{padding:20px 0}
.nav-item{display:flex;align-items:center;gap:12px;padding:12px 24px;font-size:14px;color:#8a7a6a;cursor:pointer;border-radius:0}
.nav-item.active{color:#4a7c59;background:#f0f7f2}
.nav-item:hover:not(.active){background:#faf8f5;color:#5a4e45}
.nav-emoji{font-size:16px;width:20px;text-align:center}
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;background:#f5f0eb}
.topbar{height:64px;background:#fff;border-bottom:1px solid #e8e0d6;display:flex;align-items:center;padding:0 32px;gap:16px}
.topbar-title{font-family:'DM Serif Display',serif;font-size:22px;flex:1}
.search{background:#f5f0eb;border:none;border-radius:24px;padding:10px 18px;font-size:13px;font-family:'DM Sans',sans-serif;color:#3d3530;width:260px;outline:none}
.btn-upload{background:#4a7c59;color:#fff;padding:10px 20px;border-radius:24px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;border:none;cursor:pointer}
.content{flex:1;padding:32px;overflow-y:auto}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:28px}
.stat{background:#fff;border-radius:16px;padding:18px;box-shadow:0 1px 4px rgba(0,0,0,0.05)}
.stat-icon{font-size:20px;margin-bottom:8px}
.stat-val{font-family:'DM Serif Display',serif;font-size:26px;color:#3d3530}
.stat-label{font-size:11px;color:#a09080;margin-top:2px}
.section-label{font-size:11px;color:#a09080;letter-spacing:1px;text-transform:uppercase;margin-bottom:14px}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.card{background:#fff;border-radius:16px;padding:18px;box-shadow:0 1px 4px rgba(0,0,0,0.05);cursor:pointer;transition:all 0.2s}
.card:hover{box-shadow:0 4px 16px rgba(0,0,0,0.1);transform:translateY(-2px)}
.card-emoji{font-size:22px;margin-bottom:10px}
.card-title{font-size:14px;font-weight:500;color:#3d3530;margin-bottom:4px}
.card-meta{font-size:12px;color:#a09080}
.pill{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;margin-top:8px}
.pill-sage{background:#e8f2eb;color:#4a7c59}
.pill-peach{background:#fdf0ea;color:#c07850}
.pill-sky{background:#eaf3fd;color:#4a7ab5}
</style></head><body>
<div class="sidebar">
  <div class="logo">
    <div class="logo-icon">🌿</div>
    <div><div class="logo-text">myHealth</div><div class="logo-sub">Your health, your data</div></div>
  </div>
  <nav class="nav">
    <div class="nav-item active"><span class="nav-emoji">📄</span> Documents</div>
    <div class="nav-item"><span class="nav-emoji">📅</span> Timeline</div>
    <div class="nav-item"><span class="nav-emoji">🗓</span> Appointments</div>
    <div class="nav-item"><span class="nav-emoji">👤</span> Contacts</div>
    <div class="nav-item"><span class="nav-emoji">🏥</span> Clinics</div>
    <div class="nav-item"><span class="nav-emoji">📝</span> Notes</div>
    <div class="nav-item"><span class="nav-emoji">💊</span> Medications</div>
    <div class="nav-item"><span class="nav-emoji">⚙️</span> Settings</div>
  </nav>
</div>
<div class="main">
  <div class="topbar">
    <div class="topbar-title">Documents</div>
    <input class="search" placeholder="🔍  Search records…">
    <button class="btn-upload">+ Upload</button>
  </div>
  <div class="content">
    <div class="stats">
      <div class="stat"><div class="stat-icon">📄</div><div class="stat-val">47</div><div class="stat-label">Documents</div></div>
      <div class="stat"><div class="stat-icon">🗓</div><div class="stat-val">12</div><div class="stat-label">Appointments</div></div>
      <div class="stat"><div class="stat-icon">👤</div><div class="stat-val">8</div><div class="stat-label">Contacts</div></div>
      <div class="stat"><div class="stat-icon">🏥</div><div class="stat-val">3</div><div class="stat-label">Clinics</div></div>
    </div>
    <div class="section-label">Recent Documents</div>
    <div class="cards">
      <div class="card"><div class="card-emoji">🧘</div><div class="card-title">Physio Session Invoice</div><div class="card-meta">Dr. Sarah Chen · 15 Apr 2024</div><div class="pill pill-peach">Invoice</div></div>
      <div class="card"><div class="card-emoji">🩻</div><div class="card-title">MRI Scan Results</div><div class="card-meta">Royal London · 22 Mar 2024</div><div class="pill pill-sky">Report</div></div>
      <div class="card"><div class="card-emoji">💊</div><div class="card-title">Amoxicillin Prescription</div><div class="card-meta">Dr. Patel · 10 Feb 2024</div><div class="pill pill-sage">Prescription</div></div>
      <div class="card"><div class="card-emoji">❤️</div><div class="card-title">Cardiology Consultation</div><div class="card-meta">The Heart Clinic · 30 Jan 2024</div><div class="pill pill-peach">Invoice</div></div>
      <div class="card"><div class="card-emoji">🩸</div><div class="card-title">Blood Panel Q1 2024</div><div class="card-meta">NHS Laboratory · 15 Jan 2024</div><div class="pill pill-sky">Report</div></div>
      <div class="card"><div class="card-emoji">💙</div><div class="card-title">Lisinopril 10mg</div><div class="card-meta">Dr. Okafor · 5 Dec 2023</div><div class="pill pill-sage">Prescription</div></div>
    </div>
  </div>
</div>
</body></html>`
  },
  {
    id: 'E',
    name: 'Dark Luxury',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#101214;color:#d4c9b8;font-family:'Inter',sans-serif;display:flex;height:100vh;overflow:hidden;font-weight:300}
.sidebar{width:240px;background:linear-gradient(180deg,#161a1e 0%,#111418 100%);border-right:1px solid #222830;padding:0;flex-shrink:0;display:flex;flex-direction:column}
.logo-area{padding:32px 28px 28px;border-bottom:1px solid #222830}
.logo{font-family:'Cormorant Garamond',serif;font-size:24px;color:#c9a84c;font-weight:300;letter-spacing:1px}
.logo-sub{font-size:10px;color:#4a4540;letter-spacing:2px;text-transform:uppercase;margin-top:4px;font-family:'Inter',sans-serif}
.nav{padding:24px 0;flex:1}
.nav-item{display:flex;align-items:center;gap:14px;padding:12px 28px;font-size:12px;color:#6a6055;cursor:pointer;letter-spacing:0.5px;transition:all 0.2s}
.nav-item.active{color:#c9a84c;background:linear-gradient(90deg,rgba(201,168,76,0.06) 0%,transparent 100%);border-left:1px solid #c9a84c}
.nav-item:hover:not(.active){color:#a09080;background:rgba(255,255,255,0.02)}
.nav-dot{width:5px;height:5px;border-radius:50%;background:currentColor;opacity:0.4}
.nav-item.active .nav-dot{opacity:1}
.sidebar-footer{padding:20px 28px;border-top:1px solid #222830;font-size:10px;color:#3a3530;letter-spacing:1px;text-transform:uppercase}
.main{flex:1;display:flex;flex-direction:column;overflow:hidden}
.topbar{height:64px;background:#161a1e;border-bottom:1px solid #222830;display:flex;align-items:center;padding:0 32px;gap:20px}
.topbar-title{font-family:'Cormorant Garamond',serif;font-size:20px;color:#d4c9b8;flex:1;letter-spacing:0.5px;font-weight:300}
.search{background:rgba(255,255,255,0.03);border:1px solid #2a3040;border-radius:4px;padding:9px 16px;font-size:12px;font-family:'Inter',sans-serif;color:#8a8080;width:260px;outline:none;letter-spacing:0.3px}
.btn-upload{background:linear-gradient(135deg,#c9a84c 0%,#b8944a 100%);color:#101214;padding:10px 20px;border-radius:4px;font-family:'Inter',sans-serif;font-size:11px;font-weight:500;letter-spacing:1px;text-transform:uppercase;border:none;cursor:pointer}
.content{flex:1;padding:32px;overflow-y:auto}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:32px}
.stat{background:linear-gradient(135deg,#161a1e 0%,#131719 100%);border:1px solid #222830;border-radius:8px;padding:20px;position:relative;overflow:hidden}
.stat::after{content:'';position:absolute;top:0;right:0;width:2px;height:40%;background:#c9a84c;opacity:0.4}
.stat-val{font-family:'Cormorant Garamond',serif;font-size:32px;color:#c9a84c;font-weight:300}
.stat-label{font-size:10px;color:#4a4540;letter-spacing:2px;text-transform:uppercase;margin-top:6px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.card{background:linear-gradient(135deg,#161a1e 0%,#131719 100%);border:1px solid #222830;border-radius:8px;padding:20px;cursor:pointer;transition:all 0.2s;position:relative;overflow:hidden}
.card::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,76,0.3),transparent);opacity:0}
.card:hover{border-color:#2a3040}
.card:hover::before{opacity:1}
.card-type{font-size:9px;color:#4a4540;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px}
.card-title{font-family:'Cormorant Garamond',serif;font-size:16px;color:#d4c9b8;margin-bottom:6px;font-weight:300;line-height:1.3}
.card-meta{font-size:11px;color:#5a5550}
.card-date{font-size:11px;color:#c9a84c;opacity:0.7;margin-top:8px}
.divider{width:20px;height:1px;background:#c9a84c;opacity:0.3;margin:8px 0}
</style></head><body>
<div class="sidebar">
  <div class="logo-area">
    <div class="logo">myHealth</div>
    <div class="logo-sub">Private Health Records</div>
  </div>
  <nav class="nav">
    <div class="nav-item active"><span class="nav-dot"></span> Documents</div>
    <div class="nav-item"><span class="nav-dot"></span> Timeline</div>
    <div class="nav-item"><span class="nav-dot"></span> Appointments</div>
    <div class="nav-item"><span class="nav-dot"></span> Contacts</div>
    <div class="nav-item"><span class="nav-dot"></span> Clinics</div>
    <div class="nav-item"><span class="nav-dot"></span> Notes</div>
    <div class="nav-item"><span class="nav-dot"></span> Symptoms</div>
    <div class="nav-item"><span class="nav-dot"></span> Medications</div>
  </nav>
  <div class="sidebar-footer">AES-256 Encrypted</div>
</div>
<div class="main">
  <div class="topbar">
    <div class="topbar-title">Documents</div>
    <input class="search" placeholder="Search records…">
    <button class="btn-upload">Upload</button>
  </div>
  <div class="content">
    <div class="stats">
      <div class="stat"><div class="stat-val">47</div><div class="stat-label">Documents</div></div>
      <div class="stat"><div class="stat-val">12</div><div class="stat-label">Appointments</div></div>
      <div class="stat"><div class="stat-val">8</div><div class="stat-label">Contacts</div></div>
      <div class="stat"><div class="stat-val">3</div><div class="stat-label">Clinics</div></div>
    </div>
    <div class="grid">
      <div class="card"><div class="card-type">Invoice · Physiotherapy</div><div class="divider"></div><div class="card-title">Session Invoice — April</div><div class="card-meta">Dr. Sarah Chen</div><div class="card-date">15 April 2024</div></div>
      <div class="card"><div class="card-type">Diagnostic Report</div><div class="divider"></div><div class="card-title">MRI Scan — Lumbar Spine</div><div class="card-meta">Royal London Hospital</div><div class="card-date">22 March 2024</div></div>
      <div class="card"><div class="card-type">Prescription</div><div class="divider"></div><div class="card-title">Amoxicillin 500mg</div><div class="card-meta">Dr. Patel</div><div class="card-date">10 February 2024</div></div>
      <div class="card"><div class="card-type">Invoice · Cardiology</div><div class="divider"></div><div class="card-title">Consultation — January</div><div class="card-meta">The Heart Clinic</div><div class="card-date">30 January 2024</div></div>
      <div class="card"><div class="card-type">Lab Report</div><div class="divider"></div><div class="card-title">Blood Panel — Q1 2024</div><div class="card-meta">NHS Laboratory</div><div class="card-date">15 January 2024</div></div>
      <div class="card"><div class="card-type">Prescription</div><div class="divider"></div><div class="card-title">Lisinopril 10mg</div><div class="card-meta">Dr. Okafor</div><div class="card-date">5 December 2023</div></div>
    </div>
  </div>
</div>
</body></html>`
  }
];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const dir of directions) {
    const outPath = join(__dirname, `design-direction-${dir.id}.png`);
    console.log(`Screenshotting direction ${dir.id}: ${dir.name}…`);
    await page.setContent(dir.html, { waitUntil: 'networkidle' });
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`  → Saved: ${outPath}`);
  }

  await browser.close();
  console.log('\nDone. 5 screenshots saved to docs/');
}

main().catch(err => { console.error(err); process.exit(1); });
