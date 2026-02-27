let token = localStorage.getItem('adminToken');

if (token) {
    showDashboard();
}

async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

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
            alert('Login failed. Check your username and password.');
        }
    } catch (e) {
        alert('Server Error');
    }
}

function logout() {
    localStorage.removeItem('adminToken');
    location.reload();
}

function showDashboard() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard-screen').classList.remove('hidden');
    fetchData();
}

async function fetchData() {
    try {
        const response = await fetch(`/api/admin/stats`, {
            headers: { 'Authorization': token }
        });

        if (response.status === 401) return logout();

        if (response.ok) {
            const data = await response.json();
            document.getElementById('stat-licenses').innerText = data.total;
            document.getElementById('stat-active').innerText = data.active;
            document.getElementById('stat-tamper').innerText = data.tamper;

            renderLicenses(data.licenses);
            renderLogs(data.logs);
        }
    } catch (e) {
        console.error('Fetch error');
    }
}

function renderLicenses(licenses) {
    const body = document.getElementById('license-body');
    body.innerHTML = licenses.map(lic => `
        <tr class="hover:bg-gray-50 transition">
            <td class="p-4 font-mono font-bold text-blue-600">${lic.id}</td>
            <td class="p-4 text-gray-600">${lic.deviceName || 'Not Activated'}</td>
            <td class="p-4">
                <span class="px-2 py-1 rounded-full text-xs font-bold ${lic.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">
                    ${lic.status}
                </span>
            </td>
        </tr>
    `).join('');
}

function renderLogs(logs) {
    const body = document.getElementById('logs-body');
    body.innerHTML = logs.map(log => `
        <tr class="hover:bg-gray-50 transition">
            <td class="p-4 text-red-600 font-bold">${log.violationType}</td>
            <td class="p-4 text-xs font-mono text-gray-500">${log.deviceId}</td>
            <td class="p-4 text-xs text-gray-400">${log.timestamp ? new Date(log.timestamp._seconds * 1000).toLocaleString() : '-'}</td>
        </tr>
    `).join('');
}

async function generateLicense() {
    const response = await fetch(`/api/admin/generate`, {
        method: 'POST',
        headers: { 'Authorization': token }
    });
    if (response.ok) {
        const data = await response.json();
        alert('Key Baru: ' + data.key);
        fetchData();
    }
          }
      
