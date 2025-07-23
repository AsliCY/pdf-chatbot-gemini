const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        
        // DEBUG: API key kontrolü
        console.log('🔍 Debug - API Key check:');
        console.log('API Key exists:', !!apiKey);
        
        if (!apiKey || apiKey.includes('your_gemini_api_key_here')) {
            throw new Error('GEMINI_API_KEY is required in .env file');
        }
        
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        
        console.log('✅ Gemini AI initialized with model: gemini-1.5-flash');
    }

    async generateAnswer(question, context = '') {
        try {
            let prompt;
            
            if (context) {
                // Bağlam varsa, döküman tabanlı cevap - dil kısıtlaması yok
                prompt = `Based on the following document content, answer the question in the same language as the question. If the answer is not in the content, say so in the appropriate language.

Document Content:
${context}

Question: ${question}

Please provide a clear and helpful answer in the same language as the question, based on the document content above. You can respond in any language that best serves the user.`;
            } else {
                // Bağlam yoksa, genel sohbet - dil kısıtlaması yok
                prompt = `You are a helpful assistant. Answer the following question in the most appropriate language for the user, typically the same language as the question:

${question}

Please respond in whatever language would be most helpful to the user.`;
            }

            const result = await this.model.generateContent(prompt);
            const response = result.response;
            const text = response.text();
            
            console.log(`✅ Generated answer for: "${question.substring(0, 50)}..."`);
            return text;
            
        } catch (error) {
            console.error('❌ Gemini error:', error);
            throw new Error(`AI service error: ${error.message}`);
        }
    }

    async testConnection() {
        try {
            const result = await this.model.generateContent('Hello');
            return true;
        } catch (error) {
            return false;
        }
    }
}

module.exports = GeminiService;