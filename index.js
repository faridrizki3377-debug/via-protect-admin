const express = require('express');
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// ANTI-ERROR: Firebase Auto-Initialization with Key Formatting
if (!admin.apps.length) {
    try {
        const saKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        if (!saKey) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_KEY");

        const config = JSON.parse(saKey);
        // Fix for Vercel/Environment Variable newline issue
        if (config.private_key && config.private_key.includes('\\n')) {
            config.private_key = config.private_key.replace(/\\n/g, '\n');
        }

        admin.initializeApp({
            credential: admin.credential.cert(config)
        });
        console.log("Firebase Admin Initialized");
    } catch (error) {
        console.error('Firebase Init Error:', error.message);
    }
}

const db = admin.firestore();
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Secure Middleware
const authAdmin = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ error: 'No Token' });
    try {
        req.admin = jwt.verify(token, process.env.JWT_SECRET || 'via-secret');
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid Token' });
    }
};

// --- AUTH ---
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
        const token = jwt.sign({ user: username }, process.env.JWT_SECRET || 'via-secret', { expiresIn: '24h' });
        return res.json({ token });
    }
    res.status(401).json({ error: 'Unauthorized' });
});

// --- CLIENT APIS (ANDROID) ---
app.post('/api/activate', async (req, res) => {
    const { licenseKey, deviceId, deviceName } = req.body;
    try {
        const docRef = db.collection('licenses').doc(licenseKey);
        const doc = await docRef.get();
        if (!doc.exists) return res.status(404).json({ error: 'Key Not Found' });

        const data = doc.data();
        if (data.deviceId && data.deviceId !== deviceId) return res.status(403).json({ error: 'Locked to another device' });

        await docRef.update({
            deviceId,
            deviceName: deviceName || 'Android Device',
            status: 'ACTIVE',
            activationDate: admin.firestore.FieldValue.serverTimestamp()
        });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/validate', async (req, res) => {
    const { licenseKey, deviceId } = req.body;
    try {
        const doc = await db.collection('licenses').doc(licenseKey).get();
        if (doc.exists && doc.data().deviceId === deviceId && doc.data().status === 'ACTIVE') {
            return res.json({ valid: true });
        }
        res.status(403).json({ valid: false });
    } catch (e) { res.status(500).send(); }
});

app.post('/api/security-log', async (req, res) => {
    try {
        await db.collection('securityLogs').add({
            ...req.body,
            serverTimestamp: admin.firestore.FieldValue.serverTimestamp(),
            ip: req.headers['x-forwarded-for'] || req.ip
        });
        res.json({ success: true });
    } catch (e) { res.status(500).send(); }
});

// --- ADMIN APIS ---
app.get('/api/admin/stats', authAdmin, async (req, res) => {
    try {
        const [lics, logs] = await Promise.all([
            db.collection('licenses').get(),
            db.collection('securityLogs').orderBy('serverTimestamp', 'desc').limit(20).get()
        ]);
        res.json({
            total: lics.size,
            active: lics.docs.filter(d => d.data().status === 'ACTIVE').length,
            licenses: lics.docs.map(d => ({id: d.id, ...d.data()})),
            logs: logs.docs.map(d => ({id: d.id, ...d.data()}))
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/generate', authAdmin, async (req, res) => {
    try {
        const key = 'VIA-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        await db.collection('licenses').doc(key).set({
            status: 'PENDING',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        res.json({ key });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

module.exports = app;
