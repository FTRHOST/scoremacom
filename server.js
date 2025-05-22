// scoreboard-app/backend/server.js
const express = require('express');
const http = require('http'); // Diperlukan untuk WebSocket server
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'scoreboard_data.json');

// --- HTTP Server Setup ---
const server = http.createServer(app); // Express app akan handle HTTP requests

// --- WebSocket Server Setup ---
const wss = new WebSocket.Server({ server }); // Attach WebSocket server ke HTTP server

// Middleware
app.use(cors());
app.use(express.json());

const defaultScoreboardData = {
    teamANameInput: 'TEAM A', teamBNameInput: 'TEAM B', roundTitleInput: 'ROUND TITLE',
    teamAScore1Input: 0, teamAScore2Input: 0, teamAScore3Input: 0, teamARoundScoreInput: 0,
    teamBScore1Input: 0, teamBScore2Input: 0, teamBScore3Input: 0, teamBRoundScoreInput: 0,
};

const initializeDataFile = () => {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(defaultScoreboardData, null, 2));
        console.log('scoreboard_data.json created with default values.');
    }
};
initializeDataFile();

// Fungsi untuk membaca data scoreboard
function getScoreboardData() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading or parsing data file, returning default:', err);
        return defaultScoreboardData; // Kembalikan default jika ada error
    }
}

// Fungsi untuk menyimpan data scoreboard dan broadcast pembaruan
function saveAndBroadcastScoreboardData(newData) {
    fs.writeFile(DATA_FILE, JSON.stringify(newData, null, 2), 'utf8', (err) => {
        if (err) {
            console.error('Error writing data file:', err);
            return;
        }
        console.log('Scoreboard data saved.');
        // Broadcast pembaruan ke semua klien WebSocket yang terhubung
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'scoreboardUpdate', payload: newData }));
            }
        });
    });
}

// --- WebSocket Connection Handling ---
wss.on('connection', (ws) => {
    console.log('Client connected via WebSocket');

    // Kirim data scoreboard saat ini ke klien yang baru terhubung
    ws.send(JSON.stringify({ type: 'initialData', payload: getScoreboardData() }));

    ws.on('message', (message) => {
        try {
            const parsedMessage = JSON.parse(message);
            // Hanya admin (panel kontrol) yang seharusnya mengirim 'updateScoreboard'
            if (parsedMessage.type === 'updateScoreboard') {
                console.log('Received scoreboard update from client:', parsedMessage.payload);
                saveAndBroadcastScoreboardData(parsedMessage.payload);
            }
        } catch (e) {
            console.error('Failed to parse message or invalid message format:', message, e);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});


// --- API Endpoints (masih bisa digunakan untuk reset atau initial load jika WS gagal) ---
app.get('/api/scoreboard', (req, res) => {
    res.json(getScoreboardData());
});

app.post('/api/scoreboard', (req, res) => {
    const newData = req.body;
    if (typeof newData !== 'object' || newData === null) {
        return res.status(400).json({ message: 'Invalid data format' });
    }
    saveAndBroadcastScoreboardData(newData); // Simpan dan broadcast
    res.json({ message: 'Scoreboard data update initiated', data: newData });
});


// Start server
server.listen(PORT, () => {
    console.log(`Server (HTTP & WebSocket) running on http://localhost:${PORT}`);
});