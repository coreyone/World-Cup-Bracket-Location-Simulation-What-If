import { calculateGroupStandings, generateGroupFixtures, isGuaranteedGroupWinner, isGuaranteedOutsideTopThree } from './engine';
import kalshiOdds from '../data/kalshiOdds.json';

const USA_THIRD_PLACE_ROUTING_BOOST = 25;

export function rankRemainingGroupMatches({
    groups = {},
    standings = {},
    groupScores = {},
    fixtureMetadata = {},
    thirdPlaceQualifiers = 8,
    usaR32OpponentCounts = {},
    usaR32ReachCount = 0,
    simulationTrials = 0,
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
} = {}) {
    const watchableStandings = containsSimulationScores(groupScores)
        ? buildLiveStandings(groups, groupScores)
        : standings;
    const thirdPlaceCutoff = getCurrentThirdPlaceCutoff(watchableStandings, thirdPlaceQualifiers);
    const matches = [];

    Object.entries(groups).forEach(([groupId, teams]) => {
        const fixtures = generateGroupFixtures(groupId, teams);
        const groupStandings = watchableStandings[groupId] || [];
        const remainingFixtures = fixtures.filter(match => !isActualFinal(groupScores[match.id]));
        const remainingByTeam = countRemainingMatches(remainingFixtures);
        const completedFixtures = fixtures.map(match => {
            const score = groupScores[match.id];
            return isActualFinal(score) ? { ...match, homeScore: score.home, awayScore: score.away } : match;
        });
        const teamContext = Object.fromEntries(groupStandings.map((team, index) => [
            team.id,
            buildTeamContext({
                team,
                position: index + 1,
                groupStandings,
                remainingByTeam,
                completedFixtures,
                thirdPlaceCutoff
            })
        ]));

        remainingFixtures.forEach(match => {
            const metadata = fixtureMetadata[match.id] || {
                status: 'Schedule pending',
                scheduled: true,
                completed: false,
                startsAt: null
            };

            const home = teams.find(team => team.id === match.homeId);
            const away = teams.find(team => team.id === match.awayId);
            const homeContext = teamContext[match.homeId];
            const awayContext = teamContext[match.awayId];
            if (!home || !away || !homeContext || !awayContext) return;

            matches.push(buildWatchabilityMatch({
                match,
                groupId,
                metadata,
                home,
                away,
                homeContext,
                awayContext,
                thirdPlaceCutoff
            }));
        });
    });

    return groupMatchesByDay(markTopUsaR32Candidates({
        matches,
        usaR32OpponentCounts,
        usaR32ReachCount,
        simulationTrials
    }), timeZone);
}

function markTopUsaR32Candidates({ matches, usaR32OpponentCounts, usaR32ReachCount, simulationTrials }) {
    const trials = Math.max(0, simulationTrials || 0);
    if (trials === 0) return matches;

    const topCandidates = new Map(Object.entries(usaR32OpponentCounts)
        .filter(([, count]) => Number.isFinite(count) && count > 0)
        .sort(([teamA, countA], [teamB, countB]) => countB - countA || teamA.localeCompare(teamB))
        .slice(0, 6)
        .map(([teamId, count], index) => [teamId, {
            rank: index + 1,
            exactProbability: count / trials,
            routeProbability: usaR32ReachCount > 0 ? count / usaR32ReachCount : 0
        }])
    );

    const preferredMarkerMatchByTeam = new Map();
    matches.forEach(match => {
        [match.home, match.away].forEach(team => {
            if (!topCandidates.has(team.id)) return;
            const existing = preferredMarkerMatchByTeam.get(team.id);
            if (!existing || match.score > existing.score || (match.score === existing.score && String(match.startsAt) < String(existing.startsAt))) {
                preferredMarkerMatchByTeam.set(team.id, match);
            }
        });
    });

    return matches.map(match => {
        const homeCandidate = topCandidates.get(match.home.id);
        const awayCandidate = topCandidates.get(match.away.id);
        const markedCandidates = [
            preferredMarkerMatchByTeam.get(match.home.id)?.id === match.id ? homeCandidate : null,
            preferredMarkerMatchByTeam.get(match.away.id)?.id === match.id ? awayCandidate : null
        ].filter(Boolean);
        const usaR32Boost = Math.min(24, markedCandidates.reduce(
            (sum, candidate) => sum + getUsaR32ImpactBoost(candidate.rank),
            0
        ));
        const score = clamp(match.score + usaR32Boost, 0, 100);

        return {
            ...match,
            score,
            priority: getPriority(score),
            usaR32Boost,
            homeContext: attachUsaR32Candidate({
            context: match.homeContext,
            team: match.home,
            match,
            candidate: homeCandidate,
            preferredMatch: preferredMarkerMatchByTeam.get(match.home.id),
            usaR32Boost
            }),
            awayContext: attachUsaR32Candidate({
            context: match.awayContext,
            team: match.away,
            match,
            candidate: awayCandidate,
            preferredMatch: preferredMarkerMatchByTeam.get(match.away.id),
            usaR32Boost
            })
        };
    });
}

function getUsaR32ImpactBoost(rank) {
    return Math.max(6, 20 - rank * 2);
}

function attachUsaR32Candidate({ context, team, match, candidate, preferredMatch, usaR32Boost }) {
    if (!candidate || preferredMatch?.id !== match.id) return context;

    return {
        ...context,
        usaR32Matchup: {
            ...candidate,
            teamName: team.name,
            groupId: match.groupId,
            impactBoost: usaR32Boost
        }
    };
}

function containsSimulationScores(groupScores) {
    return Object.values(groupScores).some(score => score?.source === 'simulation');
}

function buildLiveStandings(groups, groupScores) {
    return Object.fromEntries(Object.entries(groups).map(([groupId, teams]) => {
        const fixtures = generateGroupFixtures(groupId, teams).map(match => {
            const score = groupScores[match.id];
            return isActualFinal(score)
                ? { ...match, homeScore: score.home, awayScore: score.away }
                : match;
        });

        return [groupId, calculateGroupStandings(teams, fixtures)];
    }));
}

function isActualFinal(score) {
    return Boolean(score?.completed && score?.source !== 'simulation');
}

function buildWatchabilityMatch({ match, groupId, metadata, home, away, homeContext, awayContext, thirdPlaceCutoff }) {
    const qualificationLeverage = (homeContext.stakes + awayContext.stakes) / 2;
    const thirdPlaceLeverage = (homeContext.thirdPlaceStakes + awayContext.thirdPlaceStakes) / 2;
    const peleQuality = getPeleQuality(home, away);
    const competitiveBalance = getCompetitiveBalance(home, away);
    const isLive = metadata.completed === false && metadata.status && !metadata.scheduled;
    const usaBracketRoutingBoost = getUsaBracketRoutingBoost(match, home, away);
    const eliminatedTeamCount = [homeContext, awayContext].filter(context => context.eliminated).length;
    const rawScore = Math.round(clamp(
        qualificationLeverage * 57
        + thirdPlaceLeverage * 20
        + peleQuality * 15
        + competitiveBalance * 8
        + (isLive ? 9 : 0)
        + usaBracketRoutingBoost,
        0,
        100
    ));
  const cappedScore = eliminatedTeamCount === 2
    ? Math.min(rawScore, 25)
    : eliminatedTeamCount === 1
      ? Math.min(rawScore, 64)
      : rawScore;
  // Mexico avoiding defeat eliminates Czechia's best-third route and can
  // directly change the USA's R32 opponent. Keep that causal pivot visible.
  const score = usaBracketRoutingBoost > 0
    ? Math.max(cappedScore, 90)
    : cappedScore;

    return {
        ...match,
        groupId,
        startsAt: metadata.startsAt || null,
        status: metadata.status,
        isLive,
        score,
        priority: getPriority(score),
        usaBracketRoutingBoost,
        home,
        away,
        homeContext,
        awayContext,
        peleRank: {
            home: home.peleRank,
            away: away.peleRank
        },
        kalshiOdds: kalshiOdds[match.id] || null,
        reason: buildMatchReason({ home, away, homeContext, awayContext, thirdPlaceCutoff, usaBracketRoutingBoost })
    };
}

function getUsaBracketRoutingBoost(match, home, away) {
    const isMexicoCzechia = (home.id === 'MEX' && away.id === 'CZE')
        || (home.id === 'CZE' && away.id === 'MEX');

    return match.id === 'A_M5' && isMexicoCzechia ? USA_THIRD_PLACE_ROUTING_BOOST : 0;
}

function buildTeamContext({ team, position, groupStandings, remainingByTeam, completedFixtures, thirdPlaceCutoff }) {
    const points = Number(team.points) || 0;
    const matchesRemaining = remainingByTeam[team.id] || 0;
    const maxPoints = points + matchesRemaining * 3;
    const secondPlacePoints = groupStandings[1]?.points ?? 0;
    const secondPlaceGoalDifference = groupStandings[1]?.gd ?? 0;
    const rivalsWhoCanCatchCurrentPoints = groupStandings
        .filter(rival => rival.id !== team.id)
        .filter(rival => (Number(rival.points) || 0) + (remainingByTeam[rival.id] || 0) * 3 >= points)
        .length;
    const firstPlaceClinched = isGuaranteedGroupWinner({
        team,
        groupStandings,
        remainingByTeam,
        matches: completedFixtures
    });
    const firstPlaceNearlyLocked = position === 1
        && points - secondPlacePoints >= 3
        && (Number(team.gd) || 0) - secondPlaceGoalDifference >= 3;
    const topTwoClinched = rivalsWhoCanCatchCurrentPoints < 2;
    const topTwoPossible = maxPoints >= secondPlacePoints;
    const eliminated = isGuaranteedOutsideTopThree({
        team,
        groupStandings,
        remainingByTeam,
        matches: completedFixtures
    });
    const thirdPlacePossible = !eliminated && maxPoints >= thirdPlaceCutoff;
    const nearThirdCutoff = Math.abs(points - thirdPlaceCutoff) <= 2 || Math.abs(maxPoints - thirdPlaceCutoff) <= 2;

    let stakes = 0.08;
    let label = 'Little left to play for';

    if (!topTwoPossible && !thirdPlacePossible) {
        label = 'Eliminated from advancement';
    } else if (!topTwoClinched && topTwoPossible) {
        stakes = 1;
        label = position <= 2 ? 'Protecting a top-two place' : 'Chasing the top two';
    } else if (topTwoClinched) {
        stakes = 0.22;
        label = 'Qualified; seeding at stake';
    } else if (thirdPlacePossible) {
        stakes = 0.72;
        label = position === 3 ? 'Best-third cutoff race' : 'Still alive via third place';
    }

    return {
        position,
        points,
        goalDifference: Number(team.gd) || 0,
        maxPoints,
        firstPlaceClinched,
        firstPlaceNearlyLocked,
        topTwoClinched,
        topTwoPossible,
        thirdPlacePossible,
        canFinishThird: !topTwoClinched && !eliminated && thirdPlacePossible,
        eliminated,
        thirdPlaceStakes: thirdPlacePossible && (!topTwoClinched || position >= 3)
            ? nearThirdCutoff ? 1 : 0.55
            : 0,
        stakes,
        label
    };
}

function buildMatchReason({ home, away, homeContext, awayContext, thirdPlaceCutoff, usaBracketRoutingBoost }) {
    const bothTopTwo = homeContext.topTwoPossible && awayContext.topTwoPossible
        && (!homeContext.topTwoClinched || !awayContext.topTwoClinched);
    const thirdPlaceFight = homeContext.thirdPlaceStakes > 0 || awayContext.thirdPlaceStakes > 0;
    const highQuality = Math.min(home.peleRank || 99, away.peleRank || 99) <= 16;

    if (usaBracketRoutingBoost > 0) {
        return 'Mexico avoiding defeat likely ends Czechia’s best-third path and can reroute the USA R32 third-place bracket.';
    }

    if (bothTopTwo && thirdPlaceFight) {
        return `Top-two places and the ${thirdPlaceCutoff}-point best-third line are both in play.`;
    }

    if (bothTopTwo) {
        return 'Both teams can still materially change the group’s automatic qualifiers.';
    }

    if (thirdPlaceFight) {
        return `A result can decide whether either side clears the current ${thirdPlaceCutoff}-point best-third line.`;
    }

    if (highQuality) {
        return 'Qualification leverage is lower, but this is still a high-PELE matchup with seeding consequences.';
    }

    return `${homeContext.label}; ${awayContext.label}.`;
}

function getCurrentThirdPlaceCutoff(standings, thirdPlaceQualifiers) {
    const thirdPlacePoints = Object.values(standings)
        .map(group => group?.[2]?.points)
        .filter(Number.isFinite)
        .sort((a, b) => b - a);

    return thirdPlacePoints[Math.max(0, thirdPlaceQualifiers - 1)] ?? 0;
}

function countRemainingMatches(fixtures) {
    return fixtures.reduce((counts, fixture) => {
        counts[fixture.homeId] = (counts[fixture.homeId] || 0) + 1;
        counts[fixture.awayId] = (counts[fixture.awayId] || 0) + 1;
        return counts;
    }, {});
}

function getPeleQuality(home, away) {
    const ranks = [home.peleRank, away.peleRank].filter(Number.isFinite);
    if (ranks.length === 0) return 0.35;
    const averageRank = ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length;
    return clamp(1 - (averageRank - 1) / 47, 0.08, 1);
}

function getCompetitiveBalance(home, away) {
    if (!Number.isFinite(home.peleRank) || !Number.isFinite(away.peleRank)) return 0.45;
    return clamp(1 - Math.abs(home.peleRank - away.peleRank) / 45, 0.12, 1);
}

function groupMatchesByDay(matches, timeZone) {
    const days = new Map();

    matches.forEach(match => {
        const date = match.startsAt ? new Date(match.startsAt) : null;
        const hasKickoff = date && !Number.isNaN(date.getTime());
        const dayKey = hasKickoff ? getLocalDayKey(date, timeZone) : 'schedule-pending';
        const dayLabel = hasKickoff
            ? new Intl.DateTimeFormat(undefined, {
                timeZone,
                weekday: 'long',
                month: 'short',
                day: 'numeric'
            }).format(date)
            : 'Schedule pending';

        if (!days.has(dayKey)) days.set(dayKey, { dayKey, dayLabel, matches: [] });
        days.get(dayKey).matches.push(match);
    });

    return [...days.values()]
        .sort((a, b) => a.dayKey.localeCompare(b.dayKey))
        .map(day => ({
            ...day,
            matches: day.matches
                .sort((a, b) => b.score - a.score || String(a.startsAt).localeCompare(String(b.startsAt)))
        }));
}

function getLocalDayKey(date, timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);
    const valueByType = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${valueByType.year}-${valueByType.month}-${valueByType.day}`;
}

function getPriority(score) {
    if (score >= 90) return 'Must watch';
    if (score >= 76) return 'High impact';
    return 'Worth watching';
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
