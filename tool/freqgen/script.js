// Audio context for tone generation
let audioContext = null;
let oscillator = null;
let gainNode = null;
let stopTimeout = null;
let stopTime = null;

// DOM elements
const frequencySlider = document.getElementById('frequency');
const frequencyInput = document.getElementById('freq-input');
const frequencyValue = document.getElementById('frequency-value');
const freqUpBtn = document.getElementById('freq-up');
const freqDownBtn = document.getElementById('freq-down');
const rangeStartInput = document.getElementById('range-start');
const rangeEndInput = document.getElementById('range-end');
const applyRangeBtn = document.getElementById('apply-range');
const volumeSlider = document.getElementById('volume');
const volumeValue = document.getElementById('volume-value');
const durationSlider = document.getElementById('duration');
const durationValue = document.getElementById('duration-value');
const waveformSelect = document.getElementById('waveform');
const playBtn = document.getElementById('play-btn');
const stopBtn = document.getElementById('stop-btn');
const refreshBtn = document.getElementById('refresh-btn');
const presetBtns = document.querySelectorAll('.preset-btn');
const statusDiv = document.getElementById('status');
const stopTimeDiv = document.getElementById('stop-time');


// Initialize event listeners
frequencySlider.addEventListener('input', updateFrequencyFromSlider);
frequencyInput.addEventListener('input', updateFrequencyFromInput);
frequencyInput.addEventListener('blur', validateFrequencyInput);
freqUpBtn.addEventListener('click', increaseFrequency);
freqDownBtn.addEventListener('click', decreaseFrequency);
rangeStartInput.addEventListener('blur', validateRangeInputs);
rangeEndInput.addEventListener('blur', validateRangeInputs);
applyRangeBtn.addEventListener('click', applyFrequencyRange);
volumeSlider.addEventListener('input', updateVolume);
durationSlider.addEventListener('input', updateDuration);


// Add event listeners for preset buttons
presetBtns.forEach(btn => {
    btn.addEventListener('click', function() {
        const frequency = parseFloat(this.getAttribute('data-freq'));
        setFrequency(frequency);
    });
});

// Button event listeners
playBtn.addEventListener('click', playTone);
stopBtn.addEventListener('click', stopTone);
refreshBtn.addEventListener('click', extendStopTime);


// Update frequency from slider
function updateFrequencyFromSlider() {
    const frequency = frequencySlider.value;
    frequencyInput.value = frequency;
    frequencyValue.textContent = `${frequency} Hz`;
    
    // Update oscillator frequency if playing
    if (oscillator && audioContext && audioContext.state === 'running') {
        oscillator.frequency.value = frequencyInput.value;
    }
}

// Update frequency from input
function updateFrequencyFromInput() {
    const frequency = frequencyInput.value;
    if (frequency >= 20 && frequency <= 20000) {
        frequencySlider.value = frequency;
        frequencyValue.textContent = `${frequency} Hz`;
        
        // Update oscillator frequency if playing
        if (oscillator && audioContext && audioContext.state === 'running') {
            oscillator.frequency.value = frequencyInput.value;
        }
    }
}

// Validate frequency input
function validateFrequencyInput() {
    let frequency = parseFloat(frequencyInput.value);
    
    if (isNaN(frequency)) {
        frequency = 440;
    } else if (frequency < 0.5) {
        frequency = 0.5;
    } else if (frequency > 20000) {
        frequency = 20000;
    }
    
    frequencyInput.value = frequency;
    frequencySlider.value = frequency;
    frequencyValue.textContent = `${frequency} Hz`;
    
    // Update oscillator frequency if playing
    if (oscillator && audioContext && audioContext.state === 'running') {
        oscillator.frequency.value = frequencyInput.value;
    }
}


// Set frequency to specific value
function setFrequency(frequency) {
    // Clamp to the currently effective range (default 20-20000, or a custom
    // range applied via the range limiter) so the displayed value can always
    // be represented by the slider and played by the oscillator.
    const minF = parseFloat(frequencySlider.min);
    const maxF = parseFloat(frequencySlider.max);
    frequency = Math.max(minF, Math.min(maxF, frequency));
    frequencyInput.value = frequency;
    frequencySlider.value = frequency;
    frequencyValue.textContent = `${frequency} Hz`;
    
    // Update oscillator frequency if playing
    if (oscillator && audioContext && audioContext.state === 'running') {
        oscillator.frequency.value = frequencyInput.value;
    }
}


// Increase frequency
function increaseFrequency() {
    let frequency = parseFloat(frequencyInput.value);
    frequency += 1;
    if (frequency > 20000) frequency = 20000;
    setFrequency(frequency);
}

// Decrease frequency
function decreaseFrequency() {
    let frequency = parseFloat(frequencyInput.value);
    frequency -= 1;
    if (frequency < 0.5) frequency = 0.5;
    setFrequency(frequency);
}


// Update volume display
function updateVolume() {
    const volume = volumeSlider.value;
    volumeValue.textContent = `${volume}%`;
    
    // Update gain if playing
    if (gainNode && audioContext && audioContext.state === 'running') {
        gainNode.gain.value = volume / 100;
    }
}

// Update duration display
function updateDuration() {
    const duration = durationSlider.value;
    durationValue.textContent = `${duration} second${duration === '1' ? '' : 's'}`;
}

// Validate range inputs
function validateRangeInputs() {
    let startFreq = parseFloat(rangeStartInput.value);
    let endFreq = parseFloat(rangeEndInput.value);
    
    // Validate start frequency
    if (isNaN(startFreq)) {
        startFreq = 0.5;
    } else if (startFreq < 0.5) {
        startFreq = 0.5;
    } else if (startFreq > 20000) {
        startFreq = 20000;
    }
    
    // Validate end frequency
    if (isNaN(endFreq)) {
        endFreq = 20000;
    } else if (endFreq < 0.5) {
        endFreq = 0.5;
    } else if (endFreq > 20000) {
        endFreq = 20000;
    }
    
    // Ensure start <= end
    if (startFreq > endFreq) {
        const temp = startFreq;
        startFreq = endFreq;
        endFreq = temp;
    }
    
    rangeStartInput.value = startFreq;
    rangeEndInput.value = endFreq;
}


// Apply frequency range to slider
function applyFrequencyRange() {
    validateRangeInputs();
    
    const startFreq = parseFloat(rangeStartInput.value);
    const endFreq = parseFloat(rangeEndInput.value);
    
    // Update slider min and max
    frequencySlider.min = startFreq;
    frequencySlider.max = endFreq;
    
    // Update input min and max
    frequencyInput.min = startFreq;
    frequencyInput.max = endFreq;
    
    // Ensure current frequency is within new range
    let currentFreq = parseFloat(frequencyInput.value);
    if (currentFreq < startFreq) {
        currentFreq = startFreq;
    } else if (currentFreq > endFreq) {
        currentFreq = endFreq;
    }
    
    setFrequency(currentFreq);
    
    console.log(`Frequency range applied: ${startFreq}Hz to ${endFreq}Hz`);
}


// Play tone function
function playTone() {
    if (audioContext && audioContext.state === 'running') {
        stopTone();
    }
    
    // Create audio context if not exists
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // Create oscillator and gain node
    oscillator = audioContext.createOscillator();
    gainNode = audioContext.createGain();
    
    // Set oscillator properties
    oscillator.type = waveformSelect.value;
    oscillator.frequency.value = frequencyInput.value;
    
    // Set gain (volume)
    const volume = volumeSlider.value / 100;
    gainNode.gain.value = volume;
    
    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Start oscillator
    oscillator.start();
    
    // Calculate stop time
    const duration = durationSlider.value * 1000; // Convert to milliseconds
    stopTime = new Date(Date.now() + duration);
    
    // Set timeout to automatically stop
    stopTimeout = setTimeout(() => {
        stopTone();
    }, duration);
    
    // Update UI
    updateStatus('Playing', 'playing');
    updateStopTimeDisplay();
    startStopTimeCountdown();
    
    console.log(`Playing tone: ${frequencySlider.value}Hz, ${volumeSlider.value}% volume, ${durationSlider.value}s duration`);

}

// Stop tone function
function stopTone() {
    if (oscillator) {
        oscillator.stop();
        oscillator = null;
    }
    
    if (gainNode) {
        gainNode.disconnect();
        gainNode = null;
    }
    
    if (stopTimeout) {
        clearTimeout(stopTimeout);
        stopTimeout = null;
    }
    
    stopTime = null;
    
    // Update UI
    updateStatus('Stopped', 'stopped');
    updateStopTimeDisplay();
    stopStopTimeCountdown();
    
    console.log('Tone stopped');

}

// Extend stop time function
function extendStopTime() {
    if (audioContext && audioContext.state === 'running' && stopTime) {
        // Get the original duration from slider
        const durationSeconds = parseFloat(durationSlider.value);
        
        // Calculate new stop time by adding duration to current time
        const newStopTime = new Date(Date.now() + (durationSeconds * 1000));
        
        // Clear existing timeout
        if (stopTimeout) {
            clearTimeout(stopTimeout);
        }
        
        // Set new timeout
        const remainingTime = newStopTime.getTime() - Date.now();
        stopTimeout = setTimeout(() => {
            stopTone();
        }, remainingTime);
        
        // Update stop time
        stopTime = newStopTime;
        
        updateStopTimeDisplay();
        startStopTimeCountdown();
        console.log(`Stop time extended by ${durationSeconds} seconds`);

    } else {
        console.log('Cannot extend stop time - no tone is currently playing');
    }
}



// Update status display
function updateStatus(message, className) {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + className;
}

// Update stop time display with smooth animation
function updateStopTimeDisplay() {
    if (stopTime) {
        const remainingTime = stopTime.getTime() - Date.now();
        if (remainingTime > 0) {
            const totalSeconds = remainingTime / 1000;
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = Math.floor(totalSeconds % 60);
            const milliseconds = Math.floor((totalSeconds % 1) * 1000);
            
            if (minutes > 0) {
                stopTimeDiv.textContent = `Stop time: ${minutes}m ${seconds}s remaining`;
            } else if (totalSeconds > 10) {
                stopTimeDiv.textContent = `Stop time: ${seconds}s remaining`;
            } else {
                // Show milliseconds for the last 10 seconds for smoother countdown
                stopTimeDiv.textContent = `Stop time: ${seconds}.${Math.floor(milliseconds / 100)}s remaining`;
            }
        } else {
            stopTimeDiv.textContent = 'Stop time: Ended';
        }
    } else {
        stopTimeDiv.textContent = 'Stop time: Not set';
    }
}


// Start/stop the stop time countdown timer using requestAnimationFrame
let stopTimeAnimationId = null;

function startStopTimeCountdown() {
    if (stopTimeAnimationId) {
        cancelAnimationFrame(stopTimeAnimationId);
    }
    
    function animateStopTime() {
        updateStopTimeDisplay();
        
        // Continue animation if time hasn't ended
        if (stopTime && stopTime.getTime() > Date.now()) {
            stopTimeAnimationId = requestAnimationFrame(animateStopTime);
        } else {
            stopTimeAnimationId = null;
        }
    }
    
    stopTimeAnimationId = requestAnimationFrame(animateStopTime);
}

function stopStopTimeCountdown() {
    if (stopTimeAnimationId) {
        cancelAnimationFrame(stopTimeAnimationId);
        stopTimeAnimationId = null;
    }
}



// Single, consolidated keyboard handler (attached once).
// Previously the page had several duplicate `keydown` listeners, which made
// Enter trigger play 3x and caused arrow-key frequency adjustments to also
// stop the tone (a "any other key stops" listener collided with the arrows).
function handleKeydown(event) {
    // Ignore when a form control is focused so typing works normally.
    if (event.target.matches('input, textarea, select, button')) return;

    switch (event.code) {
        case 'Enter':
            event.preventDefault();
            if (playBtn) playBtn.click();
            break;
        case 'Escape':
            event.preventDefault();
            if (stopBtn) stopBtn.click();
            break;
        case 'Space':
            event.preventDefault();
            if (refreshBtn) refreshBtn.click();
            break;
        case 'ArrowLeft':
            event.preventDefault();
            setFrequency(parseFloat(frequencyInput.value) - 10);
            break;
        case 'ArrowRight':
            event.preventDefault();
            setFrequency(parseFloat(frequencyInput.value) + 10);
            break;
        case 'ArrowUp':
            event.preventDefault();
            volumeSlider.value = Math.min(100, parseFloat(volumeSlider.value) + 5);
            updateVolume();
            break;
        case 'ArrowDown':
            event.preventDefault();
            volumeSlider.value = Math.max(0, parseFloat(volumeSlider.value) - 5);
            updateVolume();
            break;
    }
}


// Initialize the application
function initializeApp() {
    updateFrequencyFromSlider();
    updateVolume();
    updateDuration();
    console.log('Tone Generator initialized with real-time frequency updates');
    
    // Attach the keyboard shortcuts exactly once.
    document.addEventListener('keydown', handleKeydown);
}


// Handle page visibility change to prevent audio issues
document.addEventListener('visibilitychange', function() {
    if (document.hidden && audioContext && audioContext.state === 'running') {
        // Suspend audio context when page is hidden
        audioContext.suspend().then(() => {
            console.log('Audio context suspended due to page visibility change');
        });
    } else if (!document.hidden && audioContext && audioContext.state === 'suspended') {
        // Resume audio context when page becomes visible
        audioContext.resume().then(() => {
            console.log('Audio context resumed');
        });
    }
});

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);
