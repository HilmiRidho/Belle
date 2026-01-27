import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp, deleteDoc, doc, getCountFromServer } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let isMuted = localStorage.getItem('isMuted') === 'true';

const playStartup = () => {
  if (isMuted) return;
  const startupAudio = new Audio('startup.ogg');
  startupAudio.play().catch(e => {
    console.log("Startup sound blocked by browser.");
  });
};

const playClick = () => {
  if (isMuted) return;
  const audio = new Audio('pop.ogg');
  audio.currentTime = 0;
  audio.play().catch(e => console.log("Audio play blocked: " + e));
};

const CONFIG = {
  firebase: {
    apiKey: "AIzaSyBRTO86MRC-EpDEyq-5u-PLqOYZdQT5R4Y",
    authDomain: "belle-1175e.firebaseapp.com",
    projectId: "belle-1175e",
    storageBucket: "belle-1175e.firebasestorage.app",
    messagingSenderId: "554073646319",
    appId: "1:554073646319:web:fd9077a3ba4ea8a9ab671a",
    measurementId: "G-S0YDY3G1LG"
  },
  icons: ["App_Manager.png", "Calendar.png", "Compass.png", "Contact.png", "Converter.png", "Download.png", "File_Manager.png", "Gallery.png", "Games.png", "Maps.png", "Messenger.png", "Music.png", "Network.png", "Radio.png", "Search.png", "Store.png", "Video.png", "Browser.png", "Notepad.png", "Settings.png", "Create.png"]
};

let app, analytics, db;
window.customApps = [];
let username;
let fileSystem = {
  "/": CONFIG.icons.map(i => ({ name: i, type: "file" })),
  "/Download": [],
  "/Documents": [],
  "/Music": [],
  "/Videos": [],
  "/Pictures": [],
  "/pack": [],
  "/icons": [],
  "/icons.zip": []
};

window.addEventListener('DOMContentLoaded', async () => {
  initFirebase();
  await loadFileSystem();
  createApp.initListener(() => {
    uiSystem.generateDrawer();
  });
  keyboardSystem.init();
  uiSystem.tick();
  setInterval(uiSystem.tick, 1000);
  setupGlobalEvents();
  playStartup();
});

function initFirebase() {
  try {
    app = initializeApp(CONFIG.firebase);
    analytics = getAnalytics(app);
    db = getFirestore(app);
    console.log("Firebase Connected: " + CONFIG.firebase.projectId);
  } catch (error) {
    console.error("Firebase Init Error:", error);
  }
}

async function loadFileSystem() {
  try {
    const response = await fetch('filesystem.json');
    if (response.ok) fileSystem = await response.json();
  } catch (error) {
    console.warn("filesystem.json missing, using default.");
  }
}

const windowOps = {
  open: (id, callback) => {
    document.querySelectorAll('.app-window').forEach(w => w.style.display = 'none');
    const win = document.getElementById(id);
    if (win) {
      win.style.display = "flex";
      presenceSystem.listenOnlineCount((count) => {
        const titleContainer = win.querySelector('.window-title');
        if (titleContainer) {
          let countBadge = titleContainer.querySelector('.online-badge');
          if (!countBadge) {
            countBadge = document.createElement('span');
            countBadge.className = 'online-badge';
            titleContainer.appendChild(countBadge);
          }
          countBadge.textContent = `${count} Online`;
        }
      });
    }
    if (callback) callback();
  },
  close: (id) => {
    const win = document.getElementById(id);
    if (win) win.style.display = "none";
    if (id === 'mapsWindow') mapsApp.reset();
    if (id === 'settingsWindow') settingsApp.stopMonitoring();
    if (id === 'viewerWindow') viewerApp.reset();
  },
  back: (id) => {
    if (id === 'fileManagerWindow') fileManagerApp.goUp();
    else if (id === 'contactWindow') contactApp.hideForm();
    else if (id === 'mapsWindow') {
      if (document.getElementById('mapsView').style.display === 'block') mapsApp.reset();
    }
    if (id === 'viewerWindow') viewerApp.reset();
    if (id === 'createWindow') document.getElementById('createAppName').value = "";
  },
  isAnyOpen: () => {
    return Array.from(document.querySelectorAll('.app-window')).some(w => w.style.display === "flex");
  }
};
window.windowOps = windowOps;

const uiSystem = {
  tick: () => {
    const d = new Date();
    const clock = document.getElementById("clock");
    if (clock) clock.textContent = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  },
  generateDrawer: () => {
    const drawer = document.getElementById("drawer");
    if (!drawer) return;
    drawer.innerHTML = "";

    CONFIG.icons.forEach(f => {
      const name = f.replace(".png", "").replace(/_/g, " ");
      const el = document.createElement("div");
      el.className = "app";
      el.dataset.name = name.toLowerCase();
      el.innerHTML = `<img src="icons/${f}" alt="${name}" onerror="this.src='icons/File.png'"><div class="label">${name}</div>`;
      el.onclick = () => uiSystem.handleAppClick(name.toLowerCase());
      drawer.appendChild(el);
    });

    window.customApps.forEach(appData => {
      const el = document.createElement("div");
      el.className = "app";
      el.dataset.name = appData.name.toLowerCase();
      const iconSrc = appData.icon || "icons/File.png";
      el.innerHTML = `<img src="${iconSrc}" onerror="this.src='icons/File.png'" style="border-radius:10px;"><div class="label">${appData.name}</div>`;
      el.onclick = () => viewerApp.launch(appData);
      drawer.appendChild(el);
    });
  },
  handleAppClick: (id) => {
    const map = {
      'app manager': () => windowOps.open('appManagerWindow', appManagerApp.render),
      'calendar': () => windowOps.open('calendarWindow', calendarApp.render),
      'compass': () => windowOps.open('compassWindow', compassApp.start),
      'contact': () => windowOps.open('contactWindow', contactApp.render),
      'converter': () => windowOps.open('converterWindow', converterApp.init),
      'file manager': () => fileManagerApp.open('/'),
      'download': () => fileManagerApp.open('/Download'),
      'gallery': () => galleryApp.open(),
      'games': () => windowOps.open('gamesWindow'),
      'maps': () => windowOps.open('mapsWindow'),
      'messenger': () => messengerApp.checkAndOpen(),
      'music': () => musicApp.open(),
      'network': () => networkApp.open(),
      'browser': () => windowOps.open('browserWindow'),
      'notepad': () => notepadApp.open(),
      'settings': () => settingsApp.open(),
      'create': () => createApp.open()
    };
    if (map[id]) map[id]();
  }
};
window.uiSystem = uiSystem;

const settingsApp = {
  fpsFrame: 0,
  fpsTime: 0,
  isMonitoring: false,
  open: () => {
    windowOps.open('settingsWindow');
    settingsApp.initHardwareInfo();
    settingsApp.updateUserInfo();
    settingsApp.updateCloudStorage();
    settingsApp.startMonitoring();
  },
  close: () => {
    windowOps.close('settingsWindow');
    settingsApp.stopMonitoring();
  },
  startMonitoring: () => {
    if (settingsApp.isMonitoring) return;
    settingsApp.isMonitoring = true;
    settingsApp.loopFPS();
  },
  stopMonitoring: () => {
    settingsApp.isMonitoring = false;
  },
  loopFPS: () => {
    if (!settingsApp.isMonitoring) return;
    const now = performance.now();
    settingsApp.fpsFrame++;
    if (now - settingsApp.fpsTime >= 1000) {
      const el = document.getElementById('setFPSVal');
      if (el) el.innerText = `${settingsApp.fpsFrame} FPS`;
      settingsApp.fpsFrame = 0;
      settingsApp.fpsTime = now;
    }
    requestAnimationFrame(settingsApp.loopFPS);
  },
  runBenchmark: async () => {
    const el = document.getElementById('setBenchmarkResult');
    if (!el) return;
    el.innerText = "Running test...";
    el.style.color = "var(--accent-color)";
    await new Promise(r => setTimeout(r, 100));
    const start = performance.now();
    let result = 0;
    for (let i = 0; i < 10000000; i++) {
      result += Math.sqrt(i) * Math.tan(i);
    }
    const end = performance.now();
    const duration = end - start;
    const score = Math.floor(10000000 / duration);
    el.innerText = `Score: ${score} (Time: ${duration.toFixed(0)}ms)`;
    el.style.color = "#fff";
  },
  updateUserInfo: () => {
    const user = localStorage.getItem('chat_username') || "Guest";
    const el = document.getElementById('setCurrentUser');
    if (el) el.innerText = user;
  },
  changeUsername: () => {
    const currentName = localStorage.getItem('chat_username') || "";
    const input = document.getElementById('usernameCustomInput');
    if (input) input.value = currentName;
    const overlay = document.getElementById('clickOverlay');
    const modal = document.getElementById('usernameModal');
    if (overlay && modal) {
      overlay.style.display = 'block';
      modal.style.display = 'flex';
      setTimeout(() => input.focus(), 100);
    }
  },
  toggleMute: () => {
    isMuted = !isMuted;
    localStorage.setItem('isMuted', isMuted);
  },
  updateCloudStorage: async () => {
    try {
      const chatColl = collection(db, "public_chat");
      const appColl = collection(db, "user_apps");
      const chatSnapshot = await getCountFromServer(chatColl);
      const appSnapshot = await getCountFromServer(appColl);
      const chatCount = chatSnapshot.data().count;
      const appCount = appSnapshot.data().count;
      const estimatedUsageKB = (chatCount * 0.5) + (appCount * 5);
      const usageMB = (estimatedUsageKB / 1024).toFixed(2);
      const el = document.getElementById('setCloudStorageDesc');
      if (el) {
        el.innerText = `Used: ${usageMB} MB / Available: 1024 MB`;
      }
    } catch (e) {
      const el = document.getElementById('setCloudStorageDesc');
      if (el) el.innerText = "Cloud storage unavailable";
    }
  },
  initHardwareInfo: async () => {
    const muteTog = document.getElementById('setMuteToggle');
    if (muteTog) muteTog.checked = isMuted;
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'Integrated Graphics';
      const el = document.getElementById('setGPUInfo');
      if (el) el.innerText = renderer;
    } catch (e) {
      const el = document.getElementById('setGPUInfo');
      if (el) el.innerText = "Unknown GPU";
    }
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const netStatus = document.getElementById('setNetStatus');
    if (netStatus) {
      if (conn) netStatus.innerText = `Type: ${conn.effectiveType.toUpperCase()}`;
      else netStatus.innerText = navigator.onLine ? "Online" : "Offline";
    }
    if (navigator.getBattery) {
      try {
        const battery = await navigator.getBattery();
        const updateBat = () => {
          const level = Math.round(battery.level * 100);
          const charging = battery.charging ? "Charging" : "Discharging";
          const elVal = document.getElementById('setBatteryVal');
          const elDesc = document.getElementById('setBatteryDesc');
          if (elVal) elVal.innerText = `${level}%`;
          if (elDesc) elDesc.innerText = charging;
        };
        updateBat();
        battery.addEventListener('levelchange', updateBat);
        battery.addEventListener('chargingchange', updateBat);
      } catch (e) {
        const el = document.getElementById('setBatteryDesc');
        if (el) el.innerText = "API Not Supported";
      }
    }
    if (navigator.storage && navigator.storage.estimate) {
      const quota = await navigator.storage.estimate();
      const used = (quota.usage / 1024 / 1024).toFixed(2);
      const free = (quota.quota / 1024 / 1024 / 1024).toFixed(2);
      const el = document.getElementById('setStorageDesc');
      if (el) el.innerText = `Used: ${used} MB / Available: ${free} GB`;
    }
    const brInfo = document.getElementById('setBrowserInfo');
    if (brInfo) brInfo.innerText = navigator.userAgent.split(') ')[0] + ")";
    const dispInfo = document.getElementById('setDisplayInfo');
    if (dispInfo) dispInfo.innerText = `${window.screen.width} x ${window.screen.height} (Pixel Ratio: ${window.devicePixelRatio})`;
    const coreInfo = document.getElementById('setCoresInfo');
    if (coreInfo) coreInfo.innerText = `${navigator.hardwareConcurrency || '?'} Logical Cores`;
    const fullTog = document.getElementById('setFullToggle');
    if (fullTog) fullTog.checked = !!document.fullscreenElement;
  },
  changeWallpaper: () => {
    document.getElementById('bgInput').click();
  },
  toggleFullscreen: () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(e => console.log(e));
      document.getElementById('setFullToggle').checked = true;
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        document.getElementById('setFullToggle').checked = false;
      }
    }
  },
  resetData: () => {
    if (confirm("Factory Reset: All app data and settings will be deleted. Continue?")) {
      localStorage.clear();
      location.reload();
    }
  }
};
window.settingsApp = settingsApp;

const appManagerApp = {
  render: () => {
    const list = document.getElementById("appListContainer");
    if (!list) return;
    list.innerHTML = "";
    CONFIG.icons.forEach(f => {
      const n = f.replace(".png", "").replace(/_/g, " ");
      const div = document.createElement("div");
      div.className = "am-item";
      div.innerHTML = `<img src="icons/${f}" class="am-icon" onerror="this.src='icons/File.png'"><div class="am-info"><div class="am-name">${n}</div><div class="am-size">System App</div></div>`;
      list.appendChild(div);
    });
    if (window.customApps && window.customApps.length > 0) {
      window.customApps.forEach(app => {
        const div = document.createElement("div");
        div.className = "am-item";
        const currentUser = localStorage.getItem('chat_username') || "Guest";
        const isOwner = app.creator === currentUser || currentUser === "admin";
        const deleteBtn = isOwner ? `<button onclick="createApp.deleteApp('${app.id}'); setTimeout(appManagerApp.render, 500);" style="background:#ff4444; color:white; border:none; padding:5px 10px; border-radius:5px; font-size:11px; cursor:pointer;">Uninstall</button>` : ``;
        div.innerHTML = `<img src="${app.icon || 'icons/File.png'}" class="am-icon" onerror="this.src='icons/File.png'" style="border-radius:8px;"><div class="am-info" style="flex:1;"><div class="am-name">${app.name}</div><div class="am-size" style="color:var(--accent-color);">User App (by ${app.creator})</div></div>${deleteBtn}`;
        list.appendChild(div);
      });
    }
  }
};
window.appManagerApp = appManagerApp;

const calendarApp = {
  render: () => {
    const grid = document.getElementById("calGrid");
    const header = document.getElementById("calMonthYear");
    if (!grid || !header) return;
    grid.innerHTML = "";
    const d = new Date();
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    header.innerText = `${months[d.getMonth()]} ${d.getFullYear()}`;
    ["S", "M", "T", "W", "T", "F", "S"].forEach(day => grid.innerHTML += `<div class="cal-day-name">${day}</div>`);
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
    const totalDays = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    for (let i = 0; i < firstDay; i++) grid.innerHTML += `<div></div>`;
    for (let i = 1; i <= totalDays; i++) {
      const cls = (i === d.getDate()) ? "today" : "";
      grid.innerHTML += `<div class="cal-date ${cls}">${i}</div>`;
    }
  }
};

const compassApp = {
  lastHeading: 0,
  smoothing: 0.1,
  start: () => {
    const btnEnable = document.getElementById('btnCompass');
    const btnDisable = document.getElementById('btnDisableCompass');
    if (!btnEnable || !btnDisable) return;
    btnEnable.onclick = () => {
      const requestPermission = typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';
      if (requestPermission) {
        DeviceOrientationEvent.requestPermission()
          .then(res => {
            if (res === 'granted') compassApp.activate(btnEnable, btnDisable);
            else alert("Permission denied.");
          }).catch(console.error);
      } else {
        compassApp.activate(btnEnable, btnDisable);
      }
    };
    btnDisable.onclick = () => compassApp.stop();
  },
  activate: (btnEnable, btnDisable) => {
    btnEnable.style.display = 'none';
    btnDisable.style.display = 'inline-block';
    const eventType = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    window.addEventListener(eventType, compassApp.handleOrientation, true);
  },
  stop: () => {
    const btnEnable = document.getElementById('btnCompass');
    const btnDisable = document.getElementById('btnDisableCompass');
    const eventType = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    window.removeEventListener(eventType, compassApp.handleOrientation, true);
    if (btnEnable) btnEnable.style.display = 'inline-block';
    if (btnDisable) btnDisable.style.display = 'none';
    const dial = document.getElementById('compassDial');
    if (dial) dial.style.transform = `rotate(0deg)`;
    document.getElementById('compassDegree').innerText = "0°";
    document.getElementById('compassDirection').innerText = "Off";
  },
  handleOrientation: (e) => {
    let rawHeading = e.webkitCompassHeading || Math.abs(e.alpha - 360);
    if (Math.abs(rawHeading - compassApp.lastHeading) > 180) {
      if (rawHeading > compassApp.lastHeading) compassApp.lastHeading += 360;
      else compassApp.lastHeading -= 360;
    }
    let smoothedHeading = compassApp.lastHeading + (rawHeading - compassApp.lastHeading) * compassApp.smoothing;
    compassApp.lastHeading = smoothedHeading;
    const dial = document.getElementById('compassDial');
    if (dial) dial.style.transform = `rotate(-${smoothedHeading}deg)`;
    document.getElementById('compassDegree').innerText = Math.round(smoothedHeading % 360) + "°";
    const dirs = ["North", "North East", "East", "South East", "South", "South West", "West", "North West"];
    let index = Math.round(((Math.round(smoothedHeading) % 360) < 0 ? (Math.round(smoothedHeading) % 360) + 360 : (Math.round(smoothedHeading) % 360)) / 45) % 8;
    document.getElementById('compassDirection').innerText = dirs[index];
  }
};

let myContacts = JSON.parse(localStorage.getItem('myContacts')) || [{ id: 1, name: "Squirtle", phone: "+62678273994391", color: "#e74c3c" }];
const contactApp = {
  render: () => {
    const list = document.getElementById('contactListContainer');
    if (!list) return;
    list.innerHTML = "";
    if (myContacts.length === 0) {
      list.innerHTML = `<div style="text-align:center;padding:20px;color:#777">No contacts.</div>`;
      return;
    }
    myContacts.forEach(c => {
      const div = document.createElement('div');
      div.className = "contact-item";
      const initials = c.name.split(" ").map(n => n[0]).join("").substring(0, 2);
      div.innerHTML = `<div class="c-avatar" style="background:${c.color}">${initials}</div><div class="c-info"><div class="c-name">${c.name}</div><div class="c-num">${c.phone}</div></div><button class="c-delete">Delete</button>`;
      div.querySelector('.c-delete').onclick = (e) => {
        e.stopPropagation();
        if (confirm(`Delete ${c.name}?`)) {
          myContacts = myContacts.filter(item => item.id !== c.id);
          contactApp.saveStorage();
          contactApp.render();
        }
      };
      list.appendChild(div);
    });
  },
  showForm: () => {
    document.getElementById('contactListView').style.display = 'none';
    document.getElementById('contactFormView').style.display = 'flex';
    document.getElementById('cInputName').value = "";
    document.getElementById('cInputPhone').value = "";
  },
  hideForm: () => {
    document.getElementById('contactFormView').style.display = 'none';
    document.getElementById('contactListView').style.display = 'block';
  },
  save: () => {
    const name = document.getElementById('cInputName').value;
    const phone = document.getElementById('cInputPhone').value;
    if (!name || !phone) { alert("Invalid Input"); return; }
    myContacts.push({ id: Date.now(), name: name, phone: phone, color: `hsl(${Math.random() * 360}, 60%, 50%)` });
    contactApp.saveStorage();
    contactApp.hideForm();
    contactApp.render();
  },
  saveStorage: () => localStorage.setItem('myContacts', JSON.stringify(myContacts))
};
window.contactApp = contactApp;

const convData = {
  units: {
    length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mile: 1609.34, yard: 0.9144, ft: 0.3048, inch: 0.0254 },
    weight: { kg: 1, g: 0.001, mg: 0.000001, lb: 0.453592, oz: 0.0283495, ton: 1000 },
    temp: { C: "C", F: "F", K: "K" }
  },
  rates: { USD: 1, IDR: 16200, EUR: 0.92, JPY: 155, SGD: 1.35 }
};
const converterApp = {
  init: () => {
    converterApp.updateOptions();
    converterApp.calcUnit();
    converterApp.calcCurr();
  },
  switchTab: (tab) => {
    document.querySelectorAll('.conv-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.conv-body').forEach(b => b.classList.remove('show'));
    if (tab === 'unit') {
      document.querySelector('.conv-tabs .conv-tab:nth-child(1)').classList.add('active');
      document.getElementById('tabUnit').classList.add('show');
    } else {
      document.querySelector('.conv-tabs .conv-tab:nth-child(2)').classList.add('active');
      document.getElementById('tabCurrency').classList.add('show');
    }
  },
  updateOptions: () => {
    const cat = document.getElementById('unitCategory').value;
    const from = document.getElementById('unitFrom');
    const to = document.getElementById('unitTo');
    from.innerHTML = ""; to.innerHTML = "";
    Object.keys(convData.units[cat]).forEach(u => { from.add(new Option(u, u)); to.add(new Option(u, u)); });
    if (cat === 'length') to.value = 'km';
    else if (cat === 'weight') to.value = 'lb';
    else if (cat === 'temp') to.value = 'F';
    converterApp.calcUnit();
  },
  calcUnit: () => {
    const cat = document.getElementById('unitCategory').value;
    const val = parseFloat(document.getElementById('unitInput').value);
    const u1 = document.getElementById('unitFrom').value;
    const u2 = document.getElementById('unitTo').value;
    const out = document.getElementById('unitOutput');
    if (isNaN(val)) { out.value = ""; return; }
    if (cat === 'temp') {
      let res = val;
      if (u1 === 'C' && u2 === 'F') res = (val * 9 / 5) + 32;
      else if (u1 === 'C' && u2 === 'K') res = val + 273.15;
      else if (u1 === 'F' && u2 === 'C') res = (val - 32) * 5 / 9;
      else if (u1 === 'F' && u2 === 'K') res = (val - 32) * 5 / 9 + 273.15;
      else if (u1 === 'K' && u2 === 'C') res = val - 273.15;
      else if (u1 === 'K' && u2 === 'F') res = (val - 273.15) * 9 / 5 + 32;
      out.value = res.toFixed(2);
    } else {
      out.value = (val * convData.units[cat][u1] / convData.units[cat][u2]).toFixed(4).replace(/\.?0+$/, "");
    }
  },
  calcCurr: () => {
    const val = parseFloat(document.getElementById('currInput').value);
    const c1 = document.getElementById('currFrom').value;
    const c2 = document.getElementById('currTo').value;
    if (isNaN(val)) { document.getElementById('currOutput').value = ""; return; }
    document.getElementById('currOutput').value = ((val / convData.rates[c1]) * convData.rates[c2]).toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
};
window.converterApp = converterApp;

let fmPath = "/";
const fileManagerApp = {
  open: (path) => {
    windowOps.open('fileManagerWindow');
    fileManagerApp.navigate(path);
  },
  navigate: (path) => {
    fmPath = path;
    document.getElementById('fmPath').innerText = fmPath;
    const grid = document.getElementById('fmContent');
    grid.innerHTML = "";
    const files = fileSystem[fmPath] || [];
    if (files.length === 0) { grid.innerHTML = `<div class="fm-empty">Folder is empty</div>`; return; }
    files.forEach(f => {
      const item = document.createElement("div");
      item.className = "fm-item";
      let iconSrc = (f.type === "folder") ? "icons/File_Manager.png" : "icons/File.png";
      if (f.type !== "folder" && (fmPath === "/icons" || fmPath === "/icons.zip")) iconSrc = "icons/" + f.name;
      item.innerHTML = `<img src="${iconSrc}" class="fm-icon"><div class="fm-name">${f.name}</div>`;
      item.onclick = () => {
        if (f.type === "folder") {
          const newPath = fmPath === "/" ? "/" + f.name : fmPath + "/" + f.name;
          fileManagerApp.navigate(newPath);
        } else {
          let realPath = fmPath === "/" ? f.name : fmPath.substring(1) + "/" + f.name;
          window.open(realPath, '_blank');
        }
      };
      grid.appendChild(item);
    });
  },
  goUp: () => {
    if (fmPath === "/") return;
    const parts = fmPath.split("/"); parts.pop();
    const newPath = parts.length === 1 ? "/" : parts.join("/");
    fileManagerApp.navigate(newPath);
  }
};
window.fileManagerApp = fileManagerApp;

const galleryApp = {
  open: () => {
    windowOps.open('galleryWindow');
    const grid = document.getElementById('galleryContent');
    grid.innerHTML = "";
    let imagesFound = [];
    Object.keys(fileSystem).forEach(folderPath => {
      fileSystem[folderPath].forEach(f => {
        if (f.type === "file") {
          const ext = f.name.split('.').pop().toLowerCase();
          if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
            let realPath = folderPath === "/" ? f.name : folderPath.substring(1) + "/" + f.name;
            if (folderPath === "/icons.zip") realPath = "icons/" + f.name;
            imagesFound.push(realPath);
          }
        }
      });
    });
    if (imagesFound.length === 0) { grid.innerHTML = `<div class="gal-empty">No images found</div>`; return; }
    imagesFound.forEach(path => {
      const item = document.createElement("div");
      item.className = "gal-item";
      item.innerHTML = `<img src="${path}" onerror="this.src='icons/Gallery.png'">`;
      item.onclick = () => window.open(path, '_blank');
      grid.appendChild(item);
    });
  }
};
window.galleryApp = galleryApp;

const mapsApp = {
  load: (provider) => {
    const urls = {
      google: "https://www.google.com/maps/embed",
      osm: "https://www.openstreetmap.org/export/embed.html",
      bing: "https://www.bing.com/maps/embed",
      yandex: "https://yandex.com/map-widget/v1/"
    };
    document.getElementById('mapsMenu').style.display = 'none';
    document.getElementById('mapsView').style.display = 'block';
    document.getElementById('mapFrame').src = urls[provider] || "";
  },
  reset: () => {
    document.getElementById('mapsView').style.display = 'none';
    document.getElementById('mapsMenu').style.display = 'flex';
    document.getElementById('mapFrame').src = "";
  }
};
window.mapsApp = mapsApp;

const messengerApp = {
  isInitialized: false,
  checkAndOpen: () => {
    const savedName = localStorage.getItem('chat_username');
    if (savedName) {
      windowOps.open('messengerWindow');
      messengerApp.init();
    } else {
      document.getElementById('clickOverlay').style.display = 'block';
      document.getElementById('usernameModal').style.display = 'flex';
      setTimeout(() => document.getElementById('usernameCustomInput').focus(), 100);
    }
  },
  cancel: () => {
    document.getElementById('clickOverlay').style.display = 'none';
    document.getElementById('usernameModal').style.display = 'none';
  },
  saveUsername: () => {
    let name = document.getElementById('usernameCustomInput').value.trim();
    if (name.length === 0) name = "Guest";
    localStorage.setItem('chat_username', name);
    messengerApp.cancel();
    windowOps.open('messengerWindow');
    messengerApp.init();
  },
  deleteMsg: async (id) => {
    try { await deleteDoc(doc(db, "public_chat", id)); } catch (e) { alert("Error: " + e.message); }
  },
  pickFile: (accept) => {
    const picker = document.getElementById('msgFilePicker');
    picker.accept = accept; picker.value = null;
    picker.onchange = (e) => messengerApp.handleFileUpload(e.target.files[0]);
    picker.click();
  },
  handleFileUpload: (file) => {
    if (!file) return;
    if (file.size > 1024 * 1024) { alert("File too large! Max 1MB."); return; }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const fileData = e.target.result;
      const fileType = file.type.startsWith('image/') ? 'image' : 'file';
      await messengerApp.send(null, fileData, fileType, file.name);
    };
    reader.readAsDataURL(file);
  },
  init: () => {
    if (messengerApp.isInitialized) return;
    const list = document.getElementById("msgList");
    if (!db) { list.innerHTML = "<div class='msg-status' style='color:red'>DB Connection Failed</div>"; return; }
    const username = localStorage.getItem('chat_username');
    const q = query(collection(db, "public_chat"), orderBy("timestamp", "asc"), limit(50));
    onSnapshot(q, (snapshot) => {
      list.innerHTML = "";
      if (snapshot.empty) { list.innerHTML = "<div class='msg-status'>No messages yet.</div>"; return; }
      snapshot.forEach((doc) => {
        const data = doc.data();
        const msgId = doc.id;
        const isSelf = data.user === username;
        const safeText = data.text ? data.text.replace(/</g, "<").replace(/>/g, ">") : "";
        const dateObj = data.timestamp ? data.timestamp.toDate() : new Date();
        const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        const dateStr = dateObj.toLocaleDateString([], { day: '2-digit', month: 'short' });
        const displayWaktu = `${dateStr}, ${timeStr}`;
        let delBtn = (username === "admin") ? `<div class="msg-del-btn" onclick="messengerApp.deleteMsg('${msgId}')">×</div>` : "";
        let contentHTML = `<div class="msg-text-content">${safeText}</div>`;
        if (data.fileType === 'image') contentHTML += `<img src="${data.fileData}" class="msg-image" onclick="window.open('${data.fileData}')">`;
        else if (data.fileType === 'file') contentHTML += `<a href="${data.fileData}" download="${data.fileName}" class="msg-file-link">${data.fileName}</a>`;
        const msgHTML = `<div class="msg-bubble ${isSelf ? 'msg-self' : 'msg-other'}">${delBtn}<span class="msg-sender">${data.user}</span>${contentHTML}<div class="msg-time">${displayWaktu}</div></div>`;
        list.insertAdjacentHTML('beforeend', msgHTML);
      });
      list.scrollTop = list.scrollHeight;
    }, (err) => console.warn("Chat Error:", err));
    messengerApp.isInitialized = true;
  },
  send: async (textOverride = null, fileData = null, fileType = null, fileName = null) => {
    const input = document.getElementById("msgInput");
    const text = textOverride || input.value.trim();
    if (!text && !fileData) return;
    if (typeof playClick === 'function') playClick();
    try {
      const currentName = localStorage.getItem('chat_username');
      await addDoc(collection(db, "public_chat"), { user: currentName, text: text || "", fileData: fileData || null, fileType: fileType || null, fileName: fileName || null, timestamp: serverTimestamp() });
      input.value = "";
    } catch (e) { alert("Failed: " + e.message); }
  }
};
window.messengerApp = messengerApp;

const networkApp = {
  isTesting: false,
  abortController: null,
  testFile: 'https://speed.cloudflare.com/__down?bytes=5000000',
  uploadUrl: 'https://httpbin.org/post',
  open: () => { windowOps.open('networkWindow'); networkApp.fetchInfo(); },
  fetchInfo: async () => {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) document.getElementById('netType').innerText = conn.effectiveType ? conn.effectiveType.toUpperCase() : "Unknown";
    try {
      const res = await fetch('https://ipapi.co/json/');
      if (res.ok) {
        const data = await res.json();
        document.getElementById('netIP').innerText = data.ip;
        document.getElementById('netISP').innerText = data.org || data.asn;
        document.getElementById('netLoc').innerText = `${data.city}, ${data.country_code}`;
      }
    } catch (e) { document.getElementById('netIP').innerText = "N/A"; document.getElementById('netISP').innerText = "Offline / Blocked"; }
  },
  startTest: async () => {
    if (networkApp.isTesting) return;
    networkApp.isTesting = true;
    networkApp.abortController = new AbortController();
    const startBtn = document.querySelector('.net-start-btn');
    const stopBtn = document.querySelector('.net-stop-btn');
    if (startBtn) startBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'inline-block';
    document.getElementById('netStatus').innerText = "PINGING...";
    const startPing = Date.now();
    try {
      await fetch('https://www.google.com/favicon.ico', { mode: 'no-cors', cache: 'no-store', signal: networkApp.abortController.signal });
      const ping = Date.now() - startPing;
      document.getElementById('valPing').innerText = ping + " ms";
    } catch (e) { document.getElementById('valPing').innerText = "---"; }
    try {
      await networkApp.runRealDownload();
      if (networkApp.isTesting) await networkApp.runRealUpload();
      if (networkApp.isTesting) document.getElementById('netStatus').innerText = "COMPLETED";
    } catch (e) {
      if (e.name === 'AbortError') document.getElementById('netStatus').innerText = "STOPPED";
      else document.getElementById('netStatus').innerText = "ERROR";
    }
    networkApp.finishTest();
  },
  stopTest: () => { if (networkApp.abortController) networkApp.abortController.abort(); networkApp.isTesting = false; networkApp.finishTest(); },
  finishTest: () => {
    const startBtn = document.querySelector('.net-start-btn');
    const stopBtn = document.querySelector('.net-stop-btn');
    if (startBtn) startBtn.style.display = 'inline-block';
    if (stopBtn) stopBtn.style.display = 'none';
    networkApp.isTesting = false;
  },
  runRealDownload: async () => {
    document.getElementById('netStatus').innerText = "DOWNLOADING...";
    const startTime = Date.now(); let receivedBytes = 0;
    const response = await fetch(networkApp.testFile, { cache: 'no-store', signal: networkApp.abortController.signal });
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      receivedBytes += value.length;
      const duration = (Date.now() - startTime) / 1000;
      const mbps = ((receivedBytes * 8) / duration) / 1048576;
      networkApp.updateUI(mbps, 'download');
    }
    const totalDuration = (Date.now() - startTime) / 1000;
    const finalMbps = ((receivedBytes * 8) / totalDuration) / 1048576;
    document.getElementById('valDown').innerText = finalMbps.toFixed(2) + " Mbps";
  },
  runRealUpload: () => {
    return new Promise((resolve, reject) => {
      document.getElementById('netStatus').innerText = "UPLOADING...";
      const size = 5 * 1024 * 1024; const data = new Uint8Array(size); const startTime = Date.now();
      const xhr = new XMLHttpRequest();
      networkApp.abortController.signal.addEventListener('abort', () => { xhr.abort(); reject(new DOMException('Aborted', 'AbortError')); });
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const duration = (Date.now() - startTime) / 1000;
          const mbps = ((e.loaded * 8) / duration) / 1048576;
          networkApp.updateUI(mbps, 'upload');
        }
      };
      xhr.onload = () => {
        const totalDuration = (Date.now() - startTime) / 1000;
        const finalMbps = ((size * 8) / totalDuration) / 1048576;
        document.getElementById('valUp').innerText = finalMbps.toFixed(2) + " Mbps"; resolve();
      };
      xhr.onerror = () => reject(new Error('Upload Failed'));
      xhr.open("POST", networkApp.uploadUrl); xhr.send(data);
    });
  },
  updateUI: (speed, type) => {
    document.getElementById('netSpeedVal').innerText = speed.toFixed(1);
    const deg = Math.min((speed / 100) * 360, 360);
    document.getElementById('netGauge').style.background = `conic-gradient(var(--accent-color) ${deg}deg, #333 0deg)`;
  }
};
window.networkApp = networkApp;

const musicApp = {
  playlist: [], currentIndex: 0, audio: new Audio(), isPlaying: false,
  open: () => { windowOps.open('musicWindow'); musicApp.loadLibrary(); musicApp.audio.ontimeupdate = musicApp.updateProgress; musicApp.audio.onended = musicApp.next; },
  loadLibrary: () => {
    const list = document.getElementById('musicList'); list.innerHTML = "";
    musicApp.playlist = (fileSystem["/Music"] || []).filter(f => ['mp3', 'wav', 'ogg', 'm4a'].includes(f.name.split('.').pop().toLowerCase()));
    if (musicApp.playlist.length === 0) { list.innerHTML = `<div style="text-align:center; padding:20px; color:#666;">No music in /Music.</div>`; return; }
    musicApp.playlist.forEach((song, index) => {
      const item = document.createElement('div');
      item.className = `music-item ${index === musicApp.currentIndex ? 'active' : ''}`;
      item.onclick = () => musicApp.playIndex(index);
      item.innerHTML = `<img src="icons/Music.png" class="music-icon"><div class="music-name">${song.name}</div>`;
      list.appendChild(item);
    });
  },
  playIndex: (index) => { musicApp.currentIndex = index; musicApp.loadSong(); musicApp.play(); musicApp.loadLibrary(); },
  loadSong: () => { const song = musicApp.playlist[musicApp.currentIndex]; musicApp.audio.src = `Music/${song.name}`; document.getElementById('mpTitle').innerText = song.name; },
  togglePlay: () => { if (musicApp.playlist.length === 0) return; if (musicApp.audio.src === "") musicApp.loadSong(); musicApp.isPlaying ? musicApp.pause() : musicApp.play(); },
  play: () => { musicApp.audio.play(); musicApp.isPlaying = true; document.getElementById('mpPlayBtn').innerHTML = `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`; },
  pause: () => { musicApp.audio.pause(); musicApp.isPlaying = false; document.getElementById('mpPlayBtn').innerHTML = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`; },
  next: () => { musicApp.currentIndex = (musicApp.currentIndex + 1) % musicApp.playlist.length; musicApp.playIndex(musicApp.currentIndex); },
  prev: () => { musicApp.currentIndex = (musicApp.currentIndex - 1 + musicApp.playlist.length) % musicApp.playlist.length; musicApp.playIndex(musicApp.currentIndex); },
  seek: () => { musicApp.audio.currentTime = musicApp.audio.duration * (document.getElementById('mpProgress').value / 100); },
  updateProgress: () => {
    const { currentTime, duration } = musicApp.audio; if (isNaN(duration)) return;
    document.getElementById('mpProgress').value = (currentTime / duration) * 100;
    const fmt = (t) => { let m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m}:${s<10?'0'+s:s}`; };
    document.getElementById('mpTime').innerText = `${fmt(currentTime)} / ${fmt(duration)}`;
  }
};
window.musicApp = musicApp;

const keyboardSystem = {
  activeInput: null, isCaps: false, isShiftTemp: false, isSym: false, lastShiftClick: 0, delInterval: null, delTimer: null, board: null,
  init: () => {
    keyboardSystem.board = document.getElementById('virtualKeyboard'); keyboardSystem.render();
    document.addEventListener('focusin', (e) => {
      const textInputTypes = ['text', 'password', 'email', 'number', 'search', 'tel', 'url'];
      const isTextArea = e.target.tagName === 'TEXTAREA';
      const isTextInput = e.target.tagName === 'INPUT' && textInputTypes.includes(e.target.type);
      if (isTextInput || isTextArea) { e.target.inputMode = "none"; keyboardSystem.activeInput = e.target; keyboardSystem.show(); }
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('input, textarea, .v-keyboard')) keyboardSystem.hide(); });
  },
  render: () => {
    if (!keyboardSystem.board) return;
    const abc = [['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'], ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'], ['z', 'x', 'c', 'v', 'b', 'n', 'm']];
    const sym = [['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'], ['@', '#', '$', '_', '&', '-', '+', '(', ')', '/'], ['.', '*', ',', '?', '!', '\'', '"', '<', '>', ':', ';']];
    const layout = keyboardSystem.isSym ? sym : abc;
    const isUpper = (keyboardSystem.isCaps || keyboardSystem.isShiftTemp) && !keyboardSystem.isSym;
    let h = '<div class="vk-row">';
    layout[0].forEach(k => h += `<div class="vk-key" data-key="${k}">${isUpper ? k.toUpperCase() : k}</div>`);
    h += '</div><div class="vk-row" style="padding:0 15px">';
    layout[1].forEach(k => h += `<div class="vk-key" data-key="${k}">${isUpper ? k.toUpperCase() : k}</div>`);
    h += '</div><div class="vk-row">';
    if (!keyboardSystem.isSym) {
      const shiftClass = keyboardSystem.isCaps ? 'active locked' : (keyboardSystem.isShiftTemp ? 'active' : '');
      const shiftIcon = keyboardSystem.isCaps ? 'Caps' : 'Shift';
      h += `<div class="vk-key wide action ${shiftClass}" id="vkShift">${shiftIcon}</div>`;
    }
    layout[2].forEach(k => h += `<div class="vk-key" data-key="${k}">${isUpper ? k.toUpperCase() : k}</div>`);
    h += `<div class="vk-key wide action" id="vkBack">Del</div></div><div class="vk-row">`;
    h += `<div class="vk-key wide action" id="vkMode">${keyboardSystem.isSym ? 'ABC' : '?123'}</div><div class="vk-key space" data-key=" "></div><div class="vk-key wide action" id="vkDone">Done</div></div>`;
    keyboardSystem.board.innerHTML = h; keyboardSystem.attachEvents();
  },
  attachEvents: () => {
    keyboardSystem.board.querySelectorAll('.vk-key[data-key]').forEach(k => {
      const typeAction = (e) => { e.preventDefault(); keyboardSystem.type(k.dataset.key); };
      k.onmousedown = typeAction; k.ontouchstart = typeAction;
    });
    const bind = (id, fn) => { const el = document.getElementById(id); if (el) { el.onmousedown = (e) => { e.preventDefault(); fn(); }; el.ontouchstart = (e) => { e.preventDefault(); fn(); }; } };
    bind('vkShift', () => {
      const now = Date.now(); const delay = now - keyboardSystem.lastShiftClick;
      if (delay < 300) { keyboardSystem.isCaps = true; keyboardSystem.isShiftTemp = false; }
      else { if (keyboardSystem.isCaps) { keyboardSystem.isCaps = false; keyboardSystem.isShiftTemp = false; } else { keyboardSystem.isShiftTemp = !keyboardSystem.isShiftTemp; } }
      keyboardSystem.lastShiftClick = now; keyboardSystem.render();
    });
    bind('vkMode', () => { keyboardSystem.isSym = !keyboardSystem.isSym; keyboardSystem.render(); });
    bind('vkDone', keyboardSystem.hide);
    const backBtn = document.getElementById('vkBack');
    if (backBtn) {
      const start = (e) => { e.preventDefault(); keyboardSystem.backspace(); keyboardSystem.delTimer = setTimeout(() => { keyboardSystem.delInterval = setInterval(keyboardSystem.backspace, 50); }, 500); };
      const stop = () => { clearTimeout(keyboardSystem.delTimer); clearInterval(keyboardSystem.delInterval); };
      backBtn.onmousedown = start; backBtn.ontouchstart = start; backBtn.onmouseup = stop; backBtn.ontouchend = stop; backBtn.onmouseleave = stop;
    }
  },
  show: () => { keyboardSystem.board.style.display = 'flex'; document.body.classList.add('keyboard-open'); },
  hide: () => { keyboardSystem.board.style.display = 'none'; document.body.classList.remove('keyboard-open'); if (keyboardSystem.activeInput) keyboardSystem.activeInput.blur(); },
  type: (c) => {
    const input = keyboardSystem.activeInput; if (!input) return;
    if (typeof playClick === 'function') playClick();
    const start = input.selectionStart; const end = input.selectionEnd; const text = input.value;
    const isUpper = (keyboardSystem.isCaps || keyboardSystem.isShiftTemp) && !keyboardSystem.isSym;
    const char = isUpper ? c.toUpperCase() : c;
    input.value = text.slice(0, start) + char + text.slice(end);
    input.selectionStart = input.selectionEnd = start + 1;
    if (keyboardSystem.isShiftTemp) { keyboardSystem.isShiftTemp = false; keyboardSystem.render(); }
    input.dispatchEvent(new Event('input', { bubbles: true }));
  },
  backspace: () => {
    const input = keyboardSystem.activeInput; if (!input) return;
    if (typeof playClick === 'function') playClick();
    const start = input.selectionStart; const end = input.selectionEnd; const text = input.value;
    if (start !== end) { input.value = text.slice(0, start) + text.slice(end); input.selectionStart = input.selectionEnd = start; }
    else if (start > 0) { input.value = text.slice(0, start - 1) + text.slice(start); input.selectionStart = input.selectionEnd = start - 1; }
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
};

const notepadApp = {
  currentTab: 'html',
  open: () => { windowOps.open('notepadWindow'); notepadApp.loadCurrentCode(); },
  switchTab: (tab) => {
    notepadApp.currentTab = tab;
    const tabs = { 'html': 'tabHtmlBtn', 'css': 'tabCssBtn', 'js': 'tabJsBtn' };
    Object.keys(tabs).forEach(key => { const btn = document.getElementById(tabs[key]); if (btn) btn.classList.toggle('active', key === tab); });
    notepadApp.loadCurrentCode();
  },
  loadCurrentCode: () => {
    const editor = document.getElementById('notepadEditor'); if (!editor) return;
    editor.className = `editor-area ${notepadApp.currentTab}-mode`;
    if (notepadApp.currentTab === 'html') editor.value = document.body.innerHTML;
    else if (notepadApp.currentTab === 'css') {
      try {
        let cssRules = "";
        for (let i = 0; i < document.styleSheets.length; i++) {
          const sheet = document.styleSheets[i];
          try {
            const rules = sheet.cssRules || sheet.rules;
            for (let j = 0; j < rules.length; j++) cssRules += rules[j].cssText + "\n\n";
          } catch (e) {}
        }
        editor.value = cssRules || "/* CSS Inaccessible */";
      } catch (e) { editor.value = "/* Error loading CSS */"; }
    }
    else if (notepadApp.currentTab === 'js') {
      let jsContent = "";
      const scripts = document.querySelectorAll('script:not([src])');
      scripts.forEach((s, i) => { jsContent += `// --- Inline Script Block ${i+1} ---\n${s.innerText}\n\n`; });
      fetch('script.js').then(response => { if (!response.ok) throw new Error("Failed to load file"); return response.text(); })
        .then(data => { const editor = document.getElementById('notepadEditor'); if (notepadApp.currentTab === 'js' && editor) editor.value = jsContent + "// --- Main Script (script.js) ---\n" + data; })
        .catch(err => { const editor = document.getElementById('notepadEditor'); if (editor) editor.value = jsContent + "// Error: " + err.message; });
      editor.value = jsContent + "// Loading script.js...";
    }
  },
  applyChanges: () => {
    const code = document.getElementById('notepadEditor').value;
    if (notepadApp.currentTab === 'html') {
      document.body.innerHTML = code;
      if (typeof uiSystem !== 'undefined') uiSystem.generateDrawer();
      if (typeof setupGlobalEvents !== 'undefined') setupGlobalEvents();
      if (typeof keyboardSystem !== 'undefined') keyboardSystem.init();
      alert("HTML Applied!");
    } else if (notepadApp.currentTab === 'css') {
      let styleTag = document.getElementById('live-css-fix');
      if (!styleTag) { styleTag = document.createElement('style'); styleTag.id = 'live-css-fix'; document.head.appendChild(styleTag); }
      styleTag.innerHTML = code; alert("CSS Applied!");
    } else if (notepadApp.currentTab === 'js') {
      try { eval(code); alert("JavaScript Executed!"); } catch (e) { alert("JS Error: " + e.message); }
    }
  }
};
window.notepadApp = notepadApp;

function setupGlobalEvents() {
  document.addEventListener("contextmenu", e => {
    if (e.target.closest('#fmContent')) {
      e.preventDefault();
      const menu = document.getElementById("contextMenu");
      menu.innerHTML = `<div onclick="fileManagerApp.uploadFile()">Upload File</div><div onclick="fileManagerApp.createFolder()">New Folder</div><div onclick="fileManagerApp.navigate(fmPath)">Refresh</div>`;
      menu.style.display = "block";
      menu.style.left = e.pageX + "px";
      menu.style.top = e.pageY + "px";
      return;
    }
  });
  document.addEventListener('click', () => { if (typeof playClick === 'function') playClick(); });
  const menu = document.getElementById("contextMenu");
  document.addEventListener("contextmenu", e => {
    if (e.target.closest('.app') || e.target.closest('#msgList') || windowOps.isAnyOpen()) return;
    e.preventDefault(); if (menu) { menu.style.display = "block"; menu.style.left = e.pageX + "px"; menu.style.top = e.pageY + "px"; }
  });
  document.addEventListener("click", () => { if (menu) menu.style.display = "none"; });
  const searchInput = document.getElementById("search");
  if (searchInput) {
    searchInput.oninput = e => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('.app').forEach(a => { a.style.display = a.dataset.name.includes(q) ? "" : "none"; });
    };
  }
  const changeBgBtn = document.getElementById("changeBg");
  if (changeBgBtn) {
    changeBgBtn.onclick = () => document.getElementById("bgInput").click();
    document.getElementById("bgInput").onchange = (e) => {
      const r = new FileReader(); r.onload = ev => document.body.style.background = `url(${ev.target.result}) center/cover no-repeat fixed`; r.readAsDataURL(e.target.files[0]);
    };
  }
}

const presenceSystem = {
  listenOnlineCount: (callback) => {
    const q = query(collection(db, "public_chat"), orderBy("timestamp", "desc"), limit(100));
    onSnapshot(q, (snapshot) => {
      const activeUsers = new Set(); const now = Date.now(); const fiveMinutesAgo = now - (5 * 60 * 1000);
      snapshot.forEach((doc) => { const data = doc.data(); if (data.timestamp && data.timestamp.toMillis() > fiveMinutesAgo) activeUsers.add(data.user); });
      callback(activeUsers.size);
    });
  }
};

const createApp = {
  open: () => { windowOps.open('createWindow'); createApp.renderManageList(); },
  close: () => windowOps.close('createWindow'),
  handleFileUpload: (input) => {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById('createAppCode').value = e.target.result;
      const nameInput = document.getElementById('createAppName');
      if (!nameInput.value) nameInput.value = file.name.replace('.html', '').replace('.txt', '');
    };
    reader.readAsText(file);
  },
  saveApp: async () => {
    const name = document.getElementById('createAppName').value.trim();
    const code = document.getElementById('createAppCode').value;
    const icon = document.getElementById('createAppIcon').value.trim();
    const user = localStorage.getItem('chat_username') || "Guest";
    if (!name || !code) return;
    try {
      await addDoc(collection(db, "user_apps"), { name: name, code: code, icon: icon, creator: user, timestamp: serverTimestamp() });
      document.getElementById('createAppName').value = "";
      document.getElementById('createAppCode').value = "";
      createApp.close();
    } catch (e) {
      console.error("Error: " + e.message);
    }
  },
  initListener: (onUpdateCallback) => {
    if (!db) return;
    const q = query(collection(db, "user_apps"), orderBy("timestamp", "asc"));
    onSnapshot(q, (snapshot) => {
      window.customApps = []; snapshot.forEach(doc => { window.customApps.push({ id: doc.id, ...doc.data() }); });
      if (onUpdateCallback) onUpdateCallback();
      if (document.getElementById('createWindow').style.display === 'flex') createApp.renderManageList();
    });
  },
  renderManageList: () => {
    const list = document.getElementById('createAppList'); if (!list) return;
    list.innerHTML = ""; const currentUser = localStorage.getItem('chat_username') || "Guest";
    window.customApps.forEach(app => {
      const isOwner = app.creator === currentUser || currentUser === "admin";
      const item = document.createElement('div'); item.className = 'custom-app-item';
      item.innerHTML = `<div><strong>${app.name}</strong> <span style="font-size:10px;">by ${app.creator}</span></div>${isOwner ? `<button class="btn-delete-app">Delete</button>` : ''}`;
      if (isOwner) item.querySelector('.btn-delete-app').onclick = () => createApp.deleteApp(app.id);
      list.appendChild(item);
    });
  },
  deleteApp: async (id) => {
    await deleteDoc(doc(db, "user_apps", id));
  }
};
window.createApp = createApp;

const viewerApp = {
  launch: (appData) => {
    windowOps.open('viewerWindow');
    document.getElementById('viewerNameText').innerText = appData.name;
    document.getElementById('viewerIcon').src = appData.icon || "icons/File.png";
    document.getElementById('viewerFrame').srcdoc = appData.code;
  },
  reset: () => { document.getElementById('viewerFrame').srcdoc = ""; }
};
window.viewerApp = viewerApp;