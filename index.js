const express = require('express');
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// 1. GABUNGAN FIREBASE ADMIN CONFIG
if (!admin.apps.length) {
    try {
        // Pada Vercel, kita akan menggunakan Environment Variable FIREBASE_SERVICE_ACCOUNT_KEY
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("Firebase Connected");
    } catch (error) {
        console.error('Firebase Admin Error:', error.message);
    }
}

const db = admin.firestore();
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- MIDDLEWARE AUTH ---
const authenticateAdmin = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.admin = verified;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// --- API LOGIN ---
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
        const token = jwt.sign({ user: username }, process.env.JWT_SECRET, { expiresIn: '24h' });
        return res.json({ token });
    }
    res.status(401).json({ error: 'Invalid credentials' });
});

// --- API CLIENT (ANDROID) ---
app.post('/api/activate', async (req, res) => {
    const { licenseKey, deviceId, deviceName } = req.body;
    try {
        const docRef = db.collection('licenses').doc(licenseKey);
        const doc = await docRef.get();

        if (!doc.exists) return res.status(404).json({ error: 'License Not Found' });

        const data = doc.data();
        if (data.deviceId && data.deviceId !== deviceId) {
            return res.status(403).json({ error: 'License already used by another device' });
        }

        await docRef.update({
            deviceId,
            deviceName,
            status: 'ACTIVE',
            activationDate: admin.firestore.FieldValue.serverTimestamp(),
            lastValidation: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true, message: 'Activated' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/validate', async (req, res) => {
    const { licenseKey, deviceId } = req.body;
    try {
        const doc = await db.collection('licenses').doc(licenseKey).get();
        if (doc.exists && doc.data().deviceId === deviceId && doc.data().status === 'ACTIVE') {
            await db.collection('licenses').doc(licenseKey).update({
                lastValidation: admin.firestore.FieldValue.serverTimestamp()
            });
            return res.json({ valid: true });
        }
        res.status(403).json({ valid: false });
    } catch (e) {
        res.status(500).json({ error: 'Internal error' });
    }
});

app.post('/api/security-log', async (req, res) => {
    const { deviceId, violationType, details } = req.body;
    try {
        await db.collection('securityLogs').add({
            deviceId,
            violationType,
            details,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            ip: req.ip || req.headers['x-forwarded-for']
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).send();
    }
});

// --- API ADMIN ---
app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
    try {
        const licenseSnapshot = await db.collection('licenses').get();
        const logsSnapshot = await db.collection('securityLogs').orderBy('timestamp', 'desc').limit(50).get();

        const licenses = [];
        let activeCount = 0;
        licenseSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.status === 'ACTIVE') activeCount++;
            licenses.push({ id: doc.id, ...data });
        });

        const logs = logsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const tamperCount = logs.filter(l => l.violationType.includes('TAMPER')).length;

        res.json({
            total: licenseSnapshot.size,
            active: activeCount,
            tamper: tamperCount,
            licenses: licenses,
            logs: logs
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/admin/generate', authenticateAdmin, async (req, res) => {
    try {
        const key = 'VIA-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        await db.collection('licenses').doc(key).set({
            status: 'PENDING',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        res.json({ key });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Serve Frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;
