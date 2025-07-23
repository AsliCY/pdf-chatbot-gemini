const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const DocumentProcessor = require('../services/documentProcessor');

const processor = new DocumentProcessor();

// Dosya yükleme
router.post('/', async (req, res) => {
    try {
        console.log('\n📤 Upload request received');
        
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'No files uploaded' 
            });
        }

        const results = [];
        const errors = [];

        for (const file of req.files) {
            try {
                const documentId = uuidv4();
                
                // Dosyayı işle
                const chunks = await processor.processDocument(file.path, file.originalname);
                
                // Global state'e ekle
                const documentData = {
                    id: documentId,
                    filename: file.originalname,
                    chunks: chunks,
                    uploadedAt: new Date().toISOString(),
                    size: file.size
                };
                
                global.appState.documents.push(documentData);
                
                // Vector store'a ekle (basit keyword search için)
                chunks.forEach(chunk => {
                    global.appState.vectorStore.push({
                        id: uuidv4(),
                        documentId: documentId,
                        content: chunk.content,
                        filename: file.originalname,
                        keywords: chunk.content.toLowerCase().split(' ')
                    });
                });
                
                results.push({
                    success: true,
                    documentId: documentId,
                    filename: file.originalname,
                    chunks: chunks.length
                });
                
                console.log(`✅ Successfully processed: ${file.originalname}`);
                
            } catch (error) {
                console.error(`❌ Error processing ${file.originalname}:`, error);
                errors.push({
                    filename: file.originalname,
                    error: error.message
                });
            } finally {
                // Temp dosyayı sil
                try {
                    await fs.unlink(file.path);
                } catch (err) {
                    console.error('Failed to delete temp file:', err);
                }
            }
        }

        console.log(`📊 Upload summary: ${results.length} success, ${errors.length} errors`);
        
        res.json({
            success: results.length > 0,
            results: results,
            errors: errors,
            totalDocuments: global.appState.documents.length,
            totalChunks: global.appState.vectorStore.length
        });

    } catch (error) {
        console.error('❌ Upload route error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Döküman listesi
router.get('/documents', (req, res) => {
    try {
        const documents = global.appState.documents.map(doc => ({
            id: doc.id,
            filename: doc.filename,
            chunks: doc.chunks.length,
            uploadedAt: doc.uploadedAt,
            size: doc.size
        }));
        
        res.json(documents);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Döküman silme
router.delete('/documents/:id', (req, res) => {
    try {
        const { id } = req.params;
        
        // Dökümanı bul ve sil
        const docIndex = global.appState.documents.findIndex(doc => doc.id === id);
        if (docIndex === -1) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        const deletedDoc = global.appState.documents.splice(docIndex, 1)[0];
        
        // Vector store'dan da sil
        global.appState.vectorStore = global.appState.vectorStore.filter(
            item => item.documentId !== id
        );
        
        console.log(`🗑️ Deleted document: ${deletedDoc.filename}`);
        
        res.json({ 
            success: true, 
            deletedDocument: deletedDoc.filename,
            remainingDocuments: global.appState.documents.length
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;