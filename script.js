// script.js - Complete Frontend Logic for Insurance Comparison Platform

const state = {
    uploadedFiles: [],
    isAnalyzing: false,
    currentResults: null,
    currentQuestionStep: 0,
    userPreferences: {},
    totalQuestions: 3
};

const elements = {};

document.addEventListener('DOMContentLoaded', init);

function init() {
    console.log('🚀 Insurance Comparison Platform initializing...');
    cacheElements();
    applyInitialTheme();
    setupEventListeners();
    updateQuestionnaireUI();
}

function cacheElements() {
    Object.assign(elements, {
        questionnaireView: document.getElementById('questionnaire-view'),
        uploadView: document.getElementById('upload-view'),
        resultsView: document.getElementById('results-view'),
        questionContent: document.querySelector('.question-content'),
        progressBarFill: document.querySelector('.progress-bar-fill'),
        prevBtn: document.getElementById('prev-btn'),
        nextBtn: document.getElementById('next-btn'),
        questionSteps: document.querySelectorAll('.question-step'),
        uploadBox: document.getElementById('upload-box'),
        fileInput: document.getElementById('file-input'),
        fileList: document.getElementById('file-list'),
        analyzeBtn: document.getElementById('analyze-btn'),
        loader: document.getElementById('loader'),
        resultsContent: document.getElementById('results-content'),
        backBtn: document.getElementById('back-btn'),
        copyBtn: document.getElementById('copy-btn'),
        newAnalysisBtn: document.getElementById('new-analysis-btn'),
        aiCommentary: document.getElementById('ai-commentary'),
        comparisonTable: document.getElementById('comparison-table'),
        fileCount: document.getElementById('file-count'),
        toastContainer: document.getElementById('toast-container'),
        themeToggle: document.querySelector('.theme-toggle-btn')
    });
}

function setupEventListeners() {
    elements.nextBtn.addEventListener('click', handleNextQuestion);
    elements.prevBtn.addEventListener('click', handlePrevQuestion);
    document.querySelectorAll('.options-list input').forEach(input => {
        input.addEventListener('change', () => {
            elements.nextBtn.disabled = !isCurrentStepValid();
        });
    });
    elements.fileInput.addEventListener('change', handleFileSelect);
    setupDragAndDrop();
    elements.analyzeBtn.addEventListener('click', startAnalysis);
    elements.backBtn.addEventListener('click', goBack);
    elements.newAnalysisBtn.addEventListener('click', goBack);
    elements.copyBtn.addEventListener('click', copyResults);
    setupShareButtons();
    elements.themeToggle.addEventListener('click', toggleTheme);
}

function updateQuestionnaireUI() {
    elements.questionContent.style.transform = `translateX(-${state.currentQuestionStep * 100}%)`;
    const progress = (state.currentQuestionStep / (state.totalQuestions - 1)) * 100;
    elements.progressBarFill.style.width = `${progress}%`;
    elements.prevBtn.style.visibility = state.currentQuestionStep > 0 ? 'visible' : 'hidden';
    elements.nextBtn.textContent = state.currentQuestionStep === state.totalQuestions - 1 ? 'Analize Başla' : 'İleri';
    elements.nextBtn.disabled = !isCurrentStepValid();
}

function handleNextQuestion() {
    if (!saveCurrentAnswer()) return;
    if (state.currentQuestionStep < state.totalQuestions - 1) {
        state.currentQuestionStep++;
        updateQuestionnaireUI();
    } else {
        console.log('Anket tamamlandı. Tercihler:', state.userPreferences);
        startMainApp();
    }
}

function handlePrevQuestion() {
    if (state.currentQuestionStep > 0) {
        state.currentQuestionStep--;
        updateQuestionnaireUI();
    }
}

function isCurrentStepValid() {
    const currentStepElement = elements.questionSteps[state.currentQuestionStep];
    return !!currentStepElement.querySelector('input:checked');
}

function saveCurrentAnswer() {
    if (!isCurrentStepValid()) {
        showToast('Lütfen en az bir seçim yapın.', 'warning');
        return false;
    }
    const currentStepElement = elements.questionSteps[state.currentQuestionStep];
    const inputs = currentStepElement.querySelectorAll('input');
    const key = inputs[0].name;
    const checkedInputs = Array.from(currentStepElement.querySelectorAll('input:checked'));
    if (inputs[0].type === 'radio') {
        state.userPreferences[key] = checkedInputs[0].value;
    } else {
        state.userPreferences[key] = checkedInputs.map(cb => cb.value);
    }
    return true;
}

function startMainApp() {
    elements.questionnaireView.classList.remove('active');
    elements.uploadView.classList.add('active');
    document.body.style.overflow = 'auto';
    showToast('Harika! Şimdi poliçelerinizi yükleyebilirsiniz.', 'info');
}

function applyInitialTheme() {
    const savedTheme = localStorage.getItem('theme');
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    if (savedTheme === 'light' || (!savedTheme && prefersLight)) {
        document.documentElement.classList.add('light-theme');
    }
}

function toggleTheme() {
    document.documentElement.classList.toggle('light-theme');
    localStorage.setItem('theme', document.documentElement.classList.contains('light-theme') ? 'light' : 'dark');
}

function setupDragAndDrop() {
    const box = elements.uploadBox;
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        box.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    ['dragenter', 'dragover'].forEach(eventName => box.addEventListener(eventName, () => box.classList.add('drag-over'), false));
    ['dragleave', 'drop'].forEach(eventName => box.addEventListener(eventName, () => box.classList.remove('drag-over'), false));
    box.addEventListener('drop', handleDrop, false);
}

function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }

function handleDrop(e) { handleFiles(e.dataTransfer.files); }

function handleFileSelect(e) { handleFiles(e.target.files); }

function handleFiles(files) {
    const validFiles = [];
    for (let file of files) {
        const validation = validateFile(file);
        if (!validation.valid) { showToast(validation.message, 'error'); continue; }
        if (state.uploadedFiles.some(f => f.name === file.name && f.size === file.size)) {
            showToast(`${file.name} zaten yüklendi`, 'warning'); continue;
        }
        validFiles.push(file);
    }
    if (validFiles.length > 0) {
        state.uploadedFiles.push(...validFiles);
        updateFileList();
        showToast(`${validFiles.length} dosya başarıyla eklendi`, 'success');
    }
}

function validateFile(file) {
    if (!file.type.includes('pdf')) return { valid: false, message: `❌ ${file.name} PDF dosyası değil` };
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) return { valid: false, message: `❌ ${file.name} çok büyük (max 50MB)` };
    return { valid: true };
}

function updateFileList() {
    elements.fileList.innerHTML = state.uploadedFiles.length === 0
        ? '<p class="no-files">Henüz dosya yüklenmedi</p>'
        : state.uploadedFiles.map((file, index) => createFileItemHTML(file, index)).join('');
    document.querySelectorAll('.file-remove').forEach(button => {
        button.addEventListener('click', (e) => removeFile(parseInt(e.currentTarget.dataset.index, 10)));
    });
    updateAnalyzeButton();
}

function createFileItemHTML(file, index) {
    return `
        <div class="file-item" title="${file.name}">
            <span class="file-icon">📄</span>
            <div class="file-info">
                <div class="file-name">${truncateFileName(file.name, 30)}</div>
                <div class="file-size">${formatFileSize(file.size)}</div>
            </div>
            <button class="file-remove" data-index="${index}" title="Dosyayı Kaldır">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
        </div>`;
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
    btn.disabled = fileCount < 2;
    btnText.textContent = fileCount < 2 
        ? (fileCount === 0 ? 'En Az 2 Poliçe Yükleyin' : 'En Az 1 Poliçe Daha Yükleyin') 
        : `${fileCount} Poliçeyi Karşılaştır`;
}

async function startAnalysis() {
    if (state.uploadedFiles.length < 2 || state.isAnalyzing) return;
    state.isAnalyzing = true;
    showResultsView();
    showLoader();
    const formData = new FormData();
    state.uploadedFiles.forEach(file => formData.append('files', file));
    formData.append('preferences', JSON.stringify(state.userPreferences));
    console.log('Sending preferences to AI:', state.userPreferences);
    try {
        const response = await fetch('/api/analyze', { method: 'POST', body: formData });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Analiz başarısız oldu');
        }
        const data = await response.json();
        state.currentResults = data;
        hideLoader();
        showResults(data);
        showToast('🎯 Analiz başarıyla tamamlandı!', 'success');
    } catch (error) {
        console.error('❌ Analysis error:', error);
        hideLoader();
        let errorMessage = 'Analiz sırasında bir hata oluştu. Lütfen tekrar deneyin.';
        if (error.message.includes('429') || error.message.includes('rate limit')) {
            errorMessage = 'Servis yoğun (API kullanım limiti aşıldı). Lütfen birkaç dakika bekleyip tekrar deneyin.';
        } else if (error.message) { errorMessage = error.message; }
        showToast(`❌ ${errorMessage}`, 'error');
        setTimeout(goBack, 3000);
    } finally {
        state.isAnalyzing = false;
    }
}

function showLoader() {
    elements.loader.classList.remove('hidden');
    elements.resultsContent.classList.add('hidden');
    const progressBar = elements.loader.querySelector('.progress-bar');
    progressBar.style.width = '0%';
    setTimeout(() => { progressBar.style.width = '30%'; }, 500);
    setTimeout(() => { progressBar.style.width = '60%'; }, 2000);
    setTimeout(() => { progressBar.style.width = '90%'; }, 4000);
}

function hideLoader() {
    elements.loader.classList.add('hidden');
    elements.loader.querySelector('.progress-bar').style.width = '100%';
}

function showResults(data) {
    elements.fileCount.textContent = state.uploadedFiles.length;
    let formattedCommentary = '<p>Bu poliçeler arasında Allianz için belirtilen teminatlarda bariz bir avantaj bulunamadı veya karşılaştırma yapılamadı.</p>';
    if (data.aiCommentary && data.aiCommentary.trim() !== "") {
        const commentaryParts = data.aiCommentary.split('---').filter(part => part.trim() !== "");
        formattedCommentary = commentaryParts.map(part => {
            const lines = part.trim().split('\n').filter(line => line.trim() !== "");
            if (lines.length < 1) return '';
            const title = `<h4>${lines[0].replace('## ', '')}</h4>`;
            const content = lines.slice(1).map(line => {
                let formattedLine = line;
                // --- DEĞİŞİKLİK BURADA ---
                // Yeni, güvenli başlıkları bold yap
                formattedLine = formattedLine.replace(/Allianz'ın Avantajı:/g, "<strong>Allianz'ın Avantajı:</strong>");
                formattedLine = formattedLine.replace(/Senaryo:/g, '<strong>Senaryo:</strong>');
                return `<p>${formattedLine}</p>`;
            }).join('');
            return title + content;
        }).join('');
    }
    elements.aiCommentary.innerHTML = formattedCommentary;
    elements.comparisonTable.innerHTML = data.tableHtml || '<tbody><tr><td colspan="3">Tablo oluşturulamadı.</td></tr></tbody>';
    elements.resultsContent.classList.remove('hidden');
    elements.resultsView.scrollTop = 0;
}

function copyResults() {
    const commentary = elements.aiCommentary.innerText || 'Yorum yok';
    let tableText = '';
    const table = elements.comparisonTable;
    if (table.rows.length > 0) {
        for (let row of table.rows) tableText += Array.from(row.cells).map(cell => cell.innerText.trim()).join(' | ') + '\n';
    }
    const fullText = `🛡️ SİGORTA KARŞILAŞTIRMA ANALİZİ\n${'='.repeat(40)}\n\n🎯 UZMAN ANALİZİ VE TAVSİYE\n${'='.repeat(40)}\n${commentary}\n\n📊 DETAYLI KARŞILAŞTIRMA TABLOSU\n${'='.repeat(40)}\n${tableText}\n${'='.repeat(40)}\n📅 Analiz Tarihi: ${new Date().toLocaleDateString("tr-TR")}\n🚀 Sigorta Karşılaştırma Platformu`;
    navigator.clipboard.writeText(fullText.trim()).then(() => {
        const btn = elements.copyBtn;
        const originalText = btn.querySelector('.btn-text').textContent;
        btn.classList.add('copied');
        btn.querySelector('.btn-text').textContent = '✅ Kopyalandı!';
        setTimeout(() => { btn.classList.remove('copied'); btn.querySelector('.btn-text').textContent = originalText; }, 2000);
        showToast('📋 Analiz panoya kopyalandı!', 'success');
    }).catch(err => showToast('❌ Kopyalama başarısız oldu', 'error'));
}

function setupShareButtons() {
    document.querySelector('.share-btn.whatsapp')?.addEventListener('click', () => window.open(`https://wa.me/?text=${encodeURIComponent('Sigorta poliçe karşılaştırma analizimi tamamladım.')}`, '_blank'));
    document.querySelector('.share-btn.email')?.addEventListener('click', () => window.location.href = `mailto:?subject=${encodeURIComponent('Sigorta Karşılaştırma Analizi')}&body=${encodeURIComponent('Merhaba,\n\nSigorta poliçe karşılaştırma analizimi tamamladım.')}`);
    document.querySelector('.share-btn.telegram')?.addEventListener('click', () => window.open(`https://t.me/share/url?text=${encodeURIComponent('Sigorta poliçe karşılaştırma analizimi tamamladım.')}`, '_blank'));
}

function showResultsView() {
    elements.uploadView.classList.remove('active');
    elements.resultsView.classList.add('active');
    document.body.style.overflow = 'auto';
}

function goBack() {
    elements.resultsView.classList.remove('active');
    elements.uploadView.classList.add('active');
    state.uploadedFiles = [];
    state.currentResults = null;
    elements.fileInput.value = '';
    updateFileList();
    elements.aiCommentary.innerHTML = '';
    elements.comparisonTable.innerHTML = '';
    showToast('🔄 Yeni analiz için hazır', 'info');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function truncateFileName(name, maxLength) {
    if (name.length <= maxLength) return name;
    const extIndex = name.lastIndexOf('.');
    if (extIndex === -1) return name.slice(0, maxLength - 3) + '...';
    const extension = name.slice(extIndex);
    const nameWithoutExt = name.slice(0, extIndex);
    return `${nameWithoutExt.slice(0, maxLength - extension.length - 3)}...${extension}`;
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-message">${message}</span><button class="toast-close">×</button>`;
    elements.toastContainer.appendChild(toast);
    toast.querySelector('.toast-close').addEventListener('click', () => removeToast(toast));
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => removeToast(toast), 5000);
}

function removeToast(toast) {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
}