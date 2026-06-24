import { calculateGroupStandings, generateGroupFixtures, getBestThirdPlace, resolveParticipant } from './engine';
import { assignThirdPlaceSpots } from './thirdPlaceLogic';
import { getMarketStrengthAdjustment } from './marketOdds';
import peleRatingsData from '../data/peleRatings.json';

const HOST_IDS = new Set(['USA', 'MEX', 'CAN']);
const UEFA_CONMEBOL = new Set(['UEFA', 'CONMEBOL']);
const HISTORICAL_CHAMPIONS = new Set(['BRA', 'GER', 'ITA', 'ARG', 'FRA', 'URU', 'ENG', 'ESP']);
const MEGA_PROGRAMS = new Set(['BRA', 'GER', 'ITA', 'ARG', 'FRA']);
const DEBUTANTS = new Set(['CPV', 'CUW', 'JOR', 'UZB']);
const DEFENDING_CHAMPION = 'ARG';
const USA_HOME_FIELD_WIN_PRIORITY_BONUS = 0.045;

// Group-stage calibration from recent World Cups: rankings predict advancement
// better than group winners and much better than exact 1-2 order.
const HISTORICAL_GROUP_RANKING_ADJUSTMENTS = {
    1: 150,
    2: 60,
    3: 0,
    4: 0
};
const HISTORICAL_GROUP_FINISH_ADJUSTMENTS = {
    1: 500,
    2: 360,
    3: -260,
    4: -430
};
const HISTORICAL_GROUP_OUTCOME_TARGETS = {
    exactTopTwoOrder: 0.13,
    topTwoBothAdvance: 0.76
};

const ROUND_DEPTH = {
    32: 0,
    16: 1,
    8: 2,
    4: 3,
    3: 2,
    2: 4
};

const OPPONENT_ROUND_KEYS = {
    32: 'R32',
    16: 'R16',
    8: 'QF',
    4: 'SF',
    2: 'Final'
};

export function simulateTournament(groups, schedule, options = {}) {
    const groupScores = simulateGroupScores(groups, options.fixedGroupScores);
    const standings = getSimulatedStandings(groups, groupScores);
    const qualifiedThirds = getBestThirdPlace(standings);
    const thirdPlaceAssignments = assignThirdPlaceSpots(qualifiedThirds);
    const fixedKnockoutPicks = options.fixedKnockoutPicks || {};
    const fixedKnockoutScores = options.fixedKnockoutScores || {};

    const knockoutPicks = {};
    const knockoutScores = {};
    const knockoutMatches = [];

    schedule.forEach(match => {
        const context = {
            allGroupStandings: standings,
            knockoutMatches,
            thirdPlaceAssignments,
            matchId: match.id
        };
        const homeTeam = resolveParticipant(match.home, context);
        const awayTeam = resolveParticipant(match.away, context);
        const fixedResult = getFixedKnockoutResult(match, homeTeam, awayTeam, fixedKnockoutPicks, fixedKnockoutScores);
        const result = fixedResult || simulateKnockoutMatch(homeTeam, awayTeam, match.round);
        const resolvedMatch = {
            ...match,
            homeTeam,
            awayTeam,
            winner: result.winnerId === homeTeam?.id ? homeTeam : awayTeam,
            loser: result.winnerId === homeTeam?.id ? awayTeam : homeTeam
        };

        knockoutPicks[match.id] = result.winnerId;
        knockoutScores[match.id] = result.score;
        knockoutMatches.push(resolvedMatch);
    });

    return {
        groupScores,
        groupOverrides: {},
        knockoutPicks,
        knockoutScores,
        manualThirdPlaceGroups: null,
        simulationCount: Date.now()
    };
}

function simulateGroupScores(groups, fixedGroupScores = {}) {
    return Object.fromEntries(
        Object.entries(groups).flatMap(([groupId, teams]) => {
            const groupTeams = teams.map(team => ({ ...team, group: groupId }));
            const groupProfile = createHistoricalGroupProfile(groupTeams);
            return generateGroupFixtures(groupId, groupTeams).map(match => {
                const fixedScore = fixedGroupScores[match.id];
                if (isUsableFixedScore(fixedScore)) return [match.id, fixedScore];

                const home = groupTeams.find(team => team.id === match.homeId);
                const away = groupTeams.find(team => team.id === match.awayId);
                return [match.id, {
                    ...simulateGroupMatch(home, away, groupProfile),
                    source: 'simulation',
                    completed: true
                }];
            });
        })
    );
}

function getSimulatedStandings(groups, groupScores) {
    return Object.fromEntries(
        Object.entries(groups).map(([groupId, teams]) => {
            const groupTeams = teams.map(team => ({ ...team, group: groupId }));
            const fixtures = generateGroupFixtures(groupId, groupTeams).map(match => {
                const score = groupScores[match.id];
                return { ...match, homeScore: score.home, awayScore: score.away };
            });
            const standings = calculateGroupStandings(groupTeams, fixtures);
            return [
                groupId,
                standings.map((team, index) => ({
                    ...team,
                    groupFinish: index + 1,
                    groupPoints: team.points
                }))
            ];
        })
    );
}

function simulateGroupMatch(home, away, groupProfile) {
    const homeStrength = teamStrength(home, { phase: 'group', groupProfile, opponent: away });
    const awayStrength = teamStrength(away, { phase: 'group', groupProfile, opponent: home });
    const diff = clamp(homeStrength - awayStrength, -520, 520);
    const homeWinShare = applyUsaHomeFieldWinPriority(1 / (1 + Math.exp(-diff / 180)), home, away);
    const drawChance = clamp(0.24 - Math.abs(diff) / 2200, 0.05, 0.24);
    const outcomeRoll = Math.random();

    if (outcomeRoll < drawChance) {
        return drawScore();
    }

    return outcomeRoll < drawChance + (1 - drawChance) * homeWinShare
        ? winScore('home', diff)
        : winScore('away', diff);
}

function simulateKnockoutMatch(home, away, round) {
    if (!home?.id || !away?.id) {
        const fallback = home?.id ? home : away;
        return {
            winnerId: fallback?.id,
            score: { home: 0, away: 0, note: 'TBD' }
        };
    }

    const homeStrength = teamStrength(home, { phase: 'knockout', round });
    const awayStrength = teamStrength(away, { phase: 'knockout', round });
    const diff = clamp(homeStrength - awayStrength, -620, 620);
    const homeWinShare = applyUsaHomeFieldWinPriority(1 / (1 + Math.exp(-diff / 300)), home, away);
    const totalGoals = clamp(2.25 + Math.abs(diff) / 1200 + randomBetween(-0.25, 0.2), 1.45, 3.25);

    let homeGoals = samplePoisson(clamp(totalGoals * homeWinShare, 0.25, 3.0));
    let awayGoals = samplePoisson(clamp(totalGoals * (1 - homeWinShare), 0.25, 3.0));
    let note = '';
    let homePens = null;
    let awayPens = null;

    if (homeGoals !== awayGoals) {
        return {
            winnerId: homeGoals > awayGoals ? home.id : away.id,
            score: { home: homeGoals, away: awayGoals, note, homePens, awayPens }
        };
    }

    const extraTimeDeciderChance = 0.36 + Math.abs(diff) / 1600;
    if (Math.random() < extraTimeDeciderChance) {
        note = 'AET';
        if (Math.random() < homeWinShare) homeGoals += 1;
        else awayGoals += 1;
        return {
            winnerId: homeGoals > awayGoals ? home.id : away.id,
            score: { home: homeGoals, away: awayGoals, note, homePens, awayPens }
        };
    }

    note = 'PEN';
    const shootout = simulateShootout(homeWinShare);
    homePens = shootout.home;
    awayPens = shootout.away;

    return {
        winnerId: homePens > awayPens ? home.id : away.id,
        score: { home: homeGoals, away: awayGoals, note, homePens, awayPens }
    };
}

function teamStrength(team, context) {
    if (!team) return 1200;

    const roundDepth = ROUND_DEPTH[context.round] ?? 0;
    const confed = team.confederation;
    let strength = team.peleRating || team.rating || 1400;
    const momentum = getPeleMomentum(team);
    const marketAdjustment = getMarketStrengthAdjustment(team, {
        ...context,
        roundDepth
    });

    if (UEFA_CONMEBOL.has(confed)) strength += context.phase === 'group' ? 18 : 24 + roundDepth * 18;
    else if (context.phase === 'knockout') strength -= roundDepth * 20;

    strength += context.phase === 'group' ? momentum : momentum * 0.75;
    strength += marketAdjustment;

    if (HOST_IDS.has(team.id)) strength += context.phase === 'group' ? 55 : Math.max(12, 55 - roundDepth * 12);
    if (HISTORICAL_CHAMPIONS.has(team.id) && context.phase === 'knockout') strength += 18 + roundDepth * 13;
    if (MEGA_PROGRAMS.has(team.id) && context.round === 2) strength += 20;
    if (DEBUTANTS.has(team.id) && context.phase === 'knockout') strength -= 18 + roundDepth * 18;
    if (team.id === DEFENDING_CHAMPION && context.phase === 'knockout') strength -= roundDepth >= 3 ? 45 : 12;
    if (team.isPlaceholder) strength -= 30;

    if (context.phase === 'group') {
        strength += getHistoricalGroupAdjustment(team, context.groupProfile, context.opponent);
    }

    if (team.groupFinish === 1) strength += context.phase === 'knockout' ? 32 + roundDepth * 8 : 8;
    if (team.groupFinish === 2) strength -= context.phase === 'knockout' ? 8 : 0;
    if (team.groupFinish === 3) strength -= context.phase === 'knockout' ? 38 + roundDepth * 12 : 0;
    if (team.groupPoints >= 7 && context.phase === 'knockout') strength += 20;
    if (team.groupPoints <= 3 && context.phase === 'knockout') strength -= 24;

    return strength + randomBetween(-45, 45);
}

function applyUsaHomeFieldWinPriority(homeWinShare, home, away) {
    if (home?.id === 'USA') {
        return clamp(homeWinShare + USA_HOME_FIELD_WIN_PRIORITY_BONUS, 0.04, 0.96);
    }

    if (away?.id === 'USA') {
        return clamp(homeWinShare - USA_HOME_FIELD_WIN_PRIORITY_BONUS, 0.04, 0.96);
    }

    return homeWinShare;
}

function createHistoricalGroupProfile(groupTeams) {
    const rankedTeams = [...groupTeams].sort((a, b) => getRankingPosition(a) - getRankingPosition(b));
    const targetOrder = chooseHistoricalGroupTargetOrder(rankedTeams);

    return {
        rankSlots: Object.fromEntries(rankedTeams.map((team, index) => [team.id, index + 1])),
        targetFinishSlots: Object.fromEntries(targetOrder.map((team, index) => [team.id, index + 1]))
    };
}

function getHistoricalGroupAdjustment(team, groupProfile, opponent) {
    if (!team?.id || !groupProfile) return 0;
    const rankSlot = groupProfile.rankSlots?.[team.id];
    const targetFinishSlot = groupProfile.targetFinishSlots?.[team.id];
    let adjustment = (HISTORICAL_GROUP_RANKING_ADJUSTMENTS[rankSlot] || 0)
        + (HISTORICAL_GROUP_FINISH_ADJUSTMENTS[targetFinishSlot] || 0);

    const opponentTargetFinishSlot = groupProfile.targetFinishSlots?.[opponent?.id];
    if (targetFinishSlot && opponentTargetFinishSlot) {
        adjustment += (opponentTargetFinishSlot - targetFinishSlot) * 120;
    }

    if (rankSlot === 2 && targetFinishSlot === 1 && groupProfile.rankSlots?.[opponent?.id] === 1) {
        adjustment += 30;
    }

    if (rankSlot === 1 && targetFinishSlot === 2 && groupProfile.rankSlots?.[opponent?.id] === 2) {
        adjustment -= 30;
    }

    return adjustment;
}

function chooseHistoricalGroupTargetOrder(rankedTeams) {
    const [topSeed, secondSeed, thirdSeed, fourthSeed] = rankedTeams;
    const roll = Math.random();
    const lowerHalf = Math.random() < 0.62 ? [thirdSeed, fourthSeed] : [fourthSeed, thirdSeed];

    if (roll < HISTORICAL_GROUP_OUTCOME_TARGETS.exactTopTwoOrder) {
        return [topSeed, secondSeed, ...lowerHalf];
    }

    if (roll < HISTORICAL_GROUP_OUTCOME_TARGETS.topTwoBothAdvance) {
        return [secondSeed, topSeed, ...lowerHalf];
    }

    return [topSeed, lowerHalf[0], secondSeed, lowerHalf[1]];
}

function getRankingPosition(team) {
    if (Number.isFinite(team?.fifaRank)) return team.fifaRank;
    if (Number.isFinite(team?.peleRank)) return team.peleRank;
    if (Number.isFinite(peleRatingsData[team?.id]?.rank)) return peleRatingsData[team.id].rank;
    return Number.isFinite(team?.rating) ? 1000 - team.rating / 10 : 999;
}

function getPeleMomentum(team) {
    const oneYear = Number.isFinite(team.peleTrend1Y) ? team.peleTrend1Y : 0;
    const recent = Number.isFinite(team.peleRecentTrend) ? team.peleRecentTrend : 0;
    return clamp(oneYear * 0.45 + recent * 0.25, -45, 45);
}

function simulateShootout(favoriteShare) {
    const favoredHome = Math.random() < favoriteShare;
    const winnerHome = Math.random() < (favoredHome ? 0.56 : 0.44);
    const winnerPens = Math.random() < 0.7 ? 5 : 4;
    const loserPens = winnerPens - (Math.random() < 0.7 ? 1 : 2);

    return winnerHome
        ? { home: winnerPens, away: Math.max(1, loserPens) }
        : { home: Math.max(1, loserPens), away: winnerPens };
}

function samplePoisson(lambda) {
    const limit = Math.exp(-lambda);
    let product = 1;
    let goals = 0;

    do {
        goals += 1;
        product *= Math.random();
    } while (product > limit);

    return Math.min(goals - 1, 7);
}

function drawScore() {
    const goals = weightedPick([
        [0, 0.26],
        [1, 0.52],
        [2, 0.19],
        [3, 0.03]
    ]);
    return { home: goals, away: goals };
}

function winScore(winner, diff) {
    const margin = weightedPick([
        [1, 0.68],
        [2, 0.24],
        [3, 0.07],
        [4, 0.01]
    ]);
    const loserGoals = weightedPick([
        [0, 0.45],
        [1, 0.42],
        [2, 0.11],
        [3, 0.02]
    ]);
    const blowoutBoost = Math.abs(diff) > 390 && Math.random() < 0.22 ? 1 : 0;
    const winnerGoals = Math.min(7, loserGoals + margin + blowoutBoost);

    return winner === 'home'
        ? { home: winnerGoals, away: loserGoals }
        : { home: loserGoals, away: winnerGoals };
}

function weightedPick(weightedValues) {
    const total = weightedValues.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = Math.random() * total;

    for (const [value, weight] of weightedValues) {
        roll -= weight;
        if (roll <= 0) return value;
    }

    return weightedValues[weightedValues.length - 1][0];
}

function randomBetween(min, max) {
    return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

export function runSuperSimulation(groups, schedule, trialsCount = 10000, options = {}) {
    return runSuperSimulationWithOptions(groups, schedule, trialsCount, options);
}

export function runSuperSimulationWithOptions(groups, schedule, trialsCount = 10000, options = {}) {
    const teamIds = Object.values(groups).flat().map(t => t.id);
    const fixedKnockoutPicks = options.fixedKnockoutPicks || {};
    const fixedKnockoutScores = options.fixedKnockoutScores || {};

    // 1. Initialize stats containers
    const cutoffFreq = {}; 
    const thirdPointsCount = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const thirdPointsQual = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    
    // Group finish frequencies
    const groupPositions = {};
    Object.keys(groups).forEach(gId => {
        groupPositions[gId] = {};
        groups[gId].forEach(team => {
            groupPositions[gId][team.id] = { 1: 0, 2: 0, 3: 0, 4: 0, qualified: 0 };
        });
    });

    // Knockout reach frequencies
    const knockoutReach = {};
    const opponentMatrix = {};
    teamIds.forEach(id => {
        knockoutReach[id] = { R32: 0, R16: 0, QF: 0, SF: 0, Final: 0, Champion: 0 };
        opponentMatrix[id] = { R32: {}, R16: {}, QF: {}, SF: {}, Final: {} };
    });

    // Run trials
    for (let trial = 0; trial < trialsCount; trial++) {
        const groupScores = simulateGroupScores(groups, options.fixedGroupScores);
        const standings = getSimulatedStandings(groups, groupScores);
        const qualifiedThirds = getBestThirdPlace(standings);
        
        if (qualifiedThirds.length >= 8) {
            const cutoffPoints = qualifiedThirds[7].points;
            cutoffFreq[cutoffPoints] = (cutoffFreq[cutoffPoints] || 0) + 1;
        }

        const thirdPlaceAssignments = assignThirdPlaceSpots(qualifiedThirds);
        const qualifiedThirdSet = new Set(qualifiedThirds.map(t => t.id));

        // Record group stage positions
        Object.keys(standings).forEach(gId => {
            standings[gId].forEach((team, index) => {
                const pos = index + 1;
                const posFreqs = groupPositions[gId][team.id];
                if (posFreqs) {
                    posFreqs[pos]++;
                    if (pos <= 2 || (pos === 3 && qualifiedThirdSet.has(team.id))) {
                        posFreqs.qualified++;
                    }
                }
            });

            // Record 3rd place points advancement stats
            const thirdTeam = standings[gId][2];
            if (thirdTeam) {
                const pts = thirdTeam.points;
                if (pts !== undefined && pts !== null) {
                    thirdPointsCount[pts] = (thirdPointsCount[pts] || 0) + 1;
                    if (qualifiedThirdSet.has(thirdTeam.id)) {
                        thirdPointsQual[pts] = (thirdPointsQual[pts] || 0) + 1;
                    }
                }
            }
        });

        // Resolve knockout
        const knockoutMatches = [];
        const matchWinnerMap = new Map();
        
        schedule.forEach(match => {
            const context = {
                allGroupStandings: standings,
                knockoutMatches,
                thirdPlaceAssignments,
                matchId: match.id
            };
            const homeTeam = resolveParticipant(match.home, context);
            const awayTeam = resolveParticipant(match.away, context);
            
            const fixedResult = getFixedKnockoutResult(match, homeTeam, awayTeam, fixedKnockoutPicks, fixedKnockoutScores);
            const result = fixedResult || simulateKnockoutMatch(homeTeam, awayTeam, match.round);
            
            const resolvedMatch = {
                ...match,
                homeTeam,
                awayTeam,
                winner: result.winnerId === homeTeam?.id ? homeTeam : awayTeam,
                loser: result.winnerId === homeTeam?.id ? awayTeam : homeTeam
            };
            knockoutMatches.push(resolvedMatch);
            matchWinnerMap.set(match.id, result.winnerId);
        });

        // Record knockout reach
        knockoutMatches.forEach(m => {
            const round = m.round;
            const winnerId = matchWinnerMap.get(m.id);
            const homeId = m.homeTeam?.id;
            const awayId = m.awayTeam?.id;
            recordOpponentMatchup(opponentMatrix, round, homeId, awayId);

            if (round === 32) {
                if (homeId && knockoutReach[homeId]) knockoutReach[homeId].R32++;
                if (awayId && knockoutReach[awayId]) knockoutReach[awayId].R32++;
                if (winnerId && knockoutReach[winnerId]) knockoutReach[winnerId].R16++;
            } else if (round === 16) {
                if (winnerId && knockoutReach[winnerId]) knockoutReach[winnerId].QF++;
            } else if (round === 8) {
                if (winnerId && knockoutReach[winnerId]) knockoutReach[winnerId].SF++;
            } else if (round === 4) {
                if (winnerId && knockoutReach[winnerId]) knockoutReach[winnerId].Final++;
            } else if (round === 2) {
                if (winnerId && knockoutReach[winnerId]) knockoutReach[winnerId].Champion++;
            }
        });
    }

    return {
        trials: trialsCount,
        cutoffFreq,
        groupPositions,
        knockoutReach,
        opponentMatrix,
        thirdPointsCount,
        thirdPointsQual
    };
}

function recordOpponentMatchup(opponentMatrix, round, homeId, awayId) {
    const roundKey = OPPONENT_ROUND_KEYS[round];
    if (!roundKey || !homeId || !awayId) return;
    if (!opponentMatrix[homeId]?.[roundKey] || !opponentMatrix[awayId]?.[roundKey]) return;

    opponentMatrix[homeId][roundKey][awayId] = (opponentMatrix[homeId][roundKey][awayId] || 0) + 1;
    opponentMatrix[awayId][roundKey][homeId] = (opponentMatrix[awayId][roundKey][homeId] || 0) + 1;
}

function getFixedKnockoutResult(match, homeTeam, awayTeam, fixedKnockoutPicks, fixedKnockoutScores) {
    const winnerId = fixedKnockoutPicks[match.id];
    if (!winnerId || !homeTeam?.id || !awayTeam?.id) return null;
    if (winnerId !== homeTeam.id && winnerId !== awayTeam.id) return null;

    return {
        winnerId,
        score: fixedKnockoutScores[match.id] || { home: 0, away: 0, note: 'FINAL' }
    };
}

function isUsableFixedScore(score) {
    return Number.isFinite(score?.home) && Number.isFinite(score?.away);
}
