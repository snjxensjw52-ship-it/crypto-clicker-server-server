'use strict';

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const ADMIN_OWNER_TG_ID = String(process.env.ADMIN_OWNER_TG_ID || '');

const CLOSED_TEST =
    String(process.env.CLOSED_TEST || 'true').toLowerCase() === 'true';

const REQUIRE_TELEGRAM_AUTH =
    String(process.env.REQUIRE_TELEGRAM_AUTH || 'false').toLowerCase() === 'true';

const TERMS_VERSION = String(process.env.TERMS_VERSION || '1.0');

const POLICY_URL = process.env.POLICY_URL || '';
const TERMS_URL = process.env.TERMS_URL || '';
const RULES_URL = process.env.RULES_URL || '';

const DATA_FILE = path.join(__dirname, 'data.json');

const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;

const FAST_INTERVAL_MS = 10;
const FAST_STREAK_BAN_MS = 60 * 1000;
const FAST_STREAK_MIN_CLICKS = 120;

const MAX_CLICKS_PER_MINUTE = 900;
const MAX_LOGS = 3000;

const STRIKE_MAX = 5;
const STRIKE_RESET_MS = 1100;

const DAILY_REWARDS = [
    500,
    1000,
    1500,
    2500,
    5000,
    7500,
    15000,
    25000,
    50000,
    100000
];

/*
========================================================
CLOSED TEST USERS
========================================================
*/

const ALLOWED_TEST_USERS = {
    vex489: {
        role: 'creator'
    },

    vex_489: {
        role: 'creator'
    },

    devilfokus: {
        role: 'tester'
    },

    xdevilx3: {
        role: 'ui_designer'
    }
};

/*
========================================================
SHOP
========================================================
*/

const SHOP = [

    {
        id: 1,
        name: 'Basic PC 💻',
        type: 'click',
        baseCost: 50,
        value: 1
    },

    {
        id: 2,
        name: 'RGB Gaming Mouse 🖱️',
        type: 'click',
        baseCost: 150,
        value: 3
    },

    {
        id: 3,
        name: 'Mechanical Keyboard 🎹',
        type: 'click',
        baseCost: 400,
        value: 8
    },

    {
        id: 4,
        name: 'Full Desk Mat 🗺️',
        type: 'click',
        baseCost: 900,
        value: 15
    },

    {
        id: 5,
        name: 'CPU Overclock 🔥',
        type: 'click',
        baseCost: 2000,
        value: 35
    },

    {
        id: 6,
        name: 'Wired Internet 🌐',
        type: 'click',
        baseCost: 4500,
        value: 80
    },

    {
        id: 7,
        name: 'Click Macros 🤖',
        type: 'click',
        baseCost: 10000,
        value: 200
    },

    {
        id: 8,
        name: 'Gaming Chair 🔥',
        type: 'click',
        baseCost: 22000,
        value: 450
    },

    {
        id: 9,
        name: 'Energy Drink Crate ⚡',
        type: 'click',
        baseCost: 50000,
        value: 1000
    },

    {
        id: 10,
        name: 'Second Monitor 📺',
        type: 'click',
        baseCost: 110000,
        value: 2500
    },

    {
        id: 11,
        name: 'GTX Graphics Card 🎮',
        type: 'passive',
        baseCost: 250,
        value: 2
    },

    {
        id: 12,
        name: 'ASIC Miner ⚡',
        type: 'passive',
        baseCost: 1200,
        value: 15
    },

    {
        id: 13,
        name: 'Mining Farm 🏭',
        type: 'passive',
        baseCost: 8000,
        value: 90
    },

    {
        id: 14,
        name: 'Power Station ⚡',
        type: 'passive',
        baseCost: 25000,
        value: 320
    },

    {
        id: 15,
        name: 'Server Rack 🖥️',
        type: 'passive',
        baseCost: 75000,
        value: 1100
    },

    {
        id: 16,
        name: 'Cloud Mining ☁️',
        type: 'passive',
        baseCost: 180000,
        value: 2800
    },

    {
        id: 17,
        name: 'Crypto Bot v1 🤖',
        type: 'passive',
        baseCost: 400000,
        value: 6500
    },

    {
        id: 18,
        name: 'AI Trader 🧠',
        type: 'passive',
        baseCost: 950000,
        value: 15000
    },

    {
        id: 19,
        name: 'Data Center ❄️',
        type: 'passive',
        baseCost: 2200000,
        value: 38000
    },

    {
        id: 20,
        name: 'Communication Satellite 🛰️',
        type: 'passive',
        baseCost: 5000000,
        value: 95000
    }

];

/*
========================================================
MEDALS
========================================================
*/

const MEDALS = [

    {
        id: 'c1',
        name: 'First Click',
        icon: '🖱️',
        type: 'clicks',
        value: 1,
        desc: 'Make your first click.'
    },

    {
        id: 'c2',
        name: 'Click Runner',
        icon: '🏃',
        type: 'clicks',
        value: 1000,
        desc: 'Make 1,000 clicks.'
    },

    {
        id: 'c3',
        name: 'Click Storm',
        icon: '🌪️',
        type: 'clicks',
        value: 10000,
        desc: 'Make 10,000 clicks.'
    },

    {
        id: 'c4',
        name: 'Click Titan',
        icon: '🗿',
        type: 'clicks',
        value: 50000,
        desc: 'Make 50,000 clicks.'
    },

    {
        id: 'c5',
        name: 'Million Clicks',
        icon: '🌟',
        type: 'clicks',
        value: 1000000,
        desc: 'Make 1,000,000 clicks.'
    },

    {
        id: 'm1',
        name: 'Coin Hoarder',
        icon: '🏦',
        type: 'coins',
        value: 100000,
        desc: 'Reach 100K coins.'
    },

    {
        id: 'm2',
        name: 'Crypto Tycoon',
        icon: '🏢',
        type: 'coins',
        value: 10000000,
        desc: 'Reach 10M coins.'
    },

    {
        id: 'm3',
        name: 'Crypto Mogul',
        icon: '👔',
        type: 'coins',
        value: 100000000,
        desc: 'Reach 100M coins.'
    },

    {
        id: 'm4',
        name: 'Billionaire',
        icon: '🤑',
        type: 'coins',
        value: 1000000000,
        desc: 'Reach 1B coins.'
    },

    {
        id: 'l1',
        name: 'Veteran',
        icon: '🏅',
        type: 'level',
        value: 25,
        desc: 'Reach level 25.'
    },

    {
        id: 'l2',
        name: 'Champion',
        icon: '🏆',
        type: 'level',
        value: 100,
        desc: 'Reach level 100.'
    },

    {
        id: 'l3',
        name: 'Grandmaster',
        icon: '👑',
        type: 'level',
        value: 250,
        desc: 'Reach level 250.'
    },

    {
        id: 'l4',
        name: 'Mythic',
        icon: '🔱',
        type: 'level',
        value: 1000,
        desc: 'Reach level 1000.'
    },

    {
        id: 't1',
        name: 'Three-Day Streak',
        icon: '🔥',
        type: 'streak',
        value: 3,
        desc: 'Claim Daily 3 days in a row.'
    },

    {
        id: 't2',
        name: 'Weekly Streak',
        icon: '📅',
        type: 'streak',
        value: 7,
        desc: 'Claim Daily 7 days in a row.'
    },

    {
        id: 't3',
        name: 'Unstoppable',
        icon: '❤️',
        type: 'streak',
        value: 50,
        desc: 'Claim Daily 50 days in a row.'
    },

    {
        id: 'v1',
        name: 'VEX Champion',
        icon: '⚔️',
        type: 'vexwins',
        value: 1,
        desc: 'Win VEX HOUR.'
    },

    {
        id: 'e1',
        name: 'Event Veteran',
        icon: '🌎',
        type: 'events',
        value: 5,
        desc: 'Participate in 5 global events.'
    }

];

/*
========================================================
TITLES
========================================================
*/

const TITLES = [

    {
        id: 'clicker',
        name: 'Clicker',
        desc: '10,000 total clicks',
        type: 'clicks',
        value: 10000
    },

    {
        id: 'veteran',
        name: 'Veteran',
        desc: '50 hours in game',
        type: 'playtime',
        value: 50 * 3600 * 1000
    },

    {
        id: 'tycoon',
        name: 'Tycoon',
        desc: '500M total earned coins',
        type: 'earned',
        value: 500000000
    },

    {
        id: 'legend',
        name: 'Legend',
        desc: '500 hours in game',
        type: 'playtime',
        value: 500 * 3600 * 1000
    },

    {
        id: 'collector',
        name: 'Collector',
        desc: '10 medals',
        type: 'medals',
        value: 10
    },

    {
        id: 'casino',
        name: 'Casino King',
        desc: '100 casino wins',
        type: 'casinoWins',
        value: 100
    },

    {
        id: 'vex',
        name: 'VEX',
        desc: 'Win VEX HOUR',
        type: 'vexWins',
        value: 1
    }

];

/*
========================================================
DATABASE
========================================================
*/

let db = {
    version: 3,
    players: {},
    sessions: {},
    promos: {},
    events: {},
    vex: {},
    logs: []
};

let saveQueue = Promise.resolve();
let dirty = false;

/*
========================================================
HELPERS
========================================================
*/

const now = () => Date.now();

function int(value, fallback = 0) {

    const n = Number(value);

    if (!Number.isFinite(n)) {
        return fallback;
    }

    return Math.floor(n);
}

function log(type, action, target = 'All', meta = {}) {

    db.logs.push({
        time: new Date().toISOString(),
        type,
        action,
        target: String(target),
        meta
    });

    if (db.logs.length > 3000) {
        db.logs.splice(
            0,
            db.logs.length - 3000
        );
    }

    dirty = true;

    console.log(
        `[${type}] ${action} ${target}`
    );
}

async function persist() {

    const data = JSON.stringify(
        {
            version: db.version,
            players: db.players,
            promos: db.promos,
            events: db.events,
            vex: db.vex,
            logs: db.logs
        },
        null,
        2
    );

    const tmp = DATA_FILE + '.tmp';

    await fs.promises.writeFile(
        tmp,
        data,
        'utf8'
    );

    await fs.promises.rename(
        tmp,
        DATA_FILE
    );

    dirty = false;
}

function queueSave() {

    dirty = true;

    saveQueue = saveQueue
        .then(persist)
        .catch(error => {
            console.error(
                '[DATABASE ERROR]',
                error
            );
        });

    return saveQueue;
}

async function load() {

    try {

        const data =
            await fs.promises.readFile(
                DATA_FILE,
                'utf8'
            );

        const parsed =
            JSON.parse(data);

        db = {
            version: 3,
            players: parsed.players || {},
            sessions: {},
            promos: parsed.promos || {},
            events: parsed.events || {},
            vex: parsed.vex || {},
            logs: Array.isArray(parsed.logs)
                ? parsed.logs.slice(-MAX_LOGS)
                : []
        };

        for (
            const player of
            Object.values(db.players)
        ) {

            normalizePlayer(player);

        }

    } catch (error) {

        if (error.code !== 'ENOENT') {
            console.error(error);
        }

        await persist();

    }

}

/*
========================================================
PLAYER NORMALIZATION
========================================================
*/

function normalizePlayer(player) {

    player.tgId =
        String(player.tgId);

    player.username =
        String(
            player.username ||
            `User_${player.tgId.slice(0, 5)}`
        ).slice(0, 24);

    player.role =
        player.role || 'player';

    player.coins =
        int(player.coins, 1000);

    player.recordCoins =
        int(
            player.recordCoins,
            player.coins
        );

    player.totalEarned =
        int(
            player.totalEarned,
            player.coins
        );

    player.level =
        Math.max(
            1,
            int(player.level, 1)
        );

    player.xp =
        int(player.xp, 0);

    player.totalClicks =
        int(player.totalClicks, 0);

    player.playtimeMs =
        int(player.playtimeMs, 0);

    player.isBanned =
        Boolean(player.isBanned);

    player.registeredAt =
        int(player.registeredAt, now());

    player.lastTapTime =
        int(player.lastTapTime, 0);

    player.fastStreakStart =
        int(player.fastStreakStart, 0);

    player.fastStreakCount =
        int(player.fastStreakCount, 0);

    player.minuteStart =
        int(player.minuteStart, now());

    player.minuteClicks =
        int(player.minuteClicks, 0);

    player.strike =
        Math.max(
            1,
            Math.min(
                STRIKE_MAX,
                int(player.strike, 1)
            )
        );

    player.strikeAt =
        int(player.strikeAt, 0);

    player.dailyStreak =
        int(player.dailyStreak, 0);

    player.dailyLast =
        String(player.dailyLast || '');

    player.medals =
        Array.isArray(player.medals)
            ? player.medals
            : [];

    player.titles =
        Array.isArray(player.titles)
            ? player.titles
            : [];

    player.selectedTitle =
        String(player.selectedTitle || '');

    player.selectedMedals =
        Array.isArray(player.selectedMedals)
            ? player.selectedMedals.slice(0, 5)
            : [];

    player.vexWins =
        int(player.vexWins, 0);

    player.casinoWins =
        int(player.casinoWins, 0);

    player.eventCount =
        int(player.eventCount, 0);

    player.acceptedTermsVersion =
        String(
            player.acceptedTermsVersion || ''
        );

    player.upgrades =
        player.upgrades &&
        typeof player.upgrades === 'object'
            ? player.upgrades
            : {};

    player.cosmetics =
        player.cosmetics &&
        typeof player.cosmetics === 'object'
            ? player.cosmetics
            : {};

    player.promoUsed =
        player.promoUsed &&
        typeof player.promoUsed === 'object'
            ? player.promoUsed
            : {};

}

/*
========================================================
LEVEL / XP
========================================================
*/

function xpNeeded(level) {

    if (level <= 10) {
        return level * 100;
    }

    if (level <= 20) {
        return 1000 + (level - 10) * 1000;
    }

    return 11000 + (level - 20) * 5000;

}

function addXp(player, amount) {

    player.xp += amount;

    let levelUps = 0;

    while (
        player.xp >=
        xpNeeded(player.level)
    ) {

        player.xp -=
            xpNeeded(player.level);

        player.level++;

        levelUps++;

        if (player.level >= 10000) {

            player.level = 10000;
            player.xp = 0;

            break;
        }

    }

    return levelUps;

}

/*
========================================================
USERNAME
========================================================
*/

function cleanName(value) {

    let name =
        String(value || '')
            .trim()
            .replace(
                /[^a-zA-Z0-9_\- ]/g,
                ''
            )
            .replace(
                /\s+/g,
                ' '
            )
            .slice(0, 24)
            .trim();

    if (!name) {
        return null;
    }

    return name;

}

function usernameKey(value) {

    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/^@/, '')
        .replace(/[\s_.\-]+/g, '');

}

/*
========================================================
PUBLIC PLAYER
========================================================
*/

function publicPlayer(player) {

    return {

        tgId: player.tgId,

        username: player.username,

        role: player.role,

        coins: player.coins,

        recordCoins:
            player.recordCoins ||
            player.coins,

        level: player.level,

        xp: player.xp,

        totalClicks:
            player.totalClicks,

        registeredAt:
            player.registeredAt,

        isBanned:
            player.isBanned,

        strike:
            player.strike,

        medals:
            player.medals,

        titles:
            player.titles,

        selectedTitle:
            player.selectedTitle,

        selectedMedals:
            player.selectedMedals,

        dailyStreak:
            player.dailyStreak,

        dailyLast:
            player.dailyLast,

        vexWins:
            player.vexWins,

        casinoWins:
            player.casinoWins,

        eventCount:
            player.eventCount,

        acceptedTermsVersion:
            player.acceptedTermsVersion,

        upgrades:
            player.upgrades,

        cosmetics:
            player.cosmetics

    };

}

/*
========================================================
TELEGRAM AUTH
========================================================
*/

function verifyTelegram(initData) {

    if (!BOT_TOKEN || !initData) {
        return null;
    }

    const params =
        new URLSearchParams(initData);

    const hash =
        params.get('hash');

    if (!hash) {
        return null;
    }

    params.delete('hash');

    const dataCheckString =
        [...params.entries()]
            .sort()
            .map(
                ([key, value]) =>
                    `${key}=${value}`
            )
            .join('\n');

    const secretKey =
        crypto
            .createHmac(
                'sha256',
                'WebAppData'
            )
            .update(BOT_TOKEN)
            .digest();

    const calculatedHash =
        crypto
            .createHmac(
                'sha256',
                secretKey
            )
            .update(dataCheckString)
            .digest('hex');

    if (
        calculatedHash.length !==
        hash.length
    ) {
        return null;
    }

    if (
        !crypto.timingSafeEqual(
            Buffer.from(calculatedHash),
            Buffer.from(hash)
        )
    ) {
        return null;
    }

    const authDate =
        int(params.get('auth_date'));

    if (!authDate) {
        return null;
    }

    if (
        now() -
        authDate * 1000 >
        86400000
    ) {
        return null;
    }

    try {

        const user =
            JSON.parse(
                params.get('user') || 'null'
            );

        return user &&
            user.id
            ? user
            : null;

    } catch {

        return null;

    }

}

/*
========================================================
SESSIONS
========================================================
*/

function createSession(
    tgId,
    role
) {

    const token =
        crypto
            .randomBytes(32)
            .toString('hex');

    db.sessions[token] = {

        tgId: String(tgId),

        role,

        expiresAt:
            now() + SESSION_TTL

    };

    return token;

}

function getSession(req) {

    const header =
        req.get('authorization') || '';

    const token =
        header.startsWith('Bearer ')
            ? header.slice(7).trim()
            : '';

    const session =
        token &&
        db.sessions[token];

    if (
        !session ||
        session.expiresAt < now()
    ) {

        if (token) {
            delete db.sessions[token];
        }

        return null;

    }

    return {

        token,

        ...session

    };

}

/*
========================================================
AUTH MIDDLEWARE
========================================================
*/

function requirePlayer(
    req,
    res,
    next
) {

    const session =
        getSession(req);

    if (!session) {

        return res.status(401).json({
            error: 'UNAUTHORIZED'
        });

    }

    const player =
        db.players
