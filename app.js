const authScreen = document.querySelector('#auth-screen');
const authForm = document.querySelector('#auth-form');
const authEmail = document.querySelector('#auth-email');
const authPassword = document.querySelector('#auth-password');
const authTitle = document.querySelector('#auth-title');
const authCopy = document.querySelector('#auth-copy');
const authSubmitButton = document.querySelector('#auth-submit-button');
const authModeButton = document.querySelector('#auth-mode-button');
const authStatus = document.querySelector('#auth-status');
const profileForm = document.querySelector('#profile-form');
const profileStatus = document.querySelector('#profile-status');
const requirementsForm = document.querySelector('#requirements-form');
const studyStatus = document.querySelector('#study-status');
const scheduleScreen = document.querySelector('#schedule-screen');
const subjectList = document.querySelector('#subject-list');
const stepLabel = document.querySelector('#step-label');
const stepDots = document.querySelectorAll('.step-dots i');
const dashboardTabs = document.querySelectorAll('[data-dashboard-tab]');
const dashboardPanels = document.querySelectorAll('[data-dashboard-step]');
const dashboardStepLabel = document.querySelector('#dashboard-step-label');
const dashboardStepProgress = document.querySelector('.dashboard-step-progress');
const dashboardStepProgressFill = document.querySelector('#dashboard-step-progress-fill');
const dashboardPreviousButton = document.querySelector('#dashboard-previous-button');
const dashboardNextButton = document.querySelector('#dashboard-next-button');
const studyFilesInput = document.querySelector('#study-files');
const fileDropZone = document.querySelector('#file-drop-zone');
const fileList = document.querySelector('#file-list');
const studyViewer = document.querySelector('#study-viewer');
const viewerTitle = document.querySelector('#viewer-title');
const viewerContent = document.querySelector('#viewer-content');
const workspaceStatus = document.querySelector('#workspace-status');
const todayTasks = document.querySelector('#today-tasks');
const upcomingExams = document.querySelector('#upcoming-exams');
const subjectProgress = document.querySelector('#subject-progress');
const weeklyChart = document.querySelector('#weekly-chart');
const completedSessions = document.querySelector('#completed-sessions');
const reminderList = document.querySelector('#reminder-list');
const resourceList = document.querySelector('#resource-list');
const dashboardResources = document.querySelector('#dashboard-resources');
const resourceSubject = document.querySelector('#resource-subject');
const fileSubject = document.querySelector('#file-subject');
const screens = [authScreen, profileForm, requirementsForm, scheduleScreen];
const dashboardSteps = [
    { id: 'overview', label: 'Overview' },
    { id: 'schedule', label: 'Study plan' },
    { id: 'progress', label: 'Progress' },
    { id: 'materials', label: 'Materials' }
];
const allowedExtensions = new Set(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'txt', 'md', 'jpg', 'jpeg', 'png']);
let authMode = 'sign-in';
let subjectCount = 0;
let profileName = '';
let studyFiles = [];
let currentUser = null;
let workspaceState = {};
let workspaceSaveQueue = Promise.resolve();
let activeStudyFileUrl = '';
let planEntries = [];
let activeDashboardStep = 0;

function setStatus(element, message = '', type = '') {
    element.textContent = message;
    element.className = `status-message${type ? ` ${type}` : ''}`;
}

function readSession() {
    return {
        ...workspaceState,
        email: currentUser?.email || '',
        materials: studyFiles
    };
}

function writeSession(data) {
    workspaceState = {
        profile: data.profile || {},
        study: data.study || {},
        completedTasks: data.completedTasks || {},
        studySessions: data.studySessions || {},
        reminders: data.reminders || [],
        resources: data.resources || []
    };
    const payload = JSON.stringify(workspaceState);
    workspaceSaveQueue = workspaceSaveQueue.catch(() => {}).then(async () => {
        const response = await fetch('/api/workspace', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: payload
        });
        const result = await readApiResponse(response);
        if (!response.ok) throw new Error(result.error || 'Could not save your study data.');
        return true;
    }).catch((error) => {
        setStatus(workspaceStatus, `Could not save your study data: ${error.message}`, 'error');
        return false;
    });
    return workspaceSaveQueue;
}

function generateId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
    }
    return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function readApiResponse(response) {
    const body = await response.text();
    if (!body.trim()) {
        throw new Error(`Planner server returned an empty response (HTTP ${response.status}). Run python server.py and open http://127.0.0.1:8000.`);
    }
    try {
        return JSON.parse(body);
    } catch {
        throw new Error(`Planner server returned an invalid response (HTTP ${response.status}). Make sure the page is served by python server.py.`);
    }
}

async function apiRequest(path, options = {}) {
    const response = await fetch(path, options);
    const result = await readApiResponse(response);
    if (!response.ok) throw new Error(result.error || `The server returned HTTP ${response.status}.`);
    return result;
}

async function loadServerWorkspace() {
    const data = await apiRequest('/api/workspace');
    currentUser = { email: data.email };
    studyFiles = Array.isArray(data.materials) ? data.materials : [];
    delete data.email;
    delete data.materials;
    workspaceState = data;
}

function showScreen(screen) {
    screens.forEach((item) => item.classList.remove('active'));
    screen.classList.add('active');
    document.body.classList.toggle('dashboard-active', screen === scheduleScreen);
    if (screen === scheduleScreen) setDashboardStep(0);
    const activeStep = screen === requirementsForm ? 1 : screen === scheduleScreen ? 2 : screen === profileForm ? 1 : 0;
    stepLabel.textContent = screen === authScreen ? 'Your account' : screen === profileForm ? 'Your profile' : screen === requirementsForm ? 'Study requirements' : 'Your study plan';
    stepDots.forEach((dot, index) => dot.classList.toggle('active', index <= activeStep));
    if (screen === authScreen) authEmail.focus();
    else if (screen === profileForm) document.querySelector('#name').focus();
    else if (screen === requirementsForm) subjectList.querySelector('input[type="text"]').focus();
}

function setDashboardStep(index) {
    activeDashboardStep = index;
    const step = dashboardSteps[index];
    dashboardTabs.forEach((tab) => {
        const isActive = tab.dataset.dashboardTab === step.id;
        tab.classList.toggle('active', isActive);
        if (isActive) tab.setAttribute('aria-current', 'step');
        else tab.removeAttribute('aria-current');
    });
    dashboardPanels.forEach((panel) => {
        panel.hidden = panel.dataset.dashboardStep !== step.id;
    });
    dashboardStepLabel.textContent = `Step ${index + 1} of ${dashboardSteps.length} · ${step.label}`;
    dashboardStepProgress.setAttribute('aria-valuenow', String(index + 1));
    dashboardStepProgressFill.style.width = `${(index + 1) / dashboardSteps.length * 100}%`;
    dashboardPreviousButton.disabled = index === 0;
    dashboardNextButton.disabled = index === dashboardSteps.length - 1;
    dashboardNextButton.textContent = index === dashboardSteps.length - 1
        ? 'Last step'
        : `Next: ${dashboardSteps[index + 1].label} →`;
}

function setAuthMode(mode) {
    authMode = mode;
    const isSignUp = mode === 'sign-up';
    authTitle.textContent = isSignUp ? 'Create your account' : 'Sign in';
    authCopy.textContent = isSignUp
        ? 'Create an account to save your profile and study work.'
        : 'Sign in to continue to your saved study plan.';
    authSubmitButton.textContent = isSignUp ? 'Create account' : 'Sign in';
    authModeButton.textContent = isSignUp ? 'Already have an account? Sign in' : 'Create an account';
    authPassword.autocomplete = isSignUp ? 'new-password' : 'current-password';
    authPassword.minLength = isSignUp ? 8 : 0;
    setStatus(authStatus);
}

function formatDateInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const today = new Date();
today.setHours(0, 0, 0, 0);
const earliestExamDate = formatDateInput(today);
const latestExamDate = new Date(today);
latestExamDate.setDate(latestExamDate.getDate() + 365);

function addSubject(subject = {}) {
    subjectCount += 1;
    const row = document.createElement('div');
    row.className = 'subject-row';
    row.dataset.subjectId = subject.id || generateId();
    row.innerHTML = `
        <div class="subject-row-head">
            <span class="subject-row-title">Subject ${subjectCount}</span>
            <button class="remove-subject" type="button" aria-label="Remove subject ${subjectCount}">Remove</button>
        </div>
        <div class="subject-fields">
            <div class="field">
                <label for="subject-name-${subjectCount}">Subject name</label>
                <input id="subject-name-${subjectCount}" type="text" maxlength="60" placeholder="e.g. Biology" required>
            </div>
            <div class="field">
                <label for="exam-date-${subjectCount}">Exam date</label>
                <input id="exam-date-${subjectCount}" type="date" min="${earliestExamDate}" max="${formatDateInput(latestExamDate)}" required>
            </div>
            <div class="field complexity-field">
                <label for="complexity-${subjectCount}">How challenging is it?</label>
                <select id="complexity-${subjectCount}" required>
                    <option value="">Choose a level</option>
                    <option value="1">1 · Comfortable</option>
                    <option value="2">2 · A little challenging</option>
                    <option value="3">3 · Moderately challenging</option>
                    <option value="4">4 · Very challenging</option>
                    <option value="5">5 · Most challenging</option>
                </select>
                <label class="priority-toggle" for="priority-${subjectCount}">
                    <input id="priority-${subjectCount}" type="checkbox">
                    High priority
                </label>
            </div>
        </div>`;
    row.querySelector('input[type="text"]').value = subject.name || '';
    row.querySelector('input[type="date"]').value = subject.examDate || '';
    row.querySelector('select').value = subject.complexity ? String(subject.complexity) : '';
    row.querySelector('input[type="checkbox"]').checked = Boolean(subject.priority);
    row.querySelector('.remove-subject').addEventListener('click', () => {
        row.remove();
        updateRemoveButtons();
    });
    subjectList.append(row);
    updateRemoveButtons();
}

function updateRemoveButtons() {
    const buttons = subjectList.querySelectorAll('.remove-subject');
    buttons.forEach((button) => {
        button.disabled = buttons.length === 1;
        button.setAttribute('aria-disabled', String(button.disabled));
    });
}

function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderStudyFiles() {
    fileList.replaceChildren();
    studyFiles.forEach((file) => {
        const item = document.createElement('li');
        item.className = 'file-item';
        const details = document.createElement('span');
        details.className = 'file-info';
        const name = document.createElement('span');
        name.className = 'file-name';
        name.textContent = file.name;
        const size = document.createElement('span');
        size.className = 'file-size';
        size.textContent = `${formatFileSize(file.size)} · ${file.subjectName || 'General'}`;
        details.append(name, size);
        const actions = document.createElement('span');
        actions.className = 'file-actions';
        const studyButton = document.createElement('button');
        studyButton.className = 'study-file';
        studyButton.type = 'button';
        studyButton.textContent = 'Study';
        studyButton.setAttribute('aria-label', `Study ${file.name}`);
        studyButton.addEventListener('click', () => openStudyFile(file));
        const removeButton = document.createElement('button');
        removeButton.className = 'remove-file';
        removeButton.type = 'button';
        removeButton.textContent = 'Remove';
        removeButton.setAttribute('aria-label', `Remove ${file.name}`);
        removeButton.addEventListener('click', () => removeStudyFile(file));
        actions.append(studyButton, removeButton);
        item.append(details, actions);
        fileList.append(item);
    });
}

function closeStudyFile() {
    if (activeStudyFileUrl) URL.revokeObjectURL(activeStudyFileUrl);
    activeStudyFileUrl = '';
    studyViewer.hidden = true;
    delete studyViewer.dataset.fileName;
    viewerContent.replaceChildren();
}

async function openStudyFile(file) {
    closeStudyFile();
    studyViewer.hidden = false;
    studyViewer.dataset.fileName = file.name;
    viewerTitle.textContent = file.name;
    viewerContent.setAttribute('aria-busy', 'true');
    try {
        const extension = file.name.split('.').pop().toLowerCase();
        const response = await fetch(`/api/materials/${encodeURIComponent(file.id)}`);
        if (!response.ok) {
            const result = await readApiResponse(response);
            throw new Error(result.error || 'Could not load this study material.');
        }
        const blob = await response.blob();
        if (['txt', 'md', 'csv'].includes(extension)) {
            const text = document.createElement('pre');
            text.textContent = await blob.text();
            viewerContent.replaceChildren(text);
        } else if (extension === 'pdf') {
            activeStudyFileUrl = URL.createObjectURL(blob);
            const preview = document.createElement('iframe');
            preview.title = `Study view of ${file.name}`;
            preview.src = activeStudyFileUrl;
            viewerContent.replaceChildren(preview);
        } else if (['jpg', 'jpeg', 'png'].includes(extension)) {
            activeStudyFileUrl = URL.createObjectURL(blob);
            const preview = document.createElement('img');
            preview.alt = file.name;
            preview.src = activeStudyFileUrl;
            viewerContent.replaceChildren(preview);
        } else {
            activeStudyFileUrl = URL.createObjectURL(blob);
            const message = document.createElement('p');
            message.className = 'viewer-message';
            message.textContent = 'This file type cannot be previewed here. Download it to open it in a compatible app.';
            const download = document.createElement('a');
            download.className = 'viewer-download';
            download.href = activeStudyFileUrl;
            download.download = file.name;
            download.textContent = `Download ${file.name}`;
            message.append(document.createElement('br'), download);
            viewerContent.replaceChildren(message);
        }
    } catch (error) {
        const message = document.createElement('p');
        message.className = 'viewer-message';
        message.textContent = `Could not open this study material: ${error.message}`;
        viewerContent.replaceChildren(message);
    } finally {
        viewerContent.removeAttribute('aria-busy');
    }
    studyViewer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function removeStudyFile(file) {
    try {
        await apiRequest(`/api/materials/${encodeURIComponent(file.id)}`, { method: 'DELETE' });
    } catch (error) {
        setStatus(workspaceStatus, `Could not remove ${file.name}: ${error.message}`, 'error');
        return;
    }
    studyFiles = studyFiles.filter((item) => item.id !== file.id);
    if (studyViewer.dataset.fileName === file.name) closeStudyFile();
    renderStudyFiles();
    renderResources(readSession());
    setStatus(workspaceStatus, `${file.name} was removed.`, 'success');
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read the selected file.'));
        reader.readAsDataURL(file);
    });
}

async function uploadStudyFiles(files) {
    const fileListToUpload = Array.from(files || []);
    for (const file of fileListToUpload) {
        const extension = file.name.split('.').pop().toLowerCase();
        if (!allowedExtensions.has(extension)) {
            setStatus(workspaceStatus, `${file.name} has an unsupported file type.`, 'error');
            continue;
        }
        if (file.size > 5 * 1024 * 1024) {
            setStatus(workspaceStatus, `${file.name} is larger than the 5 MB upload limit.`, 'error');
            continue;
        }
        try {
            const dataUrl = await readFileAsDataUrl(file);
            const saved = await apiRequest('/api/materials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                name: file.name,
                type: file.type || 'application/octet-stream',
                subjectName: fileSubject.value,
                    data: dataUrl.split(',')[1] || ''
                })
            });
            studyFiles = [saved, ...studyFiles];
            renderStudyFiles();
            renderResources(readSession());
            setStatus(workspaceStatus, `${file.name} was uploaded to your account.`, 'success');
        } catch (error) {
            setStatus(workspaceStatus, `Could not upload ${file.name}: ${error.message}`, 'error');
        }
    }
}

function buildSchedule(subjects, dailyHours) {
    const startDate = new Date(today);
    const finalExamDate = new Date(Math.max(...subjects.map((subject) => subject.examDate.getTime())));
    const dayCount = Math.round((finalExamDate - startDate) / 86400000) + 1;
    const halfHourBlocks = Math.round(dailyHours * 2);
    const scheduleList = document.querySelector('#schedule-list');
    scheduleList.replaceChildren();
    planEntries = [];

    const session = readSession();
    const completedTasks = session.completedTasks && typeof session.completedTasks === 'object' ? session.completedTasks : {};

    for (let dayIndex = 0; dayIndex < dayCount; dayIndex += 1) {
        const studyDate = new Date(startDate);
        studyDate.setDate(studyDate.getDate() + dayIndex);
        const dateKey = formatDateInput(studyDate);
        const availableSubjects = subjects.filter((subject) => subject.examDate >= studyDate);
        const allocatedBlocks = new Map(availableSubjects.map((subject) => [subject, 0]));
        for (let block = 0; block < halfHourBlocks && availableSubjects.length; block += 1) {
            let selectedSubject = availableSubjects[0];
            let highestPriority = -1;
            availableSubjects.forEach((subject) => {
                const daysUntilExam = Math.max(0, Math.round((subject.examDate - studyDate) / 86400000));
                const priority = subject.complexity * (subject.priority ? 1.5 : 1) *
                    (1 + 7 / (daysUntilExam + 1)) / (allocatedBlocks.get(subject) + 1);
                if (priority > highestPriority) {
                    highestPriority = priority;
                    selectedSubject = subject;
                }
            });
            allocatedBlocks.set(selectedSubject, allocatedBlocks.get(selectedSubject) + 1);
        }
        const entry = {
            date: dateKey,
            isExamDay: subjects.some((subject) => subject.examDate.getTime() === studyDate.getTime()),
            tasks: Array.from(allocatedBlocks, ([subject, blocks]) => ({
                subjectId: subject.id,
                subjectName: subject.name,
                hours: blocks / 2,
                priority: Boolean(subject.priority)
            })).filter((task) => task.hours > 0)
        };
        planEntries.push(entry);

        const dayRow = document.createElement('div');
        dayRow.className = `schedule-day${entry.isExamDay ? ' exam-day' : ''}`;
        const dateHeading = document.createElement('div');
        dateHeading.className = 'schedule-date';
        dateHeading.append(document.createTextNode(studyDate.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        })));
        if (dayRow.classList.contains('exam-day')) {
            const badge = document.createElement('span');
            badge.className = 'exam-badge';
            badge.textContent = 'Exam day';
            dateHeading.append(badge);
        }
        const subjectItems = document.createElement('div');
        subjectItems.className = 'schedule-subjects';
        entry.tasks.forEach((task) => {
            const item = document.createElement('span');
            item.className = 'schedule-item';
            item.textContent = `${task.subjectName} · ${task.hours} ${task.hours === 1 ? 'hr' : 'hrs'}${task.priority ? ' · High priority' : ''}`;
            subjectItems.append(item);
        });
        dayRow.append(dateHeading, subjectItems);
        scheduleList.append(dayRow);
    }
    const subjectLabel = subjects.length === 1 ? 'subject is' : 'subjects are';
    document.querySelector('#schedule-summary').textContent =
        `Your ${subjects.length} ${subjectLabel} balanced across ${dayCount} days, with extra time weighted toward difficult and high-priority subjects as exams approach.`;
    refreshDashboard(subjects, planEntries);
}

function renderEmpty(container, message) {
    const empty = document.createElement('p');
    empty.className = 'dashboard-empty';
    empty.textContent = message;
    container.replaceChildren(empty);
}

function getTaskKey(date, subjectId) {
    return `${date}:${subjectId}`;
}

function renderTaskCheckbox(container, entry, task, completedTasks) {
    const key = getTaskKey(entry.date, task.subjectId);
    const label = document.createElement('label');
    label.className = `task-row${completedTasks[key] ? ' is-complete' : ''}`;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = Boolean(completedTasks[key]);
    checkbox.setAttribute('aria-label', `Mark ${task.subjectName} study session ${completedTasks[key] ? 'incomplete' : 'complete'}`);
    const description = document.createElement('span');
    description.textContent = `${task.subjectName} · ${task.hours} ${task.hours === 1 ? 'hour' : 'hours'}${task.priority ? ' · High priority' : ''}`;
    checkbox.addEventListener('change', async () => {
        const session = readSession();
        session.completedTasks = session.completedTasks && typeof session.completedTasks === 'object' ? session.completedTasks : {};
        session.studySessions = session.studySessions && typeof session.studySessions === 'object' ? session.studySessions : {};
        if (checkbox.checked) {
            session.completedTasks[key] = true;
            session.studySessions[key] = {
                date: entry.date,
                subjectId: task.subjectId,
                subjectName: task.subjectName,
                hours: task.hours,
                completedAt: new Date().toISOString()
            };
        } else {
            delete session.completedTasks[key];
            delete session.studySessions[key];
        }
        if (!await writeSession(session)) {
            checkbox.checked = !checkbox.checked;
            return;
        }
        const savedSubjects = readSession().study?.subjects || [];
        refreshDashboard(savedSubjects.map((subject) => ({
            ...subject,
            examDate: new Date(`${subject.examDate}T00:00:00`)
        })), planEntries);
    });
    label.append(checkbox, description);
    container.append(label);
}

function refreshDashboard(subjects, entries) {
    const session = readSession();
    const completedTasks = session.completedTasks && typeof session.completedTasks === 'object' ? session.completedTasks : {};
    const sessions = Object.values(session.studySessions && typeof session.studySessions === 'object' ? session.studySessions : {});
    const todayEntry = entries.find((entry) => entry.date === formatDateInput(today));
    if (todayEntry && todayEntry.tasks.length) {
        todayTasks.replaceChildren();
        todayEntry.tasks.forEach((task) => renderTaskCheckbox(todayTasks, todayEntry, task, completedTasks));
    } else {
        renderEmpty(todayTasks, 'No study sessions planned for today.');
    }

    const upcoming = subjects
        .filter((subject) => subject.examDate >= today)
        .sort((left, right) => left.examDate - right.examDate)
        .slice(0, 4);
    if (upcoming.length) {
        upcomingExams.replaceChildren();
        upcoming.forEach((subject) => {
            const row = document.createElement('div');
            row.className = 'exam-row';
            const title = document.createElement('span');
            title.textContent = subject.name;
            const date = document.createElement('span');
            date.className = 'exam-date-label';
            date.textContent = subject.examDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            row.append(title, date);
            upcomingExams.append(row);
        });
    } else {
        renderEmpty(upcomingExams, 'No upcoming exam dates.');
    }

    subjectProgress.replaceChildren();
    subjects.forEach((subject) => {
        const plannedHours = entries.reduce((sum, entry) =>
            sum + entry.tasks.filter((task) => task.subjectId === subject.id).reduce((hours, task) => hours + task.hours, 0), 0);
        const doneHours = sessions
            .filter((item) => item.subjectId === subject.id)
            .reduce((sum, item) => sum + item.hours, 0);
        const percent = plannedHours ? Math.min(100, Math.round(doneHours / plannedHours * 100)) : 0;
        const row = document.createElement('div');
        row.className = 'progress-row';
        const label = document.createElement('div');
        label.className = 'progress-label';
        const name = document.createElement('span');
        name.textContent = `${subject.name}${subject.priority ? ' · High priority' : ''}`;
        const value = document.createElement('span');
        value.textContent = `${percent}%`;
        const track = document.createElement('div');
        track.className = 'progress-track';
        track.setAttribute('role', 'progressbar');
        track.setAttribute('aria-label', `${subject.name} completion`);
        track.setAttribute('aria-valuemin', '0');
        track.setAttribute('aria-valuemax', '100');
        track.setAttribute('aria-valuenow', String(percent));
        const fill = document.createElement('div');
        fill.className = 'progress-fill';
        fill.style.width = `${percent}%`;
        track.append(fill);
        label.append(name, value);
        row.append(label, track);
        subjectProgress.append(row);
    });

    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 6);
    const weeklySessions = sessions.filter((item) => new Date(`${item.date}T00:00:00`) >= weekStart);
    const hoursBySubject = new Map();
    weeklySessions.forEach((item) => {
        hoursBySubject.set(item.subjectName, (hoursBySubject.get(item.subjectName) || 0) + item.hours);
    });
    const weeklyHours = Array.from(hoursBySubject.values()).reduce((sum, hours) => sum + hours, 0);
    document.querySelector('#weekly-total').textContent = `${weeklyHours} hours completed in the last 7 days.`;
    weeklyChart.replaceChildren();
    if (hoursBySubject.size) {
        const maxHours = Math.max(...hoursBySubject.values());
        hoursBySubject.forEach((hours, name) => {
            const row = document.createElement('div');
            row.className = 'chart-row';
            const label = document.createElement('span');
            label.textContent = name;
            const track = document.createElement('div');
            track.className = 'chart-track';
            const bar = document.createElement('div');
            bar.className = 'chart-bar';
            bar.style.width = `${hours / maxHours * 100}%`;
            track.append(bar);
            const value = document.createElement('span');
            value.textContent = `${hours}h`;
            row.append(label, track, value);
            weeklyChart.append(row);
        });
    } else {
        renderEmpty(weeklyChart, 'Complete a study task to see your weekly subject breakdown.');
    }

    const recent = [...sessions].sort((left, right) => right.completedAt.localeCompare(left.completedAt)).slice(0, 4);
    if (recent.length) {
        completedSessions.replaceChildren();
        recent.forEach((item) => {
            const row = document.createElement('div');
            row.className = 'session-row';
            const name = document.createElement('span');
            name.textContent = item.subjectName;
            const detail = document.createElement('span');
            detail.className = 'muted-label';
            detail.textContent = `${item.hours}h · ${new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
            row.append(name, detail);
            completedSessions.append(row);
        });
    } else {
        renderEmpty(completedSessions, 'Completed sessions will appear here.');
    }
    renderReminders(session);
    renderResources(session);
    renderSubjectOptions(subjects);
}

function renderSubjectOptions(subjects) {
    [resourceSubject, fileSubject].forEach((select) => {
        const previous = select.value;
        select.replaceChildren();
        subjects.forEach((subject) => {
            const option = document.createElement('option');
            option.value = subject.name;
            option.textContent = subject.name;
            select.append(option);
        });
        if (subjects.some((subject) => subject.name === previous)) select.value = previous;
    });
}

function renderReminders(session) {
    const reminders = Array.isArray(session.reminders) ? session.reminders : [];
    reminderList.replaceChildren();
    if (!reminders.length) {
        renderEmpty(reminderList, 'No custom alerts yet.');
        return;
    }
    reminders.sort((left, right) => new Date(left.at) - new Date(right.at)).forEach((reminder) => {
        const row = document.createElement('div');
        row.className = 'reminder-row';
        const title = document.createElement('span');
        title.textContent = reminder.title;
        const date = document.createElement('span');
        date.className = 'muted-label';
        date.textContent = `${new Date(reminder.at).toLocaleString()}${reminder.notified ? ' · Alerted' : ''}`;
        const remove = document.createElement('button');
        remove.className = 'resource-remove';
        remove.type = 'button';
        remove.textContent = 'Remove';
        remove.setAttribute('aria-label', `Remove reminder ${reminder.title}`);
        remove.addEventListener('click', async () => {
            const current = readSession();
            current.reminders = (current.reminders || []).filter((item) => item.id !== reminder.id);
            if (!await writeSession(current)) return;
            renderReminders(current);
        });
        row.append(title, date, remove);
        reminderList.append(row);
    });
}

function renderResources(session) {
    const resources = Array.isArray(session.resources) ? session.resources : [];
    resourceList.replaceChildren();
    dashboardResources.replaceChildren();
    if (!resources.length) {
        renderEmpty(resourceList, 'No links saved yet.');
    } else {
        resources.forEach((resource) => {
            const row = document.createElement('div');
            row.className = 'resource-row';
            const link = document.createElement('a');
            link.href = resource.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = `${resource.subjectName} · ${resource.title}`;
            const remove = document.createElement('button');
            remove.className = 'resource-remove';
            remove.type = 'button';
            remove.textContent = 'Remove';
            remove.setAttribute('aria-label', `Remove resource ${resource.title}`);
            remove.addEventListener('click', async () => {
                const current = readSession();
                current.resources = (current.resources || []).filter((item) => item.id !== resource.id);
                if (!await writeSession(current)) return;
                renderResources(current);
            });
            row.append(link, remove);
            resourceList.append(row);
        });
    }
    const materials = Array.isArray(session.materials) ? session.materials : [];
    const materialRows = [...resources.map((resource) => ({
        label: `${resource.subjectName} · ${resource.title}`,
        url: resource.url
    })), ...materials.map((file) => ({
        label: `${file.subjectName || 'General'} · ${file.name}`,
        file
    }))];
    if (!materialRows.length) {
        renderEmpty(dashboardResources, 'Uploaded notes and saved links will show here.');
        return;
    }
    materialRows.slice(0, 6).forEach((item) => {
        const row = document.createElement('div');
        row.className = 'resource-row';
        const title = document.createElement(item.url ? 'a' : 'span');
        title.textContent = item.label;
        if (item.url) {
            title.href = item.url;
            title.target = '_blank';
            title.rel = 'noopener noreferrer';
        } else {
            title.className = 'study-file';
            title.tabIndex = 0;
            title.setAttribute('role', 'button');
            title.addEventListener('click', () => openStudyFile(item.file));
            title.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openStudyFile(item.file);
                }
            });
        }
        row.append(title);
        dashboardResources.append(row);
    });
}

async function checkDueReminders() {
    const session = readSession();
    const reminders = Array.isArray(session.reminders) ? session.reminders : [];
    const due = reminders.filter((reminder) => !reminder.notified && new Date(reminder.at).getTime() <= Date.now());
    if (!due.length) return;
    const dueIds = new Set(due.map((reminder) => reminder.id));
    session.reminders = reminders.map((reminder) => dueIds.has(reminder.id) ? { ...reminder, notified: true } : reminder);
    if (!await writeSession(session)) return;
    due.forEach((reminder) => {
        setStatus(workspaceStatus, `Reminder: ${reminder.title}`, 'success');
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Study reminder', { body: reminder.title });
        }
    });
    renderReminders(session);
}

function escapeCalendarText(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function downloadCalendar() {
    const session = readSession();
    const subjects = session.study.subjects || [];
    const events = [];
    planEntries.forEach((entry) => {
        let minuteOffset = 17 * 60;
        entry.tasks.forEach((task) => {
            const start = new Date(`${entry.date}T00:00:00`);
            start.setMinutes(minuteOffset);
            const end = new Date(start.getTime() + task.hours * 60 * 60000);
            const format = (date) => `${formatDateInput(date).replace(/-/g, '')}T${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}00`;
            events.push([
                'BEGIN:VEVENT',
                `UID:${entry.date}-${task.subjectId}@smart-ai-planner`,
                `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
                `DTSTART:${format(start)}`,
                `DTEND:${format(end)}`,
                `SUMMARY:${escapeCalendarText(`Study ${task.subjectName}`)}`,
                'END:VEVENT'
            ].join('\r\n'));
            minuteOffset += task.hours * 60;
        });
    });
    subjects.forEach((subject) => {
        const examDate = subject.examDate.replace(/-/g, '');
        const examEndDate = new Date(`${subject.examDate}T00:00:00`);
        examEndDate.setDate(examEndDate.getDate() + 1);
        const formattedExamEnd = formatDateInput(examEndDate).replace(/-/g, '');
        events.push([
            'BEGIN:VEVENT',
            `UID:${subject.id}-exam@smart-ai-planner`,
            `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
            `DTSTART;VALUE=DATE:${examDate}`,
            `DTEND;VALUE=DATE:${formattedExamEnd}`,
            `SUMMARY:${escapeCalendarText(`${subject.name} exam`)}`,
            'END:VEVENT'
        ].join('\r\n'));
    });
    const content = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Smart AI Planner//Study Calendar//EN\r\n${events.join('\r\n')}\r\nEND:VCALENDAR`;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'study-schedule.ics';
    link.click();
    URL.revokeObjectURL(url);
    setStatus(workspaceStatus, 'Calendar file downloaded. Import it into Google Calendar or another calendar app.', 'success');
}

async function shareSchedule() {
    const text = planEntries.slice(0, 7).map((entry) => {
        const tasks = entry.tasks.map((task) => `${task.subjectName} (${task.hours}h)`).join(', ') || 'No study tasks';
        return `${entry.date}: ${tasks}`;
    }).join('\n');
    const shareData = { title: 'My study schedule', text };
    try {
        if (navigator.share) {
            await navigator.share(shareData);
        } else if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            setStatus(workspaceStatus, 'The next 7 days of your schedule were copied to the clipboard.', 'success');
        } else {
            throw new Error('Sharing and clipboard access are not supported in this browser.');
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            setStatus(workspaceStatus, `Could not share the schedule: ${error.message}`, 'error');
        }
    }
}

async function saveProfileData(name, about) {
    const session = readSession();
    session.profile = { name, about };
    if (!await writeSession(session)) throw new Error('The server could not save your profile.');
    profileName = name;
    document.querySelector('#schedule-title').textContent = `${name}, your study plan is ready.`;
    document.querySelector('#profile-email').textContent = `Account: ${session.email}`;
}

async function saveStudyPlanData(subjects, dailyHours) {
    const session = readSession();
    session.study = { subjects, dailyHours };
    if (!await writeSession(session)) throw new Error('The server could not save your study plan.');
}

function loadWorkspace() {
    const session = readSession();
    const email = session.email || '';
    document.querySelector('#profile-email').textContent = email ? `Account: ${email}` : '';

    if (!session.profile || !session.profile.name) {
        showScreen(profileForm);
        return;
    }

    document.querySelector('#name').value = session.profile.name || '';
    document.querySelector('#about').value = session.profile.about || '';
    profileName = session.profile.name || '';
    document.querySelector('#schedule-title').textContent = `${profileName}, your study plan is ready.`;

    studyFiles = Array.isArray(session.materials) ? session.materials : [];
    renderStudyFiles();

    if (session.study && Array.isArray(session.study.subjects) && session.study.subjects.length) {
        subjectList.replaceChildren();
        subjectCount = 0;
        session.study.subjects = session.study.subjects.map((subject) => ({ ...subject, id: subject.id || generateId() }));
        session.study.subjects.forEach((subject) => addSubject(subject));
        document.querySelector('#daily-hours').value = session.study.dailyHours || 2;
        buildSchedule(session.study.subjects.map((subject) => ({
            ...subject,
            examDate: new Date(`${subject.examDate}T00:00:00`)
        })), Number(session.study.dailyHours || 2));
        showScreen(scheduleScreen);
        return;
    }

    if (!subjectList.children.length) addSubject();
    showScreen(requirementsForm);
}

authModeButton.addEventListener('click', () => setAuthMode(authMode === 'sign-in' ? 'sign-up' : 'sign-in'));
authForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!authForm.reportValidity()) return;

    const email = authEmail.value.trim().toLowerCase();
    const password = authPassword.value;
    if (authMode === 'sign-up' && password.length < 8) {
        setStatus(authStatus, 'Password must be at least 8 characters long.', 'error');
        return;
    }
    authSubmitButton.disabled = true;
    setStatus(authStatus, authMode === 'sign-up' ? 'Creating your account…' : 'Signing in…');
    try {
        await apiRequest(`/api/auth/${authMode === 'sign-up' ? 'register' : 'login'}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        await loadServerWorkspace();
        authPassword.value = '';
        loadWorkspace();
    } catch (error) {
        setStatus(authStatus, error.message, 'error');
    } finally {
        authSubmitButton.disabled = false;
    }
});

profileForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!profileForm.reportValidity()) return;
    const name = document.querySelector('#name').value.trim();
    const about = document.querySelector('#about').value.trim();
    setStatus(profileStatus, 'Saving your profile…');
    try {
        await saveProfileData(name, about);
        setStatus(profileStatus);
        if (!subjectList.children.length) addSubject();
        showScreen(requirementsForm);
    } catch (error) {
        setStatus(profileStatus, `Could not save your profile: ${error.message}`, 'error');
    }
});

requirementsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!requirementsForm.reportValidity()) return;
    const subjects = Array.from(subjectList.querySelectorAll('.subject-row'), (row) => ({
        id: row.dataset.subjectId,
        name: row.querySelector('input[type="text"]').value.trim(),
        examDate: row.querySelector('input[type="date"]').value,
        complexity: Number(row.querySelector('select').value),
        priority: row.querySelector('input[type="checkbox"]').checked
    }));
    const dailyHours = Number(document.querySelector('#daily-hours').value);
    setStatus(studyStatus, 'Saving your study plan…');
    try {
        await saveStudyPlanData(subjects, dailyHours);
        buildSchedule(subjects.map((subject) => ({
            ...subject,
            examDate: new Date(`${subject.examDate}T00:00:00`)
        })), dailyHours);
        setStatus(studyStatus);
        showScreen(scheduleScreen);
    } catch (error) {
        setStatus(studyStatus, `Could not save your study plan: ${error.message}`, 'error');
    }
});

document.querySelector('#add-subject-button').addEventListener('click', () => addSubject());
document.querySelector('#requirements-back-button').addEventListener('click', () => showScreen(profileForm));
document.querySelector('#edit-profile-button').addEventListener('click', () => showScreen(profileForm));
document.querySelector('#edit-requirements-button').addEventListener('click', () => showScreen(requirementsForm));
dashboardTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
        const index = dashboardSteps.findIndex((step) => step.id === tab.dataset.dashboardTab);
        if (index !== -1) setDashboardStep(index);
    });
});
dashboardPreviousButton.addEventListener('click', () => {
    if (activeDashboardStep > 0) setDashboardStep(activeDashboardStep - 1);
});
dashboardNextButton.addEventListener('click', () => {
    if (activeDashboardStep < dashboardSteps.length - 1) setDashboardStep(activeDashboardStep + 1);
});
document.querySelector('#close-viewer-button').addEventListener('click', closeStudyFile);
document.querySelector('#reminder-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const title = document.querySelector('#reminder-title').value.trim();
    const at = new Date(document.querySelector('#reminder-time').value);
    if (at.getTime() <= Date.now()) {
        setStatus(workspaceStatus, 'Choose a reminder time in the future.', 'error');
        return;
    }
    const session = readSession();
    session.reminders = Array.isArray(session.reminders) ? session.reminders : [];
    session.reminders.push({ id: generateId(), title, at: at.toISOString(), notified: false });
    if (!await writeSession(session)) return;
    form.reset();
    setStatus(workspaceStatus, `Reminder set for ${at.toLocaleString()}.`, 'success');
    renderReminders(session);
});
document.querySelector('#resource-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const urlValue = document.querySelector('#resource-url').value.trim();
    let url;
    try {
        url = new URL(urlValue);
    } catch {
        setStatus(workspaceStatus, 'Enter a valid study link.', 'error');
        return;
    }
    if (url.protocol !== 'https:') {
        setStatus(workspaceStatus, 'Study links must use HTTPS.', 'error');
        return;
    }
    const session = readSession();
    session.resources = Array.isArray(session.resources) ? session.resources : [];
    session.resources.push({
        id: generateId(),
        subjectName: resourceSubject.value,
        title: url.hostname.replace(/^www\./, ''),
        url: url.href,
        addedAt: new Date().toISOString()
    });
    if (!await writeSession(session)) return;
    form.reset();
    renderResources(session);
    setStatus(workspaceStatus, 'Study link saved.', 'success');
});
document.querySelector('#share-schedule-button').addEventListener('click', shareSchedule);
document.querySelector('#calendar-export-button').addEventListener('click', downloadCalendar);
document.querySelector('#sign-out-button').addEventListener('click', async () => {
    try {
        await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch (error) {
        setStatus(workspaceStatus, `Could not sign out: ${error.message}`, 'error');
        return;
    }
    currentUser = null;
    workspaceState = {};
    closeStudyFile();
    studyFiles = [];
    renderStudyFiles();
    document.querySelector('#name').value = '';
    document.querySelector('#about').value = '';
    subjectList.replaceChildren();
    subjectCount = 0;
    addSubject();
    showScreen(authScreen);
});
studyFilesInput.addEventListener('change', () => {
    uploadStudyFiles(studyFilesInput.files);
    studyFilesInput.value = '';
});
fileDropZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    fileDropZone.classList.add('dragging');
});
fileDropZone.addEventListener('dragleave', () => fileDropZone.classList.remove('dragging'));
fileDropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    fileDropZone.classList.remove('dragging');
    uploadStudyFiles(event.dataTransfer.files);
});

async function initialize() {
    addSubject();
    setAuthMode('sign-in');
    try {
        const auth = await apiRequest('/api/auth/session');
        if (auth.authenticated) {
            await loadServerWorkspace();
            loadWorkspace();
        } else {
            showScreen(authScreen);
        }
    } catch (error) {
        showScreen(authScreen);
        setStatus(authStatus, error.message, 'error');
    }
    window.setInterval(checkDueReminders, 15000);
}

initialize();
