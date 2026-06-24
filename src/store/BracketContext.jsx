
import React, { createContext, useReducer, useEffect, useMemo, useState } from 'react';
import groupsData from '../data/groups.json';
import scheduleData from '../data/schedule.json';
import settingsData from '../data/settings.json';
import stadiumsData from '../data/stadiums.json';
import peleRatingsData from '../data/peleRatings.json';
import { calculateGroupStandings, getBestThirdPlace, resolveParticipant, generateGroupFixtures } from '../logic/engine';
import { assignThirdPlaceSpots } from '../logic/thirdPlaceLogic';
import { getMarketOddsProfile } from '../logic/marketOdds';
import { completedLiveFinalsChanged, hasSimulationResults, mergeIncomingLiveScores } from '../logic/liveSimulationState';
import { mergeSavedState } from './statePersistence';

const BracketContext = createContext();
const enrichedGroups = enrichGroupsWithPele(groupsData.groups);

const INITIAL_STATE = {
    // Data
    groups: enrichedGroups,
    schedule: scheduleData.knockout,
    settings: settingsData,

    // User State
    groupScores: {}, // { "MEX-RSA": { home: 1, away: 1 } }
    groupOverrides: {}, // { "A": ["MEX", "RSA", ...] } IDs in order
    knockoutPicks: {}, // { 73: "MEX" } (Winner ID)
    knockoutScores: {}, // { 73: { home: 2, away: 1, note: "AET" } }
    manualThirdPlaceGroups: null, // ["A", "C", ...] forces those current 3rd-place teams to advance
    simulationCount: 0,
    compactMode: true,
    superSimStats: null,
    liveScoresEnabled: false,
    liveSimulationEnabled: true,
    groupFixtureMeta: {},
    liveScoreMeta: {
        status: 'idle',
        lastUpdated: null,
        error: null,
        simulationResetNotice: null,
        eventCount: 0,
        appliedCount: 0
    },
    preLiveState: null
};

function enrichGroupsWithPele(groups) {
    return Object.fromEntries(
        Object.entries(groups).map(([groupId, teams]) => [
            groupId,
            teams.map(team => {
                const pele = peleRatingsData[team.id];
                const marketOdds = getMarketOddsProfile(team.id);

                return {
                    ...team,
                    ...(pele ? {
                        rating: Math.round(pele.pele),
                        peleRating: pele.pele,
                        peleRank: pele.rank,
                        peleTrend1Y: pele.oneYearChange,
                        peleRecentTrend: pele.recentQuarterChange,
                        peleLatestQuarter: pele.latestQuarter
                    } : {}),
                    ...(marketOdds ? {
                        marketOdds: marketOdds.americanOdds,
                        marketOddsLabel: marketOdds.formattedOdds,
                        marketImpliedProbability: marketOdds.impliedProbability,
                        marketTier: marketOdds.tier,
                        marketOddsAsOf: marketOdds.asOf
                    } : {})
                };
            })
        ])
    );
}

// Actions
const ACTIONS = {
    UPDATE_GROUP_SCORE: 'UPDATE_GROUP_SCORE',
    SET_GROUP_ORDER: 'SET_GROUP_ORDER',
    PICK_WINNER: 'PICK_WINNER',
    SIMULATE_TOURNAMENT: 'SIMULATE_TOURNAMENT',
    SUPER_SIMULATION: 'SUPER_SIMULATION',
    TOGGLE_THIRD_PLACE_GROUP: 'TOGGLE_THIRD_PLACE_GROUP',
    CLEAR_RESULTS: 'CLEAR_RESULTS',
    RESET_ALL: 'RESET_ALL',
    LOAD_STATE: 'LOAD_STATE',
    ENABLE_LIVE_SCORES: 'ENABLE_LIVE_SCORES',
    DISABLE_LIVE_SCORES: 'DISABLE_LIVE_SCORES',
    LIVE_SCORES_LOADING: 'LIVE_SCORES_LOADING',
    APPLY_LIVE_SCORES: 'APPLY_LIVE_SCORES',
    LIVE_SCORES_ERROR: 'LIVE_SCORES_ERROR',
    TOGGLE_LIVE_SIMULATION: 'TOGGLE_LIVE_SIMULATION'
};

function reducer(state, action) {
    switch (action.type) {
        case ACTIONS.UPDATE_GROUP_SCORE:
            if (isLockedFinalLiveScore(state.groupScores[action.matchKey])) return state;
            return {
                ...state,
                groupScores: { ...state.groupScores, [action.matchKey]: action.score },
                groupOverrides: {},
                knockoutPicks: {},
                knockoutScores: {},
                superSimStats: null
            };
        case ACTIONS.SET_GROUP_ORDER:
            return {
                ...state,
                groupOverrides: { ...state.groupOverrides, [action.groupId]: action.order },
                knockoutPicks: {},
                knockoutScores: {},
                superSimStats: null
            };
        case ACTIONS.PICK_WINNER:
            if (isLockedFinalLiveScore(state.knockoutScores[action.matchId])) return state;
            return clearChangedMatchScores({
                ...state,
                knockoutPicks: { ...state.knockoutPicks, [action.matchId]: action.winnerId },
                superSimStats: null
            }, action.matchId);
        case ACTIONS.TOGGLE_THIRD_PLACE_GROUP:
            return {
                ...toggleThirdPlaceGroup(state, action.groupId),
                superSimStats: null
            };
        case ACTIONS.SIMULATE_TOURNAMENT:
            return applySimulationPayload(state, {
                ...state,
                ...action.payload,
                superSimStats: null
            });
        case ACTIONS.SUPER_SIMULATION:
            return applySimulationPayload(state, {
                ...state,
                ...action.payload
            });
        case ACTIONS.CLEAR_RESULTS:
            if (state.liveScoresEnabled && hasLockedFinalLiveScores(state)) {
                return {
                    ...state,
                    liveScoreMeta: {
                        ...state.liveScoreMeta,
                        status: 'ready',
                        error: 'Final live results are locked while live mode is enabled.'
                    }
                };
            }
            return {
                ...state,
                groupScores: {},
                groupOverrides: {},
                knockoutPicks: {},
                knockoutScores: {},
                manualThirdPlaceGroups: null,
                simulationCount: 0,
                superSimStats: null,
                liveScoresEnabled: false,
                liveSimulationEnabled: true,
                groupFixtureMeta: {},
                preLiveState: null,
                liveScoreMeta: INITIAL_STATE.liveScoreMeta
            };
        case ACTIONS.RESET_ALL:
            return { ...INITIAL_STATE };
        case ACTIONS.LOAD_STATE:
            return mergeSavedState(state, action.payload);
        case ACTIONS.ENABLE_LIVE_SCORES:
            return {
                ...state,
                groupScores: {},
                groupOverrides: {},
                knockoutPicks: {},
                knockoutScores: {},
                manualThirdPlaceGroups: null,
                simulationCount: 0,
                superSimStats: null,
                liveScoresEnabled: true,
                liveSimulationEnabled: true,
                groupFixtureMeta: {},
                preLiveState: state.preLiveState || createPreLiveSnapshot(state),
                liveScoreMeta: {
                    ...state.liveScoreMeta,
                    status: 'syncing',
                    error: null
                }
            };
        case ACTIONS.DISABLE_LIVE_SCORES: {
            const restoredState = state.preLiveState || {};
            return {
                ...state,
                ...restoredState,
                liveScoresEnabled: false,
                liveSimulationEnabled: false,
                groupFixtureMeta: {},
                preLiveState: null,
                liveScoreMeta: {
                    ...state.liveScoreMeta,
                    status: 'off',
                    error: null
                }
            };
        }
        case ACTIONS.LIVE_SCORES_LOADING:
            return {
                ...state,
                liveScoreMeta: {
                    ...state.liveScoreMeta,
                    status: 'syncing',
                    error: null
                }
            };
        case ACTIONS.APPLY_LIVE_SCORES:
            if (!state.liveScoresEnabled) return state;
            return applyLiveScoresPayload(state, action.payload);
        case ACTIONS.LIVE_SCORES_ERROR:
            return {
                ...state,
                liveScoreMeta: {
                    ...state.liveScoreMeta,
                    status: 'error',
                    error: action.error || 'Unable to sync live scores'
                }
            };
        case ACTIONS.TOGGLE_LIVE_SIMULATION:
            if (!state.liveScoresEnabled) return state;
            return {
                ...state,
                liveSimulationEnabled: !state.liveSimulationEnabled
            };
        default:
            return state;
    }
}

function applyLiveScoresPayload(state, payload) {
    const completedFinalsChanged = completedLiveFinalsChanged(state, payload);
    const hasSimulation = hasSimulationResults(state);
    const shouldClearSimulation = completedFinalsChanged && hasSimulation;
    const shouldPreserveSimulationScores = hasSimulation && !completedFinalsChanged;
    const liveScoreMeta = {
        status: 'ready',
        error: null,
        ...payload.meta,
        simulationResetNotice: shouldClearSimulation
            ? 'A new completed final score synced. Simulation results and the likely-opponents heatmap were cleared; re-run Monte Carlo to include the latest final.'
            : state.liveScoreMeta.simulationResetNotice || null
    };

    return {
        ...state,
        groupScores: shouldPreserveSimulationScores
            ? mergeIncomingLiveScores(state.groupScores, payload.groupScores)
            : payload.groupScores,
        groupOverrides: shouldClearSimulation ? {} : state.groupOverrides,
        knockoutScores: shouldPreserveSimulationScores
            ? mergeIncomingLiveScores(state.knockoutScores, payload.knockoutScores)
            : payload.knockoutScores,
        knockoutPicks: shouldPreserveSimulationScores
            ? { ...state.knockoutPicks, ...payload.knockoutPicks }
            : payload.knockoutPicks,
        groupFixtureMeta: payload.groupFixtureMeta || {},
        manualThirdPlaceGroups: null,
        simulationCount: shouldClearSimulation ? 0 : state.simulationCount,
        superSimStats: shouldClearSimulation ? null : state.superSimStats,
        liveScoreMeta
    };
}

function applySimulationPayload(previousState, nextState) {
    const preserveLiveMode = previousState.liveScoresEnabled && previousState.liveSimulationEnabled;

    if (!preserveLiveMode) {
        return {
            ...nextState,
            liveScoresEnabled: false,
            liveSimulationEnabled: false,
            preLiveState: null,
            liveScoreMeta: INITIAL_STATE.liveScoreMeta
        };
    }

    return {
        ...nextState,
        liveScoresEnabled: true,
        liveSimulationEnabled: true,
        preLiveState: previousState.preLiveState,
        liveScoreMeta: {
            ...previousState.liveScoreMeta,
            simulationResetNotice: null
        }
    };
}

function isLockedFinalLiveScore(score) {
    return score?.source === 'live' && score.completed === true;
}

function hasLockedFinalLiveScores(state) {
    return [
        ...Object.values(state.groupScores || {}),
        ...Object.values(state.knockoutScores || {})
    ].some(isLockedFinalLiveScore);
}

function createPreLiveSnapshot(state) {
    return {
        groupScores: state.groupScores,
        groupOverrides: state.groupOverrides,
        knockoutPicks: state.knockoutPicks,
        knockoutScores: state.knockoutScores,
        manualThirdPlaceGroups: state.manualThirdPlaceGroups,
        simulationCount: state.simulationCount,
        superSimStats: state.superSimStats
    };
}

function toggleThirdPlaceGroup(state, groupId) {
    if (state.simulationCount || state.liveScoresEnabled) return state;

    const advancingLimit = state.settings.thirdPlaceQualifiers;
    const currentGroups = state.manualThirdPlaceGroups || [];
    const isSelected = currentGroups.includes(groupId);
    const manualThirdPlaceGroups = isSelected
        ? currentGroups.filter(id => id !== groupId)
        : currentGroups.length < advancingLimit
            ? [...currentGroups, groupId]
            : currentGroups;

    return {
        ...state,
        manualThirdPlaceGroups,
        knockoutPicks: {},
        knockoutScores: {}
    };
}

function clearChangedMatchScores(state, changedMatchId) {
    const affectedIds = new Set([changedMatchId]);
    let changed = true;

    while (changed) {
        changed = false;
        state.schedule.forEach(match => {
            const dependsOnAffectedMatch = [match.home, match.away].some(rule =>
                (rule?.type === 'winner' || rule?.type === 'runner_up_match') && affectedIds.has(rule.match)
            );

            if (dependsOnAffectedMatch && !affectedIds.has(match.id)) {
                affectedIds.add(match.id);
                changed = true;
            }
        });
    }

    const knockoutPicks = { ...state.knockoutPicks };
    const knockoutScores = { ...state.knockoutScores };

    affectedIds.forEach(matchId => {
        if (matchId !== changedMatchId) delete knockoutPicks[matchId];
        delete knockoutScores[matchId];
    });

    return { ...state, knockoutPicks, knockoutScores };
}

export function BracketProvider({ children }) {
    const [state, dispatch] = useReducer(reducer, INITIAL_STATE, (initial) => {
        try {
            const local = localStorage.getItem('wc26_bracket_state');
            return local ? mergeSavedState(initial, JSON.parse(local)) : initial;
        } catch {
            return initial;
        }
    });

    // Persistence
    useEffect(() => {
        try {
            localStorage.setItem('wc26_bracket_state', JSON.stringify({
                groupScores: state.groupScores,
                groupOverrides: state.groupOverrides,
                knockoutPicks: state.knockoutPicks,
                knockoutScores: state.knockoutScores,
                manualThirdPlaceGroups: state.manualThirdPlaceGroups,
                simulationCount: state.simulationCount,
                groupFixtureMeta: state.groupFixtureMeta
            }));
        } catch {
            // Storage is optional; private browsing and quota limits must not break the app.
        }
    }, [state.groupScores, state.groupOverrides, state.knockoutPicks, state.knockoutScores, state.manualThirdPlaceGroups, state.simulationCount, state.liveScoresEnabled, state.liveSimulationEnabled, state.groupFixtureMeta, state.liveScoreMeta, state.preLiveState]);


    // Computed State (The "Engine" runs here)
    const computed = useMemo(() => {
        // 1. Group Standings
        const standings = {};
        Object.keys(state.groups).forEach(gId => {
            const groupTeams = state.groups[gId].map(team => ({ ...team, group: gId }));

            // If override exists, map it to team objects
            if (state.groupOverrides[gId]) {
                const orderedTeams = state.groupOverrides[gId]
                    .map(id => groupTeams.find(t => t.id === id))
                    .filter(Boolean);
                const orderedTeamIds = new Set(orderedTeams.map(team => team.id));
                standings[gId] = [
                    ...orderedTeams,
                    ...groupTeams.filter(team => !orderedTeamIds.has(team.id))
                ];
            } else {
                // Calc from scores
                const fixtures = generateGroupFixtures(gId, groupTeams);
                const matchResults = fixtures.map(m => {
                    const score = state.groupScores[m.id];
                    if (state.liveScoresEnabled && score?.source === 'live' && !score.completed) return m;
                    return score ? { ...m, homeScore: score.home, awayScore: score.away } : m;
                });
                standings[gId] = calculateGroupStandings(groupTeams, matchResults);
            }
        });

        // 2. Third Place Qualifiers. Manual selections lock in first, then the
        // strongest remaining third-place teams fill any open slots.
        const automaticThirds = getBestThirdPlace(standings);
        const manualThirdPlaceGroups = (state.simulationCount || state.liveScoresEnabled) ? null : state.manualThirdPlaceGroups;
        const manualThirds = (manualThirdPlaceGroups || [])
            .map(groupId => standings[groupId]?.[2])
            .filter(Boolean);
        const manualThirdIds = new Set(manualThirds.map(team => team.id));
        const openThirdSlots = state.settings.thirdPlaceQualifiers - manualThirds.length;
        const thirds = manualThirdPlaceGroups
            ? [
                ...manualThirds,
                ...automaticThirds.filter(team => !manualThirdIds.has(team.id)).slice(0, Math.max(0, openThirdSlots))
            ]
            : automaticThirds;

        // 3. Assign 3rd Place Slots
        const thirdAssignments = assignThirdPlaceSpots(thirds);

        // 4. Resolve Bracket (Iterative)
        const knockoutMatches = state.schedule.map(m => ({ ...m })); // Deep copy structure

        // We need to process rounds in order: 32 -> 16 -> 8 -> 4 -> 2
        // Actually, we can just map and if a parent isn't ready, it stays placeholder.
        // But `resolveParticipant` needs the *current state* of previous matches.
        // Since `knockoutMatches` is ordered by ID (mostly), we can do a pass. 
        // BUT, Round of 16 relies on Round of 32 results.

        // We can just loop through the array. 73..104 is topological sort.
        const matchResults = []; // Store resolved matches to lookup

        // Map for quick lookup
        const STADIUMS = stadiumsData.reduce((acc, s) => {
            acc[s.id] = s.name;
            return acc;
        }, {});

        knockoutMatches.forEach(match => {
            // Context for resolution
            const context = {
                allGroupStandings: standings,
                knockoutMatches: matchResults, // Previous matches
                thirdPlaceAssignments: thirdAssignments,
                matchId: match.id
            };

            const homeTeam = resolveParticipant(match.home, context);
            const awayTeam = resolveParticipant(match.away, context);

            match.homeTeam = homeTeam;
            match.awayTeam = awayTeam;
            match.score = state.knockoutScores[match.id] || null;

            // Add location
            match.location = STADIUMS[match.stadium] || match.stadium;

            // Determine winner
            if (state.knockoutPicks[match.id]) {
                // User picked
                const winnerId = state.knockoutPicks[match.id];
                match.winner = (homeTeam?.id === winnerId) ? homeTeam : (awayTeam?.id === winnerId) ? awayTeam : ruleCheck(winnerId, homeTeam, awayTeam);
                match.loser = (match.winner === homeTeam) ? awayTeam : homeTeam;
            } else {
                match.winner = null;
                match.loser = null;
            }

            matchResults.push(match);
        });

        return { standings, knockoutMatches: matchResults, qualifiedThirds: thirds, automaticThirds };

    }, [state]);

    // Helper for pick validation (if user picked 'MEX' but 'MEX' isn't in the match logic anymore, handle it)
    function ruleCheck(pickedId, home, away) {
        if (home && home.id === pickedId) return home;
        if (away && away.id === pickedId) return away;
        // Invalid pick (path changed), return null or keep legacy pick? logic says update immediately.
        return null;
    }

    return (
        <BracketContext.Provider value={{ 
            state, 
            dispatch, 
            groups: state.groups, 
            knockoutPicks: state.knockoutPicks, 
            knockoutScores: state.knockoutScores, 
            ...computed, 
            actions: ACTIONS
        }}>
            {children}
        </BracketContext.Provider>
    );
}

export { BracketContext };
