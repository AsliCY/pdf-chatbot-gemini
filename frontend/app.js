class PDFChatbot {
    constructor() {
        this.sessionId = null;
        this.documents = [];
        this.isConnected = false;
        
        console.log('🚀 PDF Chatbot starting...');
        this.init();
    }

    init() {
        this.updateDebug('Initializing...');
        
        // Event listeners
        this.setupEventListeners();
        
        // Backend connection test
        this.checkBackend();
        
        // Load documents
        this.loadDocuments();
    }

    updateDebug(status, docs = null) {
        const statusEl = document.getElementById('debugStatus');
        const docsEl = document.getElementById('debugDocs');
        
        if (statusEl) statusEl.textContent = status;
        if (docsEl && docs !== null) docsEl.textContent = docs;
    }

    setupEventListeners() {
        // Upload area
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        
        uploadArea.addEventListener('click', () => {
            if (!this.isConnected) {
                this.showError('Backend connection failed!');
                return;
            }
            fileInput.click();
        });
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            if (this.isConnected) {
                this.handleFiles(e.dataTransfer.files);
            }
        });
        
        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });

        // Chat
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        
        sendBtn.addEventListener('click', () => this.sendMessage());
        
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // New chat
        document.getElementById('newChatBtn').addEventListener('click', () => {
            this.newChat();
        });
    }

    async checkBackend() {
        try {
            const response = await fetch('/api/health');
            if (response.ok) {
                const data = await response.json();
                this.isConnected = true;
                this.updateDebug('Connected', data.documents);
                console.log('✅ Backend connected');
            } else {
                throw new Error('Backend not responding');
            }
        } catch (error) {
            this.isConnected = false;
            this.updateDebug('Offline');
            this.showError('Backend server is not running!');
            console.error('❌ Backend connection failed:', error);
        }
    }

    async handleFiles(files) {
        if (!files || files.length === 0) return;

        console.log(`📁 Uploading ${files.length} files...`);
        
        const formData = new FormData();
        for (const file of files) {
            formData.append('files', file);
        }

        // Show progress
        this.showProgress('Uploading files...', 0);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                this.showProgress('✅ Upload completed!', 100);
                setTimeout(() => this.hideProgress(), 2000);
                
                // Reload documents
                this.loadDocuments();
                
                console.log(`✅ Uploaded ${result.results.length} files`);
            } else {
                throw new Error(result.errors?.[0]?.error || 'Upload failed');
            }
            
        } catch (error) {
            this.showProgress(`❌ Error: ${error.message}`, 0);
            setTimeout(() => this.hideProgress(), 3000);
            console.error('❌ Upload error:', error);
        }
    }

    async loadDocuments() {
        try {
            const response = await fetch('/api/upload/documents');
            if (response.ok) {
                this.documents = await response.json();
                this.renderDocuments();
                this.updateDebug(this.isConnected ? 'Connected' : 'Offline', this.documents.length);
            }
        } catch (error) {
            console.error('❌ Failed to load documents:', error);
        }
    }

    renderDocuments() {
        const container = document.getElementById('documentsList');
        const countEl = document.getElementById('docCount');
        
        countEl.textContent = `(${this.documents.length})`;
        
        if (this.documents.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">No documents uploaded yet</p>';
            return;
        }
        
        container.innerHTML = this.documents.map(doc => `
            <div class="doc-card">
                <div class="doc-info">
                    <div class="doc-name">${doc.filename}</div>
                    <div class="doc-meta">${doc.chunks} chunks • ${this.formatFileSize(doc.size)}</div>
                </div>
                <button class="delete-btn" onclick="chatbot.deleteDocument('${doc.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    }

    async deleteDocument(id) {
        if (!confirm('Are you sure you want to delete this document?')) return;
        
        try {
            const response = await fetch(`/api/upload/documents/${id}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                this.loadDocuments();
                console.log('🗑️ Document deleted');
            }
        } catch (error) {
            this.showError('Failed to delete document!');
            console.error('❌ Delete error:', error);
        }
    }

    async sendMessage() {
        const input = document.getElementById('messageInput');
        const message = input.value.trim();
        
        if (!message) return;
        if (!this.isConnected) {
            this.showError('Backend connection failed!');
            return;
        }

        console.log(`💬 Sending: "${message}"`);
        
        // Add user message
        this.addMessage('user', message);
        
        // Clear input and disable
        input.value = '';
        input.disabled = true;
        document.getElementById('sendBtn').disabled = true;
        
        // Add typing indicator
        const typingId = this.addMessage('assistant', '<span class="typing">I\'m thinking</span>');

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    message: message,
                    sessionId: this.sessionId
                })
            });

            if (!response.ok) {
                throw new Error(`Chat failed: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                // Update session ID
                this.sessionId = result.sessionId;
                
                // Remove typing indicator
                document.getElementById(typingId)?.remove();
                
                // Add assistant message
                this.addMessage('assistant', result.answer, result.sources);
                
                console.log('✅ Got response');
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            // Remove typing indicator
            document.getElementById(typingId)?.remove();
            
            // Add error message
            this.addMessage('assistant', `Error: ${error.message}`, [], true);
            console.error('❌ Chat error:', error);
        } finally {
            // Re-enable input
            input.disabled = false;
            document.getElementById('sendBtn').disabled = false;
            input.focus();
        }
    }

    addMessage(type, content, sources = [], isError = false) {
        const container = document.getElementById('chatMessages');
        const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const messageClass = type === 'user' ? 'message-user' : 'message-assistant';
        const bgColor = isError ? 'bg-red-600' : '';
        
        const sourcesHtml = sources && sources.length > 0 ? `
            <div class="message-sources">
                <i class="fas fa-file-alt"></i>
                ${sources.join(', ')}
            </div>
        ` : '';
        
        const messageHtml = `
            <div id="${messageId}" class="message">
                <div class="${messageClass} ${bgColor}">
                    ${content}
                    ${sourcesHtml}
                </div>
            </div>
        `;
        
        container.innerHTML += messageHtml;
        container.scrollTop = container.scrollHeight;
        
        return messageId;
    }

    newChat() {
        this.sessionId = null;
        const container = document.getElementById('chatMessages');
        container.innerHTML = `
            <div class="text-center text-gray-400 py-8">
                <i class="fas fa-robot text-4xl mb-3"></i>
                <p>Upload a PDF file and ask questions!</p>
                <p class="text-sm mt-1">You can ask in any language</p>
            </div>
        `;
        console.log('🆕 New chat started');
    }

    showProgress(text, percent) {
        const progress = document.getElementById('uploadProgress');
        const bar = document.getElementById('progressBar');
        const status = document.getElementById('uploadStatus');
        
        progress.classList.remove('hidden');
        bar.style.width = `${percent}%`;
        status.textContent = text;
    }

    hideProgress() {
        const progress = document.getElementById('uploadProgress');
        progress.classList.add('hidden');
    }

    showError(message) {
        // Simple alert for now
        alert(message);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
}

// Initialize when page loads
let chatbot;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        chatbot = new PDFChatbot();
    });
} else {
    chatbot = new PDFChatbot();
}