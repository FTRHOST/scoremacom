// URL WebSocket Server Anda yang baru
const WS_URL = 'wss://api.manubanyuputih.id:3020'; // Menggunakan wss:// karena port 3020 mungkin SSL

let socket;
let isReconnecting = false;
let reconnectInterval = 5000;
const maxReconnectInterval = 30000;

// Definisi field sudah sesuai untuk input teks
const scoreboardFields = [
    { id: 'teamANameInput', displayId: 'displayTeamAName', dataKeyInScoreboard: 'teamANameInput', defaultValue: 'TEAM A', type: 'text' },
    { id: 'teamBNameInput', displayId: 'displayTeamBName', dataKeyInScoreboard: 'teamBNameInput', defaultValue: 'TEAM B', type: 'text' },
    { id: 'roundTitleInput', displayId: 'displayRoundTitle', dataKeyInScoreboard: 'roundTitleInput', defaultValue: 'ROUND TITLE', type: 'text' },
    { id: 'teamAScore1Input', displayId: 'displayTeamAScore1', dataKeyInScoreboard: 'teamAScore1Input', defaultValue: 0, type: 'number' },
    { id: 'teamAScore2Input', displayId: 'displayTeamAScore2', dataKeyInScoreboard: 'teamAScore2Input', defaultValue: 0, type: 'number' },
    { id: 'teamAScore3Input', displayId: 'displayTeamAScore3', dataKeyInScoreboard: 'teamAScore3Input', defaultValue: 0, type: 'number' },
    { id: 'teamARoundScoreInput', displayId: 'displayTeamARoundScore', dataKeyInScoreboard: 'teamARoundScoreInput', defaultValue: 0, type: 'number' },
    { id: 'teamBScore1Input', displayId: 'displayTeamBScore1', dataKeyInScoreboard: 'teamBScore1Input', defaultValue: 0, type: 'number' },
    { id: 'teamBScore2Input', displayId: 'displayTeamBScore2', dataKeyInScoreboard: 'teamBScore2Input', defaultValue: 0, type: 'number' },
    { id: 'teamBScore3Input', displayId: 'displayTeamBScore3', dataKeyInScoreboard: 'teamBScore3Input', defaultValue: 0, type: 'number' },
    { id: 'teamBRoundScoreInput', displayId: 'displayTeamBRoundScore', dataKeyInScoreboard: 'teamBRoundScoreInput', defaultValue: 0, type: 'number' },
];
const statusMessageEl = document.getElementById('statusMessage');

function updateDisplay(fieldId, displayId) {
    const inputElement = document.getElementById(fieldId);
    const displayElement = document.getElementById(displayId);
    if (inputElement && displayElement) {
        displayElement.textContent = inputElement.value;
    } else if (!inputElement) {
        // console.warn(`Input element with ID ${fieldId} not found for display update.`);
    } else if (!displayElement) {
        // console.warn(`Display element with ID ${displayId} not found for field ${fieldId}.`);
    }
}

function populateInputsAndDisplay(scoreboardData) { // Tidak perlu teamsData lagi
    scoreboardFields.forEach(field => {
        const inputElement = document.getElementById(field.id);
        const dataKey = field.dataKeyInScoreboard; // Gunakan dataKey untuk konsistensi

        if (!inputElement) {
            // console.warn(`Input element with ID ${field.id} not found during populate.`);
            return;
        }

        // Jika data dari server ada untuk field ini
        if (scoreboardData && scoreboardData.hasOwnProperty(dataKey)) {
            inputElement.value = scoreboardData[dataKey];
        } else { // Jika tidak, gunakan nilai default dari scoreboardFields
            inputElement.value = field.defaultValue;
        }
        updateDisplay(field.id, field.displayId); // Selalu update display setelah set value
    });
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
                if (inputElement) { // Pastikan elemen ada
                    currentScoreboardData[dataKey] = (inputElement.type === 'number')
                                                    ? parseFloat(inputElement.value) || 0
                                                    : inputElement.value;
                }
            });
            try {
                socket.send(JSON.stringify({ type: 'updateScoreboard', payload: currentScoreboardData }));
                if (statusMessageEl) statusMessageEl.textContent = 'Perubahan dikirim ke server.';
            } catch (error) {
                console.error("Error sending WebSocket message:", error);
                if (statusMessageEl) statusMessageEl.textContent = 'Gagal mengirim perubahan ke server.';
            }
        } else {
            if (statusMessageEl) statusMessageEl.textContent = 'Koneksi WebSocket tidak terbuka. Perubahan tidak terkirim.';
            console.warn("Attempted to send data, but WebSocket is not open. State:", socket?.readyState);
        }
    }, 500); // Debounce
}

function connectWebSocket() {
    if (isReconnecting || (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING))) {
        return;
    }
    isReconnecting = true;
    if (statusMessageEl) statusMessageEl.textContent = 'Menghubungkan ke server WebSocket...';
    console.log(`Attempting to connect to WebSocket at ${WS_URL}`);

    if (socket) { // Bersihkan socket lama
        socket.onopen = null; socket.onmessage = null; socket.onclose = null; socket.onerror = null;
        if (socket.readyState !== WebSocket.CLOSED) {
            try { socket.close(1000, "Client initiated reconnect"); } catch (e) { console.error("Error closing previous socket:", e); }
        }
    }

    try {
        socket = new WebSocket(WS_URL);
    } catch (e) {
        console.error("Error creating WebSocket:", e);
        if (statusMessageEl) statusMessageEl.textContent = "Gagal membuat koneksi WebSocket. Periksa URL dan console.";
        isReconnecting = false;
        setTimeout(() => { if (!isReconnecting) connectWebSocket(); }, reconnectInterval);
        return;
    }

    socket.onopen = () => {
        if (statusMessageEl) statusMessageEl.textContent = 'Terhubung ke WebSocket. Memuat data awal...';
        console.log('WebSocket connection established.');
        isReconnecting = false;
        reconnectInterval = 5000; // Reset interval reconnect
        // Server diharapkan mengirim 'initialData' atau 'initialSetup'
    };

    socket.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            console.log("Message from server:", message);

            // Sesuaikan 'message.type' dan struktur payload dengan apa yang dikirim server Anda
            if (message.type === 'initialData' || message.type === 'initialSetup') {
                // Jika server mengirim payload yang langsung berisi data scoreboard:
                const dataToPopulate = message.payload.scoreboard || message.payload;
                populateInputsAndDisplay(dataToPopulate);
                if (statusMessageEl) statusMessageEl.textContent = 'Data awal berhasil dimuat.';
            } else if (message.type === 'scoreboardUpdate') {
                populateInputsAndDisplay(message.payload);
                if (statusMessageEl) statusMessageEl.textContent = 'Papan skor diperbarui.';
                console.log("Scoreboard updated by server.");
            }
            // Update status menjadi "Terhubung" setelah memproses pesan
            setTimeout(() => {
                if (socket && socket.readyState === WebSocket.OPEN && statusMessageEl) {
                    statusMessageEl.textContent = 'Terhubung.';
                }
            }, 2000);
        } catch (e) {
            console.error('Error parsing message from server:', e, "Raw data:", event.data);
            if (statusMessageEl) statusMessageEl.textContent = 'Error memproses data dari server.';
        }
    };

    socket.onclose = (event) => {
        console.warn(`WebSocket connection closed. Code: ${event.code}, Reason: "${event.reason || 'N/A'}", WasClean: ${event.wasClean}`);
        isReconnecting = false;

        if (!navigator.onLine) {
            if (statusMessageEl) statusMessageEl.textContent = "Internet terputus. Mencoba lagi saat online...";
            const onlineHandler = () => {
                window.removeEventListener('online', onlineHandler);
                if (statusMessageEl) statusMessageEl.textContent = "Kembali online. Menghubungkan...";
                reconnectInterval = 5000;
                if (!isReconnecting) connectWebSocket();
            };
            window.addEventListener('online', onlineHandler);
            return;
        }

        let closeReasonText = `Koneksi terputus (Code: ${event.code || 'N/A'})`;
        if(event.code === 1006) closeReasonText = `Koneksi terputus tiba-tiba (1006)`;
        if (statusMessageEl) statusMessageEl.textContent = `${closeReasonText}. Mencoba lagi dalam ${reconnectInterval / 1000}d...`;

        setTimeout(() => {
            if (!isReconnecting) connectWebSocket();
        }, reconnectInterval);
        reconnectInterval = Math.min(reconnectInterval * 1.5, maxReconnectInterval);
    };

    socket.onerror = (error) => {
        console.error('WebSocket Error event:', error);
        if (statusMessageEl) statusMessageEl.textContent = 'Error koneksi WebSocket. Lihat console.';
        // onclose biasanya akan dipanggil setelah error, yang akan memicu reconnect.
    };
}

// Inisialisasi event listener untuk input fields
scoreboardFields.forEach(field => {
    const inputElement = document.getElementById(field.id);
    if (inputElement) {
        // Untuk input teks biasa, 'input' event sudah cukup
        inputElement.addEventListener('input', () => {
            updateDisplay(field.id, field.displayId);
            sendScoreboardUpdateToServer();
        });
    } else {
        console.warn(`Element with ID '${field.id}' not found for event listener setup.`);
    }
});

// Tombol Reset
const resetButton = document.getElementById('resetScoreButton');
if (resetButton) {
    resetButton.addEventListener('click', () => {
        if (confirm('Apakah Anda yakin ingin mereset skor ke nilai default?')) {
            const defaultScoreboardData = {};
            scoreboardFields.forEach(field => {
                // Karena semua input teks atau number, langsung ambil defaultValue
                defaultScoreboardData[field.dataKeyInScoreboard] = field.defaultValue;
            });
            populateInputsAndDisplay(defaultScoreboardData);
            sendScoreboardUpdateToServer();
            if (statusMessageEl) statusMessageEl.textContent = 'Data default dikirim ke server.';
        }
    });
} else {
    console.warn("Reset button not found.");
}

// Tombol Switch Teams (Jika Anda masih ingin menggunakannya, sesuaikan field yang ditukar)
const switchTeamsButton = document.getElementById('switchTeamsButton');
if (switchTeamsButton) {
    switchTeamsButton.addEventListener('click', () => {
        if (!confirm('Apakah Anda yakin ingin menukar data Tim A dan Tim B?')) { return; }

        const currentData = {};
        scoreboardFields.forEach(field => {
            const inputElement = document.getElementById(field.id);
            if (inputElement) {
                currentData[field.dataKeyInScoreboard] = (inputElement.type === 'number')
                    ? parseFloat(inputElement.value) || 0
                    : inputElement.value;
            }
        });

        const newDataAfterSwitch = { ...currentData }; // Salin data saat ini

        // Data yang akan ditukar (gunakan key dari dataKeyInScoreboard)
        const teamADataToMove = {
            name: currentData.teamANameInput, // Sesuaikan dengan dataKeyInScoreboard
            score1: currentData.teamAScore1Input,
            score2: currentData.teamAScore2Input,
            score3: currentData.teamAScore3Input,
            roundScore: currentData.teamARoundScoreInput
        };
        const teamBDataToMove = {
            name: currentData.teamBNameInput, // Sesuaikan dengan dataKeyInScoreboard
            score1: currentData.teamBScore1Input,
            score2: currentData.teamBScore2Input,
            score3: currentData.teamBScore3Input,
            roundScore: currentData.teamBRoundScoreInput
        };

        // Lakukan penukaran
        newDataAfterSwitch.teamANameInput = teamBDataToMove.name;
        newDataAfterSwitch.teamAScore1Input = teamBDataToMove.score1;
        newDataAfterSwitch.teamAScore2Input = teamBDataToMove.score2;
        newDataAfterSwitch.teamAScore3Input = teamBDataToMove.score3;
        newDataAfterSwitch.teamARoundScoreInput = teamBDataToMove.roundScore;

        newDataAfterSwitch.teamBNameInput = teamADataToMove.name;
        newDataAfterSwitch.teamBScore1Input = teamADataToMove.score1;
        newDataAfterSwitch.teamBScore2Input = teamADataToMove.score2;
        newDataAfterSwitch.teamBScore3Input = teamADataToMove.score3;
        newDataAfterSwitch.teamBRoundScoreInput = teamADataToMove.roundScore;
        
        populateInputsAndDisplay(newDataAfterSwitch);
        sendScoreboardUpdateToServer();
        if (statusMessageEl) statusMessageEl.textContent = 'Tim berhasil ditukar dan data dikirim ke server.';
        setTimeout(() => { if (socket && socket.readyState === WebSocket.OPEN && statusMessageEl) { statusMessageEl.textContent = 'Terhubung.'; } }, 3000);
    });
} else {
    // console.warn("Switch Teams button not found. Jika tidak diperlukan, ini normal.");
}


// Mulai koneksi WebSocket saat halaman dimuat
document.addEventListener('DOMContentLoaded', () => {
    if (!window.WebSocket) {
        if (statusMessageEl) statusMessageEl.textContent = "Browser Anda tidak mendukung WebSocket!";
        alert("Browser Anda tidak mendukung WebSocket yang dibutuhkan aplikasi ini.");
        return;
    }
    // Inisialisasi UI dengan nilai default sebelum koneksi
    const initialDefaultScoreboard = scoreboardFields.reduce((acc, field) => {
        acc[field.dataKeyInScoreboard] = field.defaultValue;
        return acc;
    }, {});
    populateInputsAndDisplay(initialDefaultScoreboard);

    connectWebSocket();
});