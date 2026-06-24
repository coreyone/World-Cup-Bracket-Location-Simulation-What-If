


// Constants
export const WIN_POINTS = 3;
export const DRAW_POINTS = 1;

/**
 * Generate standard round-robin fixtures for a group of 4
 */
export function generateGroupFixtures(groupName, teams) {
    if (!teams || teams.length < 4) return [];
    // Standard pairing: 1v2, 3v4 | 1v3, 2v4 | 4v1, 2v3  (approx)
    // Using indices: 0v1, 2v3, 0v2, 1v3, 0v3, 1v2
    const pairs = [
        [0, 1], [2, 3],
        [0, 2], [1, 3],
        [0, 3], [1, 2]
    ];
    return pairs.map((p, i) => ({
        id: `${groupName}_M${i + 1}`,
        homeId: teams[p[0]].id,
        awayId: teams[p[1]].id
    }));
}

/**
 * Calculate standings for a single group
 * @param {Array} teams - list of team objects { id, name, ... }
 * @param {Object} matches - map of matchId -> { homeScore, awayScore }
 * @returns {Array} sorted teams with stats
 */
export function calculateGroupStandings(teams, matches) {
    // Initialize stats
    const stats = teams.map(team => ({
        ...team,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        gf: 0,
        ga: 0,
        gd: 0,
        points: 0
    }));

    const statsMap = new Map(stats.map(s => [s.id, s]));

    // Process matches (we need a way to know which matches belong to this group)
    // For simplicity, we assume the UI passes a list of "match results" relevant to this group.
    // Or we compute a full 6-match schedule for the group.

    // In this app, maybe user just inputs the table? 
    // Prompt says: "choosing match results that then compute final standings" OR "selecting final positions directly".
    // We'll support both modes.
    // If "manual_order" mode, just return the list sorted by user index.

    // Let's assume matches are passed as an array of { homeId, awayId, homeScore, awayScore }
    if (matches) {
        matches.forEach(m => {
            if (m.homeScore === undefined || m.awayScore === undefined) return;

            const home = statsMap.get(m.homeId);
            const away = statsMap.get(m.awayId);

            if (!home || !away) return;

            home.played++;
            away.played++;
            home.gf += m.homeScore;
            away.gf += m.awayScore;
            home.ga += m.awayScore;
            away.ga += m.homeScore;

            if (m.homeScore > m.awayScore) {
                home.won++;
                home.points += 3;
                away.lost++;
            } else if (m.homeScore < m.awayScore) {
                away.won++;
                away.points += 3;
                home.lost++;
            } else {
                home.drawn++;
                away.drawn++;
                home.points += 1;
                away.points += 1;
            }
        });
    }

    // Recalculate GD
    stats.forEach(t => { t.gd = t.gf - t.ga; });

    return rankGroupTeams(stats, matches || []);
}

function rankGroupTeams(teams, matches) {
    const orderedByPoints = [...teams].sort((a, b) => b.points - a.points);
    const standings = [];

    for (let start = 0; start < orderedByPoints.length;) {
        const points = orderedByPoints[start].points;
        let end = start + 1;
        while (end < orderedByPoints.length && orderedByPoints[end].points === points) end++;

        const tiedTeams = orderedByPoints.slice(start, end);
        standings.push(...rankEqualPointTeams(tiedTeams, matches));
        start = end;
    }

    return standings;
}

function rankEqualPointTeams(tiedTeams, matches) {
    if (tiedTeams.length < 2) return tiedTeams;

    const headToHead = buildHeadToHeadStats(tiedTeams, matches);
    const headToHeadGroups = splitByCriteria(tiedTeams, compareHeadToHead);
    const ranked = [];

    for (const group of headToHeadGroups) {
        if (group.length === 1) {
            ranked.push(...group);
        } else if (group.length < tiedTeams.length) {
            // FIFA reapplies the head-to-head procedure only to teams still tied.
            ranked.push(...rankEqualPointTeams(group, matches));
        } else {
            ranked.push(...rankByOverallCriteria(group));
        }
    }

    return ranked;

    function compareHeadToHead(a, b) {
        const aStats = headToHead.get(a.id);
        const bStats = headToHead.get(b.id);
        return compareDescending(aStats.points, bStats.points)
            || compareDescending(aStats.gd, bStats.gd)
            || compareDescending(aStats.gf, bStats.gf);
    }
}

function buildHeadToHeadStats(teams, matches) {
    const teamIds = new Set(teams.map(team => team.id));
    const stats = new Map(teams.map(team => [team.id, { points: 0, gf: 0, ga: 0, gd: 0 }]));

    matches.forEach(match => {
        if (!teamIds.has(match.homeId) || !teamIds.has(match.awayId)) return;
        if (!Number.isFinite(match.homeScore) || !Number.isFinite(match.awayScore)) return;

        const home = stats.get(match.homeId);
        const away = stats.get(match.awayId);
        home.gf += match.homeScore;
        home.ga += match.awayScore;
        away.gf += match.awayScore;
        away.ga += match.homeScore;

        if (match.homeScore > match.awayScore) home.points += WIN_POINTS;
        else if (match.homeScore < match.awayScore) away.points += WIN_POINTS;
        else {
            home.points += DRAW_POINTS;
            away.points += DRAW_POINTS;
        }
    });

    stats.forEach(team => { team.gd = team.gf - team.ga; });
    return stats;
}

function rankByOverallCriteria(teams) {
    return splitByCriteria(teams, compareOverallCriteria).flat();
}

function splitByCriteria(teams, compare) {
    const ordered = [...teams].sort(compare);
    const groups = [];

    ordered.forEach(team => {
        const current = groups.at(-1);
        if (!current || compare(current[0], team) !== 0) groups.push([team]);
        else current.push(team);
    });

    return groups;
}

function compareOverallCriteria(a, b) {
    return compareDescending(a.gd, b.gd)
        || compareDescending(a.gf, b.gf)
        || compareDescending(getConductScore(a), getConductScore(b))
        || compareAscending(getFifaRank(a), getFifaRank(b));
}

export function compareThirdPlaceTeams(a, b) {
    return compareDescending(a.points, b.points)
        || compareOverallCriteria(a, b);
}

function getConductScore(team) {
    return Number.isFinite(team.conductScore)
        ? team.conductScore
        : Number.isFinite(team.fairPlayScore)
            ? team.fairPlayScore
            : 0;
}

function getFifaRank(team) {
    return Number.isFinite(team.fifaRank) ? team.fifaRank : Number.MAX_SAFE_INTEGER;
}

function compareDescending(a, b) {
    return numberOrZero(b) - numberOrZero(a);
}

function compareAscending(a, b) {
    return numberOrZero(a) - numberOrZero(b);
}

function numberOrZero(value) {
    return Number.isFinite(value) ? value : 0;
}

/**
 * Determine the 8 best 3rd place teams
 */
export function getBestThirdPlace(allGroupStandings) {
    const thirds = Object.values(allGroupStandings).map(group => group[2]).filter(t => t);
    // Sort by Points, GD, GF
    return thirds.sort(compareThirdPlaceTeams).slice(0, 8);
}

/**
 * Returns true only when a team cannot finish in its group's top three.
 * Equal-point rivals count as guaranteed above the team only when they
 * already won the direct meeting; every rival that can still reach the
 * team's ceiling must satisfy that condition so a multi-team tie cannot
 * reverse the conclusion.
 */
export function isGuaranteedOutsideTopThree({ team, groupStandings, remainingByTeam, matches }) {
    const pointsCeiling = (Number(team?.points) || 0) + (remainingByTeam?.[team?.id] || 0) * WIN_POINTS;
    const rivals = (groupStandings || []).filter(rival => rival.id !== team?.id);
    const directlyBeatenBy = new Set(rivals
        .filter(rival => rival.points === pointsCeiling)
        .filter(rival => wonHeadToHead(rival.id, team?.id, matches))
        .map(rival => rival.id));
    const guaranteedAbove = rivals.filter(rival => {
        if (rival.points > pointsCeiling) return true;
        return rival.points === pointsCeiling && directlyBeatenBy.has(rival.id);
    });
    const canStillTieAtCeiling = rivals.filter(rival => canReachPoints(
        rival.points,
        remainingByTeam?.[rival.id] || 0,
        pointsCeiling
    ));

    return guaranteedAbove.length >= 3
        && canStillTieAtCeiling.every(rival => directlyBeatenBy.has(rival.id));
}

/**
 * Returns true only when no rival can finish above a team's current points,
 * and every rival that can finish level has already lost the direct meeting.
 */
export function isGuaranteedGroupWinner({ team, groupStandings, remainingByTeam, matches }) {
    const lockedPoints = Number(team?.points) || 0;
    const rivals = (groupStandings || []).filter(rival => rival.id !== team?.id);

    return rivals.every(rival => {
        const matchesRemaining = remainingByTeam?.[rival.id] || 0;
        if (canFinishAbovePoints(rival.points, matchesRemaining, lockedPoints)) return false;
        if (!canReachPoints(rival.points, matchesRemaining, lockedPoints)) return true;
        return wonHeadToHead(team?.id, rival.id, matches);
    });
}

function wonHeadToHead(winnerId, loserId, matches = []) {
    return matches.some(match => {
        if (!Number.isFinite(match.homeScore) || !Number.isFinite(match.awayScore)) return false;
        const winnerIsHome = match.homeId === winnerId && match.awayId === loserId && match.homeScore > match.awayScore;
        const winnerIsAway = match.awayId === winnerId && match.homeId === loserId && match.awayScore > match.homeScore;
        return winnerIsHome || winnerIsAway;
    });
}

function canReachPoints(currentPoints, matchesRemaining, targetPoints) {
    const targetGain = targetPoints - (Number(currentPoints) || 0);
    if (targetGain < 0) return false;

    let possibleGains = new Set([0]);
    for (let index = 0; index < matchesRemaining; index++) {
        possibleGains = new Set([...possibleGains].flatMap(gain => [gain, gain + DRAW_POINTS, gain + WIN_POINTS]));
    }

    return possibleGains.has(targetGain);
}

function canFinishAbovePoints(currentPoints, matchesRemaining, targetPoints) {
    let possiblePoints = new Set([Number(currentPoints) || 0]);
    for (let index = 0; index < matchesRemaining; index++) {
        possiblePoints = new Set([...possiblePoints].flatMap(points => [points, points + DRAW_POINTS, points + WIN_POINTS]));
    }

    return [...possiblePoints].some(points => points > targetPoints);
}


/**
 * Resolve a dynamic feed rule like "Winner Match 97" or "3rd Place A/B/C"
 */
export function resolveParticipant(rule, context) {
    const { allGroupStandings, knockoutMatches } = context;

    if (!rule) return null;

    if (rule.type === 'group_winner') {
        return allGroupStandings[rule.group]?.[0] || null;
    }
    if (rule.type === 'group_runner_up') {
        return allGroupStandings[rule.group]?.[1] || null;
    }
    if (rule.type === 'group_third') {
        // This is the tricky one. We need to assign specific 3rd place teams to specific slots.
        // We need a stable assignment algorithm.
        // For now, let's assume `thirdPlaceQualifiers` contains the MAP of "Slot ID -> Team".
        // But wait, the schedule has "options".

        // Simplified Logic: 
        // We have a list of QUALIFIED 3rd place teams (from getBestThirdPlace).
        // We have 8 Matches (74, 77, 79, 80, 81, 82, 85, 87) asking for 3rd place teams.
        // We need to match them.

        // We will count on `context.thirdPlaceAssignments` to be passed in.
        // This means we need a separate step to compute assignments.
        return context.thirdPlaceAssignments?.[context.matchId] || { name: "TBD", isPlaceholder: true };
    }

    if (rule.type === 'winner') {
        const m = knockoutMatches.find(m => m.id === rule.match);
        if (m && m.winner) return m.winner;
        return { name: `W ${rule.match}`, isPlaceholder: true };
    }

    if (rule.type === 'runner_up_match') { // For Bronze match
        const m = knockoutMatches.find(m => m.id === rule.match);
        if (m && m.loser) return m.loser;
        return { name: `L ${rule.match}`, isPlaceholder: true };
    }

    return null;
}
