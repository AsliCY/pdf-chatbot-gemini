const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const GeminiService = require('../services/geminiService');

const gemini = new GeminiService();

// Basit keyword search fonksiyonu
function searchDocuments(query, limit = 3) {
    const queryWords = query.toLowerCase().split(' ');
    const results = [];
    
    for (const item of global.appState.vectorStore) {
        let score = 0;
        
        // Her query kelimesi için eşleşme skoru hesapla
        for (const word of queryWords) {
            if (word.length > 2) { // 2 karakterden uzun kelimeler
                const matches = item.keywords.filter(keyword => 
                    keyword.includes(word) || word.includes(keyword)
                ).length;
                score += matches;
            }
        }
        
        if (score > 0) {
            results.push({
                ...item,
                score: score
            });
        }
    }
    
    // Score'a göre sırala ve limit uygula
    return results
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}

// Sohbet endpoint'i
router.post('/', async (req, res) => {
    try {
        const { message, sessionId } = req.body;
        
        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message is required' });
        }

        console.log(`\n💬 New message: "${message}"`);
        
        let currentSessionId = sessionId || uuidv4();
        
        // Session'ı başlat (eğer yoksa)
        if (!global.appState.conversations.has(currentSessionId)) {
            global.appState.conversations.set(currentSessionId, []);
        }
        
        let context = '';
        let sources = [];
        
        // Döküman varsa arama yap
        if (global.appState.vectorStore.length > 0) {
            const searchResults = searchDocuments(message);
            
            if (searchResults.length > 0) {
                context = searchResults.map(result => result.content).join('\n\n---\n\n');
                sources = [...new Set(searchResults.map(result => result.filename))];
                
                console.log(`🔍 Found ${searchResults.length} relevant chunks from: ${sources.join(', ')}`);
            } else {
                console.log('🔍 No relevant documents found');
            }
        } else {
            console.log('📄 No documents uploaded yet');
        }
        
        // Gemini'den cevap al
        const answer = await gemini.generateAnswer(message, context);
        
        // Conversation'a ekle
        const conversation = global.appState.conversations.get(currentSessionId);
        conversation.push({
            id: uuidv4(),
            message: message,
            answer: answer,
            sources: sources,
            timestamp: new Date().toISOString()
        });
        
        console.log(`✅ Generated answer (${answer.length} chars)`);
        
        res.json({
            success: true,
            answer: answer,
            sources: sources,
            sessionId: currentSessionId,
            hasDocuments: global.appState.vectorStore.length > 0
        });
        
    } catch (error) {
        console.error('❌ Chat error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Conversation history
router.get('/history/:sessionId', (req, res) => {
    try {
        const { sessionId } = req.params;
        const conversation = global.appState.conversations.get(sessionId) || [];
        res.json(conversation);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;