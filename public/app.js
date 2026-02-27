let token = localStorage.getItem('adminToken');

window.addEventListener('DOMContentLoaded', () => {
    // Timeout 10 detik: Jika loading terlalu lama, paksa berhenti
    setTimeout(() => {
        const overlay = document.getElementById('loading-overlay');
        if (overlay && !overlay.classList.contains('hidden')) {
            console.warn("Loading timeout - forcing hide");
            hideLoading();
            if (!token) showLogin();
        }
    }, 10000);

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

async function fetchData() {
    try {
        const response = await fetch(`/api/admin/stats`, {
            headers: { 'Authorization': token }
        });

        if (response.status === 401 || response.status === 403) return logout();

        if (response.ok) {
            const data = await response.json();
            document.getElementById('stat-licenses').innerText = data.total || 0;
            document.getElementById('stat-active').innerText = data.active || 0;
            document.getElementById('stat-tamper').innerText = data.tamper || 0;
            document.getElementById('stat-pending').innerText = (data.total - data.active) || 0;
            renderLicenses(data.licenses || []);
            renderLogs(data.logs || []);
        } else {
            const err = await response.json();
            alert("Gagal memuat data: " + (err.error || "Cek konfigurasi Firebase di Vercel"));
        }
    } catch (e) {
        console.error('Fetch error:', e);
        alert("Error koneksi ke server. Pastikan Vercel sudah aktif.");
    } finally {
        hideLoading();
    }
}

// ... (Sisa fungsi renderLicenses, renderLogs, dll tetap sama)
async function generateLicense() {
    const days = document.getElementById('days-input').value || 30;
    try {
        const response = await fetch(`/api/admin/generate`, {
            method: 'POST',
            headers: { 'Authorization': token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ days: parseInt(days) })
        });
        if (response.ok) {
            const data = await response.json();
            alert('Key Baru: ' + data.key);
            fetchData();
        }
    } catch (e) { alert('Gagal membuat lisensi.'); }
}

function logout() { localStorage.removeItem('adminToken'); location.reload(); }

function renderLicenses(licenses) {
    const body = document.getElementById('license-body');
    if (!body) return;
    body.innerHTML = licenses.map(lic => `
        <tr class="hover:bg-slate-50 transition-colors">
            <td class="px-6 py-4"><span class="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100">${lic.id}</span></td>
            <td class="px-6 py-4"><span class="px-2 py-1 rounded-full text-xs font-bold ${lic.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}">${lic.status}</span></td>
            <td class="px-6 py-4 text-xs font-medium text-slate-700">${lic.deviceName || '---'}</td>
            <td class="px-6 py-4"><button onclick="copyToClipboard('${lic.id}')" class="text-slate-400 hover:text-blue-600"><i class="fas fa-copy"></i></button></td>
        </tr>
    `).join('');
}

function renderLogs(logs) {
    const list = document.getElementById('logs-list');
    if (!list) return;
    list.innerHTML = logs.map(log => `
        <div class="p-3 bg-white border border-slate-100 rounded-lg shadow-sm mb-2">
            <div class="flex justify-between items-center mb-1">
                <span class="text-xs font-bold text-red-600">${log.violationType}</span>
                <span class="text-[9px] text-slate-400 font-mono">${log.ip || ''}</span>
            </div>
            <p class="text-[10px] text-slate-500">${log.details || ''}</p>
        </div>
    `).join('');
}

function copyToClipboard(text) { navigator.clipboard.writeText(text); alert('Key disalin!'); }
