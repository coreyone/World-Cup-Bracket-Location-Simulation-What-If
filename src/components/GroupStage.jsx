import React, { useContext, useMemo, useState } from 'react';
import { Clock3, Flame, Info, Trophy } from 'lucide-react';
import { BracketContext } from '../store/BracketContext';
import { generateGroupFixtures } from '../logic/engine';
import { rankRemainingGroupMatches } from '../logic/watchability';
import { Reorder } from 'framer-motion';
import Squircle from './Squircle';
import LocalSectionNav from './LocalSectionNav';

const formatTeamId = (id) => {
    if (!id || id.length <= 3) return id;
    if (id.startsWith('PO_UEFA_')) return 'UE' + id.slice(-1);
    if (id.startsWith('PO_IC_')) return 'IC' + id.slice(-1);
    return id.slice(0, 3);
};

export default function GroupStage() {
    const { standings, groups, qualifiedThirds, automaticThirds, state, actions, dispatch } = useContext(BracketContext);
    const groupIds = Object.keys(groups).sort();
    const qualifiedThirdIds = useMemo(() => new Set(qualifiedThirds.map(team => team.id)), [qualifiedThirds]);
    const automaticThirdIds = useMemo(() => new Set((automaticThirds || []).map(team => team.id)), [automaticThirds]);
    const manualThirdPlaceGroups = useMemo(() => state.manualThirdPlaceGroups || [], [state.manualThirdPlaceGroups]);
    const manualThirdPlaceGroupSet = useMemo(() => new Set(manualThirdPlaceGroups), [manualThirdPlaceGroups]);
    const isSimulated = Boolean(state.simulationCount);
    const isLive = state.liveScoresEnabled;
    const watchableMatchDays = useMemo(() => isLive
        ? rankRemainingGroupMatches({
            groups,
            standings,
            groupScores: state.groupScores,
            fixtureMetadata: state.groupFixtureMeta,
            thirdPlaceQualifiers: state.settings.thirdPlaceQualifiers,
            usaR32OpponentCounts: state.superSimStats?.opponentMatrix?.USA?.R32,
            usaR32ReachCount: state.superSimStats?.knockoutReach?.USA?.R32,
            simulationTrials: state.superSimStats?.trials
        })
        : [], [groups, isLive, standings, state.groupFixtureMeta, state.groupScores, state.settings.thirdPlaceQualifiers, state.superSimStats]);
    const thirdPlaceRows = groupIds.map(groupId => {
        const team = standings[groupId]?.[2];
        const manuallySelected = manualThirdPlaceGroupSet.has(groupId);
        return {
            groupId,
            team,
            advances: team ? qualifiedThirdIds.has(team.id) : false,
            autoAdvances: team ? automaticThirdIds.has(team.id) : false,
            manuallySelected
        };
    });

    const compactMode = true;
    const localNavItems = [
        { href: '#group-stage-groups', label: 'Groups' },
        { href: '#group-stage-best-third', label: 'Best Third' },
        ...(state.superSimStats ? [{ href: '#group-stage-analysis', label: 'Analysis' }] : []),
        ...(isLive ? [{ href: '#group-stage-watchlist', label: 'Watchlist' }] : [])
    ];

    return (
        <div className={`group-stage ${compactMode ? 'compact-stage' : ''}`}>
            <LocalSectionNav label="Group Stage sections" items={localNavItems} />
            <section id="group-stage-groups" className="group-grid" aria-label="Groups">
                {groupIds.map(gId => (
                    <GroupCard key={gId} groupId={gId} qualifiedThirdIds={qualifiedThirdIds} />
                ))}
            </section>
            <div id="group-stage-best-third">
                <ThirdPlaceSummary
                    thirdPlaceRows={thirdPlaceRows}
                    advancingCount={state.settings.thirdPlaceQualifiers}
                    manualSelectedCount={manualThirdPlaceGroups.length}
                    isSimulated={isSimulated}
                    isLive={isLive}
                    onToggleGroup={(groupId) => dispatch({ type: actions.TOGGLE_THIRD_PLACE_GROUP, groupId })}
                    compactMode={compactMode}
                />
            </div>
            {state.superSimStats && (
                <div id="group-stage-analysis">
                    <GroupStageStats 
                        superSimStats={state.superSimStats} 
                        groups={groups} 
                        compactMode={compactMode} 
                    />
                </div>
            )}
            {isLive && <div id="group-stage-watchlist"><WatchableMatches days={watchableMatchDays} /></div>}
            <style>{`
        #group-stage-groups,
        #group-stage-best-third,
        #group-stage-analysis,
        #group-stage-watchlist { scroll-margin-top: 110px; }
        .group-stage {
            display: flex;
            flex-direction: column;
            gap: var(--space-6);
        }
        .group-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
            gap: var(--space-6); 
        }
        @media (max-width: 640px) {
            .group-grid { 
                grid-template-columns: 1fr; 
                gap: var(--space-4);
            }
        }
      `}</style>
        </div>
    );
}

function WatchableMatches({ days }) {
    const timeZoneLabel = getTimeZoneLabel();

    return (
        <Squircle
            cornerRadius={8}
            cornerSmoothing={1}
            shadow="0 2px 8px rgba(0,0,0,0.02)"
            borderColor="#e5e7eb"
            className="watchable-matches-wrapper"
            clip={false}
        >
            <section className="watchable-matches" aria-labelledby="watchable-matches-heading">
                <div className="watchable-header">
                    <div style={{ flexGrow: 1, maxWidth: '100%' }}>
                        <p className="watchable-eyebrow"><Flame size={14} aria-hidden="true" /> Live knockout impact</p>
                        <h2 id="watchable-matches-heading">Most Watchable Remaining Matches</h2>
                        <p>Every remaining match, ranked within each day by qualification leverage, best-third pressure, PELE quality, and competitive balance.</p>


                    </div>
                    <div className="watchable-legend"><Trophy size={15} aria-hidden="true" /> Top two + best 8 third-place teams advance</div>
                </div>

                {days.length === 0 ? (
                    <p className="watchable-empty">Waiting for the live fixture schedule. Refresh live scores to load remaining matches.</p>
                ) : days.map(day => (
                    <div className="watchable-day" key={day.dayKey}>
                        <h3>{day.dayLabel}</h3>
                        <div className="watchable-table-wrap">
                            <table className="watchable-table">
                                <colgroup>
                                    <col className="watchable-col-rank" />
                                    <col className="watchable-col-match" />
                                    <col className="watchable-col-kalshi" />
                                    <col className="watchable-col-stakes" />
                                    <col className="watchable-col-impact" />
                                    <col className="watchable-col-kickoff" />
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Match</th>
                                        <th>Kalshi (H/D/A)</th>
                                        <th>Stakes</th>
                                        <th>Impact</th>
                                        <th>Kickoff ({timeZoneLabel})</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {day.matches.map((match, index) => (
                                        <tr key={match.id} title={match.reason}>
                                            <td><span className="watchable-rank">{index + 1}</span></td>
                                            <td><WatchableMatchup match={match} /></td>
                                            <td>
                                                {match.kalshiOdds ? (
                                                    <span className="watchable-kalshi">
                                                        {match.kalshiOdds.home}% / {match.kalshiOdds.draw}% / {match.kalshiOdds.away}%
                                                    </span>
                                                ) : (
                                                    <span className="watchable-kalshi-empty">—</span>
                                                )}
                                            </td>
                                            <td><span className="watchable-stakes">{getStakesSummary(match)}</span></td>
                                            <td>
                                                {match.priority === 'Must watch' && (
                                                    <span className={`watchable-priority ${match.priority.toLowerCase().replaceAll(' ', '-')}`}>{match.priority}</span>
                                                )}
                                                <span className="watchable-score">{match.score}</span>
                                            </td>
                                            <td>
                                                <span className="watchable-time">
                                                    <Clock3 size={13} aria-hidden="true" />
                                                    <span>{match.isLive ? match.status || 'Live now' : formatFixtureTime(match.startsAt)}</span>
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
            </section>
            <style>{`
                .watchable-matches { box-sizing: border-box; width: 100%; margin: 0; padding: var(--space-5, 20px) var(--space-6, 24px); }
                .watchable-header { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-5, 20px); margin-bottom: var(--space-4, 16px); }
                .watchable-eyebrow { display: inline-flex; align-items: center; gap: 6px; margin: 0 0 5px; color: #c2410c; font-size: var(--font-xs); font-weight: 800; letter-spacing: 0; text-transform: uppercase; }
                .watchable-header h2 { margin: 0; color: var(--text-main); font-size: var(--font-xl); }
                .watchable-header > div > p:not(.watchable-eyebrow) { margin: 5px 0 0; color: var(--text-muted); font-size: var(--font-sm); font-weight: 600; line-height: 1.4; }
                .watchable-legend { display: inline-flex; align-items: center; gap: 7px; flex: 0 1 285px; padding: 9px 11px; border: 1px solid #fde68a; border-radius: var(--radius-md); background: #fffbeb; color: #92400e; font-size: .76rem; font-weight: 700; line-height: 1.35; }
                .watchable-day + .watchable-day { margin-top: var(--space-5, 20px); }
                .watchable-day h3 { margin: 0 0 var(--space-2); color: var(--text-main); font-size: var(--font-sm); }
                .watchable-table-wrap { overflow-x: auto; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); background: var(--surface); }
                .watchable-table { width: 100%; min-width: 900px; table-layout: fixed; border-collapse: collapse; text-align: left; }
                .watchable-col-rank { width: 6%; }
                .watchable-col-match { width: 36%; }
                .watchable-col-kalshi { width: 16%; }
                .watchable-col-stakes { width: 18%; }
                .watchable-col-impact { width: 12%; }
                .watchable-col-kickoff { width: 12%; }
                .watchable-kalshi { display: inline-flex; align-items: center; border-radius: var(--radius-pill); padding: 3px 7px; background: #f8fafc; border: 1px solid #e2e8f0; color: #475569; font-size: .68rem; font-weight: 700; white-space: nowrap; }
                .watchable-kalshi-empty { font-size: .68rem; font-weight: 500; color: var(--text-muted); }
                .watchable-table th { padding: 7px 10px; background: var(--surface-muted); border-bottom: 1px solid var(--border-subtle); color: var(--text-muted); font-size: .65rem; font-weight: 800; letter-spacing: .02em; text-transform: uppercase; }
                .watchable-table td { padding: 8px 10px; border-bottom: 1px solid var(--border-subtle); color: var(--text-main); font-size: .8rem; vertical-align: middle; }
                .watchable-table tbody tr:last-child td { border-bottom: 0; }
                .watchable-table tbody tr:hover { background: #f8fafc; }
                .watchable-rank { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: #0f172a; color: #fff; font-size: .68rem; font-weight: 800; }
                .watchable-priority, .watchable-score, .watchable-stakes { display: inline-flex; align-items: center; border-radius: var(--radius-pill); padding: 3px 7px; white-space: nowrap; font-size: .67rem; font-weight: 800; }
                .watchable-priority.must-watch { background: #fee2e2; color: #b91c1c; }
                .watchable-priority.high-impact { background: #fef3c7; color: #92400e; }
                .watchable-priority.worth-watching { background: #e0f2fe; color: #0369a1; }
                .watchable-score { margin-left: 4px; background: #f1f5f9; color: #475569; }
                .watchable-stakes { max-width: 190px; overflow: hidden; text-overflow: ellipsis; background: #eff6ff; color: #1d4ed8; }
                .watchable-matchup { display: flex; align-items: center; gap: 7px; min-width: 250px; white-space: nowrap; }
                .watchable-team { display: inline-flex; align-items: baseline; gap: 5px; font-size: .82rem; font-weight: 800; }
                .watchable-team-code { color: #475569; font-size: .68rem; }
                .watchable-team-state { display: inline-grid; place-items: center; width: 14px; height: 14px; font-size: .75rem; font-weight: 900; line-height: 1; }
                .watchable-team-state.first { color: #b45309; }
                .watchable-team-state.advances { color: #15803d; }
                .watchable-team-state.eliminated { color: #b91c1c; }
                .watchable-usa-path { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #2563eb; box-shadow: 0 0 0 2px #dbeafe; }
                .watchable-team-detail { color: var(--text-muted); font-size: .67rem; font-weight: 700; }
                .watchable-versus { color: var(--text-muted); font-size: .68rem; font-weight: 800; text-transform: uppercase; }
                .watchable-time { display: inline-flex; align-items: center; gap: 5px; min-width: 84px; color: var(--text-muted); font-size: .72rem; font-weight: 700; white-space: nowrap; }
                .watchable-empty { margin: 0; padding: var(--space-4); border-radius: var(--radius-md); background: var(--surface-muted); color: var(--text-muted); font-size: var(--font-sm); font-weight: 600; }
                @media (max-width: 700px) {
                    .watchable-matches { padding: var(--space-4); }
                    .watchable-header { flex-direction: column; gap: var(--space-3); }
                    .watchable-legend { max-width: none; flex-basis: auto; }
                    .watchable-table td, .watchable-table th { padding: 7px 8px; }
                }
            `}</style>
        </Squircle>
    );
}

function WatchableMatchup({ match }) {
    return (
        <div className="watchable-matchup" title={match.reason}>
            <span className="watchable-team">
                <span className="watchable-team-code">{formatTeamId(match.home.id)}</span>
                <span>{match.home.name}</span>
                <TeamStateMarker context={match.homeContext} />
                <UsaPathMarker groupId={match.groupId} context={match.homeContext} />
                <span className="watchable-team-detail">{match.homeContext.points}p · #{match.home.peleRank ?? '—'}</span>
            </span>
            <span className="watchable-versus">vs</span>
            <span className="watchable-team">
                <span className="watchable-team-code">{formatTeamId(match.away.id)}</span>
                <span>{match.away.name}</span>
                <TeamStateMarker context={match.awayContext} />
                <UsaPathMarker groupId={match.groupId} context={match.awayContext} />
                <span className="watchable-team-detail">{match.awayContext.points}p · #{match.away.peleRank ?? '—'}</span>
            </span>
        </div>
    );
}

function TeamStateMarker({ context }) {
    if (context.firstPlaceClinched) {
        return <span className="watchable-team-state first" title="First place locked" aria-label="First place locked">★</span>;
    }

    if (context.points >= 4) {
        return <span className="watchable-team-state advances" title="Advancing on 4 or more points" aria-label="Advancing on 4 or more points">✓</span>;
    }

    if (context.eliminated) {
        return <span className="watchable-team-state eliminated" title="Eliminated: cannot finish in the group’s top three" aria-label="Eliminated">×</span>;
    }

    return null;
}

function UsaPathMarker({ groupId, context }) {
    const matchup = context.usaR32Matchup;
    if (!matchup) return null;

    const exact = formatProbability(matchup.exactProbability);
    const route = formatProbability(matchup.routeProbability);

    return (
        <span
            className="watchable-usa-path"
            role="img"
            title={`USA R32 #${matchup.rank}: ${exact} exact · ${route} conditional. Group ${groupId} third-place path · +${matchup.impactBoost} impact.`}
            aria-label={`USA Round of 32 opponent rank ${matchup.rank}: ${exact} exact matchup chance`}
        />
    );
}

function formatProbability(probability) {
    return `${(Math.max(0, probability || 0) * 100).toFixed(1)}%`;
}

function getStakesSummary(match) {
    const topTwoRace = match.homeContext.topTwoPossible && match.awayContext.topTwoPossible
        && (!match.homeContext.topTwoClinched || !match.awayContext.topTwoClinched);
    const bestThirdRace = match.homeContext.thirdPlaceStakes > 0 || match.awayContext.thirdPlaceStakes > 0;
    const lockedWinner = getGroupWinnerStatus(match);

    if (lockedWinner && topTwoRace && bestThirdRace) {
        return `${formatTeamId(lockedWinner.team.id)} ${lockedWinner.label} · 2nd + Best 3rd`;
    }

    if (lockedWinner && topTwoRace) {
        return `${formatTeamId(lockedWinner.team.id)} ${lockedWinner.label} · 2nd`;
    }

    if (lockedWinner && bestThirdRace) {
        return `${formatTeamId(lockedWinner.team.id)} ${lockedWinner.label} · Best 3rd`;
    }

    if (topTwoRace && bestThirdRace) return 'Top 2 + Best 3rd';
    if (topTwoRace) return 'Top 2';
    if (bestThirdRace) return 'Best 3rd';
    return 'Seed/Pride';
}

function getGroupWinnerStatus(match) {
    const candidates = [
        { team: match.home, context: match.homeContext },
        { team: match.away, context: match.awayContext }
    ];
    const clinched = candidates.find(({ context }) => context.firstPlaceClinched);
    if (clinched) return { team: clinched.team, label: '1st clinched' };

    const nearlyLocked = candidates.find(({ context }) => context.firstPlaceNearlyLocked);
    return nearlyLocked ? { team: nearlyLocked.team, label: '1st safe' } : null;
}

function formatFixtureTime(startsAt) {
    if (!startsAt) return 'Time pending';
    const date = new Date(startsAt);
    if (Number.isNaN(date.getTime())) return 'Time TBD';
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

function getTimeZoneLabel() {
    const timeZonePart = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
        .formatToParts(new Date())
        .find(part => part.type === 'timeZoneName');
    return timeZonePart?.value || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function ThirdPlaceSummary({ thirdPlaceRows, advancingCount, manualSelectedCount, isSimulated, isLive, onToggleGroup, compactMode }) {
    const { state } = useContext(BracketContext);
    const hasSimulatedOrPlayed = state.simulationCount > 0 || Object.keys(state.groupScores).length > 0;
    const totalThirds = thirdPlaceRows.length;
    const manualMode = manualSelectedCount > 0;

    return (
        <Squircle
            cornerRadius={compactMode ? 8 : 12}
            cornerSmoothing={1}
            shadow={compactMode ? "0 2px 8px rgba(0,0,0,0.02)" : "0 4px 20px rgba(0,0,0,0.03)"}
            borderColor={compactMode ? "#e5e7eb" : "#e5e7eb"}
            className={`third-summary-wrapper ${compactMode ? 'compact-summary' : ''}`}
            clip={false}
        >
            <section className="third-summary">
                <div className="third-summary-main">
                    <div>
                        <div className="eyebrow-container">
                            <p className="eyebrow">Third-place teams</p>
                            <div className="tooltip-trigger" tabIndex={0} aria-label="Third-place advancement explanation">
                                <Info size={13} />
                                <div className="tooltip-content">
                                    <strong>Third-Place Advancement</strong>
                                    <p>8 of 12 third-place teams advance to the Round of 32. Standings are ranked by:</p>
                                    <ol className="tooltip-list">
                                        <li>Points accumulated</li>
                                        <li>Goal Difference (GD)</li>
                                        <li>Goals For (GF)</li>
                                    </ol>
                                    <p className="tooltip-math-note">
                                        Exact match scorelines are generated dynamically using adjusted PELE ratings, betting-market futures, confederation weights, host-nation buffs, and Poisson probability.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <h2>{advancingCount} of {totalThirds} advance</h2>
                        <p className="third-summary-note">
                            {isSimulated
                                ? 'Simulation chooses advancing third-place teams from the generated scores.'
                                : isLive
                                    ? 'Live scores choose advancing third-place teams automatically.'
                                    : manualMode
                                    ? `${manualSelectedCount} manually selected, ${advancingCount - manualSelectedCount} auto-filled`
                                    : 'Tap teams to manually choose advancing third-place groups.'}
                        </p>
                    </div>
                    <div className="summary-count">
                        <span>{isSimulated ? advancingCount : manualSelectedCount}</span>
                        <small>{isSimulated ? 'advancing spots' : 'manual picks'}</small>
                    </div>
                </div>
                <div className="third-team-grid">
                    {thirdPlaceRows.map(({ groupId, team, advances, autoAdvances, manuallySelected }) => {
                            const selectionLimitReached = !manuallySelected && manualSelectedCount >= advancingCount;
                        const chipClass = [
                            'third-chip',
                            advances ? 'advances' : 'eliminated',
                            manuallySelected ? 'manual' : '',
                            selectionLimitReached && !isSimulated ? 'locked' : ''
                        ].filter(Boolean).join(' ');

                        return (
                            <button
                                key={groupId}
                                type="button"
                                className={chipClass}
                                disabled={isSimulated || isLive || selectionLimitReached}
                                onClick={() => onToggleGroup(groupId)}
                            >
                                <span className="group-pill">Group {groupId}</span>
                                <span className="third-team-name">
                                    <span className="name-text">{team?.name || 'TBD'}</span>
                                    {hasSimulatedOrPlayed && team && team.points !== undefined && (
                                        <span className="pts-pill mini" title={`${team.points} points, ${team.gd > 0 ? `+${team.gd}` : team.gd} Goal Difference`}>
                                            <span className="pts-value">{team.points}p</span>
                                            <span className="gd-value">{team.gd > 0 ? `+${team.gd}` : team.gd}</span>
                                        </span>
                                    )}
                                </span>
                                <span className="third-status">
                                    {getThirdStatusLabel({ advances, autoAdvances, manuallySelected, manualMode, isSimulated, isLive, selectionLimitReached })}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </section>
            <style>{`
        .third-summary { padding: var(--space-6); background: transparent; max-width: 1200px; margin: 0 auto; }
        .third-summary-main {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: var(--space-6);
            margin-bottom: var(--space-5, 20px);
            max-width: 1000px;
            margin-left: auto;
            margin-right: auto;
        }
        .eyebrow-container {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 4px;
        }
        .eyebrow {
            margin: 0;
            color: var(--text-muted);
            font-size: var(--font-xs);
            font-weight: 800;
            letter-spacing: 0;
            text-transform: uppercase;
        }
        .tooltip-trigger {
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: var(--text-muted);
            cursor: help;
            transition: color 0.15s ease;
            outline: none;
            padding: 2px;
        }
        .tooltip-trigger:hover,
        .tooltip-trigger:focus {
            color: var(--text-strong, #0f172a);
        }
        .tooltip-content {
            visibility: hidden;
            position: absolute;
            bottom: 135%;
            left: -20px;
            background: rgba(15, 23, 42, 0.95);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: #f8fafc;
            padding: var(--space-3) var(--space-4);
            border-radius: var(--radius-md);
            font-size: 0.78rem;
            font-weight: 500;
            line-height: 1.4;
            width: 250px;
            text-align: left;
            white-space: normal;
            z-index: 100;
            opacity: 0;
            transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s ease;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.2);
            pointer-events: none;
            transform: translateY(4px);
        }
        .tooltip-content strong {
            display: block;
            font-size: 0.72rem;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            color: #38bdf8;
            margin-bottom: 4px;
        }
        .tooltip-content p {
            margin: 0;
        }
        .tooltip-list {
            margin: var(--space-2) 0;
            padding-left: 16px;
            font-size: 0.72rem;
            color: #e2e8f0;
        }
        .tooltip-list li {
            margin-bottom: 2px;
        }
        .tooltip-math-note {
            margin-top: var(--space-2) !important;
            font-size: 0.68rem !important;
            line-height: 1.35 !important;
            color: #94a3b8 !important;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            padding-top: var(--space-2);
        }
        .tooltip-content::after {
            content: "";
            position: absolute;
            top: 100%;
            left: 26px;
            border-width: 6px;
            border-style: solid;
            border-color: rgba(15, 23, 42, 0.95) transparent transparent transparent;
        }
        .tooltip-trigger:hover .tooltip-content,
        .tooltip-trigger:focus .tooltip-content,
        .tooltip-trigger:focus-within .tooltip-content {
            visibility: visible;
            opacity: 1;
            transform: translateY(0);
        }
        .third-summary h2 {
            margin: 0;
            font-size: var(--font-xl);
            letter-spacing: 0;
        }
        .third-summary-note {
            margin: 4px 0 0;
            color: var(--text-muted);
            font-size: 0.9rem;
            font-weight: 600;
        }
        .summary-count {
            min-width: 124px;
            padding: var(--space-3) var(--space-4);
            border-radius: var(--radius-lg);
            background: var(--success-bg);
            border: 1px solid var(--success-border);
            text-align: center;
            color: var(--success-text);
        }
        .summary-count span {
            display: block;
            font-size: 2rem;
            line-height: 1;
            font-weight: 800;
        }
        .summary-count small {
            display: block;
            margin-top: 4px;
            font-size: 0.72rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0;
        }
        .third-team-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: var(--space-3);
        }
        .third-chip {
            display: grid;
            grid-template-columns: auto 1fr auto;
            align-items: center;
            gap: var(--space-2);
            min-height: 52px;
            padding: var(--space-3);
            border-radius: var(--radius-md);
            border: 1px solid var(--border-subtle);
            background: var(--surface);
            font-size: 0.86rem;
            text-align: left;
            cursor: pointer;
            font-family: inherit;
            transition: transform var(--motion-duration-micro) var(--motion-ease-standard), box-shadow var(--motion-duration-micro) var(--motion-ease-standard), border-color var(--motion-duration-micro) var(--motion-ease-standard);
        }
        @media (hover: hover) {
            .third-chip:hover:not(:disabled) {
                transform: translateY(calc(-1 * var(--motion-distance-1)));
                box-shadow: var(--shadow-sm);
                border-color: var(--border-strong);
            }
        }
        .third-chip.advances {
            border-color: var(--success-border);
            background: var(--success-bg);
        }
        .third-chip.manual {
            border-color: var(--success-border);
            box-shadow: inset 0 0 0 1px var(--success-border);
        }
        .third-chip.eliminated {
            background: var(--surface-muted);
            color: var(--text-muted);
        }
        .third-chip.locked {
            cursor: not-allowed;
            background: #f1f5f9;
            color: #64748b;
        }
        .third-chip:disabled { cursor: default; }
        .group-pill {
            border-radius: var(--radius-pill);
            background: #e2e8f0;
            padding: 3px 8px;
            color: #475569;
            font-size: 0.72rem;
            font-weight: 800;
            white-space: nowrap;
        }
        .third-team-name {
            display: flex;
            align-items: center;
            gap: 6px;
            min-width: 0;
            overflow: visible;
            white-space: normal;
            line-height: 1.2;
            font-weight: 700;
        }
        .third-team-name .name-text {
            flex-grow: 1;
        }
        .pts-pill.mini {
            padding: 1px 4px;
            font-size: 0.68rem;
            border-radius: 4px;
            gap: 2px;
        }
        .pts-pill.mini .gd-value {
            font-size: 0.60rem;
            padding: 0px 2px;
        }
        .third-status {
            justify-self: end;
            border-radius: var(--radius-pill);
            padding: 3px 8px;
            background: #eef2f7;
            font-size: 0.72rem;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0;
        }
        .third-chip.advances .third-status {
            background: #dcfce7;
            color: var(--success-text);
        }
        .third-chip.manual .third-status {
            background: var(--success-text);
            color: #fff;
        }
        .third-chip.eliminated .third-status {
            background: #e2e8f0;
            color: #64748b;
        }
        @media (max-width: 640px) {
            .third-summary-main {
                align-items: stretch;
                flex-direction: column;
                gap: var(--space-4);
            }
            .summary-count {
                width: auto;
            }
            .third-team-grid {
                grid-template-columns: 1fr;
            }
        }
      `}</style>
        </Squircle>
    );
}

function getThirdStatusLabel({ advances, autoAdvances, manuallySelected, manualMode, isSimulated, isLive, selectionLimitReached }) {
    if (isSimulated || isLive) return advances ? 'Advances' : 'Out';
    if (manuallySelected) return 'Manual';
    if (manualMode && advances) return 'Auto';
    if (!manualMode && autoAdvances) return 'Auto';
    if (selectionLimitReached) return 'Full';
    return 'Out';
}

function getLiveScoreStatus(score) {
    if (score?.source !== 'live') return null;
    if (score.completed) {
        return {
            label: 'FT',
            title: 'This live result is final and cannot be edited or cleared while live mode is enabled.'
        };
    }

    const status = score.status || 'Live';
    const minute = parseMatchMinute(status);

    if (minute !== null) {
        const minutesLeft = Math.max(0, 90 - minute);
        if (minute >= 90) {
            return {
                label: `Live ${status} · stoppage time`,
                title: `Live match: ${status}. Regulation time is complete or in stoppage time.`
            };
        }
        return {
            label: `Live ${status} · ~${minutesLeft}' left`,
            title: `Live match: ${status}. Estimated regulation time remaining: about ${minutesLeft} minutes.`
        };
    }

    if (/half/i.test(status)) {
        return {
            label: status,
            title: 'Live match at halftime.'
        };
    }

    return {
        label: `Live · ${status}`,
        title: `Live match status: ${status}`
    };
}

function parseMatchMinute(status = '') {
    const match = status.match(/(\d{1,3})(?:\+\d{1,2})?\s*(?:'|’)|(\d{1,3})\s*min/i);
    if (!match) return null;
    const minute = Number.parseInt(match[1] || match[2], 10);
    return Number.isFinite(minute) ? minute : null;
}

function getPointsFromScore(teamGoals, opponentGoals) {
    if (teamGoals > opponentGoals) return 3;
    if (teamGoals === opponentGoals) return 1;
    return 0;
}

function getLivePointsByTeam(fixtures, groupScores) {
    const pointsByTeam = {};

    fixtures.forEach(match => {
        const score = groupScores[match.id];
        if (score?.source !== 'live') return;

        const homePoints = getPointsFromScore(score.home, score.away);
        const awayPoints = getPointsFromScore(score.away, score.home);

        [
            [match.homeId, homePoints],
            [match.awayId, awayPoints]
        ].forEach(([teamId, points]) => {
            pointsByTeam[teamId] ||= { finalPoints: 0, provisionalPoints: 0, provisionalMatches: 0 };
            if (score.completed) {
                pointsByTeam[teamId].finalPoints += points;
            } else {
                pointsByTeam[teamId].provisionalPoints += points;
                pointsByTeam[teamId].provisionalMatches += 1;
            }
        });
    });

    return pointsByTeam;
}

function getPointsPillTitle(team, livePoints, totalPoints) {
    if (!livePoints) {
        return `${totalPoints} points, ${team.gd > 0 ? `+${team.gd}` : team.gd} Goal Difference`;
    }

    if (livePoints.provisionalMatches > 0) {
        return `${totalPoints} points from final live results. In-progress matches are shown below but do not affect standings until final. ${team.gd > 0 ? `+${team.gd}` : team.gd} Goal Difference.`;
    }

    return `${totalPoints} points earned from final live results, ${team.gd > 0 ? `+${team.gd}` : team.gd} Goal Difference`;
}

function GroupCard({ groupId, qualifiedThirdIds }) {
    const { state, actions, dispatch, standings, groups } = useContext(BracketContext);
    const compactMode = true;
    const hasSimulatedOrPlayed = state.simulationCount > 0 || Object.keys(state.groupScores).length > 0;
    const [scoresOpen, setScoresOpen] = useState(false);
    const scoresExpanded = scoresOpen;
    const groupStandings = standings[groupId];
    const teamMap = new Map(groups[groupId].map(team => [team.id, team]));
    const fixtures = generateGroupFixtures(groupId, groups[groupId]);
    const livePointsByTeam = state.liveScoresEnabled ? getLivePointsByTeam(fixtures, state.groupScores) : {};

    // We use the computed standings as the source of truth for the list
    // When a drag happens, we dispatch an override action
    const handleReorder = (newOrder) => {
        if (state.liveScoresEnabled) return;
        // newOrder is an array of team objects
        const orderIds = newOrder.map(t => t.id);
        dispatch({
            type: actions.SET_GROUP_ORDER,
            groupId: groupId,
            order: orderIds
        });
    };

    return (
        <Squircle
            cornerRadius={compactMode ? 12 : 16}
            cornerSmoothing={1}
            shadow={compactMode ? "0 2px 8px rgba(0,0,0,0.02)" : "0 4px 20px rgba(0,0,0,0.03)"}
            borderColor={compactMode ? "#e5e7eb" : "#f0f0f0"}
            className={`group-card-wrapper ${compactMode ? 'compact-card' : ''} ${state.liveScoresEnabled ? 'live-card' : ''}`}
        >
            <div className="group-card-content">
                <div className="group-header">
                    <h3>Group {groupId}</h3>
                </div>

                <div className="reorder-container">
                    <div className="reorder-header">
                        <span>#</span>
                        <span>Team</span>
                    </div>
                    <Reorder.Group
                        axis="y"
                        values={groupStandings}
                        onReorder={handleReorder}
                        className="reorder-list"
                    >
                        {groupStandings.map((t, index) => (
                            (() => {
                                const livePoints = livePointsByTeam[t.id];
                                return (
                            <Reorder.Item
                                key={t.id}
                                value={t}
                                className={`reorder-item ${getRowStatusClass(index, t, qualifiedThirdIds)}`}
                                dragListener={!state.liveScoresEnabled}
                            >
                                <span className="rank">{index + 1}</span>
                                <div className="team-info">
                                    <span className="flag">{formatTeamId(t.id)}</span>
                                    <span className="name">{t.name}</span>
                                    {t.isPlaceholder && <small> (TBD)</small>}
                                    {hasSimulatedOrPlayed && t.points !== undefined && (
                                        <span className={[
                                            'pts-pill',
                                            state.liveScoresEnabled ? 'live-standings-points' : '',
                                        ].filter(Boolean).join(' ')} title={getPointsPillTitle(t, livePoints, t.points)}>
                                            <span className="pts-value">{t.points}</span>
                                            <span className="pts-label">pts</span>
                                            <span className="gd-value">{t.gd > 0 ? `+${t.gd}` : t.gd}</span>
                                        </span>
                                    )}
                                </div>
                                {index < 3 ? (
                                    <span className={`status-badge ${getRowStatusClass(index, t, qualifiedThirdIds)}`}>
                                        {getRowStatusLabel(index, t, qualifiedThirdIds)}
                                    </span>
                                ) : (
                                    <span />
                                )}
                                <span className="drag-handle">☰</span>
                            </Reorder.Item>
                                );
                            })()
                        ))}
                    </Reorder.Group>
                </div>

                <div className="group-score-list">
                    <button
                        type="button"
                        className="score-list-toggle"
                        aria-expanded={scoresExpanded}
                        onClick={() => setScoresOpen(open => !open)}
                    >
                        <span>Group match scores</span>
                        <span className={`toggle-chevron ${scoresExpanded ? 'open' : ''}`}>⌄</span>
                    </button>
                    <div className={`score-list-body ${scoresExpanded ? 'open' : ''}`}>
                        <div className="score-list-inner">
                            {fixtures.map(match => {
                                const home = teamMap.get(match.homeId);
                                const away = teamMap.get(match.awayId);
                                const score = state.groupScores[match.id];
                                const liveStatus = getLiveScoreStatus(score);

                                return (
                                    <div
                                        key={match.id}
                                        className={[
                                            'group-match-row',
                                            score?.source === 'live' ? 'live-match-row' : '',
                                            score?.completed ? 'final-match-row' : ''
                                        ].filter(Boolean).join(' ')}
                                    >
                                        <span className="team-label">{formatTeamId(home?.id)}</span>
                                        <span className="score-box">{score ? score.home : '-'}</span>
                                        <span className="score-separator">-</span>
                                        <span className="score-box">{score ? score.away : '-'}</span>
                                        <span className="team-label away">{formatTeamId(away?.id)}</span>
                                        {liveStatus && (
                                            <span
                                                className={`score-status-chip ${score.completed ? 'final' : 'live'}`}
                                                title={liveStatus.title}
                                            >
                                                {liveStatus.label}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
        /* .group-card-wrapper applied via Squircle className if needed for margin/layout context */
        .group-card-wrapper {
            container-type: inline-size;
            container-name: group-card;
        }
        
        .group-card-content { padding: var(--space-5, 20px); background: transparent; }

        .group-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6); }
        .group-header h3 { margin: 0; font-size: var(--font-lg); font-weight: 700; letter-spacing: 0; color: var(--text-main); }
        
        /* Reorder Styles */
        .reorder-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--space-2); }
        .reorder-item { 
            display: grid; 
            grid-template-columns: 28px 1fr auto 24px;
            align-items: center;
            gap: var(--space-2);
            min-height: 52px;
            padding: var(--space-3);
            background: var(--surface); 
            border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); cursor: grab; user-select: none;
            box-shadow: var(--shadow-sm);
            transition: transform var(--motion-duration-micro) var(--motion-ease-standard), box-shadow var(--motion-duration-micro) var(--motion-ease-standard), background var(--motion-duration-micro) var(--motion-ease-standard), border-color var(--motion-duration-micro) var(--motion-ease-standard);
        }
        @media (hover: hover) {
            .reorder-item:hover { transform: translateY(calc(-1 * var(--motion-distance-1))); box-shadow: var(--shadow-md); }
            .score-list-toggle:hover { color: var(--text-main); }
        }
        .reorder-item:active { cursor: grabbing; box-shadow: var(--shadow-lg); transform: scale(var(--motion-press-scale)); }
        .reorder-item.qualified { border-left: 6px solid #16a34a; background-color: var(--success-bg); }
        .reorder-item.third-qualified { border-left: 6px solid #16a34a; background-color: var(--success-bg); }
        .reorder-item.third-eliminated { border-left: 6px solid #64748b; background-color: var(--surface-muted); }
        
        .reorder-header { display: grid; grid-template-columns: 28px 1fr auto 24px; gap: var(--space-2); padding: 0 var(--space-3) var(--space-2); font-size: var(--font-xs); text-transform: uppercase; letter-spacing: 0; color: var(--text-muted); font-weight: 700; }
        .rank { width: 28px; font-weight: 800; color: #64748b; }
        .team-info { display: flex; align-items: center; gap: var(--space-3); flex: 1; min-width: 0; margin-left: var(--space-3); font-weight: 600; color: var(--text-main); }
        .name { min-width: 0; overflow: visible; white-space: normal; line-height: 1.2; }
        .flag { font-weight: 800; font-size: 0.8rem; color: #334155; background: #e2e8f0; padding: 4px 8px; border-radius: var(--radius-sm); }
        .status-badge {
            border-radius: var(--radius-pill);
            padding: 3px 8px;
            font-size: 0.68rem;
            font-weight: 800;
            letter-spacing: 0;
            text-transform: uppercase;
            white-space: nowrap;
        }
        .pts-pill {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            margin-left: auto;
            flex-shrink: 0;
            font-size: 0.72rem;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: var(--radius-sm);
            background: #f1f5f9;
            border: 1px solid #e2e8f0;
            color: #475569;
            line-height: 1;
        }
        .pts-value {
            color: #0f172a;
            font-weight: 800;
            text-transform: uppercase;
        }
        .pts-label {
            color: #475569;
            font-size: 0.6rem;
            font-weight: 850;
            text-transform: uppercase;
        }
        .live-standings-points {
            background: #ecfdf5;
            border-color: #bbf7d0;
            color: #166534;
        }
        .gd-value {
            color: #64748b;
            font-size: 0.64rem;
            font-weight: 600;
            background: rgba(0, 0, 0, 0.05);
            padding: 1px 4px;
            border-radius: 2px;
        }
        .status-badge.qualified,
        .status-badge.third-qualified {
            background: #dcfce7;
            color: #166534;
        }
        .status-badge.third-eliminated {
            background: #e2e8f0;
            color: #64748b;
        }
        .drag-handle { color: #d0d7de; cursor: grab; font-size: 1.2rem; margin-right: -4px; justify-self: end; }
        .group-score-list {
            margin-top: var(--space-5, 20px);
            padding-top: var(--space-4);
            border-top: 1px solid #eef2f7;
            display: flex;
            flex-direction: column;
            gap: var(--space-2);
        }
        .score-list-toggle {
            width: 100%;
            min-height: 44px;
            border: 0;
            background: transparent;
            color: var(--text-muted);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0;
            cursor: pointer;
            color: var(--text-muted);
            font-size: var(--font-xs);
            font-weight: 800;
            letter-spacing: 0;
            text-transform: uppercase;
        }
        .toggle-chevron {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 22px;
            height: 22px;
            border-radius: var(--radius-pill);
            background: #eef2f7;
            color: #475569;
            font-size: 1rem;
            line-height: 1;
            transition: transform var(--motion-duration-panel) var(--motion-ease-standard);
        }
        .toggle-chevron.open { transform: rotate(180deg); }
        .score-list-body {
            display: grid;
            grid-template-rows: 0fr;
            opacity: 0;
            transform: translateY(calc(-1 * var(--motion-distance-1)));
            transition: grid-template-rows var(--motion-duration-panel) var(--motion-ease-standard), opacity var(--motion-duration-panel) var(--motion-ease-standard), transform var(--motion-duration-panel) var(--motion-ease-standard);
        }
        .score-list-body.open {
            grid-template-rows: 1fr;
            opacity: 1;
            transform: translateY(0);
        }
        .score-list-inner {
            min-height: 0;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            gap: var(--space-2);
        }
        .group-match-row {
            display: grid;
            grid-template-columns: minmax(38px, 1fr) 30px 10px 30px minmax(38px, 1fr);
            align-items: center;
            gap: var(--space-1);
            min-height: 30px;
            padding: 4px 8px;
            border-radius: var(--radius-md);
            background: var(--surface-muted);
            font-size: 0.78rem;
        }
        .live-match-row {
            grid-template-columns: minmax(38px, 1fr) 30px 10px 30px minmax(38px, 1fr) minmax(92px, auto);
            background: #f0f9ff;
            border: 1px solid #bae6fd;
        }
        .live-match-row.final-match-row {
            background: #f8fafc;
            border-color: #cbd5e1;
        }
        .team-label {
            font-weight: 800;
            color: #475569;
        }
        .team-label.away {
            text-align: right;
        }
        .score-box {
            justify-self: center;
            min-width: 26px;
            border-radius: var(--radius-sm);
            background: #fff;
            border: 1px solid var(--border-subtle);
            text-align: center;
            font-weight: 800;
            color: var(--text-main);
        }
        .score-separator {
            justify-self: center;
            color: #94a3b8;
            font-weight: 800;
        }
        .score-status-chip {
            justify-self: end;
            max-width: 100%;
            border-radius: var(--radius-pill);
            padding: 2px 7px;
            font-size: 0.64rem;
            font-weight: 850;
            line-height: 1.15;
            white-space: nowrap;
        }
        .score-status-chip.live {
            color: #075985;
            background: #e0f2fe;
            border: 1px solid #7dd3fc;
        }
        .score-status-chip.final {
            color: #334155;
            background: #e2e8f0;
            border: 1px solid #cbd5e1;
            min-width: 26px;
            text-align: center;
        }

        /* Container Query responsive overrides */
        @container group-card (max-width: 330px) {
            .group-card-content { padding: var(--space-3); }
            .group-header { margin-bottom: var(--space-4); }
            .reorder-item { padding: var(--space-2); min-height: 48px; gap: var(--space-1); }
            .team-info { gap: var(--space-2); margin-left: var(--space-2); font-size: var(--font-xs); }
            .flag { padding: 2px 4px; font-size: 0.72rem; }
            .status-badge { padding: 2px 4px; font-size: 0.6rem; }
            .rank { font-size: var(--font-xs); }
        }

        /* Compact Mode Overrides */
        .compact-stage .group-grid {
            grid-template-columns: repeat(6, 1fr) !important;
            gap: var(--space-2) !important;
        }
        @media (max-width: 1400px) {
            .compact-stage .group-grid {
                grid-template-columns: repeat(4, 1fr) !important;
            }
        }
        @media (max-width: 1024px) {
            .compact-stage .group-grid {
                grid-template-columns: repeat(3, 1fr) !important;
            }
        }
        @media (max-width: 768px) {
            .compact-stage .group-grid {
                grid-template-columns: repeat(2, 1fr) !important;
            }
        }
        @media (max-width: 480px) {
            .compact-stage .group-grid {
                grid-template-columns: 1fr !important;
            }
        }

        /* Compact Card Styling */
        .compact-card .group-card-content {
            padding: var(--space-2) var(--space-3) !important;
        }
        .compact-card .group-header {
            margin-bottom: var(--space-2) !important;
        }
        .compact-card .group-header h3 {
            font-size: var(--font-sm) !important;
        }
        .compact-card .reorder-header {
            display: none !important;
        }
        .compact-card .reorder-list {
            gap: 2px !important;
        }
        .compact-card .reorder-item {
            min-height: 32px !important;
            padding: 2px 6px !important;
            border-radius: var(--radius-sm) !important;
            font-size: 0.76rem !important;
            grid-template-columns: 18px 1fr auto 16px !important;
            gap: 4px !important;
        }
        .compact-card .rank {
            width: 18px !important;
            font-size: 0.72rem !important;
            color: #64748b;
        }
        .compact-card .team-info {
            gap: 4px !important;
            margin-left: 2px !important;
        }
        .compact-card .flag {
            padding: 1px 4px !important;
            font-size: 0.68rem !important;
            border-radius: 4px !important;
        }
        .compact-card .status-badge {
            padding: 1px 4px !important;
            font-size: 0.58rem !important;
        }
        .compact-card .drag-handle {
            font-size: 0.9rem !important;
        }
        .compact-card .pts-pill {
            padding: 1px 3px !important;
            font-size: 0.68rem !important;
            gap: 2px !important;
            border-radius: 2px !important;
        }
        .compact-card .pts-value {
            font-weight: 800 !important;
        }
        .compact-card .gd-value {
            font-size: 0.6rem !important;
            padding: 0px 2px !important;
        }
        .compact-card .pts-label {
            display: none !important;
        }
        .compact-card .group-score-list {
            display: none !important;
        }
        .compact-card.live-card .group-score-list {
            display: flex !important;
            margin-top: var(--space-2) !important;
            padding-top: var(--space-2) !important;
        }
        .compact-card.live-card .group-match-row {
            min-height: 28px !important;
            padding: 3px 5px !important;
            grid-template-columns: minmax(28px, 1fr) 24px 8px 24px minmax(28px, 1fr);
            font-size: 0.68rem !important;
        }
        .compact-card.live-card .live-match-row {
            grid-template-columns: minmax(28px, 1fr) 24px 8px 24px minmax(28px, 1fr);
        }
        .compact-card.live-card .score-status-chip {
            grid-column: 1 / -1;
            justify-self: stretch;
            text-align: center;
            white-space: normal;
        }

        /* Compact Third Place Summary Styling */
        .compact-summary .third-summary {
            padding: var(--space-2) var(--space-4) !important;
            max-width: 100% !important;
        }
        .compact-summary .third-summary-main {
            margin-bottom: var(--space-2) !important;
            gap: var(--space-3) !important;
        }
        .compact-summary .third-summary-main h2 {
            font-size: var(--font-base) !important;
        }
        .compact-summary .third-summary-note {
            font-size: 0.78rem !important;
            margin-top: 2px !important;
        }
        .compact-summary .summary-count {
            min-width: 90px !important;
            padding: var(--space-1) var(--space-2) !important;
            border-radius: var(--radius-md) !important;
        }
        .compact-summary .summary-count span {
            font-size: 1.25rem !important;
        }
        .compact-summary .summary-count small {
            font-size: 0.58rem !important;
            margin-top: 0 !important;
        }
        .compact-summary .third-team-grid {
            grid-template-columns: repeat(12, 1fr) !important;
            gap: 4px !important;
        }
        @media (max-width: 1200px) {
            .compact-summary .third-team-grid {
                grid-template-columns: repeat(6, 1fr) !important;
            }
        }
        @media (max-width: 640px) {
            .compact-summary .third-team-grid {
                grid-template-columns: repeat(3, 1fr) !important;
            }
        }
        .compact-summary .third-chip {
            min-height: 32px !important;
            padding: var(--space-1) var(--space-2) !important;
            font-size: 0.74rem !important;
            border-radius: var(--radius-sm) !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 2px !important;
            text-align: center !important;
        }
        .compact-summary .group-pill {
            font-size: 0.58rem !important;
            padding: 1px 4px !important;
        }
        .compact-summary .third-team-name {
            font-size: 0.7rem !important;
            text-align: center !important;
            width: 100% !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            gap: 2px !important;
        }
        .compact-summary .pts-pill.mini {
            margin: 0 !important;
            padding: 0px 2px !important;
            font-size: 0.58rem !important;
        }
        .compact-summary .third-status {
            display: none !important;
        }

        @media (prefers-reduced-motion: reduce) {
            .third-chip:hover:not(:disabled),
            .reorder-item:hover,
            .reorder-item:active,
            .score-list-body {
                transform: none;
            }
            .score-list-body,
            .score-list-body.open {
                transition: none;
            }
        }
      `}</style>
        </Squircle>
    );
}

function getRowStatusClass(index, team, qualifiedThirdIds) {
    if (index < 2) return 'qualified';
    if (index === 2) return qualifiedThirdIds.has(team.id) ? 'third-qualified' : 'third-eliminated';
    return '';
}

function getRowStatusLabel(index, team, qualifiedThirdIds) {
    if (index < 2) return 'Top 2';
    if (qualifiedThirdIds.has(team.id)) return 'Advances';
    return 'Out';
}

function GroupStageStats({ superSimStats, groups, compactMode }) {
    const [selectedGroup, setSelectedGroup] = useState('A');
    const trials = superSimStats.trials;
    const groupPositions = superSimStats.groupPositions;
    const thirdPointsCount = superSimStats.thirdPointsCount || {};
    const thirdPointsQual = superSimStats.thirdPointsQual || {};

    const pointsKeys = [2, 3, 4, 5, 6].sort((a, b) => b - a);
    const threePointTotal = thirdPointsCount[3] || 0;
    const threePointQualified = thirdPointsQual[3] || 0;
    const threePointAdvanceRate = threePointTotal > 0 ? ((threePointQualified / threePointTotal) * 100).toFixed(1) : '0.0';
    const selectedGroupStats = groupPositions[selectedGroup] || {};
    const selectedGroupTeams = groups[selectedGroup] || [];

    const sortedGroupTeams = [...selectedGroupTeams].sort((a, b) => {
        const aStats = selectedGroupStats[a.id] || { qualified: 0 };
        const bStats = selectedGroupStats[b.id] || { qualified: 0 };
        return bStats.qualified - aStats.qualified;
    });

    return (
        <Squircle
            cornerRadius={compactMode ? 12 : 16}
            cornerSmoothing={1}
            shadow={compactMode ? "0 2px 8px rgba(0,0,0,0.02)" : "0 4px 20px rgba(0,0,0,0.03)"}
            borderColor="#e5e7eb"
            className={`group-stats-card ${compactMode ? 'compact-stats' : ''}`}
            clip={false}
        >
            <div className="stats-container">
                <div className="stats-header">
                    <h2>Monte Carlo Group Stage Analysis</h2>
                    <p className="stats-subtitle">Based on {trials.toLocaleString()} tournament trials</p>
                </div>

                <div className="stats-grid">
                    <div className="stats-box advancement-rate-box">
                        <h3>Advancement Rate by Points</h3>
                        <p className="stats-note">If a third-place team finished with exactly X points, how often did they actually advance?</p>

                        <div className="stat-bar-chart" aria-label="Third-place advancement rate by points">
                            {pointsKeys.map(pts => {
                                const totalCount = thirdPointsCount[pts] || 0;
                                const qualCount = thirdPointsQual[pts] || 0;
                                const pct = totalCount > 0 ? ((qualCount / totalCount) * 100).toFixed(1) : (pts >= 5 ? '100.0' : '0.0');
                                return (
                                    <StatBarRow
                                        key={pts}
                                        label={`${pts} pts`}
                                        percentage={pct}
                                        meta={`${qualCount}/${totalCount}`}
                                    />
                                );
                            })}
                        </div>

                        <div className="insight-card">
                            <span className="insight-icon">💡</span>
                            <div className="insight-text">
                                <strong>Qualification Odds</strong>: Third-place teams on <strong>3 points</strong> advanced in <strong>{threePointAdvanceRate}%</strong> of matching simulation outcomes.
                            </div>
                        </div>
                    </div>

                    <div className="stats-box group-probs-box">
                        <div className="group-probs-header">
                            <h3>Team Finish Probabilities</h3>
                            <div className="group-selector">
                                {Object.keys(groups).sort().map(gId => (
                                    <button
                                        key={gId}
                                        type="button"
                                        className={`group-sel-btn ${selectedGroup === gId ? 'active' : ''}`}
                                        onClick={() => setSelectedGroup(gId)}
                                    >
                                        {gId}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="probs-table-wrapper">
                            <table className="probs-table">
                                <thead>
                                    <tr>
                                        <th>Team</th>
                                        <th>1st</th>
                                        <th>2nd</th>
                                        <th>3rd</th>
                                        <th>4th</th>
                                        <th className="th-adv">Advance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedGroupTeams.map(team => {
                                        const tStats = selectedGroupStats[team.id] || { 1: 0, 2: 0, 3: 0, 4: 0, qualified: 0 };
                                        const p1 = ((tStats[1] / trials) * 100).toFixed(1);
                                        const p2 = ((tStats[2] / trials) * 100).toFixed(1);
                                        const p3 = ((tStats[3] / trials) * 100).toFixed(1);
                                        const p4 = ((tStats[4] / trials) * 100).toFixed(1);
                                        const padv = ((tStats.qualified / trials) * 100).toFixed(1);

                                        const o1 = tStats[1] / trials;
                                        const o2 = tStats[2] / trials;
                                        const o3 = tStats[3] / trials;
                                        const o4 = tStats[4] / trials;
                                        const oadv = tStats.qualified / trials;

                                        return (
                                            <tr key={team.id}>
                                                <td className="team-td" data-label="Team">
                                                    <span className="flag-mini">{formatTeamId(team.id)}</span>
                                                    <span className="team-name-text">{team.name}</span>
                                                </td>
                                                <td data-label="1st" style={{ backgroundColor: `rgba(34, 197, 94, ${o1 * 0.4})`, color: o1 > 0.6 ? '#166534' : 'inherit', fontWeight: o1 > 0.4 ? '800' : 'normal' }}>{p1}%</td>
                                                <td data-label="2nd" style={{ backgroundColor: `rgba(59, 130, 246, ${o2 * 0.4})`, color: o2 > 0.6 ? '#1e40af' : 'inherit', fontWeight: o2 > 0.4 ? '800' : 'normal' }}>{p2}%</td>
                                                <td data-label="3rd" style={{ backgroundColor: `rgba(245, 158, 11, ${o3 * 0.4})`, color: o3 > 0.6 ? '#92400e' : 'inherit', fontWeight: o3 > 0.4 ? '800' : 'normal' }}>{p3}%</td>
                                                <td data-label="4th" style={{ backgroundColor: `rgba(239, 68, 68, ${o4 * 0.4})`, color: o4 > 0.6 ? '#991b1b' : 'inherit', fontWeight: o4 > 0.4 ? '800' : 'normal' }}>{p4}%</td>
                                                <td data-label="Adv" className="td-adv" style={{ backgroundColor: `rgba(22, 163, 74, ${oadv * 0.25})` }}>
                                                    <strong>{padv}%</strong>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            <style>{`
                .group-stats-card { margin-top: var(--space-6); background: transparent; max-width: 1200px; width: 100%; min-width: 0; margin-left: auto; margin-right: auto; }
                .stats-container { padding: var(--space-6); min-width: 0; }
                .stats-header { margin-bottom: var(--space-5); }
                .stats-header h2 { margin: 0; font-size: var(--font-xl); line-height: 1.1; color: var(--text-main); }
                .stats-subtitle { margin: var(--space-1) 0 0; color: var(--text-muted); font-size: var(--font-sm); font-weight: 500; }
                
                .stats-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--space-6); min-width: 0; }
                @media (max-width: 900px) {
                    .stats-grid { grid-template-columns: 1fr; gap: var(--space-5); }
                }

                .stats-box { min-width: 0; background: rgba(255, 255, 255, 0.45); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: var(--space-5); backdrop-filter: blur(8px); }
                .stats-box h3 { margin: 0 0 var(--space-3); font-size: var(--font-md); font-weight: 700; color: var(--text-main); }
                .stats-note { margin: 0 0 var(--space-3); font-size: var(--font-xs); line-height: 1.45; color: var(--text-muted); }

                .stat-bar-chart {
                    display: grid;
                    gap: var(--space-2);
                    background: #0f172a;
                    color: #e2e8f0;
                    padding: var(--space-4);
                    border-radius: var(--radius-md);
                    margin: 0 0 var(--space-4);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
                }
                .stat-bar-row {
                    display: grid;
                    grid-template-columns: minmax(168px, 220px) minmax(0, 1fr);
                    align-items: center;
                    gap: var(--space-3);
                    min-width: 0;
                }
                .stat-bar-copy {
                    display: grid;
                    grid-template-columns: 46px 58px minmax(0, 1fr);
                    gap: var(--space-2);
                    align-items: baseline;
                    min-width: 0;
                    font-family: var(--font-mono, monospace);
                    font-size: 0.76rem;
                    line-height: 1.25;
                }
                .stat-bar-label,
                .stat-bar-value {
                    white-space: nowrap;
                }
                .stat-bar-value {
                    text-align: right;
                    font-weight: 800;
                    color: #f8fafc;
                }
                .stat-bar-meta {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    color: #cbd5e1;
                }
                .stat-bar-track {
                    width: 100%;
                    height: 16px;
                    overflow: hidden;
                    border-radius: 3px;
                    background: rgba(226, 232, 240, 0.12);
                }
                .stat-bar-fill {
                    display: block;
                    height: 100%;
                    min-width: 2px;
                    background: #e2e8f0;
                }

                /* Insight card */
                .insight-card { display: flex; gap: var(--space-3); background: var(--success-bg); border: 1px solid var(--success-border); border-radius: var(--radius-md); padding: var(--space-3) var(--space-4); align-items: flex-start; }
                .insight-icon { font-size: 1.1rem; }
                .insight-text { font-size: 0.82rem; color: var(--success-text); line-height: 1.4; }

                /* Group Probabilities */
                .group-probs-header { display: flex; flex-direction: column; gap: var(--space-2); margin-bottom: var(--space-4); }
                .group-selector {
                    display: flex;
                    gap: 4px;
                    overflow-x: auto;
                    scrollbar-width: none;
                    -webkit-overflow-scrolling: touch;
                    padding-bottom: 4px;
                }
                .group-selector::-webkit-scrollbar { display: none; }
                .group-sel-btn {
                    width: 32px;
                    height: 32px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border: 1px solid var(--border-subtle);
                    background: var(--surface);
                    color: var(--text-muted);
                    font-size: var(--font-xs);
                    font-weight: 700;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    flex-shrink: 0;
                }
                .group-sel-btn:hover { background: var(--surface-muted); color: var(--text-main); }
                .group-sel-btn.active { background: var(--text-main); color: white; border-color: var(--text-main); }

                /* Heatmap Table */
                .probs-table-wrapper { min-width: 0; overflow-x: auto; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); background: var(--surface); }
                .probs-table { width: 100%; border-collapse: collapse; text-align: center; font-size: 0.8rem; }
                .probs-table th, .probs-table td { padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--border-subtle); }
                .probs-table th { background: var(--surface-muted); font-weight: 700; color: var(--text-muted); font-size: 0.72rem; text-transform: uppercase; }
                .probs-table td.team-td { display: flex; align-items: center; gap: var(--space-2); text-align: left; font-weight: 700; color: var(--text-main); overflow: hidden; }
                .team-name-text {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 90px;
                }
                @media (min-width: 640px) {
                    .team-name-text { max-width: 140px; }
                }
                .flag-mini { font-weight: 800; font-size: 0.65rem; background: #e2e8f0; padding: 2px 4px; border-radius: 3px; color: #475569; flex-shrink: 0; }
                .probs-table td.td-adv, .probs-table th.th-adv { border-left: 2px solid var(--border-subtle); }
                .probs-table td.td-adv { font-weight: 800; color: #166534; }

                /* Compact Mode Stats Styles */
                .compact-stats .stats-container { padding: var(--space-3) var(--space-4) !important; }
                .compact-stats .stats-header { margin-bottom: var(--space-3) !important; }
                .compact-stats .stats-grid { gap: var(--space-4) !important; }
                .compact-stats .stats-box { padding: var(--space-3) var(--space-4) !important; }
                .compact-stats .stat-bar-chart { padding: var(--space-3) !important; margin-bottom: var(--space-3) !important; }
                .compact-stats .stat-bar-copy { font-size: 0.7rem !important; }
                .compact-stats .insight-card { padding: var(--space-2) var(--space-3) !important; }
                .compact-stats .insight-text { font-size: 0.76rem !important; }
                .compact-stats .probs-table th, .compact-stats .probs-table td { padding: 4px 6px !important; font-size: 0.74rem !important; }
                .compact-stats .flag-mini { padding: 1px 3px !important; font-size: 0.6rem !important; }

                @media (max-width: 640px) {
                    .group-stats-card {
                        margin-top: var(--space-4);
                    }
                    .stats-container {
                        padding: var(--space-3);
                    }
                    .stats-header h2 {
                        font-size: clamp(1.4rem, 8vw, 1.9rem);
                    }
                    .stats-subtitle {
                        font-size: var(--font-sm);
                    }
                    .stats-grid {
                        gap: var(--space-4);
                    }
                    .stats-box {
                        padding: var(--space-4);
                        border-radius: var(--radius-md);
                    }
                    .stats-box h3 {
                        font-size: 1.05rem;
                        line-height: 1.2;
                    }
                    .stat-bar-chart {
                        padding: var(--space-3);
                        gap: 10px;
                    }
                    .stat-bar-row {
                        grid-template-columns: 1fr;
                        gap: 6px;
                    }
                    .stat-bar-copy {
                        grid-template-columns: 44px 54px minmax(0, 1fr);
                        font-size: 0.72rem;
                    }
                    .stat-bar-track {
                        height: 12px;
                    }
                    .insight-card {
                        display: grid;
                        grid-template-columns: auto minmax(0, 1fr);
                    }
                    .group-selector {
                        display: grid;
                        grid-template-columns: repeat(6, minmax(0, 1fr));
                        gap: 6px;
                        overflow: visible;
                    }
                    .group-sel-btn {
                        width: 100%;
                        min-width: 0;
                        height: 44px;
                    }
                    .probs-table-wrapper {
                        overflow: visible;
                        border: 0;
                        background: transparent;
                    }
                    .probs-table,
                    .probs-table tbody,
                    .probs-table tr,
                    .probs-table td {
                        display: block;
                        width: 100%;
                    }
                    .probs-table thead {
                        display: none;
                    }
                    .probs-table tbody {
                        display: grid;
                        gap: var(--space-3);
                    }
                    .probs-table tr {
                        display: grid;
                        grid-template-columns: repeat(5, minmax(0, 1fr));
                        overflow: hidden;
                        border: 1px solid var(--border-subtle);
                        border-radius: var(--radius-md);
                        background: var(--surface);
                    }
                    .probs-table th,
                    .probs-table td {
                        border-bottom: 0;
                    }
                    .probs-table td {
                        min-width: 0;
                        padding: var(--space-2) 4px !important;
                        font-size: 0.76rem !important;
                    }
                    .probs-table td::before {
                        content: attr(data-label);
                        display: block;
                        margin-bottom: 2px;
                        color: var(--text-muted);
                        font-size: 0.58rem;
                        font-weight: 800;
                        line-height: 1;
                        text-transform: uppercase;
                    }
                    .probs-table td.team-td {
                        grid-column: 1 / -1;
                        padding: var(--space-3) !important;
                        border-bottom: 1px solid var(--border-subtle);
                    }
                    .probs-table td.team-td::before {
                        display: none;
                    }
                    .team-name-text {
                        max-width: none;
                    }
                    .probs-table td.td-adv,
                    .probs-table th.th-adv {
                        border-left: 0;
                    }
                }
            `}</style>
        </Squircle>
    );
}

function StatBarRow({ label, percentage, meta }) {
    const pct = Math.max(0, Math.min(100, Number.parseFloat(percentage) || 0));

    return (
        <div className="stat-bar-row">
            <div className="stat-bar-copy">
                <span className="stat-bar-label">{label}</span>
                <span className="stat-bar-value">{percentage}%</span>
                <span className="stat-bar-meta">{meta}</span>
            </div>
            <div className="stat-bar-track" aria-hidden="true">
                <span className="stat-bar-fill" style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}
