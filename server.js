const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

let db = {
    players: {},
    killSwitchActive: false,
    logs: []
};

// ВПИШИ СЮДА СВОЙ НАСТОЯЩИЙ TELEGRAM ID ДЛЯ ПОЛНОЙ БЕЗОПАСНОСТИ
const MASTER_CREATOR_TG_ID = "8745499515"; 

const BANNED_WORDS = ["badword", "scam", "admin", "moderator", "cheat", "hack", "fuck", "bitch", "shit"];

function logAction(admin, action, target = "All") {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] MASTER_ADMIN: ${admin} | Action: ${action} | Target: ${target}`;
    db.logs.push(logEntry);
    console.log(logEntry);
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/api/auth', (req, res) => {
    const { tgId, firstName, username } = req.body;
    if (!tgId) return res.status(400).json({ error: "Telegram ID is required" });

    const stringTgId = String(tgId);

    if (db.killSwitchActive && stringTgId !== String(MASTER_CREATOR_TG_ID)) {
        return res.status(503).json({ error: "SERVER_CLOSED", message: "Emergency Shutdown: Offline by the Creator." });
    }

    let rawName = username || firstName || "User_" + stringTgId.substring(0, 4);
    let trimmedName = rawName.trim().replace(/[^a-zA-Z0-9_]/g, ""); 

    const lowerInput = trimmedName.toLowerCase();
    for (let bad of BANNED_WORDS) {
        if (lowerInput.includes(bad)) {
            trimmedName = "User_" + stringTgId.substring(0, 4);
            break;
        }
    }

    let assignedRole = "player";
    if (stringTgId === String(MASTER_CREATOR_TG_ID)) {
        assignedRole = "creator";
        trimmedName = "Creator"; 
    } else {
        if (lowerInput === "creator") {
            trimmedName = "User_" + stringTgId.substring(0, 4);
        }
    }

    if (db.players[stringTgId] && db.players[stringTgId].isBanned) {
        return res.status(403).json({ error: "BANNED", message: "Your account has been permanently suspended by 3-Step Anticheat." });
    }

    if (!db.players[stringTgId]) {
        db.players[stringTgId] = {
            tgId: stringTgId,
            username: trimmedName,
            role: assignedRole,
            chosenEmoji: "",
            coins: 1000,
            recordCoins: 1000,
            level: 1,
            xp: 0,
            isBanned: false,
            lastTapTime: 0,
            intervalsHistory: [],
            minuteClicksCount: 0,
            minuteStartTime: Date.now()
        };
    }

    res.json({ player: db.players[stringTgId], killSwitch: db.killSwitchActive });
});

app.post('/api/click', (req, res) => {
    const { tgId } = req.body;
    const stringTgId = String(tgId);
    
    if (db.killSwitchActive && stringTgId !== String(MASTER_CREATOR_TG_ID)) {
        return res.status(503).json({ error: "SERVER_CLOSED" });
    }

    const player = db.players[stringTgId];
    if (!player) return res.status(404).json({ error: "Player not found" });
    if (player.isBanned) return res.status(403).json({ error: "BANNED" });

    const now = Date.now();
    const timeDiff = now - player.lastTapTime;
    player.lastTapTime = now;

    if (timeDiff > 0 && timeDiff < 45) {
        player.isBanned = true;
        logAction("ANTICHEAT_STAGE_1", "PERMANENT_BAN_SPEEDHACK", player.username);
        return res.status(403).json({ error: "BANNED" });
    }

    if (player.intervalsHistory.length >= 10) player.intervalsHistory.shift();
    player.intervalsHistory.push(timeDiff);
    if (player.intervalsHistory.length === 10) {
        let isPerfectPattern = true;
        const firstDiff = player.intervalsHistory[0];
        for (let i = 1; i < player.intervalsHistory.length; i++) {
            if (Math.abs(player.intervalsHistory[i] - firstDiff) > 4) { isPerfectPattern = false; break; }
        }
        if (isPerfectPattern) {
            player.isBanned = true;
            logAction("ANTICHEAT_STAGE_2", "PERMANENT_BAN_MACRO", player.username);
            return res.status(403).json({ error: "BANNED" });
        }
    }

    if (now - player.minuteStartTime >= 60000) {
        player.minuteClicksCount = 0;
        player.minuteStartTime = now;
    }
    player.minuteClicksCount++;
    if (player.minuteClicksCount > 550) {
        player.isBanned = true;
        logAction("ANTICHEAT_STAGE_3", "PERMANENT_BAN_OVERLOAD", player.username);
        return res.status(403).json({ error: "BANNED" });
    }

    let clickValue = 1 + Math.floor(player.level * 0.5);
    player.coins += clickValue;
    if (player.coins > player.recordCoins) player.recordCoins = player.coins;

    player.xp += 1;
    let xpNeeded = player.level <= 10 ? player.level * 100 : player.level <= 20 ? 1000 + (player.level - 10) * 1000 : 11000 + (player.level - 20) * 5000;
    
    if (player.xp >= xpNeeded) {
        player.xp -= xpNeeded;
        player.level++;
    }

    res.json({ player });
});

app.post('/api/save', (req, res) => {
    const { tgId, coins, recordCoins, chosenEmoji } = req.body;
    const player = db.players[String(tgId)];
    if (!player) return res.status(404).json({ error: "Player not found" });
    
    player.coins = coins;
    player.recordCoins = recordCoins;
    if (player.role === "creator") player.chosenEmoji = chosenEmoji;
    
    res.json({ player });
});

app.post('/api/admin/command', (req, res) => {
    const { adminTgId, command, targetTgId } = req.body;
    
    if (String(adminTgId) !== String(MASTER_CREATOR_TG_ID)) {
        return res.status(403).json({ error: "ACCESS_DENIED" });
    }

    if (command === "BAN") {
        if (db.players[String(targetTgId)]) {
            if (String(targetTgId) === String(MASTER_CREATOR_TG_ID)) return res.status(403).json({ error: "Cannot ban yourself" });
            db.players[String(targetTgId)].isBanned = true;
            logAction(adminTgId, "MANUAL_BAN", targetTgId);
            return res.json({ success: true, msg: `User ID ${targetTgId} banned.` });
        }
    }

    if (command === "UNBAN") {
        if (db.players[String(targetTgId)]) {
            db.players[String(targetTgId)].isBanned = false;
            logAction(adminTgId, "MANUAL_UNBAN", targetTgId);
            return res.json({ success: true, msg: `User ID ${targetTgId} restored.` });
        }
    }

    if (command === "KILL_SWITCH") {
        db.killSwitchActive = !db.killSwitchActive;
        logAction(adminTgId, `KILL_SWITCH_STATUS_${db.killSwitchActive}`);
        return res.json({ success: true, killSwitch: db.killSwitchActive, msg: `Kill Switch state changed!` });
    }

    if (command === "RESET_ECONOMY") {
        Object.keys(db.players).forEach(id => { db.players[id].coins = 0; });
        logAction(adminTgId, "CORE_ECONOMY_RESET_WIPE");
        return res.json({ success: true, msg: "All balances set to 0." });
    }

    res.status(400).json({ error: "Unknown Command" });
});

app.listen(PORT, () => console.log(`Master Server deployed on port ${PORT}`));
      
