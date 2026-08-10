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

