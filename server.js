const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();

// ======================================================
// RENDER
// ======================================================

const PORT = Number(process.env.PORT || 10000);
const HOST = "0.0.0.0";

const DATA_FILE = path.join(__dirname, "data.json");

// ======================================================
// CONFIG
// ======================================================

// ТВОЙ ОСНОВНОЙ TELEGRAM ID
// Лучше задать через Render Environment:
// ADMIN_OWNER_TG_ID
const OWNER_TG_ID = String(
    process.env.ADMIN_OWNER_TG_ID || ""
);

// Секрет Creator Panel.
// Задай в Render Environment:
// ADMIN_SECRET=какая-нибудь-длинная-строка
const ADMIN_SECRET =
    process.env.ADMIN_SECRET || "";

// Античит:
// 1-9 ms = мгновенный RED FLAG + бан
const RED_FLAG_LIMIT_MS = 10;

// Максимум обычных кликов за минуту
const MAX_CLICKS_PER_MINUTE = 550;

// Максимум запросов клика за секунду
const MAX_CLICKS_PER_SECOND = 20;

// Strike
const STRIKE_MAX = 5;
const STRIKE_TIMEOUT_MS = 1300;

// Leaderboard
const LEADERBOARD_PAGE_SIZE = 20;

// ======================================================
// EXPRESS
// ======================================================

app.use(cors());

app.use(
    express.json({
        limit: "32kb"
    })
);

// Игра находится в той же папке, что и server.js
app.use(
    express.static(__dirname)
);

// ======================================================
// DATABASE
// ======================================================

function createEmptyDatabase() {
    return {
        players: {},
        logs: [],
        killSwitchActive: false
    };
}

function loadDatabase() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            console.log("data.json not found. Creating new database.");
            return createEmptyDatabase();
        }

        const raw = fs.readFileSync(
            DATA_FILE,
            "utf8"
        );

        const data = JSON.parse(raw);

        return {
            players: data.players || {},
            logs: Array.isArray(data.logs)
                ? data.logs
                : [],
            killSwitchActive:
                Boolean(data.killSwitchActive)
        };

    } catch (error) {

        console.error(
            "DATABASE LOAD ERROR:",
            error.message
        );

        return createEmptyDatabase();
    }
}

let db = loadDatabase();

let saveTimer = null;

function saveDatabase() {

    clearTimeout(saveTimer);

    saveTimer = setTimeout(() => {

        try {

            const temporaryFile =
                DATA_FILE + ".tmp";

            fs.writeFileSync(
                temporaryFile,
                JSON.stringify(
                    db,
                    null,
                    2
                ),
                "utf8"
            );

            fs.renameSync(
                temporaryFile,
                DATA_FILE
            );

        } catch (error) {

            console.error(
                "DATABASE SAVE ERROR:",
                error.message
            );
        }

    }, 100);
}

// ======================================================
// LOGGING
// ======================================================

function addLog(
    type,
    action,
    target = "ALL",
    details = ""
) {

    const entry = {
        time:
            new Date().toISOString(),

        type,
        action,

        target:
            String(target),

        details:
            String(details)
    };

    db.logs.push(entry);

    // Храним максимум 3000 логов
    if (db.logs.length > 3000) {
        db.logs.shift();
    }

    console.log(
        `[${entry.time}]`,
        `[${type}]`,
        action,
        target,
        details
    );

    saveDatabase();
}

// ======================================================
// ADMIN
// ======================================================

function isCreator(tgId) {

    return (
        OWNER_TG_ID !== "" &&
        String(tgId) === OWNER_TG_ID
    );
}

function checkAdmin(req, res) {

    const secret =
        req.headers["x-admin-secret"];

    if (
        !ADMIN_SECRET ||
        !secret ||
        secret !== ADMIN_SECRET
    ) {

        res.status(403).json({
            error: "ACCESS_DENIED"
        });

        return false;
    }

    return true;
}

// ======================================================
// NAME CENSOR
// ======================================================

const BANNED_WORDS = [

    "fuck",
    "fucker",
    "fucking",

    "shit",
    "bitch",
    "asshole",
    "dick",
    "pussy",

    "porn",
    "porno",

    "sex",

    "nigger",
    "nigga",

    "scam",
    "cheat",
    "hacker",
    "hack",

    "admin",
    "moderator",
    "creator",
    "owner"
];

function cleanName(
    input,
    tgId
) {

    let name =
        String(input || "")
            .trim()
            .slice(0, 24);

    // Разрешаем:
    // английские буквы
    // цифры
    // _
    name =
        name.replace(
            /[^a-zA-Z0-9_]/g,
            ""
        );

    if (!name) {
        return `User_${String(tgId).slice(0, 6)}`;
    }

    const lower =
        name.toLowerCase();

    for (const word of BANNED_WORDS) {

        if (
            lower.includes(word)
        ) {

            return `User_${String(tgId).slice(0, 6)}`;
        }
    }

    return name;
}

// ======================================================
// PLAYER
// ======================================================

function getPlayer(tgId) {

    return (
        db.players[
            String(tgId)
        ] || null
    );
}

function xpRequired(level) {

    if (level <= 10) {
        return level * 100;
    }

    if (level <= 20) {
        return (
            1000 +
            (level - 10) * 1000
        );
    }

    return (
        11000 +
        (level - 20) * 5000
    );
}

function publicPlayer(player) {

    if (!player) {
        return null;
    }

    return {

        tgId:
            player.tgId,

        username:
            player.username,

        role:
            player.role,

        chosenEmoji:
            player.chosenEmoji,

        coins:
            player.coins,

        recordCoins:
            player.recordCoins,

        level:
            player.level,

        xp:
            player.xp,

        xpNeeded:
            xpRequired(
                player.level
            ),

        totalClicks:
            player.totalClicks,

        registrationDate:
            player.registrationDate,

        isBanned:
            player.isBanned,

        strike:
            player.strike,

        anticheatFlags:
            player.anticheatFlags
    };
}

// ======================================================
// HEALTH
// ======================================================

app.get(
    "/api/health",
    (req, res) => {

        res.json({

            ok: true,

            server:
                "crypto-clicker",

            version:
                "2.0-server",

            players:
                Object.keys(
                    db.players
                ).length,

            killSwitch:
                db.killSwitchActive,

            uptime:
                Math.floor(
                    process.uptime()
                )
        });
    }
);

// ======================================================
// GAME
// ======================================================

app.get(
    "/",
    (req, res) => {

        const indexFile =
            path.join(
                __dirname,
                "index.html"
            );

        if (
            fs.existsSync(indexFile)
        ) {

            return res.sendFile(
                indexFile
            );
        }

        res.send(
            "Crypto Clicker Server is online."
        );
    }
);

// ======================================================
// AUTH
// ======================================================

app.post(
    "/api/auth",
    (req, res) => {

        const {
            tgId,
            firstName,
            username
        } = req.body || {};

        if (!tgId) {

            return res.status(400).json({
                error:
                    "TG_ID_REQUIRED"
            });
        }

        const id =
            String(tgId);

        // Kill switch
        if (
            db.killSwitchActive &&
            !isCreator(id)
        ) {

            return res.status(503).json({

                error:
                    "SERVER_CLOSED",

                message:
                    "The game is temporarily closed for maintenance."
            });
        }

        let player =
            getPlayer(id);

        // Уже забанен
        if (
            player &&
            player.isBanned
        ) {

            return res.status(403).json({

                error:
                    "ANTICHEAT_BANNED",

                message:
                    "Your account is permanently banned."
            });
        }

        // Новый игрок
        if (!player) {

            player = {

                tgId:
                    id,

                username:
                    isCreator(id)
                        ? "Creator"
                        : cleanName(
                            username ||
                            firstName ||
                            "Player",
                            id
                        ),

                role:
                    isCreator(id)
                        ? "creator"
                        : "player",

                chosenEmoji:
                    "",

                coins:
                    1000,

                recordCoins:
                    1000,

                level:
                    1,

                xp:
                    0,

                totalClicks:
                    0,

                registrationDate:
                    new Date().toISOString(),

                isBanned:
                    false,

                lastTapTime:
                    0,

                minuteStartTime:
                    Date.now(),

                minuteClicks:
                    0,

                secondStartTime:
                    Date.now(),

                secondClicks:
                    0,

                strike:
                    0,

                lastStrikeAt:
                    0,

                anticheatFlags:
                    0
            };

            db.players[id] =
                player;

            addLog(
                "SYSTEM",
                "NEW_PLAYER",
                id,
                player.username
            );

        }

        // Если ID создателя
        if (
            isCreator(id)
        ) {

            player.role =
                "creator";

            player.username =
                "Creator";
        }

        saveDatabase();

        res.json({

            player:
                publicPlayer(player),

            killSwitch:
                db.killSwitchActive
        });
    }
);

// ======================================================
// CLICK
// ======================================================

app.post(
    "/api/click",
    (req, res) => {

        const {
            tgId
        } = req.body || {};

        if (!tgId) {

            return res.status(400).json({
                error:
                    "TG_ID_REQUIRED"
            });
        }

        const player =
            getPlayer(tgId);

        if (!player) {

            return res.status(404).json({
                error:
                    "PLAYER_NOT_FOUND"
            });
        }

        if (
            player.isBanned
        ) {

            return res.status(403).json({
                error:
                    "ANTICHEAT_BANNED"
            });
        }

        const now =
            Date.now();

        const interval =
            player.lastTapTime
                ? now -
                  player.lastTapTime
                : null;

        // ==================================================
        // 🔴 RED FLAG: 1-9ms
        // ==================================================

        if (
            interval !== null &&
            interval > 0 &&
            interval < RED_FLAG_LIMIT_MS
        ) {

            player.isBanned =
                true;

            player.anticheatFlags++;

            addLog(
                "RED_FLAG",
                "PERMANENT_BAN_1_9MS",
                player.tgId,
                `interval=${interval}ms`
            );

            saveDatabase();

            return res.status(403).json({

                error:
                    "ANTICHEAT_RED_FLAG",

                reason:
                    `Impossible click interval: ${interval}ms`
            });
        }

        // ==================================================
        // 🔴 0ms
        // ==================================================

        if (
            interval === 0
        ) {

            player.isBanned =
                true;

            player.anticheatFlags++;

            addLog(
                "RED_FLAG",
                "PERMANENT_BAN_ZERO_INTERVAL",
                player.tgId,
                "interval=0ms"
            );

            saveDatabase();

            return res.status(403).json({

                error:
                    "ANTICHEAT_RED_FLAG"
            });
        }

        // ==================================================
        // PER SECOND LIMIT
        // ==================================================

        if (
            now -
            player.secondStartTime
            >= 1000
        ) {

            player.secondStartTime =
                now;

            player.secondClicks =
                0;
        }

        player.secondClicks++;

        if (
            player.secondClicks >
            MAX_CLICKS_PER_SECOND
        ) {

            player.isBanned =
                true;

            player.anticheatFlags++;

            addLog(
                "RED_FLAG",
                "PERMANENT_BAN_20_PLUS_PER_SECOND",
                player.tgId,
                `clicks=${player.secondClicks}`
            );

            saveDatabase();

            return res.status(403).json({

                error:
                    "ANTICHEAT_RED_FLAG"
            });
        }

        // ==================================================
        // PER MINUTE LIMIT
        // ==================================================

        if (
            now -
            player.minuteStartTime
            >= 60000
        ) {

            player.minuteStartTime =
                now;

            player.minuteClicks =
                0;
        }

        player.minuteClicks++;

        if (
            player.minuteClicks >
            MAX_CLICKS_PER_MINUTE
        ) {

            player.isBanned =
                true;

            player.anticheatFlags++;

            addLog(
                "ANTICHEAT",
                "PERMANENT_BAN_550_PER_MINUTE",
                player.tgId,
                `clicks=${player.minuteClicks}`
            );

            saveDatabase();

            return res.status(403).json({

                error:
                    "ANTICHEAT_STAGE_3"
            });
        }

        // ==================================================
        // STRIKE
        // ==================================================

        if (
            player.lastStrikeAt &&
            now -
            player.lastStrikeAt
            <= STRIKE_TIMEOUT_MS
        ) {

            player.strike =
                Math.min(
                    STRIKE_MAX,
                    player.strike + 1
                );

        } else {

            player.strike =
                1;
        }

        player.lastStrikeAt =
            now;

        // ==================================================
        // SERVER CLICK
        // ==================================================

        player.lastTapTime =
            now;

        player.totalClicks++;

        // ==================================================
        // COINS
        // ==================================================

        const baseReward =
            Math.max(
                1,
                1 +
                Math.floor(
                    player.level * 0.5
                )
            );

        const multiplier =
            Math.max(
                1,
                Math.min(
                    STRIKE_MAX,
                    player.strike
                )
            );

        const reward =
            baseReward *
            multiplier;

        player.coins +=
            reward;

        if (
            player.coins >
            player.recordCoins
        ) {

            player.recordCoins =
                player.coins;
        }

        // ==================================================
        // XP
        // ==================================================

        player.xp++;

        let levelUp =
            false;

        while (
            player.xp >=
            xpRequired(
                player.level
            )
        ) {

            player.xp -=
                xpRequired(
                    player.level
                );

            player.level++;

            levelUp =
                true;
        }

        saveDatabase();

        res.json({

            success:
                true,

            reward,

            baseReward,

            multiplier,

            levelUp,

            player:
                publicPlayer(player)
        });
    }
);

// ======================================================
// PROFILE
// ======================================================

app.post(
    "/api/profile",
    (req, res) => {

        const {
            tgId,
            username,
            chosenEmoji
        } = req.body || {};

        const player =
            getPlayer(tgId);

        if (!player) {

            return res.status(404).json({
                error:
                    "PLAYER_NOT_FOUND"
            });
        }

        if (
            player.isBanned
        ) {

            return res.status(403).json({
                error:
                    "ANTICHEAT_BANNED"
            });
        }

        if (
            username !== undefined
        ) {

            const cleaned =
                cleanName(
                    username,
                    player.tgId
                );

            // Если имя прошло цензуру
            // и не было изменено
            if (
                cleaned !==
                String(username)
                    .trim()
                    .slice(0, 24)
                    .replace(
                        /[^a-zA-Z0-9_]/g,
                        ""
                    )
            ) {

                return res.status(400).json({
                    error:
                        "NAME_REJECTED"
                });
            }

            player.username =
                player.role === "creator"
                    ? "Creator"
                    : cleaned;
        }

        if (
            chosenEmoji !== undefined
        ) {

            player.chosenEmoji =
                String(
                    chosenEmoji
                ).slice(0, 8);
        }

        saveDatabase();

        res.json({

            success:
                true,

            player:
                publicPlayer(player)
        });
    }
);

// ======================================================
// SAVE
// ======================================================
//
// ВАЖНО:
// Клиент НЕ может менять Coins / XP / Level.
// Сервер сам их хранит.
//
// ======================================================

app.post(
    "/a
