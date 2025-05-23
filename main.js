    // ----------------------------------------------------------------------------------
    // PASTIKAN UNTUK MENGGANTI URL INI DENGAN URL WEBSOCKET SERVER ANDA YANG BENAR!
    // ----------------------------------------------------------------------------------
    const WS_URL = 'wss://api.manubanyuputih.id:3020'; // GANTI INI!

    let socket;
    let isReconnecting = false;
    let reconnectInterval = 5000;
    const maxReconnectInterval = 30000;
    const DEFAULT_POINTS_TO_WIN_ROUND = 25;
    let currentPointsToWinRound = DEFAULT_POINTS_TO_WIN_ROUND;
    let scoreRoundTriggerState = {}; // { teamAScore1Input: 0, teamAScore2Input: 0, ... }

    const scoreboardFields = [
        { id: 'teamANameInput', displayId: 'displayTeamAName', dataKeyInScoreboard: 'teamANameInput', defaultValue: 'TEAM A', type: 'text' },
        { id: 'teamBNameInput', displayId: 'displayTeamBName', dataKeyInScoreboard: 'teamBNameInput', defaultValue: 'TEAM B', type: 'text' },
        { id: 'roundTitleInput', displayId: 'displayRoundTitle', dataKeyInScoreboard: 'roundTitleInput', defaultValue: 'ROUND TITLE', type: 'text' },
        { id: 'pointsToWinRoundInput', displayId: null, dataKeyInScoreboard: 'pointsToWinRound', defaultValue: DEFAULT_POINTS_TO_WIN_ROUND, type: 'number' },
        { id: 'teamAScore1Input', displayId: 'displayTeamAScore1', dataKeyInScoreboard: 'teamAScore1Input', defaultValue: 0, type: 'number', isMainScore: true, team: 'A' },
        { id: 'teamAScore2Input', displayId: 'displayTeamAScore2', dataKeyInScoreboard: 'teamAScore2Input', defaultValue: 0, type: 'number', isMainScore: true, team: 'A' },
        { id: 'teamAScore3Input', displayId: 'displayTeamAScore3', dataKeyInScoreboard: 'teamAScore3Input', defaultValue: 0, type: 'number', isMainScore: true, team: 'A' },
        { id: 'teamARoundScoreInput', displayId: 'displayTeamARoundScore', dataKeyInScoreboard: 'teamARoundScoreInput', defaultValue: 0, type: 'number' },
        { id: 'teamBScore1Input', displayId: 'displayTeamBScore1', dataKeyInScoreboard: 'teamBScore1Input', defaultValue: 0, type: 'number', isMainScore: true, team: 'B' },
        { id: 'teamBScore2Input', displayId: 'displayTeamBScore2', dataKeyInScoreboard: 'teamBScore2Input', defaultValue: 0, type: 'number', isMainScore: true, team: 'B' },
        { id: 'teamBScore3Input', displayId: 'displayTeamBScore3', dataKeyInScoreboard: 'teamBScore3Input', defaultValue: 0, type: 'number', isMainScore: true, team: 'B' },
        { id: 'teamBRoundScoreInput', displayId: 'displayTeamBRoundScore', dataKeyInScoreboard: 'teamBRoundScoreInput', defaultValue: 0, type: 'number' },
    ];
    const statusMessageEl = document.getElementById('statusMessage');

    function initializeScoreTriggerState(scoreboardData = null) {
        scoreboardFields.forEach(field => {
            if (field.isMainScore) {
                // Jika ada data scoreboard, coba hitung kelipatan awal dari data tersebut
                if (scoreboardData && scoreboardData.hasOwnProperty(field.dataKeyInScoreboard) && currentPointsToWinRound > 0) {
                    const score = parseInt(scoreboardData[field.dataKeyInScoreboard]) || 0;
                    scoreRoundTriggerState[field.id] = Math.floor(score / currentPointsToWinRound);
                } else {
                    scoreRoundTriggerState[field.id] = 0;
                }
            }
        });
        console.log("Score trigger state initialized/updated:", JSON.parse(JSON.stringify(scoreRoundTriggerState)));
    }

    function updateDisplay(fieldId, displayId) {
        const inputElement = document.getElementById(fieldId);
        const displayElement = document.getElementById(displayId);
        if (inputElement && displayElement) {
            displayElement.textContent = inputElement.value;
        }
    }

    function populateInputsAndDisplay(scoreboardData) {
        const pointsFieldDef = scoreboardFields.find(f => f.dataKeyInScoreboard === 'pointsToWinRound');
        if (scoreboardData && scoreboardData.hasOwnProperty('pointsToWinRound')) {
            currentPointsToWinRound = parseInt(scoreboardData.pointsToWinRound) || DEFAULT_POINTS_TO_WIN_ROUND;
        } else if (pointsFieldDef) {
            currentPointsToWinRound = pointsFieldDef.defaultValue;
        } else {
            currentPointsToWinRound = DEFAULT_POINTS_TO_WIN_ROUND;
        }
        const pointsToWinRoundElHTML = document.getElementById('pointsToWinRoundInput');
        if (pointsToWinRoundElHTML) pointsToWinRoundElHTML.value = currentPointsToWinRound;

        scoreboardFields.forEach(field => {
            if (field.dataKeyInScoreboard === 'pointsToWinRound' && !field.id) return;
            const inputElement = document.getElementById(field.id);
            const dataKey = field.dataKeyInScoreboard;
            if (!inputElement) return;
            if (scoreboardData && scoreboardData.hasOwnProperty(dataKey)) {
                inputElement.value = scoreboardData[dataKey];
            } else {
                inputElement.value = field.defaultValue;
            }
            if (field.displayId) updateDisplay(field.id, field.displayId);
        });
        // Inisialisasi ulang trigger state setelah semua data di-populate,
        // terutama jika pointsToWinRound berubah atau data awal diterima.
        initializeScoreTriggerState(scoreboardData);
    }

    let updateTimeout;
    function sendScoreboardUpdateToServer() {
        clearTimeout(updateTimeout);
        updateTimeout = setTimeout(() => {
            if (socket && socket.readyState === WebSocket.OPEN) {
                const currentScoreboardData = {};
                scoreboardFields.forEach(field => {
                    const inputElement = document.getElementById(field.id);
                    const dataKey = field.dataKeyInScoreboard;
                    if (inputElement) {
                        currentScoreboardData[dataKey] = (inputElement.type === 'number')
                            ? parseFloat(inputElement.value) || 0
                            : inputElement.value;
                    } else if (dataKey === 'pointsToWinRound') { // Jika tidak ada elemen HTML, ambil dari variabel global
                        currentScoreboardData[dataKey] = currentPointsToWinRound;
                    }
                });
                try {
                    socket.send(JSON.stringify({ type: 'updateScoreboard', payload: currentScoreboardData }));
                    if (statusMessageEl) statusMessageEl.textContent = 'Perubahan dikirim.';
                } catch (error) {
                    console.error("Error sending WebSocket message:", error);
                    if (statusMessageEl) statusMessageEl.textContent = 'Gagal mengirim.';
                }
            } else {
                if (statusMessageEl) statusMessageEl.textContent = 'Koneksi terputus. Perubahan tidak terkirim.';
            }
        }, 500);
    }

    function checkAndUpdateRoundScore(mainScoreInputId, team) {
        const mainScoreInput = document.getElementById(mainScoreInputId);
        if (!mainScoreInput) return;
        const currentMainScore = parseInt(mainScoreInput.value) || 0;
        const pointsToWin = currentPointsToWinRound;
        if (pointsToWin <= 0) return; // Hindari pembagian dengan nol atau logika aneh

        const currentMultipleAchieved = Math.floor(currentMainScore / pointsToWin);
        const lastTriggeredMultiple = scoreRoundTriggerState[mainScoreInputId] || 0;

        if (currentMainScore >= pointsToWin && currentMultipleAchieved > lastTriggeredMultiple) {
            const roundsToAdd = currentMultipleAchieved - lastTriggeredMultiple;
            incrementRoundScore(team, roundsToAdd);
            scoreRoundTriggerState[mainScoreInputId] = currentMultipleAchieved;
            console.log(`Round score added for ${mainScoreInputId}. New trigger state: ${scoreRoundTriggerState[mainScoreInputId]}`);
        } else if (currentMainScore < (lastTriggeredMultiple * pointsToWin) && lastTriggeredMultiple > 0) {
             scoreRoundTriggerState[mainScoreInputId] = Math.max(0, Math.floor(currentMainScore / pointsToWin));
             console.log(`Score trigger state for ${mainScoreInputId} rolled back to: ${scoreRoundTriggerState[mainScoreInputId]}`);
        }
    }

    function incrementRoundScore(team, roundsToAdd = 1) {
        const roundScoreInputId = (team === 'A') ? 'teamARoundScoreInput' : 'teamBRoundScoreInput';
        const roundScoreInput = document.getElementById(roundScoreInputId);
        if (roundScoreInput) {
            roundScoreInput.value = (parseInt(roundScoreInput.value) || 0) + roundsToAdd;
            const roundFieldDef = scoreboardFields.find(f => f.id === roundScoreInputId);
            if (roundFieldDef && roundFieldDef.displayId) updateDisplay(roundFieldDef.id, roundFieldDef.displayId);
        }
    }

    function connectWebSocket() {
        if (isReconnecting || (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING))) { return; }
        isReconnecting = true;
        if (statusMessageEl) statusMessageEl.textContent = 'Menghubungkan...';
        console.log(`Attempting to connect to WebSocket at ${WS_URL}`);
        if (socket) {
            socket.onopen = null; socket.onmessage = null; socket.onclose = null; socket.onerror = null;
            if (socket.readyState !== WebSocket.CLOSED) { try { socket.close(1000, "Client initiated reconnect"); } catch (e) { console.error("Error closing previous socket:", e); } }
        }
        try { socket = new WebSocket(WS_URL); }
        catch (e) {
            console.error("Error creating WebSocket:", e); if (statusMessageEl) statusMessageEl.textContent = "Gagal membuat koneksi. Periksa URL.";
            isReconnecting = false; setTimeout(() => { if (!isReconnecting) connectWebSocket(); }, reconnectInterval); return;
        }
        socket.onopen = () => {
            if (statusMessageEl) statusMessageEl.textContent = 'Terhubung. Memuat data...';
            console.log('WebSocket connection established.');
            isReconnecting = false; reconnectInterval = 5000;
        };
        socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                console.log("Message from server:", message);
                if (message.type === 'initialData' || message.type === 'initialSetup' || message.type === 'scoreboardUpdate') {
                    const dataToPopulate = message.payload.scoreboard || message.payload;
                    populateInputsAndDisplay(dataToPopulate); // Ini akan update currentPointsToWinRound & scoreRoundTriggerState
                    if (message.type === 'initialData' || message.type === 'initialSetup') {
                         if (statusMessageEl) statusMessageEl.textContent = 'Data awal dimuat.';
                    } else {
                         if (statusMessageEl) statusMessageEl.textContent = 'Papan skor diperbarui.';
                    }
                }
                setTimeout(() => { if (socket && socket.readyState === WebSocket.OPEN && statusMessageEl) { statusMessageEl.textContent = 'Terhubung.'; } }, 2000);
            } catch (e) { console.error('Error parsing message from server:', e, "Raw data:", event.data); if (statusMessageEl) statusMessageEl.textContent = 'Error data server.'; }
        };
        socket.onclose = (event) => {
            console.warn(`WebSocket closed. Code: ${event.code}, Reason: "${event.reason || 'N/A'}", Clean: ${event.wasClean}`);
            isReconnecting = false;
            if (!navigator.onLine) {
                if (statusMessageEl) statusMessageEl.textContent = "Internet terputus. Coba lagi saat online.";
                const onlineHandler = () => { window.removeEventListener('online', onlineHandler); if (statusMessageEl) statusMessageEl.textContent = "Online. Menghubungkan..."; reconnectInterval = 5000; if (!isReconnecting) connectWebSocket(); };
                window.addEventListener('online', onlineHandler); return;
            }
            let closeReasonText = `Koneksi terputus (Code: ${event.code || 'N/A'})`;
            if(event.code === 1006) closeReasonText = `Koneksi terputus tiba-tiba (1006)`;
            if (statusMessageEl) statusMessageEl.textContent = `${closeReasonText}. Mencoba lagi dalam ${reconnectInterval / 1000}d...`;
            setTimeout(() => { if (!isReconnecting) connectWebSocket(); }, reconnectInterval);
            reconnectInterval = Math.min(reconnectInterval * 1.5, maxReconnectInterval);
        };
        socket.onerror = (error) => {
            console.error('WebSocket Error event:', error);
            if (statusMessageEl) statusMessageEl.textContent = 'Error koneksi WebSocket.';
        };
    }

    scoreboardFields.forEach(field => {
        if (field.dataKeyInScoreboard === 'pointsToWinRound' && !document.getElementById(field.id)) return;
        const inputElement = document.getElementById(field.id);
        if (inputElement) {
            inputElement.addEventListener('input', () => {
                if (field.displayId) updateDisplay(field.id, field.displayId);
                if (field.isMainScore) {
                    if (parseInt(inputElement.value) < 0 && inputElement.value !== "") inputElement.value = 0;
                    checkAndUpdateRoundScore(field.id, field.team);
                }
                if (field.id === 'pointsToWinRoundInput') {
                    const newPoints = parseInt(inputElement.value) || DEFAULT_POINTS_TO_WIN_ROUND;
                    currentPointsToWinRound = Math.max(1, newPoints);
                    inputElement.value = currentPointsToWinRound;
                    initializeScoreTriggerState(scoreboardFields.reduce((acc, fld) => { // Dapatkan data UI saat ini untuk re-init state
                        const el = document.getElementById(fld.id);
                        if (el) acc[fld.dataKeyInScoreboard] = (el.type === 'number') ? parseFloat(el.value) || 0 : el.value;
                        else if (fld.dataKeyInScoreboard === 'pointsToWinRound') acc[fld.dataKeyInScoreboard] = currentPointsToWinRound;
                        return acc;
                    }, {}));
                }
                sendScoreboardUpdateToServer();
            });
        } else { console.warn(`Element with ID '${field.id}' not found for event listener setup.`); }
    });

    const resetButton = document.getElementById('resetScoreButton');
    if (resetButton) {
        resetButton.addEventListener('click', () => {
            if (confirm('Reset semua skor, nama, dan pengaturan ke default?')) {
                const defaultData = {};
                scoreboardFields.forEach(field => defaultData[field.dataKeyInScoreboard] = field.defaultValue);
                const pointsFieldDef = scoreboardFields.find(f => f.dataKeyInScoreboard === 'pointsToWinRound');
                if (pointsFieldDef) currentPointsToWinRound = pointsFieldDef.defaultValue;
                else currentPointsToWinRound = DEFAULT_POINTS_TO_WIN_ROUND;
                const pointsToWinRoundElHTML = document.getElementById('pointsToWinRoundInput');
                if (pointsToWinRoundElHTML) pointsToWinRoundElHTML.value = currentPointsToWinRound;
                populateInputsAndDisplay(defaultData); // Ini akan memanggil initializeScoreTriggerState
                sendScoreboardUpdateToServer();
                if (statusMessageEl) statusMessageEl.textContent = 'Data default dikirim.';
            }
        });
    }

    const switchTeamsButton = document.getElementById('switchTeamsButton');
    if (switchTeamsButton) {
        switchTeamsButton.addEventListener('click', () => {
            if (!confirm('Tukar data Tim A dan Tim B?')) { return; }
            const currentData = {};
            scoreboardFields.forEach(field => {
                const el = document.getElementById(field.id);
                if(el) currentData[field.dataKeyInScoreboard] = (el.type === 'number') ? parseFloat(el.value) || 0 : el.value;
                else if (field.dataKeyInScoreboard === 'pointsToWinRound') currentData[field.dataKeyInScoreboard] = currentPointsToWinRound;
            });
            const newData = { ...currentData };
            [newData.teamANameInput, newData.teamBNameInput] = [currentData.teamBNameInput, currentData.teamANameInput];
            [newData.teamAScore1Input, newData.teamBScore1Input] = [currentData.teamBScore1Input, currentData.teamAScore1Input];
            [newData.teamAScore2Input, newData.teamBScore2Input] = [currentData.teamBScore2Input, currentData.teamAScore2Input];
            [newData.teamAScore3Input, newData.teamBScore3Input] = [currentData.teamBScore3Input, currentData.teamAScore3Input];
            [newData.teamARoundScoreInput, newData.teamBRoundScoreInput] = [currentData.teamBRoundScoreInput, currentData.teamARoundScoreInput];

            // Tukar scoreRoundTriggerState
            const tempTriggerA = {}, tempTriggerB = {};
            scoreboardFields.forEach(f => {
                if (f.isMainScore && f.team === 'A') tempTriggerA[f.id] = scoreRoundTriggerState[f.id] || 0;
                if (f.isMainScore && f.team === 'B') tempTriggerB[f.id] = scoreRoundTriggerState[f.id] || 0;
            });
            scoreboardFields.forEach(f => {
                if (f.isMainScore && f.team === 'A') scoreRoundTriggerState[f.id] = tempTriggerB[f.id.replace('teamA','teamB')] || 0;
                if (f.isMainScore && f.team === 'B') scoreRoundTriggerState[f.id] = tempTriggerA[f.id.replace('teamB','teamA')] || 0;
            });
            console.log("Score trigger state after switch:", JSON.parse(JSON.stringify(scoreRoundTriggerState)));

            populateInputsAndDisplay(newData);
            sendScoreboardUpdateToServer();
            if (statusMessageEl) statusMessageEl.textContent = 'Tim ditukar.';
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!window.WebSocket) {
            if (statusMessageEl) statusMessageEl.textContent = "Browser tidak mendukung WebSocket!";
            alert("Browser Anda tidak mendukung WebSocket."); return;
        }
        const initialDefaults = scoreboardFields.reduce((acc, f) => { acc[f.dataKeyInScoreboard] = f.defaultValue; return acc; }, {});
        const pointsFieldDef = scoreboardFields.find(f => f.dataKeyInScoreboard === 'pointsToWinRound');
        if(pointsFieldDef) currentPointsToWinRound = initialDefaults[pointsFieldDef.dataKeyInScoreboard] || pointsFieldDef.defaultValue;
        else currentPointsToWinRound = DEFAULT_POINTS_TO_WIN_ROUND;
        const pointsToWinRoundElHTML = document.getElementById('pointsToWinRoundInput');
        if (pointsToWinRoundElHTML) pointsToWinRoundElHTML.value = currentPointsToWinRound;

        populateInputsAndDisplay(initialDefaults); // Ini akan panggil initializeScoreTriggerState
        connectWebSocket();
    });