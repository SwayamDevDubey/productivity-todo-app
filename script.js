// App State
let tasks = [];
let currentMood = 'neutral';
let pomodoroTimer = null;
let timerSeconds = 1500; // 25 minutes
let isTimerRunning = false;
let isBreakTime = false;
let sessionsToday = 0;
let totalFocusTime = 0;
let screenTimeStart = Date.now();

// Load data from localStorage
function loadData() {
    const saved = localStorage.getItem('productivityTodoData');
    if (saved) {
        const data = JSON.parse(saved);
        tasks = data.tasks || [];
        sessionsToday = data.sessionsToday || 0;
        totalFocusTime = data.totalFocusTime || 0;
    }
    renderTasks();
    updateAnalytics();
    updatePomodoroStats();
}

// Save data to localStorage
function saveData() {
    const data = {
        tasks,
        sessionsToday,
        totalFocusTime,
        lastSaveDate: new Date().toDateString()
    };
    localStorage.setItem('productivityTodoData', JSON.stringify(data));
}

// Selectors
const taskInput = document.getElementById('task-input');
const addTaskBtn = document.getElementById('add-task-btn');
const tasksList = document.getElementById('tasks-list');
const taskPriority = document.getElementById('task-priority');
const taskDeadline = document.getElementById('task-deadline');
const taskCategory = document.getElementById('task-category');
const moodButtons = document.querySelectorAll('.mood-btn');
const filterButtons = document.querySelectorAll('.filter-btn');
const tabButtons = document.querySelectorAll('.tab-btn');
const voiceBtn = document.getElementById('voice-btn');
const voiceModal = document.getElementById('voice-modal');
const closeVoiceModalBtn = document.getElementById('close-voice-modal');
const voiceStatus = document.getElementById('voice-status');
const loginBtn = document.getElementById('login-btn');
const settingsBtn = document.getElementById('settings-btn');

// Pomodoro elements
const timerTime = document.getElementById('timer-time');
const timerLabel = document.getElementById('timer-label');
const startTimerBtn = document.getElementById('start-timer');
const pauseTimerBtn = document.getElementById('pause-timer');
const resetTimerBtn = document.getElementById('reset-timer');
const focusDuration = document.getElementById('focus-duration');
const breakDuration = document.getElementById('break-duration');
const sessionsTodaySpan = document.getElementById('sessions-today');
const totalFocusTimeSpan = document.getElementById('total-focus-time');

// Analytics elements
const weeklyCompleted = document.getElementById('weekly-completed');
const productivityScore = document.getElementById('productivity-score');
const totalFocusSpan = document.getElementById('total-focus');

// Screen time reminder
const screenTimeReminder = document.getElementById('screen-time-reminder');
const dismissReminderBtn = document.getElementById('dismiss-reminder');

// Event Listeners
addTaskBtn.addEventListener('click', addTask);
taskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTask();
});
moodButtons.forEach(btn => btn.addEventListener('click', setMood));
filterButtons.forEach(btn => btn.addEventListener('click', filterTasks));
tabButtons.forEach(button => button.addEventListener('click', switchTab));
voiceBtn.addEventListener('click', openVoiceModal);
closeVoiceModalBtn.addEventListener('click', closeVoiceModal);
startTimerBtn.addEventListener('click', startTimer);
pauseTimerBtn.addEventListener('click', pauseTimer);
resetTimerBtn.addEventListener('click', resetTimer);
dismissReminderBtn.addEventListener('click', dismissScreenTimeReminder);

// New Google Login Event Listener
loginBtn.addEventListener('click', openLoginModal);
document.getElementById('close-login-modal').addEventListener('click', closeLoginModal);
document.getElementById('google-signin-btn').addEventListener('click', googleSignIn);

document.getElementById('settings-btn').addEventListener('click', openSettingsModal);
document.getElementById('close-settings-modal').addEventListener('click', closeSettingsModal);
document.getElementById('save-settings').addEventListener('click', saveSettings);

// Mobile and PWA Features
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;
let isScrolling = false;

// Initialize app
loadData();
loadSettings(); // Load saved settings on app start
setInterval(checkScreenTime, 60000); // Check screen time every minute
initializeMobileFeatures();
initializePWAFeatures();

// Initialize Google Identity Services when page loads
window.addEventListener('load', () => {
    if (typeof google !== 'undefined' && google.accounts) {
        google.accounts.id.initialize({
            client_id: '716800239147-s1v0ocouqmsn11k4ksqmbsb8n5lrv6g3.apps.googleusercontent.com',
            callback: handleCredentialResponse
        });
    }
});

// Task Management Functions
function addTask() {
    const taskText = taskInput.value.trim();
    if (!taskText) return;

    const task = {
        id: Date.now(),
        text: taskText,
        completed: false,
        priority: taskPriority.value,
        deadline: taskDeadline.value,
        category: taskCategory.value,
        mood: currentMood,
        createdAt: new Date(),
        comments: []
    };

    tasks.push(task);
    renderTasks();
    clearTaskForm();
    saveData();
    
    // Show smart reminder if deadline is soon
    if (task.deadline) {
        checkSmartReminders();
    }
}

function clearTaskForm() {
    taskInput.value = '';
    taskDeadline.value = '';
    taskPriority.value = 'medium';
    taskCategory.value = 'work';
}

function toggleTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        task.completed = !task.completed;
        task.completedAt = task.completed ? new Date() : null;
        renderTasks();
        updateAnalytics();
        saveData();
    }
}

function deleteTask(taskId) {
    tasks = tasks.filter(t => t.id !== taskId);
    renderTasks();
    updateAnalytics();
    saveData();
}

function renderTasks() {
    const activeFilter = document.querySelector('.filter-btn.active').dataset.filter;
    let filteredTasks = tasks;

    switch (activeFilter) {
        case 'today':
            const today = new Date().toDateString();
            filteredTasks = tasks.filter(t => 
                new Date(t.createdAt).toDateString() === today ||
                (t.deadline && new Date(t.deadline).toDateString() === today)
            );
            break;
        case 'high':
            filteredTasks = tasks.filter(t => t.priority === 'high');
            break;
        case 'completed':
            filteredTasks = tasks.filter(t => t.completed);
            break;
    }

    tasksList.innerHTML = '';
    filteredTasks.forEach(task => {
        const taskElement = createTaskElement(task);
        tasksList.appendChild(taskElement);
    });
}

function createTaskElement(task) {
    const taskDiv = document.createElement('div');
    taskDiv.className = `task-item ${task.priority}-priority ${task.completed ? 'completed' : ''}`;
    
    const deadlineText = task.deadline ? 
        `Due: ${new Date(task.deadline).toLocaleDateString()}` : 'No deadline';
    
    taskDiv.innerHTML = `
        <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} 
               onchange="toggleTask(${task.id})">
        <div class="task-content">
            <div class="task-title">${task.text}</div>
            <div class="task-meta">
                <span class="task-priority">Priority: ${task.priority}</span>
                <span class="task-deadline">${deadlineText}</span>
                <span class="task-category">Category: ${task.category}</span>
                <span class="task-mood">Mood: ${task.mood}</span>
            </div>
        </div>
        <div class="task-actions">
            <button class="task-action-btn" onclick="addComment(${task.id})" title="Add Comment">
                <i class="fas fa-comment"></i>
            </button>
            <button class="task-action-btn" onclick="deleteTask(${task.id})" title="Delete Task">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    `;
    
    return taskDiv;
}

function addComment(taskId) {
    const comment = prompt('Add a comment:');
    if (comment) {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            task.comments.push({
                text: comment,
                timestamp: new Date()
            });
            saveData();
            alert('Comment added!');
        }
    }
}

// Mood Tracking
function setMood(e) {
    moodButtons.forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    currentMood = e.target.dataset.mood;
}

// Task Filtering
function filterTasks(e) {
    filterButtons.forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    renderTasks();
}

// Tab Switching
function switchTab(e) {
    const targetTab = e.currentTarget.dataset.tab;
    
    tabButtons.forEach(button => button.classList.remove('active'));
    e.currentTarget.classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.getElementById(`${targetTab}-tab`).classList.add('active');
    
    if (targetTab === 'analytics') {
        updateAnalytics();
    }
}

// Voice Recognition
function openVoiceModal() {
    voiceModal.classList.remove('hidden');
    startVoiceRecognition();
}

function closeVoiceModal() {
    voiceModal.classList.add('hidden');
    if (window.recognition) {
        window.recognition.stop();
    }
}

// Google Login
function openLoginModal() {
    document.getElementById('login-modal').classList.remove('hidden');
}

function closeLoginModal() {
    document.getElementById('login-modal').classList.add('hidden');
}

function googleSignIn() {
    try {
        if (typeof google !== 'undefined' && google.accounts) {
            // Prompt for sign-in
            google.accounts.id.prompt((notification) => {
                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                    // If prompt doesn't show, show an alert with instructions
                    alert('Please sign in by clicking the Google sign-in button that will appear.');
                    // Render a sign-in button as fallback
                    google.accounts.id.renderButton(
                        document.getElementById('google-signin-btn'),
                        { 
                            theme: 'outline', 
                            size: 'large',
                            width: '100%',
                            text: 'signin_with'
                        }
                    );
                }
            });
        } else {
            alert('Google Sign-In is not available. Please check your internet connection and try again.');
        }
    } catch (error) {
        console.error('Google Sign-In error:', error);
        alert('Error initializing Google Sign-In. Please try refreshing the page.');
    }
}

function handleCredentialResponse(response) {
    // Decode the JWT token to get user info
    const userInfo = parseJwt(response.credential);
    console.log('User signed in:', userInfo.name);
    alert(`Welcome, ${userInfo.name}! Login Successful!`);
    closeLoginModal();
    
    // Store user info for future use
    localStorage.setItem('userInfo', JSON.stringify({
        name: userInfo.name,
        email: userInfo.email,
        picture: userInfo.picture
    }));
}

function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error('Error parsing JWT:', error);
        return {};
    }
}

// Settings
function openSettingsModal() {
    document.getElementById('settings-modal').classList.remove('hidden');
    loadSettings();
}

function closeSettingsModal() {
    document.getElementById('settings-modal').classList.add('hidden');
}

function saveSettings() {
    const settings = {
        notifications: document.getElementById('notification-enabled').checked,
        sounds: document.getElementById('sound-enabled').checked,
        theme: document.getElementById('theme-select').value,
        autoSave: document.getElementById('auto-save').checked
    };
    
    localStorage.setItem('productivitySettings', JSON.stringify(settings));
    alert('Settings saved successfully!');
    applySettings(settings);
    closeSettingsModal();
}

function loadSettings() {
    const savedSettings = localStorage.getItem('productivitySettings');
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        document.getElementById('notification-enabled').checked = settings.notifications ?? true;
        document.getElementById('sound-enabled').checked = settings.sounds ?? true;
        document.getElementById('theme-select').value = settings.theme ?? 'default';
        document.getElementById('auto-save').checked = settings.autoSave ?? true;
        applySettings(settings);
    }
}

function applySettings(settings) {
    // Apply theme
    // Remove any existing theme attributes
    document.documentElement.removeAttribute('data-theme');
    document.body.classList.remove('dark-theme', 'light-theme');
    
    // Apply the selected theme
    if (settings.theme && settings.theme !== 'default') {
        document.documentElement.setAttribute('data-theme', settings.theme);
    }
    
    // Handle legacy dark/light themes if they exist
    if (settings.theme === 'dark') {
        document.body.classList.add('dark-theme');
    } else if (settings.theme === 'light') {
        document.body.classList.add('light-theme');
    }
    
    // Store settings globally for use in other functions
    window.appSettings = settings;
}

function startVoiceRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        window.recognition = new SpeechRecognition();
        
        window.recognition.continuous = false;
        window.recognition.interimResults = false;
        window.recognition.lang = 'en-US';
        
        window.recognition.onstart = function() {
            voiceStatus.textContent = 'Listening... Speak now!';
        };
        
        window.recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            voiceStatus.textContent = `You said: "${transcript}"`;
            
            // Process voice command
            processVoiceCommand(transcript);
            
            setTimeout(() => {
                closeVoiceModal();
            }, 2000);
        };
        
        window.recognition.onerror = function(event) {
            console.error('Voice recognition error:', event.error);
            switch(event.error) {
                case 'network':
                    voiceStatus.textContent = 'Network error. Please check your connection.';
                    break;
                case 'not-allowed':
                    voiceStatus.textContent = 'Microphone access denied. Please allow microphone access.';
                    break;
                case 'no-speech':
                    voiceStatus.textContent = 'No speech detected. Please try again.';
                    break;
                default:
                    voiceStatus.textContent = 'Sorry, could not understand. Try again.';
            }
        };
        
        window.recognition.start();
    } else {
        voiceStatus.textContent = 'Voice recognition not supported in this browser. Please use Chrome, Edge, or Safari.';
    }
}

function processVoiceCommand(transcript) {
    const text = transcript.toLowerCase();
    
    if (text.includes('add task') || text.includes('remind me')) {
        const taskText = transcript.replace(/add task|remind me to?/i, '').trim();
        if (taskText) {
            taskInput.value = taskText;
            addTask();
        }
    } else if (text.includes('start timer') || text.includes('pomodoro')) {
        startTimer();
    } else if (text.includes('stop timer') || text.includes('pause timer')) {
        pauseTimer();
    } else {
        // Default: add as task
        taskInput.value = transcript;
        addTask();
    }
}

// Pomodoro Timer
function updateTimerDisplay() {
    const minutes = Math.floor(timerSeconds / 60);
    const seconds = timerSeconds % 60;
    timerTime.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function startTimer() {
    if (!isTimerRunning) {
        isTimerRunning = true;
        startTimerBtn.textContent = 'Running...';
        
        pomodoroTimer = setInterval(() => {
            timerSeconds--;
            updateTimerDisplay();
            
            if (timerSeconds <= 0) {
                clearInterval(pomodoroTimer);
                completeSession();
            }
        }, 1000);
    }
}

function pauseTimer() {
    if (isTimerRunning) {
        clearInterval(pomodoroTimer);
        isTimerRunning = false;
        startTimerBtn.textContent = 'Start';
    }
}

function resetTimer() {
    clearInterval(pomodoroTimer);
    isTimerRunning = false;
    isBreakTime = false;
    timerSeconds = parseInt(focusDuration.value) * 60;
    timerLabel.textContent = 'Focus Time';
    startTimerBtn.textContent = 'Start';
    updateTimerDisplay();
}

function completeSession() {
    isTimerRunning = false;
    
    if (!isBreakTime) {
        // Focus session completed
        sessionsToday++;
        totalFocusTime += parseInt(focusDuration.value);
        
        // Start break
        isBreakTime = true;
        timerSeconds = parseInt(breakDuration.value) * 60;
        timerLabel.textContent = 'Break Time';
        
        // Notification
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Pomodoro Complete!', {
                body: 'Time for a break! 🎉',
                icon: 'icon-192x192.png'
            });
        }
        
        startTimer(); // Auto-start break
    } else {
        // Break completed
        isBreakTime = false;
        timerSeconds = parseInt(focusDuration.value) * 60;
        timerLabel.textContent = 'Focus Time';
        
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Break Over!', {
                body: 'Ready to focus again? 💪',
                icon: 'icon-192x192.png'
            });
        }
    }
    
    startTimerBtn.textContent = 'Start';
    updateTimerDisplay();
    updatePomodoroStats();
    saveData();
}

function updatePomodoroStats() {
    sessionsTodaySpan.textContent = sessionsToday;
    totalFocusTimeSpan.textContent = totalFocusTime;
}

// Analytics
function updateAnalytics() {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const weeklyTasks = tasks.filter(t => 
        t.completedAt && new Date(t.completedAt) >= weekAgo
    );
    
    weeklyCompleted.textContent = weeklyTasks.length;
    
    // Calculate productivity score
    const totalTasks = tasks.filter(t => new Date(t.createdAt) >= weekAgo).length;
    const score = totalTasks > 0 ? Math.round((weeklyTasks.length / totalTasks) * 100) : 0;
    productivityScore.textContent = `${score}%`;
    
    const focusHours = Math.round(totalFocusTime / 60 * 10) / 10;
    totalFocusSpan.textContent = `${focusHours}h`;
    
    updateMoodChart();
    updateCategoryChart();
}

function updateMoodChart() {
    const moodCounts = {};
    tasks.forEach(task => {
        moodCounts[task.mood] = (moodCounts[task.mood] || 0) + 1;
    });
    
    const moodChart = document.getElementById('mood-chart');
    moodChart.innerHTML = Object.entries(moodCounts)
        .map(([mood, count]) => `<div>${mood}: ${count} tasks</div>`)
        .join('');
}

function updateCategoryChart() {
    const categoryCounts = {};
    tasks.forEach(task => {
        categoryCounts[task.category] = (categoryCounts[task.category] || 0) + 1;
    });
    
    const categoryChart = document.getElementById('category-chart');
    categoryChart.innerHTML = Object.entries(categoryCounts)
        .map(([category, count]) => `<div>${category}: ${count} tasks</div>`)
        .join('');
}

// Screen Time Management
function checkScreenTime() {
    const currentTime = Date.now();
    const timeSpent = (currentTime - screenTimeStart) / (1000 * 60); // minutes
    
    if (timeSpent > 30) { // Show reminder after 30 minutes
        showScreenTimeReminder();
        screenTimeStart = currentTime; // Reset timer
    }
}

function showScreenTimeReminder() {
    screenTimeReminder.classList.remove('hidden');
}

function dismissScreenTimeReminder() {
    screenTimeReminder.classList.add('hidden');
}

// Smart Reminders
function checkSmartReminders() {
    tasks.forEach(task => {
        if (task.deadline && !task.completed) {
            const deadline = new Date(task.deadline);
            const now = new Date();
            const timeDiff = deadline - now;
            const hoursDiff = timeDiff / (1000 * 60 * 60);
            
            if (hoursDiff <= 2 && hoursDiff > 0) {
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('Deadline Approaching!', {
                        body: `"${task.text}" is due soon!`,
                        icon: 'icon-192x192.png'
                    });
                }
            }
        }
    });
}

// Request notification permission
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

// Initialize timer display
updateTimerDisplay();

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('Service Worker registered with scope:', registration.scope);
        }).catch(error => {
            console.log('Service Worker registration failed:', error);
        });
    });
}

// Mobile Features
function initializeMobileFeatures() {
    // Add touch gesture support for task items
    setupTouchGestures();
    
    // Add pull-to-refresh
    setupPullToRefresh();
    
    // Detect if app is running in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
        console.log('App is running in standalone mode');
        document.body.classList.add('standalone');
    }
    
    // Handle device orientation changes
    window.addEventListener('orientationchange', handleOrientationChange);
    
    // Prevent zoom on double tap
    preventDoubleTabZoom();
    
    // Add haptic feedback for supported devices
    setupHapticFeedback();
}

function setupTouchGestures() {
    let tasksList = document.getElementById('tasks-list');
    
    tasksList.addEventListener('touchstart', handleTouchStart, { passive: false });
    tasksList.addEventListener('touchmove', handleTouchMove, { passive: false });
    tasksList.addEventListener('touchend', handleTouchEnd, { passive: false });
}

function handleTouchStart(e) {
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    isScrolling = false;
}

function handleTouchMove(e) {
    if (!touchStartX || !touchStartY) return;
    
    const touch = e.touches[0];
    const diffX = touchStartX - touch.clientX;
    const diffY = touchStartY - touch.clientY;
    
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
        isScrolling = false;
        e.preventDefault(); // Prevent scrolling when swiping horizontally
        
        const taskItem = e.target.closest('.task-item');
        if (taskItem) {
            if (diffX > 0) {
                // Swipe left - show delete indicator
                taskItem.classList.add('swipe-left');
                taskItem.classList.remove('swipe-right');
            } else {
                // Swipe right - show complete indicator
                taskItem.classList.add('swipe-right');
                taskItem.classList.remove('swipe-left');
            }
        }
    } else if (Math.abs(diffY) > 10) {
        isScrolling = true;
    }
}

function handleTouchEnd(e) {
    if (!touchStartX || !touchStartY) return;
    
    const diffX = touchStartX - touchEndX;
    const taskItem = e.target.closest('.task-item');
    
    if (taskItem && !isScrolling && Math.abs(diffX) > 100) {
        const taskId = extractTaskId(taskItem);
        
        if (diffX > 0) {
            // Swipe left completed - delete task
            if (confirm('Delete this task?')) {
                deleteTask(taskId);
                hapticFeedback('light');
            }
        } else {
            // Swipe right completed - toggle task
            toggleTask(taskId);
            hapticFeedback('light');
        }
    }
    
    // Reset swipe indicators
    if (taskItem) {
        taskItem.classList.remove('swipe-left', 'swipe-right');
    }
    
    touchStartX = 0;
    touchStartY = 0;
    touchEndX = 0;
    touchEndY = 0;
    isScrolling = false;
}

function extractTaskId(taskElement) {
    const checkbox = taskElement.querySelector('.task-checkbox');
    if (checkbox && checkbox.onchange) {
        const onchangeStr = checkbox.onchange.toString();
        const match = onchangeStr.match(/toggleTask\((\d+)\)/);
        return match ? parseInt(match[1]) : null;
    }
    return null;
}

function setupPullToRefresh() {
    let startY = 0;
    let currentY = 0;
    let isPulling = false;
    const pullThreshold = 100;
    
    const pullIndicator = document.createElement('div');
    pullIndicator.className = 'pull-to-refresh';
    pullIndicator.textContent = 'Pull to refresh';
    document.body.appendChild(pullIndicator);
    
    document.addEventListener('touchstart', (e) => {
        if (window.scrollY === 0) {
            startY = e.touches[0].clientY;
            isPulling = true;
        }
    }, { passive: true });
    
    document.addEventListener('touchmove', (e) => {
        if (!isPulling) return;
        
        currentY = e.touches[0].clientY;
        const pullDistance = currentY - startY;
        
        if (pullDistance > 0) {
            if (pullDistance > pullThreshold) {
                pullIndicator.textContent = 'Release to refresh';
                pullIndicator.classList.add('visible');
            } else {
                pullIndicator.textContent = 'Pull to refresh';
                pullIndicator.classList.remove('visible');
            }
        }
    }, { passive: true });
    
    document.addEventListener('touchend', () => {
        if (isPulling && (currentY - startY) > pullThreshold) {
            pullIndicator.textContent = 'Refreshing...';
            
            // Simulate refresh
            setTimeout(() => {
                loadData();
                pullIndicator.classList.remove('visible');
                pullIndicator.textContent = 'Pull to refresh';
                hapticFeedback('medium');
            }, 1000);
        } else {
            pullIndicator.classList.remove('visible');
        }
        
        isPulling = false;
        startY = 0;
        currentY = 0;
    });
}

function handleOrientationChange() {
    // Re-render layout after orientation change
    setTimeout(() => {
        window.scrollTo(0, 0);
        renderTasks();
    }, 100);
}

function preventDoubleTabZoom() {
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    }, false);
}

function setupHapticFeedback() {
    // Add haptic feedback to buttons
    const buttons = document.querySelectorAll('button, .tab-btn, .filter-btn, .mood-btn');
    buttons.forEach(button => {
        button.addEventListener('click', () => hapticFeedback('light'));
    });
}

function hapticFeedback(intensity = 'light') {
    if ('vibrate' in navigator) {
        switch (intensity) {
            case 'light':
                navigator.vibrate(10);
                break;
            case 'medium':
                navigator.vibrate(50);
                break;
            case 'heavy':
                navigator.vibrate([100, 30, 100]);
                break;
        }
    }
}

// PWA Features
function initializePWAFeatures() {
    // Handle install prompt
    setupInstallPrompt();
    
    // Handle app shortcuts from manifest
    handleAppShortcuts();
    
    // Network status detection
    setupNetworkDetection();
    
    // Background sync setup
    setupBackgroundSync();
}

function setupInstallPrompt() {
    let deferredPrompt;
    
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        // Show install button or banner
        showInstallBanner(deferredPrompt);
    });
    
    window.addEventListener('appinstalled', () => {
        console.log('PWA was installed');
        hideInstallBanner();
        hapticFeedback('medium');
    });
}

function showInstallBanner(deferredPrompt) {
    const installBanner = document.createElement('div');
    installBanner.id = 'install-banner';
    installBanner.innerHTML = `
        <div style="background: #6366f1; color: white; padding: 1rem; text-align: center; position: fixed; bottom: 0; left: 0; right: 0; z-index: 1000;">
            <p style="margin: 0 0 0.5rem 0;">Install this app for a better experience!</p>
            <button id="install-btn" style="background: white; color: #6366f1; border: none; padding: 0.5rem 1rem; border-radius: 5px; margin-right: 0.5rem;">Install</button>
            <button id="install-dismiss" style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 0.5rem 1rem; border-radius: 5px;">Not now</button>
        </div>
    `;
    
    document.body.appendChild(installBanner);
    
    document.getElementById('install-btn').addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to install prompt: ${outcome}`);
            deferredPrompt = null;
            hideInstallBanner();
        }
    });
    
    document.getElementById('install-dismiss').addEventListener('click', hideInstallBanner);
}

function hideInstallBanner() {
    const banner = document.getElementById('install-banner');
    if (banner) {
        banner.remove();
    }
}

function handleAppShortcuts() {
    const urlParams = new URLSearchParams(window.location.search);
    const shortcut = urlParams.get('shortcut');
    
    switch (shortcut) {
        case 'add-task':
            // Focus on task input
            setTimeout(() => {
                taskInput.focus();
                document.querySelector('[data-tab="tasks"]').click();
            }, 100);
            break;
        case 'timer':
            // Switch to timer tab
            setTimeout(() => {
                document.querySelector('[data-tab="pomodoro"]').click();
            }, 100);
            break;
    }
}

function setupNetworkDetection() {
    window.addEventListener('online', () => {
        console.log('App is online');
        showNetworkStatus('Online', 'success');
        syncOfflineData();
    });
    
    window.addEventListener('offline', () => {
        console.log('App is offline');
        showNetworkStatus('Offline - Working in offline mode', 'warning');
    });
}

function showNetworkStatus(message, type) {
    const statusBar = document.createElement('div');
    statusBar.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: ${type === 'success' ? '#10b981' : '#f59e0b'};
        color: white;
        padding: 0.5rem;
        text-align: center;
        z-index: 1001;
        transform: translateY(-100%);
        transition: transform 0.3s ease;
    `;
    statusBar.textContent = message;
    
    document.body.appendChild(statusBar);
    
    setTimeout(() => statusBar.style.transform = 'translateY(0)', 100);
    setTimeout(() => {
        statusBar.style.transform = 'translateY(-100%)';
        setTimeout(() => statusBar.remove(), 300);
    }, 3000);
}

function setupBackgroundSync() {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        // Register for background sync when adding tasks offline
        window.addEventListener('offline', () => {
            navigator.serviceWorker.ready.then(registration => {
                return registration.sync.register('background-sync');
            });
        });
    }
}

function syncOfflineData() {
    // Sync any offline data when connection is restored
    console.log('Syncing offline data...');
    // Implementation would sync with server
}
