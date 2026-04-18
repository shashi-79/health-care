// Initialize Icons
lucide.createIcons();

// --- Elements ---
const views = document.querySelectorAll('.view');
const backdrop = document.getElementById('backdrop');

// Chat Elements
const menuTrigger = document.getElementById('menu-trigger');
const chatMenu = document.getElementById('chat-menu');
const attachTrigger = document.getElementById('attach-trigger');
const attachSheet = document.getElementById('attach-sheet');
const messageContainer = document.getElementById('message-container');
const chatInput = document.getElementById('chat-input');

// --- Global UI Logic ---
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.innerText = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

function flashNotice(msg) {
    closeOverlays();
    showToast(msg);
}

function switchView(viewId) {
    views.forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    closeOverlays();
}

function closeOverlays() {
    chatMenu.classList.remove('active');
    attachSheet.classList.remove('active');
    backdrop.classList.add('hidden');
    // Close context menus in history
    document.querySelectorAll('.context-menu').forEach(m => m.classList.remove('active'));
}

// Backdrop click closes any open overlay
backdrop.addEventListener('click', closeOverlays);

// --- Chat Menu & Attachment Sheet ---
menuTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isActive = chatMenu.classList.contains('active');
    closeOverlays();
    if (!isActive) {
        chatMenu.classList.add('active');
        // Intentionally NOT showing backdrop to avoid impacting the rest of the screen
    }
});

// Close menus when clicking outside (since they no longer use the backdrop)
document.addEventListener('click', (e) => {
    if (chatMenu.classList.contains('active') && !chatMenu.contains(e.target) && !menuTrigger.contains(e.target)) {
        chatMenu.classList.remove('active');
    }
    if (attachSheet.classList.contains('active') && !attachSheet.contains(e.target) && !attachTrigger.contains(e.target)) {
        attachSheet.classList.remove('active');
    }
});

attachTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isActive = attachSheet.classList.contains('active');
    closeOverlays();
    if (!isActive) {
        attachSheet.classList.add('active');
        // Intentionally NOT showing backdrop to avoid impacting the rest of the screen
    }
});

// Auto-expand textarea & toggle send icon
chatInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    if(this.value.trim() === '') {
        this.style.height = '40px';
        document.getElementById('voice-send-btn').innerHTML = '<i data-lucide="mic"></i>';
    } else {
        document.getElementById('voice-send-btn').innerHTML = '<i data-lucide="send"></i>';
    }
    lucide.createIcons();
});

document.getElementById('voice-send-btn').addEventListener('click', function() {
    const text = chatInput.value.trim();
    if (text !== '') {
        appendMessage(`<div class="message patient-msg">${text}<span class="time">Just now</span></div>`);
        chatInput.value = '';
        chatInput.style.height = '40px';
        this.innerHTML = '<i data-lucide="mic"></i>';
        lucide.createIcons();
    } else {
        flashNotice('Recording Voice...');
    }
});

function appendMessage(html) {
    messageContainer.insertAdjacentHTML('beforeend', html);
    messageContainer.scrollTop = messageContainer.scrollHeight;
    lucide.createIcons();
}

function sendMockDoc() {
    closeOverlays();
    const html = `
        <div class="message patient-msg doc-message" onclick="openDocument()">
            <div class="doc-icon"><i data-lucide="file-text"></i></div>
            <div class="doc-info">
                <strong>New_Upload.pdf</strong>
                <div class="doc-meta"><span>1 Page</span> • <span>500 KB</span> • <span>PDF</span></div>
            </div>
            <span class="time">Just now</span>
        </div>
    `;
    appendMessage(html);
    showToast("Document Sent");
}

// --- Attachment Native Picker Flow ---
function handleFileSelect(e, type) {
    if (e.target.files && e.target.files.length > 0) {
        closeOverlays();
        const file = e.target.files[0];
        flashNotice(`Selected ${type}: ${file.name}`);
        
        if (type === 'Document') {
            sendMockDoc(); 
        } else {
            const html = `
                <div class="message patient-msg" style="padding:10px 14px;">
                    <div style="font-weight:600; font-size:12px; color:var(--primary); margin-bottom:4px; display:flex; align-items:center; gap:5px;">
                       <i data-lucide="upload" style="width:14px; height:14px;"></i> ${type} Uploaded
                    </div>
                    <span style="font-size:14px;">${file.name}</span>
                    <span class="time">Just now</span>
                </div>
            `;
            appendMessage(html);
        }
        e.target.value = ''; // Reset
    }
}

// --- Document Viewer Flow ---
function openDocument() { switchView('document-viewer-view'); }
function closeDocument() { switchView('chat-view'); }
function openImage(src) { showToast("Opening Image Fullscreen..."); }

// --- Header Search Flow ---
function openSearch() {
    document.querySelector('.chat-header').classList.add('show-search');
    document.getElementById('search-input').focus();
}
function closeSearch() {
    document.querySelector('.chat-header').classList.remove('show-search');
    document.getElementById('search-input').value = '';
}

// --- Calendar Flow ---
function openCalendar() { document.getElementById('calendar-view').classList.add('active'); }
function closeCalendar() { document.getElementById('calendar-view').classList.remove('active'); }

// --- Schedule Extension Flow ---
function openAddSchedule() {
    document.getElementById('add-schedule-view').classList.add('active');
}
function closeAddSchedule() {
    document.getElementById('add-schedule-view').classList.remove('active');
}
function saveSchedule() {
    closeAddSchedule();
    showToast("Schedule Saved Successfully!");
}

// --- Calling Flow ---
let callTimerLine;
let callDuration = 0;

function startCall(type) {
    document.getElementById('call-status').innerText = 'Ringing...';
    document.querySelector('.avatar-ring').classList.add('is-ringing');
    switchView('calling-view');
    // Mock answering after 3 seconds
    setTimeout(() => {
        if(document.getElementById('calling-view').classList.contains('active')) {
            answerCall();
        }
    }, 3000);
}

function answerCall() {
    document.querySelector('.avatar-ring').classList.remove('is-ringing');
    callDuration = 0;
    updateCallTimer();
    callTimerLine = setInterval(updateCallTimer, 1000);
}

function updateCallTimer() {
    callDuration++;
    const mins = Math.floor(callDuration / 60).toString().padStart(2, '0');
    const secs = (callDuration % 60).toString().padStart(2, '0');
    document.getElementById('call-status').innerText = `${mins}:${secs}`;
}

function endCall() {
    clearInterval(callTimerLine);
    switchView('chat-view');
    appendMessage(`<div class="message bot-msg" style="text-align:center; background:transparent; box-shadow:none; align-self:center; color:#666;">Call Ended • ${Math.floor(callDuration / 60)}m ${callDuration % 60}s</div>`);
}

// --- Camera Flow ---
function openCamera() {
    closeOverlays();
    switchView('camera-view');
    document.getElementById('viewfinder').classList.remove('hidden');
    document.getElementById('image-preview').classList.add('hidden');
    document.getElementById('camera-controls').classList.remove('hidden');
    document.getElementById('caption-controls').classList.add('hidden');
    document.getElementById('caption-input').value = '';
}

function captureImage() {
    document.getElementById('viewfinder').classList.add('hidden');
    document.getElementById('image-preview').classList.remove('hidden');
    document.getElementById('camera-controls').classList.add('hidden');
    document.getElementById('caption-controls').classList.remove('hidden');
}

function closeCamera() { switchView('chat-view'); }

function sendCapturedImage() {
    const caption = document.getElementById('caption-input').value;
    const captionHtml = caption ? `<p>${caption}</p>` : '';
    const imgUrl = "https://images.unsplash.com/photo-1542736667-069246bdbc6d?auto=format&fit=crop&w=400&q=80";
    
    const html = `
        <div class="message patient-msg image-message">
            <img src="${imgUrl}" alt="Captured">
            ${captionHtml}
            <span class="time">Just now</span>
        </div>
    `;
    appendMessage(html);
    closeCamera();
}

// --- Call History Flow ---
const mockHistory = [
    { id: 1, name: "John Doe", time: "10:30 AM", type: "out", avatar: "https://i.pravatar.cc/150?img=32" },
    { id: 2, name: "Dr. Smith", time: "Yesterday", type: "missed", avatar: "https://i.pravatar.cc/150?img=11" },
    { id: 3, name: "Jane Roe", time: "Monday", type: "in", avatar: "https://i.pravatar.cc/150?img=5" },
];

let isSelectionMode = false;

function showHistory() {
    populateHistory();
    setSelectionMode(false);
    switchView('call-history-view');
}

function closeHistory() { switchView('chat-view'); }

// --- Profile View Flow ---
function showProfile() {
    closeOverlays();
    switchView('profile-view');
}
function closeProfile() { switchView('chat-view'); }

// --- Media View Flow ---
function showMedia() {
    closeOverlays();
    switchView('media-view');
}
function closeMedia() { switchView('chat-view'); }

function switchMediaTab(tabName) {
    document.querySelectorAll('.media-panel').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.media-tab-btn').forEach(btn => {
        btn.style.borderBottom = '3px solid transparent';
        btn.style.color = 'rgba(255,255,255,0.7)';
    });
    
    document.getElementById('media-panel-' + tabName).style.display = 'block';
    if(window.event && window.event.currentTarget) {
        window.event.currentTarget.style.borderBottom = '3px solid white';
        window.event.currentTarget.style.color = 'white';
    }
}

function populateHistory() {
    const list = document.getElementById('history-list');
    list.innerHTML = mockHistory.map(item => `
        <div class="history-item" data-id="${item.id}" onclick="handleHistoryClick(event, this)" style="display:flex; align-items:center; padding:15px; border-bottom:1px solid var(--border); background:white;">
            <img src="${item.avatar}" style="border-radius:50%; width:48px; height:48px; object-fit:cover;">
            <div class="history-info" style="flex:1; margin-left:15px; display:flex; flex-direction:column; justify-content:center;">
                <h3 style="margin:0; font-size:16px; font-weight:500; color:${item.type === 'missed' ? 'var(--alert-red)' : 'var(--text-main)'};">${item.name}</h3>
                <div class="history-meta" style="display:flex; align-items:center; color:var(--text-muted); font-size:14px; margin-top:4px; gap:8px;">
                    ${getCallIcon(item.type)} 
                    <span>${item.time}</span>
                </div>
            </div>
            <div class="history-actions" style="margin-left:auto;">
                <button class="icon-btn" onclick="startCall('audio')" style="color:var(--primary);"><i data-lucide="phone" style="width:22px; height:22px;"></i></button>
            </div>
        </div>
    `).join('');
    list.className = 'history-list normal-mode'; // Reset mode class
    lucide.createIcons();
}

function getCallIcon(type) {
    if(type === 'in') return '<i data-lucide="arrow-down-left" class="call-in"></i>';
    if(type === 'out') return '<i data-lucide="arrow-up-right" class="call-out"></i>';
    return '<i data-lucide="phone-missed" class="call-missed"></i>';
}

function handleHistoryClick(e, element) {
    if(isSelectionMode) {
        element.classList.toggle('selected');
    }
}

function toggleContext(e, id) {
    e.stopPropagation();
    closeOverlays();
    document.getElementById(id).classList.add('active');
    backdrop.classList.remove('hidden');
}

function deleteSingleHistory(e, id) {
    e.stopPropagation();
    closeOverlays();
    const index = mockHistory.findIndex(h => h.id === id);
    if(index > -1) {
        mockHistory.splice(index, 1);
        populateHistory();
        showToast("Call log deleted");
    }
}

function toggleBulkSelect() {
    setSelectionMode(!isSelectionMode);
}

function setSelectionMode(mode) {
    isSelectionMode = mode;
    const list = document.getElementById('history-list');
    const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
    const bulkSelectBtn = document.getElementById('bulk-select-btn');
    
    if (mode) {
        list.classList.remove('normal-mode');
        list.classList.add('selection-mode');
        bulkDeleteBtn.classList.remove('hidden');
        bulkSelectBtn.style.color = 'var(--primary)';
    } else {
        list.classList.remove('selection-mode');
        list.classList.add('normal-mode');
        bulkDeleteBtn.classList.add('hidden');
        bulkSelectBtn.style.color = '';
        document.querySelectorAll('.history-item').forEach(item => item.classList.remove('selected'));
    }
}

function deleteSelectedCalls() {
    const selectedNodes = document.querySelectorAll('.history-item.selected');
    if(selectedNodes.length === 0) {
        setSelectionMode(false);
        return;
    }
    const idsToDelete = Array.from(selectedNodes).map(node => parseInt(node.getAttribute('data-id')));
    
    // Remove from mock data
    idsToDelete.forEach(id => {
       const index = mockHistory.findIndex(h => h.id === id);
       if(index > -1) mockHistory.splice(index, 1);
    });
    
    populateHistory();
    setSelectionMode(false);
    showToast(`${idsToDelete.length} item(s) deleted`);
}

// --- PWA Installation Logic ---
let deferredPrompt;
const installBtn = document.getElementById('install-app-btn');

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Update UI notify the user they can install the PWA
    if(installBtn) {
        installBtn.style.display = 'flex'; 
    }
});

function triggerInstall() {
    closeOverlays();
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            }
            deferredPrompt = null;
            if(installBtn) installBtn.style.display = 'none';
        });
    } else {
        flashNotice('App installation not supported or already installed.');
    }
}
