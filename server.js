'use strict';

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();

app.disable('x-powered-by');

app.use(cors());

app.use(
    express.json({
        limit: '256kb'
    })
);

const PORT =
    Number(
        process.env.PORT || 3000
    );

const HOST =
    process.env.HOST || '0.0.0.0';

/*
========================================================
ENVIRONMENT
========================================================
*/

const BOT_TOKEN =
    process.env.BOT_TOKEN || '';

const ADMIN_SECRET =
    process.env.ADMIN_SECRET || '';

const ADMIN_OWNER_TG_ID =
    String(
        process.env.ADMIN_OWNER_TG_ID || ''
    );

const CLOSED_TEST =
    String(
        process.env.CLOSED_TEST ?? 'true'
    ).toLowerCase() === 'true';

const REQUIRE_TELEGRAM_AUTH =
    String(
        process.env.REQUIRE_TELEGRAM_AUTH ?? 'false'
    ).toLowerCase() === 'true';

const TERMS_VERSION =
    String(
        process.env.TERMS_VERSION || '1.0'
    );

const POLICY_URL =
    process.env.POLICY_URL || '';

const TERMS_URL =
    process.env.TERMS_URL || '';

const RULES_URL =
    process.env.RULES_URL || '';

/*
========================================================
DATABASE
========================================================
*/

const DATA_FILE =
    path.join(
        __dirname,
        'data.json'
    );

const SESSION_TTL =
    7 * 24 * 60 * 60 * 1000;

const MAX_LOGS =
    3000;

/*
========================================================
ANTI-CHEAT
========================================================
*/

const MAX_CLICKS_PER_MINUTE =
    900;

const FAST_INTERVAL_MS =
    10;

const FAST_STREAK_BAN_MS =
    60 * 1000;

const FAST_STREAK_MIN_CLICKS =
    120;

const STRIKE_MAX =
    5;

const STRIKE_RESET_MS =
    1100;

/*
========================================================
DAILY REWARDS
========================================================
*/

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

    devilfokus: {
        role: 'tester'
    },

    xdevilx3: {
        role: 'ui_designer'
    }

};
/*
========================================================
ACHIEVEMENTS
========================================================
*/

app.get(
    '/api/achievements',
    requirePlayer,
    (req, res) => {

        res.json({

            medals:
                MEDALS,

            titles:
                TITLES,

            playerMedals:
                req.player.medals,

            playerTitles:
                req.player.titles,

            selectedMedals:
                req.player.selectedMedals,

            selectedTitle:
                req.player.selectedTitle

        });

    }
);

/*
========================================================
PROFILE
========================================================
*/

app.post(
    '/api/profile',
    requirePlayer,
    async (req, res) => {

        const player =
            req.player;

        if (
            typeof req.body?.username ===
            'string'
        ) {

            const name =
                cleanName(
                    req.body.username
                );

            if (!name) {

                return res.status(400).json({
                    error:
                        'INVALID_USERNAME'
                });

            }

            player.username =
                name;

        }

        if (
            typeof req.body?.selectedTitle ===
            'string'
        ) {

            const title =
                req.body.selectedTitle;

            if (
                title !== '' &&
                !player.titles.includes(
                    title
                )
            ) {

                return res.status(400).json({
                    error:
                        'TITLE_NOT_OWNED'
                });

            }

            player.selectedTitle =
                title;

        }

        if (
            Array.isArray(
                req.body?.selectedMedals
            )
        ) {

            player.selectedMedals =
                req.body.selectedMedals
                    .filter(
                        id =>
                            player.medals
                                .includes(id)
                    )
                    .slice(0, 5);

        }

        await queueSave();

        return res.json({

            ok:
                true,

            player:
                publicPlayer(
                    player
                )

        });

    }
);

/*
========================================================
LEADERBOARD
========================================================
*/

app.get(
    '/api/leaderboard',
    requirePlayer,
    (req, res) => {

        const sort =
            [
                'coins',
                'level',
                'clicks',
                'earned'
            ].includes(
                req.query.sort
            )
                ? req.query.sort
                : 'coins';

        const players =
            Object.values(
                db.players
            )
            .filter(
                player =>
                    !player.isBanned
            );

        players.sort(
            (a, b) => {

                if (
                    sort ===
                    'level'
                ) {

                    return (
                        b.level -
                        a.level
                    ) ||
                    (
                        b.xp -
                        a.xp
                    );

                }

                if (
                    sort ===
                    'clicks'
                ) {

                    return (
                        b.totalClicks -
                        a.totalClicks
                    );

                }

                if (
                    sort ===
                    'earned'
                ) {

                    return (
                        b.totalEarned -
                        a.totalEarned
                    );

                }

                return (
                    b.coins -
                    a.coins
                );

            }
        );

        const result =
            players.map(
                (player, index) => ({

                    rank:
                        index + 1,

                    tgId:
                        player.tgId,

                    username:
                        player.username,

                    role:
                        player.role,

                    coins:
                        player.coins,

                    level:
                        player.level,

                    xp:
                        player.xp,

                    totalClicks:
                        player.totalClicks,

                    totalEarned:
                        player.totalEarned,

                    medals:
                        player.medals.length,

                    title:
                        player.selectedTitle

                })
            );

        return res.json({

            sort,

            players:
                result

        });

    }
);
/*
========================================================
VEX HOUR
========================================================
*/

app.get(
    '/api/vex',
    requirePlayer,
    (req, res) => {

        const player =
            req.player;

        const currentHour =
            hourKey();

        const players =
            Object.values(
                db.players
            )
            .filter(
                p =>
                    !p.isBanned &&
                    p.hourKey ===
                    currentHour
            )
            .sort(
                (a, b) =>
                    b.hourCoins -
                    a.hourCoins
            );

        const winner =
            players.length > 0
                ? players[0]
                : null;

        const rank =
            players.findIndex(
                p =>
                    p.tgId ===
                    player.tgId
            ) + 1;

        res.json({

            hourKey:
                currentHour,

            hourClicks:
                player.hourClicks,

            hourCoins:
                player.hourCoins,

            rank:
                rank > 0
                    ? rank
                    : null,

            players:
                players
                    .slice(0, 20)
                    .map(
                        (p, index) => ({

                            rank:
                                index + 1,

                            username:
                                p.username,

                            clicks:
                                p.hourClicks,

                            coins:
                                p.hourCoins,

                            isMe:
                                p.tgId ===
                                player.tgId

                        })
                    ),

            winner:
                winner
                    ? {
                        username:
                            winner.username,

                        coins:
                            winner.hourCoins,

                        clicks:
                            winner.hourClicks
                    }
                    : null

        });

    }
);

/*
========================================================
VEX HOUR CLAIM
========================================================
*/

app.post(
    '/api/vex/claim',
    requirePlayer,
    async (req, res) => {

        const player =
            req.player;

        const currentHour =
            hourKey();

        const players =
            Object.values(
                db.players
            )
            .filter(
                p =>
                    !p.isBanned &&
                    p.hourKey ===
                    currentHour
            )
            .sort(
                (a, b) =>
                    b.hourCoins -
                    a.hourCoins
            );

        if (!players.length) {

            return res.status(400).json({
                error:
                    'NO_PLAYERS'
            });

        }

        const winner =
            players[0];

        if (
            winner.tgId !==
            player.tgId
        ) {

            return res.status(400).json({
                error:
                    'NOT_WINNER',

                winner:
                    winner.username,

                coins:
                    winner.hourCoins
            });

        }

        if (
            player.hourCoins <= 0
        ) {

            return res.status(400).json({
                error:
                    'NO_ACTIVITY'
            });

        }

        const claimKey =
            currentHour;

        if (
            player.vexClaimedHour ===
            claimKey
        ) {

            return res.status(400).json({
                error:
                    'ALREADY_CLAIMED'
            });

        }

        player.vexClaimedHour =
            claimKey;

        player.vexWins++;

        const medalsUnlocked =
            updateMedals(
                player
            );

        const titlesUnlocked =
            updateTitles(
                player
            );

        log(
            'VEX',
            'WIN',
            player.username,
            {
                hour:
                    currentHour,

                clicks:
                    player.hourClicks,

                coins:
                    player.hourCoins
            }
        );

        await queueSave();

        return res.json({

            ok:
                true,

            vexWins:
                player.vexWins,

            medalsUnlocked,

            titlesUnlocked

        });

    }
);

/*
========================================================
DAILY STATUS
========================================================
*/

app.get(
    '/api/daily',
    requirePlayer,
    (req, res) => {

        const player =
            req.player;

        const today =
            dateKey();

        const claimed =
            player.dailyLast ===
            today;

        const nextIndex =
            Math.min(
                DAILY_REWARDS.length - 1,
                Math.max(
                    0,
                    player.dailyStreak
                )
            );

        res.json({

            today,

            claimed,

            streak:
                player.dailyStreak,

            rewards:
                DAILY_REWARDS,

            nextReward:
                DAILY_REWARDS[
                    nextIndex
                ]

        });

    }
);
/*
========================================================
PROMO CODES
========================================================
*/

app.post(
    '/api/promo/redeem',
    requirePlayer,
    async (req, res) => {

        const player =
            req.player;

        const code =
            String(
                req.body?.code || ''
            )
            .trim()
            .toUpperCase();

        if (!code) {

            return res.status(400).json({
                error:
                    'INVALID_PROMO'
            });

        }

        const promo =
            db.promos[code];

        if (!promo) {

            return res.status(404).json({
                error:
                    'PROMO_NOT_FOUND'
            });

        }

        if (
            promo.expiresAt &&
            promo.expiresAt < now()
        ) {

            return res.status(400).json({
                error:
                    'PROMO_EXPIRED'
            });

        }

        if (
            player.promoUsed[code]
        ) {

            return res.status(400).json({
                error:
                    'PROMO_ALREADY_USED'
            });

        }

        if (
            promo.maxUses &&
            promo.uses >=
                promo.maxUses
        ) {

            return res.status(400).json({
                error:
                    'PROMO_LIMIT_REACHED'
            });

        }

        const reward =
            Math.max(
                0,
                int(promo.reward)
            );

        player.coins +=
            reward;

        player.totalEarned +=
            reward;

        player.recordCoins =
            Math.max(
                player.recordCoins,
                player.coins
            );

        player.promoUsed[code] =
            true;

        promo.uses =
            int(promo.uses) + 1;

        updateMedals(
            player
        );

        updateTitles(
            player
        );

        log(
            'PROMO',
            'REDEEM',
            player.username,
            {
                code,
                reward
            }
        );

        await queueSave();

        return res.json({

            ok:
                true,

            reward,

            coins:
                player.coins

        });

    }
);

/*
========================================================
ADMIN — CREATE PROMO
========================================================
*/

app.post(
    '/api/admin/promo',
    requireAdmin,
    async (req, res) => {

        const code =
            String(
                req.body?.code || ''
            )
            .trim()
            .toUpperCase();

        const reward =
            Math.max(
                0,
                int(
                    req.body?.reward
                )
            );

        const maxUses =
            Math.max(
                0,
                int(
                    req.body?.maxUses
                )
            );

        const expiresAt =
            Math.max(
                0,
                int(
                    req.body?.expiresAt
                )
            );

        if (
            !code ||
            reward <= 0
        ) {

            return res.status(400).json({
                error:
                    'INVALID_PROMO_DATA'
            });

        }

        db.promos[code] = {

            reward,

            maxUses,

            uses:
                0,

            expiresAt,

            createdAt:
                now()

        };

        log(
            'ADMIN',
            'CREATE_PROMO',
            code,
            {
                reward,
                maxUses,
                expiresAt
            }
        );

        await queueSave();

        return res.json({

            ok:
                true,

            code,
            reward,
            maxUses,
            expiresAt

        });

    }
);

/*
========================================================
ADMIN — LIST PROMOS
========================================================
*/

app.get(
    '/api/admin/promos',
    requireAdmin,
    (req, res) => {

        return res.json({

            promos:
                db.promos

        });

    }
);

/*
========================================================
ADMIN — DELETE PROMO
========================================================
*/

app.delete(
    '/api/admin/promo/:code',
    requireAdmin,
    async (req, res) => {

        const code =
            String(
                req.params.code || ''
            )
            .trim()
            .toUpperCase();

        if (
            !db.promos[code]
        ) {

            return res.status(404).json({
                error:
                    'PROMO_NOT_FOUND'
            });

        }

        delete db.promos[code];

        log(
            'ADMIN',
            'DELETE_PROMO',
            code
        );

        await queueSave();

        return res.json({
            ok:
                true
        });

    }
);



