/**
 * FileHandler - File Upload and Drag-and-Drop Support
 * Implements Issue #7 requirements for DynamicParameterHelper
 * 
 * Features:
 * - File upload button
 * - Drag-and-drop zone with visual feedback
 * - File type validation (.xml, .json, .txt)
 * - File size limits (10MB)
 * - Progress indication
 * - Recent files history (localStorage)
 * - Security validation
 * - Accessibility support
 * - Mobile-friendly file selection
 */

class FileHandler {
    constructor(options = {}) {
        this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
        this.allowedTypes = options.allowedTypes || ['.xml', '.json', '.txt'];
        this.enableHistory = options.enableHistory !== false;
        this.maxHistoryItems = options.maxHistoryItems || 10;
        
        // Element references
        this.dropZone = null;
        this.fileInput = null;
        this.progressContainer = null;
        this.progressBar = null;
        this.progressText = null;
        
        // Event callbacks
        this.onFileLoad = options.onFileLoad || null;
        this.onProgress = options.onProgress || null;
        this.onError = options.onError || null;
        this.onValidationError = options.onValidationError || null;
        
        // State
        this.isDragActive = false;
        this.currentFile = null;
        
        // Bind methods to preserve context
        this.handleDragEnter = this.handleDragEnter.bind(this);
        this.handleDragOver = this.handleDragOver.bind(this);
        this.handleDragLeave = this.handleDragLeave.bind(this);
        this.handleDrop = this.handleDrop.bind(this);
        this.handleFileSelect = this.handleFileSelect.bind(this);
    }
    
    /**
     * Initialize drag-drop functionality on a target element
     * @param {HTMLElement} dropZone - Element to set up as drop zone
     */
    setupDragDrop(dropZone) {
        if (!dropZone) {
            throw new Error('Drop zone element is required');
        }
        
        this.dropZone = dropZone;
        
        // Add ARIA attributes for accessibility
        dropZone.setAttribute('role', 'button');
        dropZone.setAttribute('aria-label', 'File drop zone - drag and drop files here or click to browse');
        dropZone.setAttribute('tabindex', '0');
        
        // Add CSS classes for styling
        dropZone.classList.add('file-drop-zone');
        
        // Add drag and drop event listeners
        dropZone.addEventListener('dragenter', this.handleDragEnter);
        dropZone.addEventListener('dragover', this.handleDragOver);
        dropZone.addEventListener('dragleave', this.handleDragLeave);
        dropZone.addEventListener('drop', this.handleDrop);
        
        // Add keyboard support for accessibility
        dropZone.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                this.openFileDialog();
            }
        });
        
        // Add click support for file dialog
        dropZone.addEventListener('click', () => {
            this.openFileDialog();
        });
        
        this.updateVisualFeedback('default');
    }
    
    /**
     * Set up file input element
     * @param {HTMLElement} inputElement - File input element
     */
    setupFileInput(inputElement) {
        if (!inputElement) {
            // Create hidden file input if not provided
            inputElement = document.createElement('input');
            inputElement.type = 'file';
            inputElement.style.display = 'none';
            inputElement.accept = this.allowedTypes.join(',');
            inputElement.multiple = false;
            document.body.appendChild(inputElement);
        }
        
        this.fileInput = inputElement;
        this.fileInput.accept = this.allowedTypes.join(',');
        this.fileInput.addEventListener('change', (event) => {
            if (event.target.files && event.target.files[0]) {
                this.handleFileSelect(event.target.files[0]);
            }
        });
    }
    
    /**
     * Set up progress indication elements
     * @param {HTMLElement} container - Container for progress elements
     */
    setupProgressIndicator(container) {
        if (!container) return;
        
        this.progressContainer = container;
        this.progressContainer.innerHTML = `
            <div class="file-progress-bar">
                <div class="file-progress-fill"></div>
            </div>
            <div class="file-progress-text">Ready</div>
        `;
        
        this.progressBar = container.querySelector('.file-progress-fill');
        this.progressText = container.querySelector('.file-progress-text');
        this.progressContainer.style.display = 'none';
    }
    
    /**
     * Open file dialog programmatically
     */
    openFileDialog() {
        if (!this.fileInput) {
            this.setupFileInput();
        }
        this.fileInput.click();
    }
    
    /**
     * Handle drag enter event
     * @param {DragEvent} event 
     */
    handleDragEnter(event) {
        event.preventDefault();
        event.stopPropagation();
        
        if (!this.isDragActive) {
            this.isDragActive = true;
            this.updateVisualFeedback('dragover');
        }
    }
    
    /**
     * Handle drag over event
     * @param {DragEvent} event 
     */
    handleDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Check if files are being dragged
        const hasFiles = event.dataTransfer.types.includes('Files');
        const feedbackState = hasFiles ? 'dragover-valid' : 'dragover-invalid';
        this.updateVisualFeedback(feedbackState);
    }
    
    /**
     * Handle drag leave event
     * @param {DragEvent} event 
     */
    handleDragLeave(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Only update if leaving the drop zone completely
        if (!this.dropZone.contains(event.relatedTarget)) {
            this.isDragActive = false;
            this.updateVisualFeedback('default');
        }
    }
    
    /**
     * Handle drop event
     * @param {DragEvent} event 
     */
    handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        
        this.isDragActive = false;
        this.updateVisualFeedback('default');
        
        const files = event.dataTransfer.files;
        if (files && files[0]) {
            this.handleFileSelect(files[0]);
        }
    }
    
    /**
     * Process uploaded/selected file
     * @param {File} file - File object to process
     */
    async handleFileSelect(file) {
        this.currentFile = file;
        
        try {
            // Validate file first
            this.validateFile(file);
            
            // Show progress for larger files
            const showProgress = file.size > 1024 * 1024; // 1MB
            if (showProgress) {
                this.showProgress(0);
            }
            
            // Read file content
            const content = await this.readFileContent(file);
            
            if (showProgress) {
                this.showProgress(100);
            }
            
            // Save to history
            if (this.enableHistory) {
                this.saveToHistory({
                    name: file.name,
                    size: file.size,
                    type: file.type || this.getFileTypeFromExtension(file.name),
                    lastModified: file.lastModified,
                    loadedAt: Date.now()
                });
            }
            
            // Call success callback
            if (this.onFileLoad) {
                this.onFileLoad({
                    file: file,
                    content: content,
                    metadata: {
                        name: file.name,
                        size: file.size,
                        type: file.type || this.getFileTypeFromExtension(file.name),
                        lastModified: new Date(file.lastModified),
                        loadedAt: new Date()
                    }
                });
            }
            
            // Hide progress after short delay
            if (showProgress) {
                setTimeout(() => {
                    if (this.progressContainer) {
                        this.progressContainer.style.display = 'none';
                    }
                }, 1000);
            }
            
        } catch (error) {
            this.handleError(error);
        }
    }
    
    /**
     * Validate file before processing
     * @param {File} file - File to validate
     * @returns {boolean} True if valid
     * @throws {Error} If validation fails
     */
    validateFile(file) {
        // Check if file exists
        if (!file) {
            throw new Error('No file provided');
        }
        
        // Size validation
        if (file.size > this.maxFileSize) {
            const maxSizeMB = Math.round(this.maxFileSize / 1024 / 1024);
            throw new Error(`File size (${this.formatFileSize(file.size)}) exceeds maximum limit of ${maxSizeMB}MB`);
        }
        
        // Empty file check
        if (file.size === 0) {
            throw new Error('File is empty');
        }
        
        // Name validation (check first to provide better error messages)
        if (!file.name || file.name.trim() === '') {
            throw new Error('File must have a valid name');
        }
        
        // Type validation (client-side only, not security-critical)
        const extension = this.getFileExtension(file.name);
        if (!this.allowedTypes.includes(extension)) {
            throw new Error(`File type "${extension}" not supported. Allowed types: ${this.allowedTypes.join(', ')}`);
        }
        
        // Check for suspicious file name patterns
        if (file.name.includes('..') || /[<>:"/\\|?*\x00-\x1f]/.test(file.name)) {
            throw new Error('File name contains invalid characters');
        }
        
        return true;
    }
    
    /**
     * Read file content as text
     * @param {File} file - File to read
     * @returns {Promise<string>} File content as string
     */
    readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    const content = event.target.result;
                    
                    // Basic content validation
                    if (typeof content !== 'string') {
                        throw new Error('File content is not text-readable');
                    }
                    
                    // Check for null bytes (potential security issue)
                    if (content.includes('\0')) {
                        throw new Error('File contains null bytes and may be corrupted or unsafe');
                    }
                    
                    resolve(content);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file: ' + (reader.error?.message || 'Unknown error')));
            };
            
            reader.onprogress = (event) => {
                if (event.lengthComputable && this.onProgress) {
                    const percent = Math.round((event.loaded / event.total) * 100);
                    this.onProgress(percent);
                    this.showProgress(percent);
                }
            };
            
            // Read as text with UTF-8 encoding
            reader.readAsText(file, 'UTF-8');
        });
    }
    
    /**
     * Show progress indication
     * @param {number} percent - Progress percentage (0-100)
     */
    showProgress(percent) {
        if (!this.progressContainer) return;
        
        this.progressContainer.style.display = 'block';
        
        if (this.progressBar) {
            this.progressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
        }
        
        if (this.progressText) {
            if (percent >= 100) {
                this.progressText.textContent = 'Complete!';
            } else if (percent > 0) {
                this.progressText.textContent = `Loading... ${percent}%`;
            } else {
                this.progressText.textContent = 'Starting...';
            }
        }
        
        // Call progress callback
        if (this.onProgress) {
            this.onProgress(percent);
        }
    }
    
    /**
     * Update visual feedback based on current state
     * @param {string} state - Visual state ('default', 'dragover', 'dragover-valid', 'dragover-invalid', 'error', 'success')
     */
    updateVisualFeedback(state) {
        if (!this.dropZone) return;
        
        // Remove all state classes
        const stateClasses = ['drag-default', 'drag-over', 'drag-valid', 'drag-invalid', 'drag-error', 'drag-success'];
        this.dropZone.classList.remove(...stateClasses);
        
        // Add appropriate state class
        switch (state) {
            case 'default':
                this.dropZone.classList.add('drag-default');
                this.dropZone.setAttribute('aria-label', 'File drop zone - drag and drop files here or click to browse');
                break;
            case 'dragover':
                this.dropZone.classList.add('drag-over');
                this.dropZone.setAttribute('aria-label', 'Drop files here');
                break;
            case 'dragover-valid':
                this.dropZone.classList.add('drag-valid');
                this.dropZone.setAttribute('aria-label', 'Valid files - drop to upload');
                break;
            case 'dragover-invalid':
                this.dropZone.classList.add('drag-invalid');
                this.dropZone.setAttribute('aria-label', 'Invalid file type - only XML, JSON, and TXT files are supported');
                break;
            case 'error':
                this.dropZone.classList.add('drag-error');
                break;
            case 'success':
                this.dropZone.classList.add('drag-success');
                setTimeout(() => this.updateVisualFeedback('default'), 2000);
                break;
        }
    }
    
    /**
     * Save file information to history
     * @param {Object} fileInfo - File metadata to save
     */
    saveToHistory(fileInfo) {
        if (!this.enableHistory) return;
        
        try {
            let history = this.getRecentFiles();
            
            // Remove duplicate entries (same name and size)
            history = history.filter(item => 
                !(item.name === fileInfo.name && item.size === fileInfo.size)
            );
            
            // Add new entry at the beginning
            history.unshift(fileInfo);
            
            // Limit history size
            if (history.length > this.maxHistoryItems) {
                history = history.slice(0, this.maxHistoryItems);
            }
            
            // Save to localStorage
            localStorage.setItem('fileHandler.recentFiles', JSON.stringify(history));
        } catch (error) {
            console.warn('Failed to save file to history:', error);
        }
    }
    
    /**
     * Get recent files from history
     * @returns {Array} Array of recent file information
     */
    getRecentFiles() {
        if (!this.enableHistory) return [];
        
        try {
            const historyJson = localStorage.getItem('fileHandler.recentFiles');
            return historyJson ? JSON.parse(historyJson) : [];
        } catch (error) {
            console.warn('Failed to load file history:', error);
            return [];
        }
    }
    
    /**
     * Clear file history
     */
    clearHistory() {
        try {
            localStorage.removeItem('fileHandler.recentFiles');
        } catch (error) {
            console.warn('Failed to clear file history:', error);
        }
    }
    
    /**
     * Handle errors
     * @param {Error} error - Error to handle
     */
    handleError(error) {
        console.error('FileHandler error:', error);
        
        this.updateVisualFeedback('error');
        
        if (this.progressContainer) {
            this.progressContainer.style.display = 'none';
        }
        
        if (this.onError) {
            this.onError(error);
        } else {
            // Default error handling
            alert(`File error: ${error.message}`);
        }
        
        // Reset visual state after error display
        setTimeout(() => {
            this.updateVisualFeedback('default');
        }, 3000);
    }
    
    /**
     * Get file extension from filename
     * @param {string} filename - File name
     * @returns {string} File extension (with dot)
     */
    getFileExtension(filename) {
        const lastDotIndex = filename.lastIndexOf('.');
        return lastDotIndex >= 0 ? filename.substring(lastDotIndex).toLowerCase() : '';
    }
    
    /**
     * Get file type from extension
     * @param {string} filename - File name
     * @returns {string} MIME type
     */
    getFileTypeFromExtension(filename) {
        const extension = this.getFileExtension(filename);
        const typeMap = {
            '.xml': 'application/xml',
            '.json': 'application/json',
            '.txt': 'text/plain'
        };
        return typeMap[extension] || 'text/plain';
    }
    
    /**
     * Format file size for display
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted size string
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        
        const units = ['B', 'KB', 'MB', 'GB'];
        const k = 1024;
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + units[i];
    }
    
    /**
     * Check if FileAPI is supported
     * @returns {boolean} True if supported
     */
    static isSupported() {
        return (
            typeof File !== 'undefined' &&
            typeof FileReader !== 'undefined' &&
            typeof FileList !== 'undefined' &&
            typeof Blob !== 'undefined'
        );
    }
    
    /**
     * Get current file being processed
     * @returns {File|null} Current file or null
     */
    getCurrentFile() {
        return this.currentFile;
    }
    
    /**
     * Reset the file handler state
     */
    reset() {
        this.currentFile = null;
        this.isDragActive = false;
        
        if (this.fileInput) {
            this.fileInput.value = '';
        }
        
        if (this.progressContainer) {
            this.progressContainer.style.display = 'none';
        }
        
        this.updateVisualFeedback('default');
    }
    
    /**
     * Destroy the file handler and clean up resources
     */
    destroy() {
        // Remove event listeners
        if (this.dropZone) {
            this.dropZone.removeEventListener('dragenter', this.handleDragEnter);
            this.dropZone.removeEventListener('dragover', this.handleDragOver);
            this.dropZone.removeEventListener('dragleave', this.handleDragLeave);
            this.dropZone.removeEventListener('drop', this.handleDrop);
        }
        
        // Clean up file input
        if (this.fileInput && this.fileInput.parentNode) {
            this.fileInput.parentNode.removeChild(this.fileInput);
        }
        
        // Reset references
        this.dropZone = null;
        this.fileInput = null;
        this.progressContainer = null;
        this.progressBar = null;
        this.progressText = null;
        this.currentFile = null;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileHandler;
}