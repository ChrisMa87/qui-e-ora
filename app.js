document.addEventListener('DOMContentLoaded', () => {
    // Config & State
    const timeMapping = [5, 15, 30, 60, Infinity]; // slider values correspond to index 0..4
    let tasks = JSON.parse(localStorage.getItem('quiora_tasks')) || [];
    let currentContext = { isRaining: false, isNight: false };
    let currentTaskIndex = -1;
    let filteredTasks = [];

    // DOM Elements
    const viewTime = document.getElementById('view-time');
    const viewFocus = document.getElementById('view-focus');
    const viewDump = document.getElementById('view-dump');

    const btnFabDump = document.getElementById('btn-fab-dump');
    const btnCloseDump = document.getElementById('btn-close-dump');
    const dumpInput = document.getElementById('dump-input');
    const dumpTimeSlider = document.getElementById('dump-time-slider');
    const dumpTimeLabel = document.getElementById('dump-time-label');
    const dumpOutdoorToggle = document.getElementById('dump-outdoor-toggle');
    const btnSaveDump = document.getElementById('btn-save-dump');

    // Values map for the new dump slider
    const dumpTimeMapping = [5, 15, 30, 45, 60, Infinity];

    const timeSlider = document.getElementById('time-slider');
    const btnStart = document.getElementById('btn-start');

    const btnBackTime = document.getElementById('btn-back-time');
    const btnEmptyBack = document.getElementById('btn-empty-back');

    const focusContent = document.getElementById('focus-content');
    const focusEmpty = document.getElementById('focus-empty');
    const focusTitle = document.getElementById('focus-task-title');
    const focusTime = document.getElementById('focus-task-time');
    const focusTags = document.getElementById('focus-task-tags');

    const btnDone = document.getElementById('btn-done');
    const btnLater = document.getElementById('btn-later');

    const toast = document.getElementById('toast');

    // --- Initial Setup ---
    initWeatherAndTime();

    // --- View Transitions ---
    function switchView(toView) {
        [viewTime, viewFocus, viewDump].forEach(v => v.classList.remove('active'));
        toView.classList.add('active');

        // Manage FAB visibility based on view
        if (toView === viewDump || toView === viewFocus) {
            btnFabDump.classList.add('hidden');
        } else {
            btnFabDump.classList.remove('hidden');
        }
    }

    btnFabDump.addEventListener('click', () => {
        switchView(viewDump);
        setTimeout(() => dumpInput.focus(), 600); // Focus input after fade transition
    });

    btnCloseDump.addEventListener('click', () => switchView(viewTime));
    btnBackTime.addEventListener('click', () => switchView(viewTime));
    btnEmptyBack.addEventListener('click', () => switchView(viewTime));

    // --- Brain Dump Logic ---

    // Update label when slider moves
    dumpTimeSlider.addEventListener('input', (e) => {
        const valIndex = parseInt(e.target.value, 10);
        const mins = dumpTimeMapping[valIndex];
        dumpTimeLabel.textContent = mins === Infinity ? "Dauer: ∞" : `Dauer: ${mins} min`;
    });

    // Save action
    function handleSaveDump() {
        const title = dumpInput.value.trim().replace(/\s+/g, ' ');
        if (!title) return;

        const valIndex = parseInt(dumpTimeSlider.value, 10);
        const duration = dumpTimeMapping[valIndex];
        const isOutdoor = dumpOutdoorToggle.checked;

        const tags = [];
        if (isOutdoor) {
            tags.push('allaperto', 'outdoor');
        }

        const newTask = {
            id: Date.now().toString(),
            title,
            duration,
            tags
        };

        tasks.push(newTask);
        saveTasks();

        // Reset inputs
        dumpInput.value = '';
        dumpTimeSlider.value = 2; // Default 30m
        dumpTimeLabel.textContent = 'Dauer: 30 min';
        dumpOutdoorToggle.checked = false;

        showToast('Attività salvata.');
    }

    btnSaveDump.addEventListener('click', handleSaveDump);

    dumpInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            handleSaveDump();
        }
    });

    function saveTasks() {
        localStorage.setItem('quiora_tasks', JSON.stringify(tasks));
    }

    function showToast(msg) {
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    // --- Context & External Data ---
    async function initWeatherAndTime() {
        // 1. Check time: After 18:00
        const now = new Date();
        const isNight = now.getHours() >= 18 || now.getHours() < 6;
        currentContext.isNight = isNight;

        // 2. Local weather via Open-Meteo
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    try {
                        const { latitude, longitude } = position.coords;
                        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
                        const data = await res.json();

                        // WMO Weathercodes: Anything 51 or above usually includes precipitation/bad weather
                        const wmoCode = data.current_weather.weathercode;
                        const isRaining = wmoCode >= 51 && wmoCode <= 99;
                        currentContext.isRaining = isRaining;
                        console.log('Background weather check updated:', currentContext);
                    } catch (err) {
                        console.error('Failed to fetch weather from Open-Meteo:', err);
                    }
                },
                (err) => {
                    console.warn('Geolocation blocked or failed. Using defaults.', err);
                }
            );
        }
    }

    // --- Focus Mode Logic ---
    btnStart.addEventListener('click', () => {
        const selectedTimeIndex = parseInt(timeSlider.value, 10);
        const maxTime = timeMapping[selectedTimeIndex];

        // Evaluate tasks based on time capacity and weather context
        filteredTasks = tasks.filter(task => {
            // Time check: only allow tasks less than or equal to maxTime. 
            // If task has Infinity duration, it's allowed. If sliding selection is Infinity (index 4), maxTime becomes Infinity -> allowed.
            if (task.duration > maxTime && task.duration !== Infinity) return false;

            // Context check (Night or Raining -> no outdoor tasks)
            const hasOutdoorTag = task.tags.some(t => ['outdoor', 'draussen', 'fuori', 'esterno'].includes(t));
            if (hasOutdoorTag && (currentContext.isNight || currentContext.isRaining)) {
                return false;
            }
            return true;
        });

        if (filteredTasks.length === 0) {
            focusContent.classList.add('hidden');
            focusEmpty.classList.remove('hidden');
            focusEmpty.querySelector('p').textContent = 'Nessuna attività trovata per questo contesto.';
        } else {
            focusContent.classList.remove('hidden');
            focusEmpty.classList.add('hidden');
            showRandomTask();
        }

        switchView(viewFocus);
    });

    function showRandomTask() {
        if (filteredTasks.length === 0) return;

        const randomIndex = Math.floor(Math.random() * filteredTasks.length);
        const task = filteredTasks[randomIndex];
        currentTaskIndex = tasks.findIndex(t => t.id === task.id);

        focusTitle.textContent = task.title;
        focusTime.textContent = task.duration === Infinity ? '∞' : `${task.duration}m`;

        if (task.tags && task.tags.length > 0) {
            focusTags.textContent = '#' + task.tags.join(' #');
            focusTags.style.display = 'inline-block';
        } else {
            focusTags.style.display = 'none';
            focusTags.textContent = '';
        }
    }

    // Task Actions
    btnDone.addEventListener('click', () => {
        if (currentTaskIndex > -1) {
            tasks.splice(currentTaskIndex, 1);
            saveTasks();
        }
        // Fade out to main view
        switchView(viewTime);
    });

    btnLater.addEventListener('click', () => {
        if (filteredTasks.length > 1) {
            const currentId = tasks[currentTaskIndex].id;
            // Filter out the active one so you don't instantly see it again
            filteredTasks = filteredTasks.filter(t => t.id !== currentId);

            // Force an artificial UI blink effect to give feedback
            focusContent.style.opacity = '0';
            setTimeout(() => {
                showRandomTask();
                focusContent.style.opacity = '1';
            }, 300);

        } else {
            focusContent.classList.add('hidden');
            focusEmpty.classList.remove('hidden');
            focusEmpty.querySelector('p').textContent = 'Hai saltato tutte le opzioni.';
        }
    });

});
