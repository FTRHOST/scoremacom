const WS_URL = 'https://api.manubanyuputih.id:3020'; // URL backend server

let socket;

        const scoreboardFields = [
            { id: 'teamANameInput', displayId: 'displayTeamAName', defaultValue: 'TEAM A', type: 'text' },
            { id: 'teamBNameInput', displayId: 'displayTeamBName', defaultValue: 'TEAM B', type: 'text' },
            { id: 'roundTitleInput', displayId: 'displayRoundTitle', defaultValue: 'ROUND TITLE', type: 'text' },
            { id: 'teamAScore1Input', displayId: 'displayTeamAScore1', defaultValue: 0, type: 'number' },
            { id: 'teamAScore2Input', displayId: 'displayTeamAScore2', defaultValue: 0, type: 'number' },
            { id: 'teamAScore3Input', displayId: 'displayTeamAScore3', defaultValue: 0, type: 'number' },
            { id: 'teamARoundScoreInput', displayId: 'displayTeamARoundScore', defaultValue: 0, type: 'number' },
            { id: 'teamBScore1Input', displayId: 'displayTeamBScore1', defaultValue: 0, type: 'number' },
            { id: 'teamBScore2Input', displayId: 'displayTeamBScore2', defaultValue: 0, type: 'number' },
            { id: 'teamBScore3Input', displayId: 'displayTeamBScore3', defaultValue: 0, type: 'number' },
            { id: 'teamBRoundScoreInput', displayId: 'displayTeamBRoundScore', defaultValue: 0, type: 'number' },
        ];
        const statusMessageEl = document.getElementById('statusMessage');

        function updateDisplay(inputId, displayId) {
            const inputElement = document.getElementById(inputId);
            const displayElement = document.getElementById(displayId);
            if (inputElement && displayElement) {
                displayElement.textContent = inputElement.value;
            }
        }

        function populateInputsAndDisplay(data) {
            scoreboardFields.forEach(field => {
                const inputElement = document.getElementById(field.id);
                if (inputElement && data.hasOwnProperty(field.id)) {
                    inputElement.value = data[field.id];
                    updateDisplay(field.id, field.displayId);
                } else if (inputElement) {
                    inputElement.value = field.defaultValue;
                    updateDisplay(field.id, field.displayId);
                }
            });
        }

        let updateTimeout;
        function sendScoreboardUpdateToServer() {
            clearTimeout(updateTimeout);
            updateTimeout = setTimeout(() => {
                if (socket && socket.readyState === WebSocket.OPEN) {
                    const currentData = {};
                    scoreboardFields.forEach(field => {
                        const inputElement = document.getElementById(field.id);
                        currentData[field.id] = (inputElement.type === 'number') 
                                                ? parseFloat(inputElement.value) || 0 
                                                : inputElement.value;
                    });
                    socket.send(JSON.stringify({ type: 'updateScoreboard', payload: currentData }));
                    statusMessageEl.textContent = 'Perubahan dikirim ke server.';
                    setTimeout(() => statusMessageEl.textContent = 'Terhubung.', 2000);
                } else {
                    statusMessageEl.textContent = 'Koneksi WebSocket tidak terbuka. Coba lagi nanti.';
                }
            }, 500); // Debounce
        }

        function connectWebSocket() {
            socket = new WebSocket(WS_URL);

            socket.onopen = () => {
                statusMessageEl.textContent = 'Terhubung ke server WebSocket. Memuat data...';
                // Server akan mengirim initialData otomatis setelah koneksi
            };

            socket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    if (message.type === 'initialData' || message.type === 'scoreboardUpdate') {
                        populateInputsAndDisplay(message.payload);
                        if (message.type === 'initialData') {
                             statusMessageEl.textContent = 'Data awal berhasil dimuat.';
                        } else {
                            // Untuk panel kontrol, tidak perlu pesan khusus saat menerima update
                            // karena ia yang memicu update, atau update dari admin lain.
                            // Cukup pastikan UI sinkron.
                            console.log("Scoreboard updated by server or another admin.");
                        }
                        setTimeout(() => statusMessageEl.textContent = 'Terhubung.', 2000);
                    }
                } catch (e) {
                    console.error('Error parsing message from server:', e);
                }
            };

            socket.onclose = () => {
                statusMessageEl.textContent = 'Koneksi WebSocket terputus. Mencoba menghubungkan kembali dalam 5 detik...';
                setTimeout(connectWebSocket, 5000); // Coba hubungkan kembali
            };

            socket.onerror = (error) => {
                console.error('WebSocket Error:', error);
                statusMessageEl.textContent = 'Error koneksi WebSocket.';
                // onclose akan dipanggil setelah error, jadi reconnect akan ditangani di sana
            };
        }

        // Inisialisasi event listener untuk input fields
        scoreboardFields.forEach(field => {
            const inputElement = document.getElementById(field.id);
            if (inputElement) {
                inputElement.addEventListener('input', () => {
                    updateDisplay(field.id, field.displayId); // Update UI lokal dulu
                    sendScoreboardUpdateToServer();      // Kirim pembaruan ke server
                });
            }
        });

        // Tombol Reset
        document.getElementById('resetScoreButton').addEventListener('click', () => {
            if (confirm('Apakah Anda yakin ingin mereset skor ke nilai default? Ini akan mengirim data default ke server.')) {
                const defaultData = {};
                scoreboardFields.forEach(field => {
                    defaultData[field.id] = field.defaultValue;
                });
                populateInputsAndDisplay(defaultData); // Update UI lokal
                sendScoreboardUpdateToServer(); // Kirim data default ini ke server
                statusMessageEl.textContent = 'Data default dikirim ke server.';
            }
        });
        
        // Mulai koneksi WebSocket saat halaman dimuat
        document.addEventListener('DOMContentLoaded', connectWebSocket);