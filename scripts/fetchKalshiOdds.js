import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const GROUPS_FILE = path.join(process.cwd(), 'src/data/groups.json');
const OUTPUT_FILE = path.join(process.cwd(), 'src/data/kalshiOdds.json');
const KEY_FILE = path.join(process.cwd(), 'World Cup.txt');

const HOST_IDS = new Set(['USA', 'MEX', 'CAN']);

// Helper to generate group fixtures (matching logic in engine.js)
function generateGroupFixtures(groupId, teams) {
    if (!teams || teams.length < 4) return [];
    const pairs = [
        [0, 1], [2, 3],
        [0, 2], [1, 3],
        [0, 3], [1, 2]
    ];
    return pairs.map((p, i) => ({
        id: `${groupId}_M${i + 1}`,
        homeId: teams[p[0]].id,
        awayId: teams[p[1]].id
    }));
}

// Generate realistic mock odds based on ratings
function generateRatingOdds(groups) {
    const odds = {};
    Object.entries(groups).forEach(([groupId, teams]) => {
        const fixtures = generateGroupFixtures(groupId, teams);
        fixtures.forEach(fixture => {
            const home = teams.find(t => t.id === fixture.homeId);
            const away = teams.find(t => t.id === fixture.awayId);
            if (!home || !away) return;

            let homeRating = home.rating || 1500;
            let awayRating = away.rating || 1500;

            // Host advantage
            if (HOST_IDS.has(home.id)) homeRating += 55;
            if (HOST_IDS.has(away.id)) awayRating += 55;

            const diff = homeRating - awayRating;
            const homeWinShare = 1 / (1 + Math.exp(-diff / 180));
            const drawChance = Math.min(0.24, Math.max(0.05, 0.24 - Math.abs(diff) / 2200));

            const homeWinChance = (1 - drawChance) * homeWinShare;
            const awayWinChance = (1 - drawChance) * (1 - homeWinShare);

            const pHome = Math.round(homeWinChance * 100);
            const pDraw = Math.round(drawChance * 100);
            const pAway = 100 - pHome - pDraw;

            odds[fixture.id] = {
                home: pHome,
                draw: pDraw,
                away: pAway
            };
        });
    });
    return odds;
}

// Sign headers for Kalshi API if credentials exist
function signRequest(privateKeyPem, timestamp, method, pathWithoutQuery) {
    try {
        const message = `${timestamp}${method}${pathWithoutQuery}`;
        const privateKey = crypto.createPrivateKey(privateKeyPem);
        const signature = crypto.sign(
            'sha256',
            Buffer.from(message, 'utf-8'),
            {
                key: privateKey,
                padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
                saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST
            }
        );
        return signature.toString('base64');
    } catch (e) {
        console.error('Error signing request:', e.message);
        return null;
    }
}

async function main() {
    console.log('Starting Kalshi odds sync...');

    let groupsData;
    try {
        groupsData = JSON.parse(fs.readFileSync(GROUPS_FILE, 'utf8'));
    } catch (e) {
        console.error('Error reading groups.json:', e.message);
        process.exit(1);
    }

    const groups = groupsData.groups || {};
    let kalshiOdds = null;

    // Check if we have the private key and access key ID for auth
    const hasKeyFile = fs.existsSync(KEY_FILE);
    const keyId = process.env.KALSHI_ACCESS_KEY_ID;

    if (hasKeyFile && keyId) {
        try {
            const privateKeyPem = fs.readFileSync(KEY_FILE, 'utf8');
            const timestamp = Date.now().toString();
            const method = 'GET';
            const requestPath = '/trade-api/v2/markets';
            const signature = signRequest(privateKeyPem, timestamp, method, requestPath);

            if (signature) {
                console.log('Authenticating with Kalshi using RSA Private Key...');
                const res = await fetch(`https://trading-api.kalshi.com${requestPath}?limit=100&status=open`, {
                    headers: {
                        'KALSHI-ACCESS-KEY': keyId,
                        'KALSHI-ACCESS-TIMESTAMP': timestamp,
                        'KALSHI-ACCESS-SIGNATURE': signature,
                        'Content-Type': 'application/json'
                    }
                });

                if (res.ok) {
                    const data = await res.json();
                    console.log(`Successfully fetched ${data.markets?.length} markets from Kalshi API.`);
                    // In a production scenario with live World Cup markets, we would map the data here.
                    // Since no World Cup markets exist yet, we will log this and proceed to fallback.
                } else {
                    console.warn(`Kalshi API returned status ${res.status}. Falling back to rating-based simulation.`);
                }
            }
        } catch (e) {
            console.warn('Failed to fetch from Kalshi API:', e.message);
        }
    } else {
        console.log('No Kalshi credentials found in environment. Using rating-based simulation.');
    }

    // Generate simulated odds as fallback
    if (!kalshiOdds) {
        console.log('Generating simulated Kalshi odds from team ratings...');
        kalshiOdds = generateRatingOdds(groups);
    }

    try {
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(kalshiOdds, null, 4));
        console.log(`Saved Kalshi odds to ${OUTPUT_FILE}`);
    } catch (e) {
        console.error('Error writing output file:', e.message);
        process.exit(1);
    }
}

main();
