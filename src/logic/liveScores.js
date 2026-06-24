import { generateGroupFixtures } from './engine';

export const ESPN_WORLD_CUP_SCOREBOARD_URL =
    'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=200&region=us&lang=en';

export const LIVE_SCORE_START_MS = Date.parse('2026-06-11T00:00:00-07:00');
const KNOCKOUT_START_MS = Date.parse('2026-06-28T00:00:00-07:00');

const TEAM_ALIASES = {
    BOS: 'BIH',
    BIH: 'BIH',
    CRC: 'CRC',
    CZE: 'CZE',
    CZR: 'CZE',
    CIV: 'CIV',
    CDI: 'CIV',
    CUW: 'CUW',
    CUR: 'CUW',
    CPV: 'CPV',
    CVE: 'CPV',
    KSA: 'KSA',
    SAU: 'KSA',
    KOR: 'KOR',
    SKO: 'KOR',
    RSA: 'RSA',
    SAF: 'RSA',
    NZL: 'NZL',
    TUR: 'TUR',
    USA: 'USA'
};

export function isLiveScoresAvailable(now = new Date()) {
    return now.getTime() >= LIVE_SCORE_START_MS;
}

export async function fetchWorldCupLiveScores({ groups, knockoutMatches, signal } = {}) {
    const response = await fetch(ESPN_WORLD_CUP_SCOREBOARD_URL, { signal });
    if (!response.ok) {
        throw new Error(`ESPN scoreboard request failed (${response.status})`);
    }

    const data = await response.json();
    return mapEspnEventsToAppState(data.events || [], groups, knockoutMatches);
}

export function mapEspnEventsToAppState(events, groups, knockoutMatches = []) {
    const groupFixtureMap = buildGroupFixtureMap(groups);
    const knockoutFixtureMap = buildKnockoutFixtureMap(knockoutMatches);
    const groupScores = {};
    const groupFixtureMeta = {};
    const knockoutScores = {};
    const knockoutPicks = {};
    let appliedCount = 0;

    events
        .map(normalizeEspnEvent)
        .filter(Boolean)
        .forEach(event => {
            const pairKey = getPairKey(event.teams[0].id, event.teams[1].id);
            const groupFixture = groupFixtureMap.get(pairKey);
            const knockoutFixture = knockoutFixtureMap.get(pairKey);
            const isKnockoutWindow = Date.parse(event.updatedAt) >= KNOCKOUT_START_MS;

            if (groupFixture) {
                groupFixtureMeta[groupFixture.matchId] = buildFixtureMeta(event);

                if (event.scheduled) {
                    appliedCount += 1;
                    return;
                }

                groupScores[groupFixture.matchId] = buildLiveScore(event, groupFixture);
                appliedCount += 1;
                return;
            }

            if (isKnockoutWindow && knockoutFixture) {
                if (event.scheduled) return;
                knockoutScores[knockoutFixture.matchId] = buildLiveScore(event, knockoutFixture);

                if (event.completed) {
                    const winner = event.teams.find(team => team.winner);
                    if (winner?.id) knockoutPicks[knockoutFixture.matchId] = winner.id;
                }

                appliedCount += 1;
                return;
            }

            if (!knockoutFixture) return;

            if (event.scheduled) return;

            knockoutScores[knockoutFixture.matchId] = buildLiveScore(event, knockoutFixture);

            if (event.completed) {
                const winner = event.teams.find(team => team.winner);
                if (winner?.id) knockoutPicks[knockoutFixture.matchId] = winner.id;
            }

            appliedCount += 1;
        });

    return {
        groupScores,
        groupFixtureMeta,
        knockoutScores,
        knockoutPicks,
        meta: {
            source: 'ESPN',
            lastUpdated: new Date().toISOString(),
            eventCount: events.length,
            appliedCount
        }
    };
}

function buildGroupFixtureMap(groups = {}) {
    const map = new Map();

    Object.entries(groups).forEach(([groupId, teams]) => {
        const groupTeams = teams.map(team => ({ ...team, group: groupId }));
        generateGroupFixtures(groupId, groupTeams).forEach(match => {
            map.set(getPairKey(match.homeId, match.awayId), {
                matchId: match.id,
                homeId: match.homeId,
                awayId: match.awayId
            });
        });
    });

    return map;
}

function buildKnockoutFixtureMap(knockoutMatches = []) {
    const map = new Map();

    knockoutMatches.forEach(match => {
        const homeId = match.homeTeam?.id;
        const awayId = match.awayTeam?.id;
        if (!homeId || !awayId || match.homeTeam?.isPlaceholder || match.awayTeam?.isPlaceholder) return;

        map.set(getPairKey(homeId, awayId), {
            matchId: match.id,
            homeId,
            awayId
        });
    });

    return map;
}

function buildLiveScore(event, fixture) {
    return {
        home: getTeamScore(event, fixture.homeId),
        away: getTeamScore(event, fixture.awayId),
        note: '',
        source: 'live',
        status: event.statusDescription,
        completed: event.completed,
        espnEventId: event.id,
        updatedAt: event.updatedAt
    };
}

function buildFixtureMeta(event) {
    return {
        startsAt: event.updatedAt,
        status: event.statusDescription,
        completed: event.completed,
        scheduled: event.scheduled,
        source: 'live',
        espnEventId: event.id
    };
}

function normalizeEspnEvent(event) {
    const competitors = event.competitions?.[0]?.competitors || [];
    if (competitors.length < 2) return null;

    const teams = competitors.map(competitor => {
        const id = normalizeTeamId(competitor.team?.abbreviation);
        const score = Number.parseInt(competitor.score, 10);
        return {
            id,
            score,
            winner: Boolean(competitor.winner)
        };
    });

    const scheduled = isScheduled(event.status?.type?.name);
    if (teams.some(team => !team.id || (!scheduled && !Number.isFinite(team.score)))) return null;

    return {
        id: event.id,
        name: event.name,
        updatedAt: event.date,
        statusDescription: event.status?.type?.description || 'Live',
        completed: Boolean(event.status?.type?.completed),
        scheduled,
        teams
    };
}

function normalizeTeamId(abbreviation = '') {
    const id = abbreviation.trim().toUpperCase();
    return TEAM_ALIASES[id] || id;
}

function getPairKey(a, b) {
    return [a, b].sort().join('|');
}

function getTeamScore(event, teamId) {
    return event.teams.find(team => team.id === teamId)?.score ?? 0;
}

function isScheduled(statusName = '') {
    return statusName.toUpperCase().includes('SCHEDULED') || statusName.toUpperCase() === 'STATUS_PRE';
}
