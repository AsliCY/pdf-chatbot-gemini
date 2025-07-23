const fs = require('fs').promises;
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

class DocumentProcessor {
    constructor() {
        this.chunkSize = 500; // Daha büyük chunk'lar
        console.log('✅ Document processor initialized');
    }

    async processDocument(filePath, originalName) {
        try {
            console.log(`📄 Processing: ${originalName}`);
            
            const ext = path.extname(originalName).toLowerCase();
            let text = '';

            // Dosya tipine göre text çıkar
            switch (ext) {
                case '.pdf':
                    const pdfBuffer = await fs.readFile(filePath);
                    const pdfResult = await pdfParse(pdfBuffer);
                    text = pdfResult.text;
                    break;
                    
                case '.txt':
                    text = await fs.readFile(filePath, 'utf-8');
                    break;
                    
                case '.docx':
                    const docResult = await mammoth.extractRawText({ path: filePath });
                    text = docResult.value;
                    break;
                    
                default:
                    throw new Error(`Unsupported file type: ${ext}`);
            }

            // Text temizle
            text = this.cleanText(text);
            
            if (!text || text.length < 10) {
                throw new Error('No readable content found in document');
            }

            // Chunk'lara böl
            const chunks = this.createChunks(text, originalName);
            
            console.log(`✅ Processed ${originalName}: ${chunks.length} chunks, ${text.length} chars`);
            return chunks;
            
        } catch (error) {
            console.error(`❌ Error processing ${originalName}:`, error);
            throw error;
        }
    }

    cleanText(text) {
        return text
            .replace(/\s+/g, ' ') // Çoklu boşlukları tek boşluğa çevir
            .replace(/\n{3,}/g, '\n\n') // Çok fazla satır atlamayı azalt
            .trim();
    }

    createChunks(text, filename) {
        const chunks = [];
        const words = text.split(' ');
        
        for (let i = 0; i < words.length; i += this.chunkSize) {
            const chunkWords = words.slice(i, i + this.chunkSize);
            const chunkText = chunkWords.join(' ');
            
            if (chunkText.length > 50) { // Minimum chunk size
                chunks.push({
                    content: chunkText,
                    filename: filename,
                    chunkIndex: chunks.length,
                    wordCount: chunkWords.length
                });
            }
        }
        
        return chunks;
    }
}

module.exports = DocumentProcessor;