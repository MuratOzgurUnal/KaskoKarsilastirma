// script.js - Complete Frontend Logic for Insurance Comparison Platform

// Global State
const state = {
    uploadedFiles: [],
    isAnalyzing: false,
    currentResults: null
};

// DOM Elements
const elements = {
    // Views
    uploadView: null,
    resultsView: null,
    
    // Upload elements
    uploadBox: null,
    fileInput: null,
    fileList: null,
    analyzeBtn: null,
    
    // Results elements
    loader: null,
    resultsContent: null,
    backBtn: null,
    copyBtn: null,
    newAnalysisBtn: null,
    aiCommentary: null,
    comparisonTable: null,
    fileCount: null,
    
    // Toast container
    toastContainer: null
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);

function init() {
    console.log('🚀 Insurance Comparison Platform initializing...');
    
    // Cache DOM elements
    cacheElements();
    
    // Setup event listeners
    setupEventListeners();
    
    // Show welcome toast
    showToast('Hoş geldiniz! Poliçelerinizi yükleyerek başlayın.', 'info');
    
    console.log('✅ Platform ready!');
}

function cacheElements() {
    // Views
    elements.uploadView = document.getElementById('upload-view');
    elements.resultsView = document.getElementById('results-view');
    
    // Upload elements
    elements.uploadBox = document.getElementById('upload-box');
    elements.fileInput = document.getElementById('file-input');
    elements.fileList = document.getElementById('file-list');
    elements.analyzeBtn = document.getElementById('analyze-btn');
    
    // Results elements
    elements.loader = document.getElementById('loader');
    elements.resultsContent = document.getElementById('results-content');
    elements.backBtn = document.getElementById('back-btn');
    elements.copyBtn = document.getElementById('copy-btn');
    elements.newAnalysisBtn = document.getElementById('new-analysis-btn');
    elements.aiCommentary = document.getElementById('ai-commentary');
    elements.comparisonTable = document.getElementById('comparison-table');
    elements.fileCount = document.getElementById('file-count');
    
    // Toast container
    elements.toastContainer = document.getElementById('toast-container');
}

function setupEventListeners() {
    // File upload events
    elements.fileInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop events
    setupDragAndDrop();
    
    // Button events
    elements.analyzeBtn.addEventListener('click', startAnalysis);
    elements.backBtn.addEventListener('click', goBack);
    elements.newAnalysisBtn.addEventListener('click', goBack);
    elements.copyBtn.addEventListener('click', copyResults);
    
    // Share button events
    setupShareButtons();
}

// ============= FILE UPLOAD FUNCTIONALITY =============

function setupDragAndDrop() {
    const box = elements.uploadBox;
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        box.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    // Highlight drop area when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        box.addEventListener(eventName, () => box.classList.add('drag-over'), false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        box.addEventListener(eventName, () => box.classList.remove('drag-over'), false);
    });
    
    // Handle dropped files
    box.addEventListener('drop', handleDrop, false);
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
}

function handleFileSelect(e) {
    const files = e.target.files;
    handleFiles(files);
}

function handleFiles(files) {
    const validFiles = [];
    
    for (let file of files) {
        // Validate file
        const validation = validateFile(file);
        
        if (!validation.valid) {
            showToast(validation.message, 'error');
            continue;
        }
        
        // Check for duplicates
        if (state.uploadedFiles.some(f => f.name === file.name)) {
            showToast(`${file.name} zaten yüklendi`, 'warning');
            continue;
        }
        
        validFiles.push(file);
    }
    
    if (validFiles.length > 0) {
        state.uploadedFiles.push(...validFiles);
        updateFileList();
        showToast(`${validFiles.length} dosya başarıyla yüklendi`, 'success');
    }
}

function validateFile(file) {
    // Check file type
    if (!file.type.includes('pdf')) {
        return {
            valid: false,
            message: `❌ ${file.name} PDF dosyası değil`
        };
    }
    
    // Check file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
        return {
            valid: false,
            message: `❌ ${file.name} çok büyük (max 50MB)`
        };
    }
    
    return { valid: true };
}

function updateFileList() {
    const list = elements.fileList;
    list.innerHTML = '';
    
    if (state.uploadedFiles.length === 0) {
        list.innerHTML = '<p class="no-files">Henüz dosya yüklenmedi</p>';
        updateAnalyzeButton();
        return;
    }
    
    state.uploadedFiles.forEach((file, index) => {
        const fileItem = createFileItem(file, index);
        list.appendChild(fileItem);
    });
    
    updateAnalyzeButton();
}

function createFileItem(file, index) {
    const div = document.createElement('div');
    div.className = 'file-item';
    div.innerHTML = `
        <div class="file-icon">📄</div>
        <div class="file-info">
            <div class="file-name">${truncateFileName(file.name, 30)}</div>
            <div class="file-size">${formatFileSize(file.size)}</div>
        </div>
        <button class="file-remove" data-index="${index}" title="Dosyayı Kaldır">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </button>
    `;
    
    // Add remove event
    div.querySelector('.file-remove').addEventListener('click', () => removeFile(index));
    
    return div;
}

function removeFile(index) {
    const fileName = state.uploadedFiles[index].name;
    state.uploadedFiles.splice(index, 1);
    updateFileList();
    showToast(`${truncateFileName(fileName, 20)} kaldırıldı`, 'info');
}

function updateAnalyzeButton() {
    const btn = elements.analyzeBtn;
    const btnText = btn.querySelector('.btn-text');
    const fileCount = state.uploadedFiles.length;
    
    if (fileCount < 2) {
        btn.disabled = true;
        btnText.textContent = fileCount === 0 
            ? 'En Az 2 Poliçe Yükleyin' 
            : 'En Az 1 Poliçe Daha Yükleyin';
    } else {
        btn.disabled = false;
        btnText.textContent = `${fileCount} Poliçeyi Karşılaştır`;
    }
}

// ============= ANALYSIS FUNCTIONALITY =============

async function startAnalysis() {
    if (state.uploadedFiles.length < 2) {
        showToast('En az 2 poliçe yüklemelisiniz!', 'error');
        return;
    }
    
    if (state.isAnalyzing) {
        showToast('Analiz devam ediyor, lütfen bekleyin...', 'warning');
        return;
    }
    
    state.isAnalyzing = true;
    
    // Switch to results view
    showResultsView();
    
    // Show loader
    showLoader();
    
    // Prepare form data
    const formData = new FormData();
    state.uploadedFiles.forEach(file => {
        formData.append('files', file);
    });
    
    try {
        console.log('📤 Sending files for analysis...');
        
        const response = await fetch('/api/analyze', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Analiz başarısız oldu');
        }
        
        const data = await response.json();
        console.log('✅ Analysis complete:', data);
        
        state.currentResults = data;
        
        // Hide loader and show results
        hideLoader();
        showResults(data);
        
        showToast('🎯 Analiz başarıyla tamamlandı!', 'success');
        
    } catch (error) {
        console.error('❌ Analysis error:', error);
        
        hideLoader();
        
        // Show error message
        let errorMessage = 'Analiz sırasında bir hata oluştu.';
        
        if (error.message.includes('rate_limit')) {
            errorMessage = 'API kullanım limiti aşıldı. Lütfen birkaç dakika bekleyin.';
        } else if (error.message.includes('quota')) {
            errorMessage = 'API kotası doldu. Lütfen yöneticiyle iletişime geçin.';
        } else if (error.message.includes('timeout')) {
            errorMessage = 'İşlem zaman aşımına uğradı. Daha küçük dosyalar deneyin.';
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        showToast(`❌ ${errorMessage}`, 'error');
        
        // Go back after 3 seconds
        setTimeout(goBack, 3000);
        
    } finally {
        state.isAnalyzing = false;
    }
}

function showLoader() {
    elements.loader.classList.remove('hidden');
    elements.resultsContent.classList.add('hidden');
    
    // Animate progress bar
    const progressBar = elements.loader.querySelector('.progress-bar');
    progressBar.style.width = '0%';
    
    setTimeout(() => {
        progressBar.style.width = '30%';
    }, 500);
    
    setTimeout(() => {
        progressBar.style.width = '60%';
    }, 2000);
    
    setTimeout(() => {
        progressBar.style.width = '90%';
    }, 4000);
}

function hideLoader() {
    elements.loader.classList.add('hidden');
    
    // Complete progress bar
    const progressBar = elements.loader.querySelector('.progress-bar');
    progressBar.style.width = '100%';
}

function showResults(data) {
    // Update file count
    elements.fileCount.textContent = state.uploadedFiles.length;
    
    // Display AI commentary
    displayCommentary(data.aiCommentary);
    
    // Display comparison table
    displayTable(data.tableHtml);
    
    // Show results content
    elements.resultsContent.classList.remove('hidden');
    
    // Scroll to top
    elements.resultsView.scrollTop = 0;
}

function displayCommentary(commentary) {
    if (!commentary) {
        elements.aiCommentary.innerHTML = '<p>Yorum oluşturulamadı.</p>';
        return;
    }
    
    // Format commentary with proper paragraphs
    const formattedCommentary = commentary
        .split('\n\n')
        .map(paragraph => `<p>${paragraph.trim()}</p>`)
        .join('');
    
    elements.aiCommentary.innerHTML = formattedCommentary;
    
    // Add animation
    elements.aiCommentary.style.opacity = '0';
    setTimeout(() => {
        elements.aiCommentary.style.opacity = '1';
    }, 100);
}

function displayTable(tableHtml) {
    if (!tableHtml) {
        elements.comparisonTable.innerHTML = `
            <tbody>
                <tr>
                    <td colspan="3" style="text-align: center; padding: 2rem;">
                        Karşılaştırma tablosu oluşturulamadı.
                    </td>
                </tr>
            </tbody>
        `;
        return;
    }
    
    elements.comparisonTable.innerHTML = tableHtml;
    
    // Add hover effects to table rows
    const rows = elements.comparisonTable.querySelectorAll('tbody tr');
    rows.forEach(row => {
        row.addEventListener('mouseenter', () => {
            row.style.background = 'rgba(59, 130, 246, 0.05)';
        });
        row.addEventListener('mouseleave', () => {
            row.style.background = '';
        });
    });
}

// ============= RESULTS ACTIONS =============

function copyResults() {
    try {
        // Get commentary text
        const commentary = elements.aiCommentary.innerText || 'Yorum yok';
        
        // Get table text
        let tableText = '';
        const table = elements.comparisonTable;
        
        if (table.rows.length > 0) {
            for (let row of table.rows) {
                const cells = Array.from(row.cells).map(cell => cell.innerText.trim());
                tableText += cells.join(' | ') + '\n';
            }
        }
        
        // Combine all text
        const fullText = `
🛡️ SİGORTA KARŞILAŞTIRMA ANALİZİ
${'='.repeat(50)}

🎯 UZMAN ANALİZİ VE TAVSİYE
${'='.repeat(50)}
${commentary}

📊 DETAYLI KARŞILAŞTIRMA TABLOSU
${'='.repeat(50)}
${tableText}

${'='.repeat(50)}
📅 Analiz Tarihi: ${new Date().toLocaleDateString('tr-TR')}
🚀 Sigorta Karşılaştırma Platformu
Created by Murat Özgür Ünal
        `.trim();
        
        // Copy to clipboard
        navigator.clipboard.writeText(fullText).then(() => {
            // Success feedback
            const btn = elements.copyBtn;
            const originalText = btn.querySelector('.btn-text').textContent;
            
            btn.classList.add('copied');
            btn.querySelector('.btn-text').textContent = '✅ Kopyalandı!';
            
            setTimeout(() => {
                btn.classList.remove('copied');
                btn.querySelector('.btn-text').textContent = originalText;
            }, 2000);
            
            showToast('📋 Analiz panoya kopyalandı!', 'success');
            
        }).catch(err => {
            console.error('Copy failed:', err);
            showToast('❌ Kopyalama başarısız oldu', 'error');
        });
        
    } catch (error) {
        console.error('Copy error:', error);
        showToast('❌ Bir hata oluştu', 'error');
    }
}

function setupShareButtons() {
    // WhatsApp share
    const whatsappBtn = document.querySelector('.share-btn.whatsapp');
    if (whatsappBtn) {
        whatsappBtn.addEventListener('click', () => {
            const text = encodeURIComponent('Sigorta poliçe karşılaştırma analizimi tamamladım. Detayları sizinle paylaşmak isterim.');
            window.open(`https://wa.me/?text=${text}`, '_blank');
        });
    }
    
    // Email share
    const emailBtn = document.querySelector('.share-btn.email');
    if (emailBtn) {
        emailBtn.addEventListener('click', () => {
            const subject = encodeURIComponent('Sigorta Karşılaştırma Analizi');
            const body = encodeURIComponent('Merhaba,\n\nSigorta poliçe karşılaştırma analizimi tamamladım. Detayları ektedir.\n\nSaygılarımla');
            window.location.href = `mailto:?subject=${subject}&body=${body}`;
        });
    }
    
    // Telegram share
    const telegramBtn = document.querySelector('.share-btn.telegram');
    if (telegramBtn) {
        telegramBtn.addEventListener('click', () => {
            const text = encodeURIComponent('Sigorta poliçe karşılaştırma analizimi tamamladım.');
            window.open(`https://t.me/share/url?text=${text}`, '_blank');
        });
    }
}

// ============= VIEW MANAGEMENT =============

function showResultsView() {
    elements.uploadView.classList.remove('active');
    elements.resultsView.classList.add('active');
}

function hideResultsView() {
    elements.resultsView.classList.remove('active');
    elements.uploadView.classList.add('active');
}

function goBack() {
    // Hide results view
    hideResultsView();
    
    // Reset state
    state.uploadedFiles = [];
    state.currentResults = null;
    
    // Clear file input
    elements.fileInput.value = '';
    
    // Update UI
    updateFileList();
    
    // Reset results
    elements.aiCommentary.innerHTML = '';
    elements.comparisonTable.innerHTML = '';
    
    showToast('🔄 Yeni analiz için hazır', 'info');
}

// ============= UTILITY FUNCTIONS =============

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function truncateFileName(name, maxLength) {
    if (name.length <= maxLength) return name;
    
    const extension = name.split('.').pop();
    const nameWithoutExt = name.slice(0, name.lastIndexOf('.'));
    const truncatedName = nameWithoutExt.slice(0, maxLength - extension.length - 4);
    
    return `${truncatedName}...${extension}`;
}

// ============= TOAST NOTIFICATIONS =============

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Add icon based on type
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close">×</button>
    `;
    
    // Add to container
    elements.toastContainer.appendChild(toast);
    
    // Add close functionality
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => removeToast(toast));
    
    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Auto remove after 5 seconds
    setTimeout(() => removeToast(toast), 5000);
}

function removeToast(toast) {
    toast.classList.remove('show');
    setTimeout(() => {
        if (toast.parentElement) {
            toast.parentElement.removeChild(toast);
        }
    }, 300);
}

// ============= ERROR HANDLING =============

window.addEventListener('error', (e) => {
    console.error('Global error:', e);
    showToast('Beklenmeyen bir hata oluştu', 'error');
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e);
    showToast('Bir işlem başarısız oldu', 'error');
});

// ============= PERFORMANCE MONITORING =============

if (window.performance) {
    window.addEventListener('load', () => {
        const perfData = window.performance.timing;
        const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
        console.log(`📊 Page load time: ${pageLoadTime}ms`);
    });
}

// ============= KEYBOARD SHORTCUTS =============

document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + O: Open file dialog
    if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        elements.fileInput.click();
    }
    
    // Escape: Go back to upload view
    if (e.key === 'Escape' && elements.resultsView.classList.contains('active')) {
        goBack();
    }
    
    // Ctrl/Cmd + C: Copy results (when in results view)
    if ((e.ctrlKey || e.metaKey) && e.key === 'c' && elements.resultsView.classList.contains('active')) {
        if (!window.getSelection().toString()) {
            e.preventDefault();
            copyResults();
        }
    }
});

// ============= RESPONSIVE HANDLING =============

let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        // Handle responsive adjustments if needed
        console.log('Window resized');
    }, 250);
});

// ============= VISIBILITY CHANGE HANDLING =============

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('Page is hidden');
    } else {
        console.log('Page is visible');
    }
});

// ============= NETWORK STATUS =============

window.addEventListener('online', () => {
    showToast('İnternet bağlantısı yeniden kuruldu', 'success');
});

window.addEventListener('offline', () => {
    showToast('İnternet bağlantısı kesildi', 'error');
});

// ============= INITIALIZATION COMPLETE =============

console.log('🎯 Insurance Comparison Platform v1.0.0');
console.log('👨‍💻 Created by Murat Özgür Ünal');
console.log('🚀 Ready for analysis!');