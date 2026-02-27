let token = localStorage.getItem('adminToken');

// Initial Setup
window.addEventListener('DOMContentLoaded', () => {
    if (token) {
        showDashboard();
    } else {
        hideLoading();
        showLogin();
    }
});

function showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('dashboard-screen').classList.add('hidden');
}

function showDashboard() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard-screen').classList.remove('hidden');
    fetchData();
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.classList.add('hidden'), 500);
    }
}

async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const btn = document.getElementById('login-btn');

    if (!username || !password) return alert('Lengkapi data login!');

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Memproses...';

    try {
        const response = await fetch(`/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (response.ok) {
            const data = await response.json();
            token = data.token;
            localStorage.setItem('adminToken', token);
            showDashboard();
        } else {
            alert('Login gagal! Username atau Password salah.');
        }
    } catch (e) {
        alert('Gagal terhubung ke server.');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Masuk ke Dashboard';
    }
}

function logout() {
    localStorage.removeItem('adminToken');
    location.reload();
}

async function fetchData() {
    try {
        const response = await fetch(`/api/admin/stats`, {
            headers: { 'Authorization': token }
        });

        if (response.status === 401) return logout();

        if (response.ok) {
            const data = await response.json();

            document.getElementById('stat-licenses').innerText = data.total || 0;
            document.getElementById('stat-active').innerText = data.active || 0;
            document.getElementById('stat-tamper').innerText = data.tamper || 0;
            document.getElementById('stat-pending').innerText = (data.total - data.active) || 0;

            renderLicenses(data.licenses || []);
            renderLogs(data.logs || []);
        }
    } catch (e) {
        console.error('Fetch error:', e);
    } finally {
        hideLoading();
    }
}

function renderLicenses(licenses) {
    const body = document.getElementById('license-body');
    if (licenses.length === 0) {
        body.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-slate-400 italic">Belum ada lisensi yang dibuat</td></tr>';
        return;
    }

    body.innerHTML = licenses.map(lic => {
        const expiry = lic.expiryDate ? new Date(lic.expiryDate._seconds * 1000).toLocaleDateString() : 'Lifetime';
        return `
        <tr class="hover:bg-slate-50 transition-colors border-b border-slate-50">
            <td class="px-6 py-4">
                <div class="flex flex-col">
                    <span class="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md text-sm border border-blue-100 w-fit">${lic.id}</span>
                    <span class="text-[10px] text-slate-400 mt-1">Exp: ${expiry}</span>
                </div>
            </td>
            <td class="px-6 py-4">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    lic.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                    lic.status === 'BANNED' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                }">
                    ${lic.status}
                </span>
            </td>
            <td class="px-6 py-4">
                <div class="flex flex-col">
                    <span class="text-slate-700 font-semibold text-xs">${lic.deviceName || '---'}</span>
                    <span class="text-[9px] text-slate-400 font-mono truncate w-32">${lic.deviceId || 'Menunggu aktivasi'}</span>
                </div>
            </td>
            <td class="px-6 py-4">
                <button onclick="copyToClipboard('${lic.id}')" title="Copy Key" class="text-slate-400 hover:text-blue-600 p-2">
                    <i class="fas fa-copy"></i>
                </button>
            </td>
        </tr>
    `}).join('');
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    alert('License Key disalin!');
}

function renderLogs(logs) {
    const list = document.getElementById('logs-list');
    if (logs.length === 0) {
        list.innerHTML = '<div class="p-8 text-center text-slate-400 italic text-sm">Aman, tidak ada pelanggaran terdeteksi</div>';
        return;
    }

    list.innerHTML = logs.map(log => `
        <div class="p-4 rounded-xl border border-slate-100 bg-white shadow-sm flex gap-4 items-start">
            <div class="flex-shrink-0 w-10 h-10 rounded-lg ${log.violationType?.includes('TAMPER') ? 'bg-red-50 text-red-500' : 'bg-orange-50 text-orange-500'} flex items-center justify-center">
                <i class="fas ${log.violationType?.includes('TAMPER') ? 'fa-skull-crossbones' : 'fa-exclamation-triangle'}"></i>
            </div>
            <div class="flex-grow min-w-0">
                <div class="flex justify-between items-start mb-1">
                    <h4 class="text-sm font-bold text-slate-800">${log.violationType}</h4>
                    <span class="text-[10px] text-slate-400 whitespace-nowrap ml-2">${getTimeAgo(log.serverTimestamp)}</span>
                </div>
                <p class="text-[11px] text-slate-500 leading-relaxed line-clamp-2">${log.details || 'Akses ilegal terdeteksi'}</p>
                <div class="mt-2 flex items-center gap-2">
                    <span class="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-mono">${log.deviceId?.substring(0,12)}...</span>
                </div>
            </div>
        </div>
    `).join('');
}

async function generateLicense() {
    const days = document.getElementById('days-input').value || 30;

    try {
        const response = await fetch(`/api/admin/generate`, {
            method: 'POST',
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ days: parseInt(days) })
        });

        if (response.ok) {
            const data = await response.json();
            alert('LISENSI BERHASIL DIBUAT!\n\nKey: ' + data.key + '\nMasa Aktif: ' + days + ' Hari');
            fetchData();
        }
    } catch (e) {
        alert('Gagal membuat lisensi.');
    }
}

function getTimeAgo(timestamp) {
    if (!timestamp) return 'Baru saja';
    const seconds = Math.floor((new Date() - new Date(timestamp._seconds * 1000)) / 1000);

    if (seconds < 60) return "Baru saja";
    let interval = Math.floor(seconds / 3600);
    if (interval >= 1) return interval + " jam lalu";
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return interval + " mnt lalu";
    return seconds + " dtk lalu";
}
  
