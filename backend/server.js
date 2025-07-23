const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// Klasörleri oluştur
const uploadDir = './backend/data/uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Multer config - basit
const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.pdf', '.txt', '.docx'];
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, allowedTypes.includes(ext));
    }
});

// Global state - basit approach
global.appState = {
    documents: [],
    conversations: new Map(),
    vectorStore: []
};

// Routes
app.use('/api/upload', upload.array('files', 5), require('./routes/upload'));
app.use('/api/chat', require('./routes/query'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        documents: global.appState.documents.length,
        vectorStore: global.appState.vectorStore.length,
        timestamp: new Date().toISOString()
    });
});

// Ana sayfa
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handler
app.use((error, req, res, next) => {
    console.error('Error:', error.message);
    res.status(500).json({ error: error.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('\n🚀 PDF Chatbot with Gemini AI');
    console.log(`📍 Server: http://localhost:${PORT}`);
    console.log(`📁 Upload dir: ${uploadDir}`);
    console.log('✅ Ready!\n');
});

module.exports = app;