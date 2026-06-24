
import { describe, it, expect } from 'bun:test';
import { calculateGroupStandings, generateGroupFixtures, getBestThirdPlace, isGuaranteedGroupWinner, isGuaranteedOutsideTopThree } from './logic/engine';
import { assignThirdPlaceSpots } from './logic/thirdPlaceLogic';
import { simulateTournament, runSuperSimulation } from './logic/simulator';
import { isLiveScoresAvailable, mapEspnEventsToAppState } from './logic/liveScores';
import { completedLiveFinalsChanged, mergeIncomingLiveScores } from './logic/liveSimulationState';
import { americanOddsToProbability, formatAmericanOdds, getMarketOddsProfile, getMarketStrengthAdjustment, probabilityToAmericanOdds } from './logic/marketOdds';
import { rankRemainingGroupMatches } from './logic/watchability';
import { mergeSavedState } from './store/statePersistence';
import groupsData from './data/groups.json';
import peleRatingsData from './data/peleRatings.json';
import vegasOddsData from './data/vegasOdds.json';
import scheduleData from './data/schedule.json';

describe('Sanity Check', () => {
    it('Groups Data is Valid', () => {
        const groupKeys = Object.keys(groupsData.groups);
        expect(groupKeys.length).toBe(12);
        groupKeys.forEach(k => {
            expect(groupsData.groups[k].length).toBe(4);
        });
    });

    it('Schedule Data is Valid', () => {
        expect(scheduleData.knockout.length).toBe(32); // 32 knockout matches
        scheduleData.knockout.forEach(m => {
            expect(m.id).toBeGreaterThan(72);
            expect(m.home).toBeDefined();
            expect(m.away).toBeDefined();
        });
    });

    it('PELE Ratings Cover Every World Cup Team', () => {
        const teams = Object.values(groupsData.groups).flat();
        teams.forEach(team => {
            const pele = peleRatingsData[team.id];
            expect(pele).toBeDefined();
            expect(Number.isFinite(pele.pele)).toBe(true);
            expect(Number.isFinite(pele.oneYearChange)).toBe(true);
            expect(Number.isFinite(pele.recentQuarterChange)).toBe(true);
        });
    });

    it('Engine Standings Logic Works', () => {
        const groupA = groupsData.groups['A'];
        // Mock matches results: Mexico beats everyone
        const fixtures = generateGroupFixtures('A', groupA);
        const matchResults = fixtures.map(m => {
            if (m.homeId === 'MEX') return { ...m, homeScore: 2, awayScore: 0 };
            if (m.awayId === 'MEX') return { ...m, homeScore: 0, awayScore: 2 };
            return { ...m, homeScore: 1, awayScore: 1 }; // Draw others
        });

        const standings = calculateGroupStandings(groupA, matchResults);
        expect(standings[0].id).toBe('MEX');
        expect(standings[0].points).toBe(9);
    });

    it('Ranks Equal-Point Teams By Head-To-Head Before Overall Goal Difference', () => {
        const teams = ['A', 'B', 'C', 'D'].map(id => ({ id, name: id }));
        const matches = [
            { homeId: 'A', awayId: 'B', homeScore: 0, awayScore: 1 },
            { homeId: 'A', awayId: 'C', homeScore: 4, awayScore: 0 },
            { homeId: 'A', awayId: 'D', homeScore: 0, awayScore: 1 },
            { homeId: 'B', awayId: 'C', homeScore: 0, awayScore: 5 },
            { homeId: 'B', awayId: 'D', homeScore: 0, awayScore: 3 },
            { homeId: 'C', awayId: 'D', homeScore: 1, awayScore: 0 }
        ];

        const standings = calculateGroupStandings(teams, matches);
        const alpha = standings.findIndex(team => team.id === 'A');
        const beta = standings.findIndex(team => team.id === 'B');

        expect(standings.find(team => team.id === 'A').gd).toBeGreaterThan(standings.find(team => team.id === 'B').gd);
        expect(beta).toBeLessThan(alpha);
    });

    it('Reapplies Head-To-Head Criteria To The Remaining Teams In A Multi-Team Tie', () => {
        const teams = ['A', 'B', 'C', 'D'].map(id => ({ id, name: id }));
        const matches = [
            { homeId: 'A', awayId: 'B', homeScore: 1, awayScore: 0 },
            { homeId: 'B', awayId: 'C', homeScore: 3, awayScore: 2 },
            { homeId: 'C', awayId: 'A', homeScore: 1, awayScore: 0 },
            { homeId: 'A', awayId: 'D', homeScore: 0, awayScore: 1 },
            { homeId: 'B', awayId: 'D', homeScore: 0, awayScore: 1 },
            { homeId: 'C', awayId: 'D', homeScore: 0, awayScore: 1 }
        ];

        const standings = calculateGroupStandings(teams, matches);

        expect(standings.map(team => team.id)).toEqual(['D', 'B', 'C', 'A']);
    });

    it('Ranks Best Third-Place Teams Only By Overall Criteria', () => {
        const thirdPlaceStandings = Object.fromEntries([
            ['A', { id: 'A3', points: 4, gd: 0, gf: 3 }],
            ['B', { id: 'B3', points: 4, gd: 0, gf: 2 }],
            ['C', { id: 'C3', points: 5, gd: 0, gf: 1 }],
            ['D', { id: 'D3', points: 5, gd: 0, gf: 1 }],
            ['E', { id: 'E3', points: 5, gd: 0, gf: 1 }],
            ['F', { id: 'F3', points: 5, gd: 0, gf: 1 }],
            ['G', { id: 'G3', points: 5, gd: 0, gf: 1 }],
            ['H', { id: 'H3', points: 5, gd: 0, gf: 1 }],
            ['I', { id: 'I3', points: 5, gd: 0, gf: 1 }]
        ].map(([group, third]) => [group, [{ id: `${group}1` }, { id: `${group}2` }, third]]));

        const qualifiers = getBestThirdPlace(thirdPlaceStandings);

        expect(qualifiers).toHaveLength(8);
        expect(qualifiers.some(team => team.id === 'A3')).toBe(true);
        expect(qualifiers.some(team => team.id === 'B3')).toBe(false);
    });

    it('Recognizes A Team Blocked From Third By Two Head-To-Head Rivals At Its Points Ceiling', () => {
        const standings = [
            { id: 'USA', points: 6 },
            { id: 'PAR', points: 3 },
            { id: 'AUS', points: 3 },
            { id: 'TUR', points: 0 }
        ];
        const remainingByTeam = { USA: 1, PAR: 1, AUS: 1, TUR: 1 };
        const matches = [
            { homeId: 'TUR', awayId: 'PAR', homeScore: 0, awayScore: 1 },
            { homeId: 'AUS', awayId: 'TUR', homeScore: 1, awayScore: 0 }
        ];

        expect(isGuaranteedOutsideTopThree({
            team: standings.find(team => team.id === 'TUR'),
            groupStandings: standings,
            remainingByTeam,
            matches
        })).toBe(true);
    });

    it('Does Not Eliminate A Team From Third On A Single Head-To-Head Loss', () => {
        const standings = [
            { id: 'USA', points: 6 },
            { id: 'PAR', points: 3 },
            { id: 'AUS', points: 3 },
            { id: 'TUR', points: 0 }
        ];
        const remainingByTeam = { USA: 1, PAR: 1, AUS: 1, TUR: 1 };
        const matches = [{ homeId: 'TUR', awayId: 'PAR', homeScore: 0, awayScore: 1 }];

        expect(isGuaranteedOutsideTopThree({
            team: standings.find(team => team.id === 'TUR'),
            groupStandings: standings,
            remainingByTeam,
            matches
        })).toBe(false);
    });

    it('Locks First Place When Every Possible Equal-Points Rival Lost Head-To-Head', () => {
        const standings = [
            { id: 'MEX', points: 6 },
            { id: 'KOR', points: 3 },
            { id: 'CZE', points: 1 },
            { id: 'RSA', points: 1 }
        ];
        const remainingByTeam = { MEX: 1, KOR: 1, CZE: 1, RSA: 1 };
        const matches = [{ homeId: 'MEX', awayId: 'KOR', homeScore: 1, awayScore: 0 }];

        expect(isGuaranteedGroupWinner({
            team: standings.find(team => team.id === 'MEX'),
            groupStandings: standings,
            remainingByTeam,
            matches
        })).toBe(true);
    });

    it('Does Not Lock First Place Before A Rival Can Reach The Same Points Without A Head-To-Head Loss', () => {
        const standings = [
            { id: 'MEX', points: 6 },
            { id: 'KOR', points: 3 },
            { id: 'CZE', points: 1 },
            { id: 'RSA', points: 1 }
        ];

        expect(isGuaranteedGroupWinner({
            team: standings.find(team => team.id === 'MEX'),
            groupStandings: standings,
            remainingByTeam: { MEX: 1, KOR: 1, CZE: 1, RSA: 1 },
            matches: []
        })).toBe(false);
    });

    it('Third Place Assignment Works (Default)', () => {
        // Mock 8 groups qualifying: A, B, C, D, E, F, G, H
        const qualified = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(g => ({ group: g, id: `3rd_${g}` }));

        const assignment = assignThirdPlaceSpots(qualified);
        const assignedMatchIds = Object.keys(assignment).map(Number).sort((a, b) => a - b);
        // Should assign to all 8 slots (74, 77, 79, 80, 81, 82, 85, 87)
        expect(assignedMatchIds).toEqual([74, 77, 79, 80, 81, 82, 85, 87]);
    });

    it('Round Of 32 Entrants Match Official Group Transition Table', () => {
        const roundOf32 = Object.fromEntries(
            scheduleData.knockout
                .filter(match => match.round === 32)
                .map(match => [match.id, match])
        );

        const expected = {
            73: ['group_runner_up:A', 'group_runner_up:B'],
            74: ['group_winner:E', 'group_third:ABCDF'],
            75: ['group_winner:F', 'group_runner_up:C'],
            76: ['group_winner:C', 'group_runner_up:F'],
            77: ['group_winner:I', 'group_third:CDFGH'],
            78: ['group_runner_up:E', 'group_runner_up:I'],
            79: ['group_winner:A', 'group_third:CEFHI'],
            80: ['group_winner:L', 'group_third:EHIJK'],
            81: ['group_winner:D', 'group_third:BEFIJ'],
            82: ['group_winner:G', 'group_third:AEHIJ'],
            83: ['group_runner_up:K', 'group_runner_up:L'],
            84: ['group_winner:H', 'group_runner_up:J'],
            85: ['group_winner:B', 'group_third:EFGIJ'],
            86: ['group_winner:J', 'group_runner_up:H'],
            87: ['group_winner:K', 'group_third:DEIJL'],
            88: ['group_runner_up:D', 'group_runner_up:G']
        };

        Object.entries(expected).forEach(([matchId, [home, away]]) => {
            expect(formatRoundOf32Rule(roundOf32[matchId].home)).toBe(home);
            expect(formatRoundOf32Rule(roundOf32[matchId].away)).toBe(away);
        });
    });

    it('Third Place Assignment Matches Official FIFA Annex C (Scenario ABCDEFGH)', () => {
        const qualified = [
            { group: 'A', id: '3rd_A', points: 3, gd: 0, gf: 3 },
            { group: 'B', id: '3rd_B', points: 3, gd: -1, gf: 2 },
            { group: 'C', id: '3rd_C', points: 7, gd: 4, gf: 6 },
            { group: 'D', id: '3rd_D', points: 5, gd: 1, gf: 4 },
            { group: 'E', id: '3rd_E', points: 4, gd: 1, gf: 3 },
            { group: 'F', id: '3rd_F', points: 4, gd: 0, gf: 3 },
            { group: 'G', id: '3rd_G', points: 4, gd: -1, gf: 2 },
            { group: 'H', id: '3rd_H', points: 3, gd: 1, gf: 4 }
        ];

        const assignment = assignThirdPlaceSpots(qualified);

        expect(assignment[74].id).toBe('3rd_C');
        expect(assignment[77].id).toBe('3rd_F');
        expect(assignment[79].id).toBe('3rd_H');
        expect(assignment[80].id).toBe('3rd_E');
        expect(assignment[81].id).toBe('3rd_B');
        expect(assignment[82].id).toBe('3rd_A');
        expect(assignment[85].id).toBe('3rd_G');
        expect(assignment[87].id).toBe('3rd_D');
    });

    it('Third Place Assignment Matches Official FIFA Annex C (Scenario BCDEFGHI)', () => {
        const qualified = [
            { group: 'B', id: '3rd_B', points: 8, gd: 6, gf: 8 },
            { group: 'C', id: '3rd_C', points: 7, gd: 5, gf: 7 },
            { group: 'D', id: '3rd_D', points: 6, gd: 4, gf: 6 },
            { group: 'E', id: '3rd_E', points: 5, gd: 3, gf: 5 },
            { group: 'F', id: '3rd_F', points: 4, gd: 2, gf: 4 },
            { group: 'G', id: '3rd_G', points: 3, gd: 1, gf: 3 },
            { group: 'H', id: '3rd_H', points: 2, gd: 0, gf: 2 },
            { group: 'I', id: '3rd_I', points: 1, gd: -1, gf: 1 }
        ];

        const assignment = assignThirdPlaceSpots(qualified);

        expect(assignment[74].id).toBe('3rd_D');
        expect(assignment[77].id).toBe('3rd_F');
        expect(assignment[79].id).toBe('3rd_C');
        expect(assignment[80].id).toBe('3rd_I');
        expect(assignment[81].id).toBe('3rd_B');
        expect(assignment[82].id).toBe('3rd_H');
        expect(assignment[85].id).toBe('3rd_G');
        expect(assignment[87].id).toBe('3rd_E');
    });

    it('Simulator Generates Scores And Knockout Picks', () => {
        const result = simulateTournament(groupsData.groups, scheduleData.knockout);

        expect(Object.keys(result.groupScores).length).toBe(72);
        expect(Object.keys(result.knockoutPicks).length).toBe(32);
        expect(Object.keys(result.knockoutScores).length).toBe(32);

        Object.values(result.groupScores).forEach(score => {
            expect(Number.isInteger(score.home)).toBe(true);
            expect(Number.isInteger(score.away)).toBe(true);
        });
    });

    it('Simulator Preserves Completed Live Group Results As Fixed Inputs', () => {
        const groupD = groupsData.groups.D;
        const fixtures = generateGroupFixtures('D', groupD);
        const fixedGroupScores = Object.fromEntries(fixtures.map(match => {
            const usaIsHome = match.homeId === 'USA';
            const usaIsAway = match.awayId === 'USA';
            const home = usaIsHome ? 3 : usaIsAway ? 0 : 0;
            const away = usaIsAway ? 3 : usaIsHome ? 0 : 0;

            return [match.id, {
                home,
                away,
                source: 'live',
                completed: true
            }];
        }));

        const result = simulateTournament(groupsData.groups, scheduleData.knockout, { fixedGroupScores });
        const usaMatchIds = fixtures
            .filter(match => match.homeId === 'USA' || match.awayId === 'USA')
            .map(match => match.id);

        usaMatchIds.forEach(matchId => {
            expect(result.groupScores[matchId]).toEqual(fixedGroupScores[matchId]);
        });
    });

    it('Super Simulator Generates Statistical Frequencies', () => {
        const stats = runSuperSimulation(groupsData.groups, scheduleData.knockout, 10);
        expect(stats.trials).toBe(10);
        expect(stats.cutoffFreq).toBeDefined();
        expect(stats.groupPositions).toBeDefined();
        expect(stats.knockoutReach).toBeDefined();
        expect(stats.opponentMatrix).toBeDefined();
        expect(stats.thirdPointsCount).toBeDefined();
        expect(stats.thirdPointsQual).toBeDefined();
        expect(stats.opponentMatrix.USA.R32).toBeDefined();
        expect(stats.thirdPointsCount[3]).toBeGreaterThanOrEqual(0);
        expect(stats.thirdPointsQual[3]).toBeGreaterThanOrEqual(0);
    });

    it('Opponent Heatmap Counts Match Knockout Round Appearances', () => {
        const stats = runSuperSimulation(groupsData.groups, scheduleData.knockout, 20);
        const roundKeys = ['R32', 'R16', 'QF', 'SF', 'Final'];

        Object.keys(stats.knockoutReach).forEach(teamId => {
            roundKeys.forEach(roundKey => {
                const opponentCount = Object.values(stats.opponentMatrix[teamId][roundKey])
                    .reduce((sum, count) => sum + count, 0);

                expect(opponentCount).toBe(stats.knockoutReach[teamId][roundKey]);
            });
        });
    });

    it('Super Simulator Uses Completed Live Group Results In Every Trial', () => {
        const groupD = groupsData.groups.D;
        const fixtures = generateGroupFixtures('D', groupD);
        const fixedGroupScores = Object.fromEntries(fixtures.map(match => {
            const usaIsHome = match.homeId === 'USA';
            const usaIsAway = match.awayId === 'USA';
            const home = usaIsHome ? 2 : usaIsAway ? 0 : 0;
            const away = usaIsAway ? 2 : usaIsHome ? 0 : 0;

            return [match.id, {
                home,
                away,
                source: 'live',
                completed: true
            }];
        }));

        const stats = runSuperSimulation(groupsData.groups, scheduleData.knockout, 20, { fixedGroupScores });

        expect(stats.groupPositions.D.USA[1]).toBe(20);
        expect(stats.groupPositions.D.USA.qualified).toBe(20);
    });

    it('Vegas Odds Convert To Market Strength Adjustments', () => {
        expect(americanOddsToProbability(500)).toBeCloseTo(1 / 6, 4);
        expect(formatAmericanOdds(probabilityToAmericanOdds(0.6))).toBe('-150');
        expect(formatAmericanOdds(probabilityToAmericanOdds(1 / 11))).toBe('+1000');
        expect(getMarketOddsProfile('ESP')).toEqual(expect.objectContaining({
            americanOdds: 450,
            formattedOdds: '+450',
            tier: 'top'
        }));
        expect(getMarketStrengthAdjustment({ id: 'ESP' }, { phase: 'knockout', roundDepth: 4 }))
            .toBeGreaterThan(getMarketStrengthAdjustment({ id: 'USA' }, { phase: 'knockout', roundDepth: 4 }));
        expect(getMarketStrengthAdjustment({ id: 'MAR' }, { phase: 'knockout', roundDepth: 4 })).toBeGreaterThan(0);
    });

    it('Vegas Odds Cover Every World Cup Team', () => {
        const teams = Object.values(groupsData.groups).flat();
        expect(Object.keys(vegasOddsData.teams).length).toBe(48);
        teams.forEach(team => {
            const profile = vegasOddsData.teams[team.id];
            expect(profile).toBeDefined();
            expect(Number.isFinite(profile.americanOdds)).toBe(true);
            expect(profile.americanOdds).toBeGreaterThan(0);
            expect(typeof profile.tier).toBe('string');
        });
    });

    it('Live Scores Are Gated Until World Cup Start', () => {
        expect(isLiveScoresAvailable(new Date('2026-06-10T23:59:00-07:00'))).toBe(false);
        expect(isLiveScoresAvailable(new Date('2026-06-11T00:00:00-07:00'))).toBe(true);
    });

    it('Saved State Cannot Enable Live Scores By Default', () => {
        const state = mergeSavedState({
            compactMode: true,
            liveScoresEnabled: false,
            liveScoreMeta: {
                status: 'idle',
                lastUpdated: null,
                error: null,
                eventCount: 0,
                appliedCount: 0
            },
            liveSimulationEnabled: true,
            preLiveState: null
        }, {
            liveScoresEnabled: true,
            liveSimulationEnabled: false,
            liveScoreMeta: {
                status: 'ready',
                lastUpdated: '2026-06-12T18:00:00.000Z',
                error: null,
                eventCount: 72,
                appliedCount: 72
            },
            preLiveState: {
                groupScores: { A_M1: { home: 2, away: 1 } }
            }
        });

        expect(state.liveScoresEnabled).toBe(false);
        expect(state.liveSimulationEnabled).toBe(true);
        expect(state.liveScoreMeta.status).toBe('idle');
        expect(state.preLiveState).toBe(null);
    });

    it('Saved State Whitelists Persisted Fields And Rejects Invalid Shapes', () => {
        const baseState = {
            groupScores: {},
            groupOverrides: {},
            knockoutPicks: {},
            knockoutScores: {},
            groupFixtureMeta: {},
            manualThirdPlaceGroups: null,
            simulationCount: 0,
            groups: { A: ['trusted'] },
            settings: { thirdPlaceQualifiers: 8 },
            compactMode: true,
            liveScoresEnabled: false,
            liveSimulationEnabled: true,
            liveScoreMeta: { status: 'idle' },
            preLiveState: null
        };
        const state = mergeSavedState(baseState, {
            groupScores: { A_M1: { home: 2, away: 1 } },
            groupOverrides: 'invalid',
            manualThirdPlaceGroups: ['A', 9],
            simulationCount: 1_000_001,
            groups: { A: ['untrusted'] },
            settings: { thirdPlaceQualifiers: 0 },
            injectedField: true
        });

        expect(state.groupScores).toEqual({ A_M1: { home: 2, away: 1 } });
        expect(state.groupOverrides).toEqual({});
        expect(state.manualThirdPlaceGroups).toBe(null);
        expect(state.simulationCount).toBe(0);
        expect(state.groups).toEqual({ A: ['trusted'] });
        expect(state.settings).toEqual({ thirdPlaceQualifiers: 8 });
        expect(state.injectedField).toBeUndefined();
    });

    it('Maps ESPN Group Scores Onto Canonical Group Fixtures', () => {
        const stats = mapEspnEventsToAppState([
            {
                id: 'espn-1',
                name: 'South Africa at Mexico',
                date: '2026-06-11T19:00:00Z',
                status: {
                    type: {
                        name: 'STATUS_FINAL',
                        description: 'Final',
                        completed: true
                    }
                },
                competitions: [
                    {
                        competitors: [
                            {
                                team: { abbreviation: 'RSA', displayName: 'South Africa' },
                                score: '1',
                                winner: false
                            },
                            {
                                team: { abbreviation: 'MEX', displayName: 'Mexico' },
                                score: '2',
                                winner: true
                            }
                        ]
                    }
                ]
            }
        ], groupsData.groups, []);

        expect(stats.groupScores.A_M1).toEqual(expect.objectContaining({
            home: 2,
            away: 1,
            source: 'live',
            completed: true
        }));
        expect(stats.meta.appliedCount).toBe(1);
        expect(stats.groupFixtureMeta.A_M1).toEqual(expect.objectContaining({
            startsAt: '2026-06-11T19:00:00Z',
            completed: true
        }));
    });

    it('Keeps Scheduled Group Fixtures As Metadata Without Treating Them As Scores', () => {
        const stats = mapEspnEventsToAppState([
            {
                id: 'espn-scheduled',
                date: '2026-06-25T01:00:00Z',
                status: {
                    type: {
                        name: 'STATUS_SCHEDULED',
                        description: 'Scheduled',
                        completed: false
                    }
                },
                competitions: [
                    {
                        competitors: [
                            { team: { abbreviation: 'MEX' }, score: '0' },
                            { team: { abbreviation: 'CZE' }, score: '0' }
                        ]
                    }
                ]
            }
        ], groupsData.groups, []);

        expect(stats.groupScores.A_M5).toBeUndefined();
        expect(stats.groupFixtureMeta.A_M5).toEqual(expect.objectContaining({
            startsAt: '2026-06-25T01:00:00Z',
            scheduled: true,
            completed: false
        }));
    });

    it('Ranks Remaining Fixtures By Qualification Stakes And Groups Them By Day', () => {
        const enrichedGroupA = groupsData.groups.A.map(team => ({
            ...team,
            peleRank: peleRatingsData[team.id].rank
        }));
        const groupAStandings = [
            { ...enrichedGroupA[0], points: 6, gd: 3, gf: 3 },
            { ...enrichedGroupA[2], points: 3, gd: 0, gf: 2 },
            { ...enrichedGroupA[3], points: 1, gd: -1, gf: 2 },
            { ...enrichedGroupA[1], points: 1, gd: -2, gf: 1 }
        ];
        const days = rankRemainingGroupMatches({
            groups: { A: enrichedGroupA },
            standings: { A: groupAStandings },
            groupScores: {
                A_M1: { completed: true },
                A_M2: { completed: true },
                A_M3: { completed: true },
                A_M4: { completed: true }
            },
            fixtureMetadata: {
                A_M5: { startsAt: '2026-06-25T01:00:00Z', status: 'Scheduled', scheduled: true, completed: false },
                A_M6: { startsAt: '2026-06-25T01:00:00Z', status: 'Scheduled', scheduled: true, completed: false }
            },
            thirdPlaceQualifiers: 1,
            timeZone: 'UTC'
        });

        expect(days).toHaveLength(1);
        expect(days[0].matches).toHaveLength(2);
        expect(days[0].matches[0].score).toBeGreaterThan(days[0].matches[1].score);
        const mexicoCzechia = days[0].matches.find(match => match.id === 'A_M5');
    expect(mexicoCzechia.usaBracketRoutingBoost).toBe(25);
    expect(mexicoCzechia.priority).toBe('Must watch');
    expect(mexicoCzechia.score).toBeGreaterThanOrEqual(90);
        expect(mexicoCzechia.reason).toContain('Mexico avoiding defeat');
        expect(days[0].matches[0].home.peleRank).toBeDefined();
    });

    it('Keeps Ranking Remaining Fixtures When Future Kickoff Metadata Is Missing', () => {
        const enrichedGroupA = groupsData.groups.A.map(team => ({
            ...team,
            peleRank: peleRatingsData[team.id].rank
        }));
        const standings = {
            A: enrichedGroupA.map((team, index) => ({
                ...team,
                points: [6, 1, 3, 1][index],
                gd: [3, -2, 0, -1][index],
                gf: [3, 1, 2, 2][index]
            }))
        };
        const days = rankRemainingGroupMatches({
            groups: { A: enrichedGroupA },
            standings,
            groupScores: {
                A_M1: { completed: true },
                A_M2: { completed: true },
                A_M3: { completed: true },
                A_M4: { completed: true }
            },
            fixtureMetadata: {},
            thirdPlaceQualifiers: 1,
            timeZone: 'UTC'
        });

        expect(days).toHaveLength(1);
        expect(days[0].dayLabel).toBe('Schedule pending');
        expect(days[0].matches).toHaveLength(2);
    });

    it('Promotes The USA Third-Place Routing Pivot While Czechia Is Still Alive', () => {
        const enrichedGroupA = groupsData.groups.A.map(team => ({
            ...team,
            peleRank: peleRatingsData[team.id].rank
        }));
        const teamById = Object.fromEntries(enrichedGroupA.map(team => [team.id, team]));
        const days = rankRemainingGroupMatches({
            groups: { A: enrichedGroupA },
            standings: {
                A: [
                    { ...teamById.MEX, points: 6, gd: 4, gf: 5 },
                    { ...teamById.KOR, points: 4, gd: 2, gf: 4 },
                    { ...teamById.RSA, points: 1, gd: -2, gf: 1 },
                    { ...teamById.CZE, points: 0, gd: -4, gf: 0 }
                ]
            },
            groupScores: {
                A_M1: { completed: true },
                A_M2: { completed: true },
                A_M3: { completed: true },
                A_M4: { completed: true }
            },
            fixtureMetadata: {
                A_M5: { startsAt: '2026-06-25T01:00:00Z', status: 'Scheduled', scheduled: true, completed: false },
                A_M6: { startsAt: '2026-06-25T01:00:00Z', status: 'Scheduled', scheduled: true, completed: false }
            },
            thirdPlaceQualifiers: 1,
            timeZone: 'UTC'
        });

        const mexicoCzechia = days[0].matches.find(match => match.id === 'A_M5');
        expect(mexicoCzechia.awayContext.eliminated).toBe(false);
        expect(mexicoCzechia.usaBracketRoutingBoost).toBe(25);
        expect(mexicoCzechia.score).toBe(90);
        expect(mexicoCzechia.priority).toBe('Must watch');
    });

    it('Keeps Simulated Group Finals On The Watch List When Live Mode Is Active', () => {
        const enrichedGroupA = groupsData.groups.A.map(team => ({
            ...team,
            peleRank: peleRatingsData[team.id].rank
        }));
        const standings = {
            A: enrichedGroupA.map((team, index) => ({
                ...team,
                points: [9, 4, 3, 1][index],
                gd: [5, 1, 0, -6][index],
                gf: [6, 4, 3, 1][index]
            }))
        };
        const days = rankRemainingGroupMatches({
            groups: { A: enrichedGroupA },
            standings,
            groupScores: {
                A_M1: { home: 2, away: 0, source: 'live', completed: true },
                A_M2: { home: 1, away: 1, source: 'live', completed: true },
                A_M3: { home: 2, away: 0, source: 'live', completed: true },
                A_M4: { home: 1, away: 0, source: 'live', completed: true },
                A_M5: { home: 3, away: 1, source: 'simulation', completed: true },
                A_M6: { home: 1, away: 1, source: 'simulation', completed: true }
            },
            fixtureMetadata: {
                A_M5: { startsAt: '2026-06-25T01:00:00Z', status: 'Scheduled', scheduled: true, completed: false },
                A_M6: { startsAt: '2026-06-25T01:00:00Z', status: 'Scheduled', scheduled: true, completed: false }
            },
            thirdPlaceQualifiers: 1,
            timeZone: 'UTC'
        });

        expect(days[0].matches.map(match => match.id).sort()).toEqual(['A_M5', 'A_M6']);
    });

    it('Uses Monte Carlo USA R32 Frequencies For USA Path Markers', () => {
        const enrichedGroupA = groupsData.groups.A.map(team => ({
            ...team,
            peleRank: peleRatingsData[team.id].rank
        }));
        const standings = {
            A: [
                { ...enrichedGroupA[0], points: 6, gd: 3, gf: 3 },
                { ...enrichedGroupA[2], points: 3, gd: 0, gf: 2 },
                { ...enrichedGroupA[3], points: 1, gd: -1, gf: 2 },
                { ...enrichedGroupA[1], points: 1, gd: -2, gf: 1 }
            ]
        };
        const days = rankRemainingGroupMatches({
            groups: { A: enrichedGroupA },
            standings,
            groupScores: {
                A_M1: { completed: true },
                A_M2: { completed: true },
                A_M3: { completed: true },
                A_M4: { completed: true }
            },
            fixtureMetadata: {
                A_M5: { startsAt: '2026-06-25T01:00:00Z', status: 'Scheduled', scheduled: true, completed: false },
                A_M6: { startsAt: '2026-06-25T01:00:00Z', status: 'Scheduled', scheduled: true, completed: false }
            },
            usaR32OpponentCounts: { MEX: 62, CZE: 38 },
            usaR32ReachCount: 100,
            simulationTrials: 100,
            thirdPlaceQualifiers: 1,
            timeZone: 'UTC'
        });

        const mexicoCzechia = days[0].matches.find(match => match.id === 'A_M5');
        expect(mexicoCzechia.homeContext.usaR32Matchup).toEqual(expect.objectContaining({
            rank: 1,
            exactProbability: 0.62,
            routeProbability: 0.62
        }));
        expect(mexicoCzechia.awayContext.usaR32Matchup).toEqual(expect.objectContaining({ rank: 2 }));
        expect(mexicoCzechia.usaR32Boost).toBe(24);
    });

    it('Live Polls Only Invalidate Simulation Inputs When Completed Finals Change', () => {
        const currentState = {
            groupScores: {
                A_M1: { home: 2, away: 1, source: 'live', completed: true },
                A_M2: { home: 1, away: 1, source: 'live', completed: false },
                A_M3: { home: 3, away: 0, source: 'simulation', completed: true }
            },
            knockoutScores: {},
            knockoutPicks: {}
        };
        const unchangedPoll = {
            groupScores: {
                A_M1: { home: 2, away: 1, source: 'live', completed: true },
                A_M2: { home: 2, away: 1, source: 'live', completed: false }
            },
            knockoutScores: {},
            knockoutPicks: {}
        };
        const newFinalPoll = {
            groupScores: {
                A_M1: { home: 2, away: 1, source: 'live', completed: true },
                A_M2: { home: 2, away: 1, source: 'live', completed: true }
            },
            knockoutScores: {},
            knockoutPicks: {}
        };

        expect(completedLiveFinalsChanged(currentState, unchangedPoll)).toBe(false);
        expect(completedLiveFinalsChanged(currentState, newFinalPoll)).toBe(true);
        expect(mergeIncomingLiveScores(currentState.groupScores, unchangedPoll.groupScores).A_M3)
            .toEqual(currentState.groupScores.A_M3);
    });

});

function formatRoundOf32Rule(rule) {
    if (rule.type === 'group_third') return `${rule.type}:${rule.options.join('')}`;
    return `${rule.type}:${rule.group}`;
}
