import React, { useContext, useMemo, useState } from 'react';
import { BracketContext } from '../store/BracketContext';
import { Info } from 'lucide-react';
import { formatAmericanOdds, getMarketOddsProfile, probabilityToAmericanOdds } from '../logic/marketOdds';

import Squircle from './Squircle';
import SparklerEffect from './SparklerEffect';
import LocalSectionNav from './LocalSectionNav';

const VENUE_SETTINGS = {
    S_LA: 'indoor',
    S_BOS: 'outdoor',
    S_MTY: 'outdoor',
    S_HOU: 'indoor',
    S_NYNJ: 'outdoor',
    S_DAL: 'indoor',
    S_MEX: 'outdoor',
    S_ATL: 'indoor',
    S_SF: 'outdoor',
    S_SEA: 'outdoor',
    S_TOR: 'outdoor',
    S_VAN: 'indoor',
    S_MIA: 'outdoor',
    S_KC: 'outdoor',
    S_PHI: 'outdoor'
};
const TEAM_PATH_QUERY_STORAGE_KEY = 'wc26_team_path_query';
const OPPONENT_HEATMAP_QUERY_STORAGE_KEY = 'wc26_opponent_heatmap_query';
const OPPONENT_HEATMAP_ROUNDS = [
    { key: 'R32', label: 'R32' },
    { key: 'R16', label: 'R16' },
    { key: 'QF', label: 'QF' },
    { key: 'SF', label: 'SF' },
    { key: 'Final', label: 'Final' }
];

export default function KnockoutBracket() {
    const { knockoutMatches, actions, dispatch, knockoutPicks, state, groups, standings, qualifiedThirds } = useContext(BracketContext);
    const [showCelebration, setShowCelebration] = useState(false);
    const [activeRoundTab, setActiveRoundTab] = useState('32');
    const [teamPathExpanded, setTeamPathExpanded] = useState(true);
    const compactMode = true;

    // Group by round
    const rounds = {
        32: knockoutMatches.filter(m => m.round === 32), // 16 matches
        16: knockoutMatches.filter(m => m.round === 16), // 8 matches
        8: knockoutMatches.filter(m => m.round === 8),   // 4 matches
        4: knockoutMatches.filter(m => m.round === 4),   // 2 matches
        2: knockoutMatches.filter(m => m.round === 2),   // Final
        3: knockoutMatches.filter(m => m.round === 3),   // Bronze
    };

    const triggerCelebration = () => setShowCelebration(true);
    const localNavItems = [
        { href: '#knockout-path', label: 'Team Path' },
        { href: '#knockout-bracket', label: 'Bracket' },
        ...(state.superSimStats ? [
            { href: '#knockout-title-odds', label: 'Title Odds' },
            { href: '#knockout-reach-odds', label: 'Reach Odds' },
            { href: '#knockout-opponents', label: 'Opponents' }
        ] : [])
    ];

    const renderRound = (roundNum, title, startIdx, endIdx, showColTitle = true) => {
        const hasSlice = startIdx !== undefined && endIdx !== undefined;
        const matches = hasSlice ? rounds[roundNum].slice(startIdx, endIdx) : rounds[roundNum];
        return (
            <div className={`round-column round-col-${roundNum} ${hasSlice ? `round-col-${roundNum}-split` : ''}`}>
                {showColTitle && <h3>{title}</h3>}
                <div className="match-list">
                    {matches.map(m => (
                        <MatchCard key={m.id} match={m} dispatch={dispatch} actions={actions} pickedId={knockoutPicks[m.id]} onUSAWin={triggerCelebration} compactMode={compactMode} liveScoresEnabled={state.liveScoresEnabled} />
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div>
            {showCelebration && <SparklerEffect onClose={() => setShowCelebration(false)} />}
            <LocalSectionNav className="knockout-local-nav" label="Knockout sections" items={localNavItems} />
            <div className="bracket-controls" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <div className="mobile-round-tabs" aria-label="Select bracket round">
                    {[
                        { id: '32', label: 'Round of 32' },
                        { id: '16', label: 'Round of 16' },
                        { id: '8', label: 'Quarter-Finals' },
                        { id: 'finals', label: 'Finals' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            className={`tab-btn ${activeRoundTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveRoundTab(tab.id)}
                            aria-pressed={activeRoundTab === tab.id}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div id="knockout-path">
                <TeamPathPanel
                    groups={groups}
                    standings={standings}
                    qualifiedThirds={qualifiedThirds}
                    groupScores={state.groupScores}
                    knockoutMatches={knockoutMatches}
                    isExpanded={teamPathExpanded}
                    onToggle={() => setTeamPathExpanded(expanded => !expanded)}
                    hasCompletedRun={Boolean(state.simulationCount || Object.keys(state.knockoutScores || {}).length)}
                />
            </div>

            <div id="knockout-bracket" className="bracket-container">
                <div className={`scroller show-tab-${activeRoundTab} ${compactMode ? 'compact-scroller' : ''}`}>
                    <div className="round-group group-r32">
                        <div className="group-header">Round of 32</div>
                        <div className="group-columns">
                            {renderRound(32, "Top Half", 0, 8, true)}
                            {renderRound(32, "Bottom Half", 8, 16, true)}
                        </div>
                    </div>

                    <div className="round-group group-r16">
                        <div className="group-header">Round of 16</div>
                        {renderRound(16, "Round of 16", undefined, undefined, false)}
                    </div>

                    <div className="round-group group-qf">
                        <div className="group-header">Quarter-Finals</div>
                        {renderRound(8, "Quarter-Finals", undefined, undefined, false)}
                    </div>

                    <div className="round-group group-finals">
                        <div className="group-header">Finals</div>
                        <div className="group-columns final-rounds-col round-col-finals">
                            {renderRound(4, "Semi-Finals", undefined, undefined, true)}
                            <div className="finals-split">
                                {renderRound(2, "Final", undefined, undefined, true)}
                                {renderRound(3, "Bronze Match", undefined, undefined, true)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {state.superSimStats && (
                <KnockoutStageStats 
                    superSimStats={state.superSimStats} 
                    groups={groups} 
                    compactMode={compactMode} 
                />
            )}

            <style>{`
           #knockout-path,
           #knockout-bracket,
           #knockout-title-odds,
           #knockout-reach-odds,
           #knockout-opponents { scroll-margin-top: 110px; }
           .knockout-local-nav { margin-bottom: var(--space-4); }
           .bracket-container { 
               overflow: visible; 
               padding: var(--space-8); 
               background: transparent;
               min-width: 0;
           }
           @media (max-width: 640px) {
               .bracket-container { padding: var(--space-4); }
           }

           .scroller { display: flex; gap: var(--space-6); min-width: 1200px; padding-right: var(--space-6); }

           /* Mobile Round Tab bar styling */
           .mobile-round-tabs {
               display: none;
           }

           .round-group {
               display: flex;
               flex-direction: column;
               background: rgba(255, 255, 255, 0.45);
               border: 1px solid rgba(226, 232, 240, 0.8);
               border-radius: var(--radius-lg);
               padding: var(--space-5) var(--space-4);
               box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.03), 0 2px 6px -1px rgba(15, 23, 42, 0.02);
               gap: var(--space-3);
               transition: all var(--motion-duration-ui) var(--motion-ease-standard);
           }
           @media (hover: hover) {
               .round-group:hover {
                   border-color: var(--border-strong);
                   box-shadow: 0 10px 25px -3px rgba(15, 23, 42, 0.05), 0 4px 12px -2px rgba(15, 23, 42, 0.03);
               }
           }
           
           .group-header {
               text-align: center;
               font-size: 0.78rem;
               font-weight: 900;
               text-transform: uppercase;
               color: var(--text-main);
               letter-spacing: 0.06em;
               border-bottom: 2px solid var(--border-subtle);
               padding-bottom: var(--space-2);
               margin-bottom: var(--space-1);
           }

           .group-columns {
               display: flex;
               gap: var(--space-4);
               flex-grow: 1;
           }

           .round-column { min-width: 240px; display: flex; flex-direction: column; flex-grow: 1; }
           .final-rounds-col { display: flex; flex-direction: column; gap: var(--space-12); }
           .finals-split { display: flex; flex-direction: column; gap: var(--space-12); }

           .round-column h3 { text-align: center; font-size: var(--font-xs); letter-spacing: 0; text-transform: uppercase; color: var(--text-muted); margin-bottom: var(--space-4); font-weight: 800; }
           
           .match-list { display: flex; flex-direction: column; justify-content: space-around; flex-grow: 1; gap: var(--space-6); }
           @media (max-width: 640px) {
                .match-list { gap: var(--space-4); }
           }

           /* Compact Scroller Layout Rules */
           .scroller.compact-scroller {
               min-width: 100% !important;
               width: 100% !important;
               max-width: 1560px;
               margin: 0 auto;
               gap: var(--space-3) !important;
               justify-content: center;
               padding-right: 0 !important;
           }
           
           .compact-scroller .round-group {
               background: rgba(255, 255, 255, 0.55) !important;
               border: 1px solid rgba(226, 232, 240, 0.9) !important;
               border-radius: var(--radius-md) !important;
               padding: 8px 6px !important;
               gap: var(--space-2) !important;
               box-shadow: 0 2px 10px rgba(0, 0, 0, 0.02) !important;
           }
           
           .compact-scroller .group-header {
               font-size: 0.68rem !important;
               padding-bottom: var(--space-1) !important;
               margin-bottom: var(--space-1) !important;
               border-bottom-width: 1px !important;
           }

           .compact-scroller .round-column {
               min-width: 170px !important;
               width: 170px !important;
           }
           .compact-scroller .round-column h3 {
               margin-bottom: var(--space-2) !important;
               font-size: 0.62rem !important;
           }
           .compact-scroller .final-rounds-col {
               min-width: 170px !important;
               width: 170px !important;
               gap: var(--space-2) !important;
           }
           .compact-scroller .finals-split {
               gap: var(--space-2) !important;
           }
           .compact-scroller .match-list {
               gap: 4px !important;
           }

           /* Tablet/Mobile tabs and layout overrides */
           @media (max-width: 1023px) {
               .mobile-round-tabs {
                   display: flex;
                   gap: var(--space-1);
                   background: var(--border-subtle);
                   padding: 4px;
                   border-radius: var(--radius-pill);
                   overflow-x: visible;
                   flex-wrap: wrap;
                   scrollbar-width: none;
               }
               .mobile-round-tabs::-webkit-scrollbar { display: none; }
               
               .mobile-round-tabs .tab-btn {
                   min-height: 38px;
                   padding: 6px 12px;
                   border: 0;
                   background: transparent;
                   color: var(--text-muted);
                   font-weight: 700;
                   font-size: var(--font-xs);
                   border-radius: var(--radius-pill);
                   cursor: pointer;
                   white-space: nowrap;
                   transition: background var(--motion-duration-micro) var(--motion-ease-standard), color var(--motion-duration-micro) var(--motion-ease-standard);
               }
               .mobile-round-tabs .tab-btn.active {
                   background: var(--surface);
                   color: var(--text-main);
                   box-shadow: var(--shadow-sm);
               }

               .scroller {
                   min-width: 100% !important;
                   width: 100% !important;
                   padding-right: 0;
                   gap: 0;
               }
               
               .round-group {
                   display: none;
                   width: 100% !important;
                   min-width: 100% !important;
                   background: transparent !important;
                   border: 0 !important;
                   padding: 0 !important;
                   box-shadow: none !important;
               }

               .scroller.show-tab-32 .group-r32 { display: flex; }
               .scroller.show-tab-16 .group-r16 { display: flex; }
               .scroller.show-tab-8 .group-qf { display: flex; }
               .scroller.show-tab-finals .group-finals { display: flex; }

               /* Stack columns inside the group card on mobile */
               .round-group .group-columns {
                   flex-direction: column;
                   width: 100%;
                   gap: var(--space-4) !important;
               }
               .round-group .round-column,
               .round-group .final-rounds-col {
                   display: flex !important;
                   width: 100% !important;
                   min-width: 100% !important;
               }
               .round-group .group-header {
                   display: none !important;
               }
               .round-group .round-column h3 {
                   display: block !important;
               }

               /* Hide split columns and stack them on mobile if compactMode active */
               .scroller.compact-scroller {
                   display: flex !important;
                   gap: 0 !important;
               }
               .scroller.compact-scroller.show-tab-32 {
                   flex-direction: column !important;
                   overflow: visible !important;
                   gap: var(--space-3) !important;
               }
               .scroller.compact-scroller.show-tab-32 .group-r32 {
                   display: flex !important;
                   min-width: 100% !important;
                   width: 100% !important;
               }
           }

           @media (min-width: 1024px) {
               .bracket-controls {
                   display: none !important;
               }
           }

           /* Compress container padding in compact mode to maximize space */
           .compact-mode .bracket-container {
               padding: var(--space-2) !important;
           }
       `}</style>
        </div>
    );
}

function TeamPathPanel({ groups, standings, qualifiedThirds, groupScores, knockoutMatches, isExpanded, onToggle, hasCompletedRun }) {
    const allTeams = useMemo(() => Object.values(groups || {}).flat(), [groups]);
    const [query, setQuery] = useState(readSavedTeamPathQuery);
    const [suggestionsOpen, setSuggestionsOpen] = useState(false);
    const selectedTeam = useMemo(() => findTeamForQuery(allTeams, query), [allTeams, query]);
    const suggestions = useMemo(() => getTeamSuggestions(allTeams, query), [allTeams, query]);
    const teamPath = useMemo(() => (
        selectedTeam
            ? buildTeamPath({
                team: selectedTeam,
                groups,
                standings,
                qualifiedThirds,
                groupScores,
                knockoutMatches
            })
            : null
    ), [selectedTeam, groups, standings, qualifiedThirds, groupScores, knockoutMatches]);

    const summaryText = selectedTeam
        ? `${selectedTeam.name} path`
        : query.trim()
            ? 'No team selected'
            : 'Search team path';

    return (
        <section className={`team-path-panel ${isExpanded ? 'expanded' : 'collapsed'}`} aria-label="Team path">
            <button
                type="button"
                className="team-path-toggle"
                onClick={onToggle}
                aria-expanded={isExpanded}
            >
                <span className="team-path-kicker">Team path</span>
                <span className="team-path-summary">{summaryText}</span>
                <span className="team-path-chevron" aria-hidden="true">{isExpanded ? '−' : '+'}</span>
            </button>

            {isExpanded && (
                <div className="team-path-body">
                    <div className="team-path-search-row">
                        <label htmlFor="team-path-search">Search team</label>
                        <input
                            id="team-path-search"
                            type="search"
                            value={query}
                            onChange={(event) => updateTeamPathQuery(event.target.value, setQuery)}
                            placeholder="USA"
                            onFocus={() => setSuggestionsOpen(true)}
                            onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 120)}
                            onKeyDown={(event) => {
                                if (event.key === 'Escape') setSuggestionsOpen(false);
                            }}
                            autoComplete="off"
                        />
                        {suggestionsOpen && suggestions.length > 0 && (
                            <div className="team-path-suggestions" role="listbox" aria-label="Team suggestions">
                                {suggestions.slice(0, 8).map(team => (
                                    <button
                                        key={team.id}
                                        type="button"
                                        role="option"
                                        className="team-path-suggestion"
                                        onMouseDown={(event) => {
                                            event.preventDefault();
                                            updateTeamPathQuery(team.name, setQuery);
                                            setSuggestionsOpen(false);
                                        }}
                                    >
                                        <span>{team.name}</span>
                                        <strong>{team.id}</strong>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {!hasCompletedRun && (
                        <div className="team-path-empty">
                            Run a simulation to populate the full group-to-knockout path.
                        </div>
                    )}

                    {hasCompletedRun && !selectedTeam && (
                        <div className="team-path-empty">
                            No team matches "{query}".
                        </div>
                    )}

                    {hasCompletedRun && selectedTeam && teamPath && (
                        <div className="team-path-content">
                            <div className="team-path-overview">
                                <span className="team-path-team">
                                    <strong>{selectedTeam.name}</strong>
                                    <span>{selectedTeam.id}</span>
                                </span>
                                <span className={`team-path-status ${teamPath.statusType}`}>
                                    {teamPath.status}
                                </span>
                            </div>

                            <ol className="team-path-list">
                                {teamPath.items.map(item => (
                                    <li key={item.key} className={`team-path-item ${item.resultType}`}>
                                        <span className="path-stage">{item.stage}</span>
                                        {item.venue && <span className="path-venue">{item.venue}</span>}
                                        <span className="path-match">
                                            <strong>{item.homeName}</strong>
                                            <span className="path-score">{item.scoreLabel}</span>
                                            <strong>{item.awayName}</strong>
                                        </span>
                                        {item.resultLabel && <span className="path-result">{item.resultLabel}</span>}
                                    </li>
                                ))}
                            </ol>
                        </div>
                    )}
                </div>
            )}

            <style>{`
                .team-path-panel {
                    max-width: 1560px;
                    margin: 0 auto var(--space-3);
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-md);
                    background: rgba(255, 255, 255, 0.72);
                    box-shadow: var(--shadow-sm);
                    overflow: hidden;
                }

                .team-path-panel.collapsed {
                    border-color: rgba(203, 213, 225, 0.75);
                    box-shadow: none;
                }

                .team-path-toggle {
                    width: 100%;
                    border: 0;
                    background: transparent;
                    color: var(--text-main);
                    font: inherit;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                    padding: 8px 12px;
                    min-height: 34px;
                    text-align: left;
                }

                .team-path-panel.collapsed .team-path-toggle {
                    min-height: 30px;
                    padding: 6px 12px;
                }

                .team-path-kicker {
                    font-size: 0.64rem;
                    font-weight: 900;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0;
                    white-space: nowrap;
                }

                .team-path-summary {
                    min-width: 0;
                    flex: 1;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    font-size: 0.78rem;
                    font-weight: 800;
                }

                .team-path-chevron {
                    width: 18px;
                    height: 18px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: var(--radius-pill);
                    background: var(--surface-muted);
                    color: var(--text-muted);
                    font-weight: 900;
                    line-height: 1;
                    flex: 0 0 auto;
                }

                .team-path-panel.collapsed .team-path-chevron {
                    width: 18px;
                    height: 18px;
                }

                .team-path-body {
                    border-top: 1px solid var(--border-subtle);
                    padding: var(--space-3);
                    display: grid;
                    gap: var(--space-3);
                }

                .team-path-search-row {
                    position: relative;
                    display: grid;
                    grid-template-columns: auto minmax(180px, 320px);
                    align-items: center;
                    gap: var(--space-2);
                }

                .team-path-search-row label {
                    color: var(--text-muted);
                    font-size: var(--font-xs);
                    font-weight: 850;
                    text-transform: uppercase;
                    white-space: nowrap;
                }

                .team-path-search-row input {
                    width: 100%;
                    min-height: 34px;
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-sm);
                    background: var(--surface);
                    color: var(--text-main);
                    padding: 6px 10px;
                    font: inherit;
                    font-size: var(--font-sm);
                    font-weight: 700;
                }

                .team-path-search-row input:focus {
                    outline: 2px solid rgba(37, 99, 235, 0.2);
                    border-color: #93c5fd;
                }

                .team-path-suggestions {
                    position: absolute;
                    top: calc(100% + 4px);
                    left: calc(100% - min(320px, 100%));
                    z-index: 75;
                    width: min(320px, 100%);
                    max-height: 240px;
                    overflow-y: auto;
                    border: 1px solid var(--border-strong);
                    border-radius: var(--radius-md);
                    background: #0f172a;
                    color: #f8fafc;
                    box-shadow: var(--shadow-lg);
                    padding: 4px;
                }

                .team-path-suggestion {
                    width: 100%;
                    min-height: 36px;
                    border: 0;
                    border-radius: var(--radius-sm);
                    background: transparent;
                    color: #f8fafc;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: var(--space-3);
                    padding: 7px 9px;
                    font: inherit;
                    font-size: var(--font-sm);
                    font-weight: 750;
                    text-align: left;
                    cursor: pointer;
                }

                .team-path-suggestion strong {
                    color: #cbd5e1;
                    font-size: 0.68rem;
                    font-weight: 900;
                    flex: 0 0 auto;
                }

                .team-path-suggestion:hover,
                .team-path-suggestion:focus {
                    background: #1e293b;
                    outline: none;
                }

                .team-path-empty {
                    border: 1px dashed var(--border-subtle);
                    border-radius: var(--radius-sm);
                    padding: var(--space-3);
                    color: var(--text-muted);
                    font-size: var(--font-sm);
                    font-weight: 650;
                    background: rgba(248, 250, 252, 0.7);
                }

                .team-path-content {
                    display: grid;
                    gap: var(--space-3);
                }

                .team-path-overview {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: var(--space-3);
                    flex-wrap: wrap;
                }

                .team-path-team {
                    display: inline-flex;
                    align-items: center;
                    gap: var(--space-2);
                    min-width: 0;
                }

                .team-path-team strong {
                    font-size: var(--font-md);
                }

                .team-path-team span {
                    border-radius: var(--radius-sm);
                    background: #e2e8f0;
                    color: #475569;
                    padding: 2px 6px;
                    font-size: 0.68rem;
                    font-weight: 900;
                }

                .team-path-status {
                    border-radius: var(--radius-pill);
                    padding: 4px 10px;
                    font-size: 0.72rem;
                    font-weight: 900;
                    text-transform: uppercase;
                }

                .team-path-status.alive {
                    color: var(--success-text);
                    background: var(--success-bg);
                    border: 1px solid var(--success-border);
                }

                .team-path-status.out {
                    color: var(--danger-text);
                    background: var(--danger-bg);
                    border: 1px solid var(--danger-border);
                }

                .team-path-status.pending {
                    color: #475569;
                    background: #f1f5f9;
                    border: 1px solid #cbd5e1;
                }

                .team-path-list {
                    list-style: none;
                    margin: 0;
                    padding: 0;
                    display: grid;
                    gap: 6px;
                }

                .team-path-item {
                    display: grid;
                    grid-template-columns: minmax(90px, 0.85fr) minmax(220px, 2.2fr) minmax(80px, 0.55fr);
                    align-items: center;
                    gap: var(--space-2);
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-sm);
                    background: var(--surface);
                    padding: 7px 10px;
                    font-size: var(--font-sm);
                }

                .team-path-item.win {
                    border-left: 4px solid var(--success-border);
                }

                .team-path-item.loss {
                    border-left: 4px solid var(--danger-border);
                }

                .team-path-item.draw,
                .team-path-item.pending {
                    border-left: 4px solid #cbd5e1;
                }

                .path-stage {
                    color: var(--text-muted);
                    font-size: 0.72rem;
                    font-weight: 850;
                    text-transform: uppercase;
                    white-space: nowrap;
                }

                .path-venue {
                    grid-column: 1;
                    margin-top: -4px;
                    color: #64748b;
                    font-size: 0.66rem;
                    font-weight: 700;
                    line-height: 1.15;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .path-match {
                    grid-column: 2;
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
                    align-items: center;
                    gap: var(--space-2);
                    min-width: 0;
                }

                .path-match strong {
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    font-weight: 800;
                }

                .path-match strong:last-child {
                    text-align: right;
                }

                .path-score {
                    border-radius: var(--radius-sm);
                    background: var(--surface-muted);
                    color: var(--text-main);
                    min-width: 54px;
                    padding: 2px 7px;
                    text-align: center;
                    font-weight: 900;
                    white-space: nowrap;
                }

                .path-result {
                    grid-column: 3;
                    justify-self: end;
                    color: var(--text-muted);
                    font-size: 0.72rem;
                    font-weight: 900;
                    text-transform: uppercase;
                    white-space: nowrap;
                }

                .team-path-item.win .path-result { color: var(--success-text); }
                .team-path-item.loss .path-result { color: var(--danger-text); }

                @media (max-width: 720px) {
                    .team-path-search-row {
                        grid-template-columns: 1fr;
                        gap: 4px;
                    }

                    .team-path-suggestions {
                        left: 0;
                        width: 100%;
                    }

                    .team-path-item {
                        grid-template-columns: 1fr;
                        align-items: stretch;
                    }

                    .path-venue,
                    .path-match,
                    .path-result {
                        grid-column: 1;
                    }

                    .path-result {
                        justify-self: start;
                    }
                }

                @media (prefers-reduced-motion: reduce) {
                    .team-path-toggle,
                    .team-path-search-row input {
                        transition: none;
                    }
                }
            `}</style>
        </section>
    );
}

function readSavedTeamPathQuery() {
    try {
        return window.localStorage.getItem(TEAM_PATH_QUERY_STORAGE_KEY) || 'USA';
    } catch {
        return 'USA';
    }
}

function updateTeamPathQuery(value, setQuery) {
    setQuery(value);
    try {
        window.localStorage.setItem(TEAM_PATH_QUERY_STORAGE_KEY, value);
    } catch {
        // Ignore storage failures; the in-memory search still works.
    }
}

function readSavedOpponentHeatmapQuery() {
    try {
        return window.localStorage.getItem(OPPONENT_HEATMAP_QUERY_STORAGE_KEY) || 'USA';
    } catch {
        return 'USA';
    }
}

function updateOpponentHeatmapQuery(value, setQuery) {
    setQuery(value);
    try {
        window.localStorage.setItem(OPPONENT_HEATMAP_QUERY_STORAGE_KEY, value);
    } catch {
        // Ignore storage failures; the in-memory search still works.
    }
}

function findTeamForQuery(teams, query) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return null;

    return teams.find(team => team.id.toLowerCase() === normalized)
        || teams.find(team => team.name.toLowerCase() === normalized)
        || teams.find(team => team.name.toLowerCase().includes(normalized))
        || teams.find(team => team.id.toLowerCase().includes(normalized))
        || null;
}

function getTeamSuggestions(teams, query) {
    const normalized = query.trim().toLowerCase();
    const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));

    if (!normalized) return sortedTeams;

    return sortedTeams.filter(team =>
        team.name.toLowerCase().includes(normalized) || team.id.toLowerCase().includes(normalized)
    );
}

function buildOpponentHeatmapRows({ selectedTeam, opponentMatrix, teamById, trials }) {
    if (!selectedTeam) return [];

    const safeTrials = Math.max(1, trials || 0);

    return OPPONENT_HEATMAP_ROUNDS.map(round => {
        const counts = opponentMatrix[selectedTeam.id]?.[round.key] || {};
        const appearanceCount = Object.values(counts).reduce((sum, count) => sum + count, 0);
        const appearancePct = appearanceCount / safeTrials * 100;
        const opponents = Object.entries(counts)
            .map(([teamId, count]) => {
                const conditionalPct = appearanceCount > 0 ? count / appearanceCount * 100 : 0;
                const matchupPct = count / safeTrials * 100;
                const matchupOdds = formatAmericanOdds(probabilityToAmericanOdds(matchupPct / 100));
                const likelihood = getOpponentLikelihood(conditionalPct);

                return {
                    team: teamById[teamId] || { id: teamId, name: teamId },
                    count,
                    conditionalPct,
                    matchupPct,
                    matchupOdds,
                    likelihood
                };
            })
            .sort((a, b) => {
                if (b.count !== a.count) return b.count - a.count;
                return a.team.name.localeCompare(b.team.name);
            })
            .slice(0, 5);

        return {
            ...round,
            appearanceCount,
            appearancePct,
            opponents
        };
    });
}

function getOpponentLikelihood(conditionalPct) {
    if (conditionalPct >= 60) return { label: 'Clear route', tone: 'clear' };
    if (conditionalPct >= 50) return { label: 'Majority route', tone: 'majority' };
    if (conditionalPct >= 30) return { label: 'Common route', tone: 'common' };
    if (conditionalPct >= 8) return { label: 'Notable route', tone: 'notable' };
    if (conditionalPct >= 2) return { label: 'Uncommon route', tone: 'uncommon' };
    return { label: 'Rare route', tone: 'rare' };
}

function buildTeamPath({ team, groups, standings, qualifiedThirds, groupScores, knockoutMatches }) {
    const groupId = findTeamGroupId(groups, team.id);
    const groupRows = groupId ? standings?.[groupId] || [] : [];
    const groupSummaryItem = groupId ? buildGroupSummaryItem({ team, groupId, groupRows }) : null;
    const groupPositionIndex = groupRows.findIndex(row => row.id === team.id);
    const groupPosition = groupPositionIndex >= 0 ? groupPositionIndex + 1 : null;
    const qualifiedThirdIds = new Set((qualifiedThirds || []).map(third => third.id));
    const qualified = Boolean(groupPosition && (groupPosition <= 2 || qualifiedThirdIds.has(team.id)));
    const allGroupMatchesScored = Object.keys(groupScores || {}).length > 0;

    if (!qualified && allGroupMatchesScored) {
        return {
            status: `Eliminated in Group ${groupId}`,
            statusType: 'out',
            items: groupSummaryItem ? [groupSummaryItem] : []
        };
    }

    const knockoutItems = buildKnockoutPathItems({ team, knockoutMatches });
    const finalItem = knockoutItems[knockoutItems.length - 1];
    let status = qualified ? `Qualified from Group ${groupId}` : `Group ${groupId || 'TBD'} pending`;
    let statusType = qualified ? 'alive' : 'pending';

    if (finalItem?.resultType === 'loss') {
        status = `Eliminated in ${finalItem.stage}`;
        statusType = 'out';
    } else if (finalItem?.round === 2 && finalItem.resultType === 'win') {
        status = 'Champion';
        statusType = 'alive';
    } else if (!qualified) {
        statusType = 'pending';
    }

    return {
        status,
        statusType,
        items: [
            ...(groupSummaryItem ? [groupSummaryItem] : []),
            ...knockoutItems
        ]
    };
}

function buildGroupSummaryItem({ team, groupId, groupRows }) {
    const groupPositionIndex = groupRows.findIndex(row => row.id === team.id);
    const groupPosition = groupPositionIndex >= 0 ? groupPositionIndex + 1 : null;
    const row = groupPositionIndex >= 0 ? groupRows[groupPositionIndex] : null;
    const points = row?.points ?? 0;
    const goalsFor = row?.gf ?? 0;
    const goalDifference = row?.gd ?? 0;

    return {
        key: `group-summary-${groupId}-${team.id}`,
        stage: `Group ${groupId}`,
        homeName: `${formatOrdinal(groupPosition)} place`,
        awayName: `${points} pts`,
        scoreLabel: `${goalsFor} GF · ${formatGoalDifference(goalDifference)} GD`,
        resultType: groupPosition && groupPosition <= 3 ? 'win' : 'pending',
        resultLabel: ''
    };
}

function buildKnockoutPathItems({ team, knockoutMatches }) {
    const items = [];
    const sortedMatches = [...(knockoutMatches || [])].sort((a, b) => {
        const dayCompare = String(a.day || '').localeCompare(String(b.day || ''));
        return dayCompare || a.id - b.id;
    });

    for (const match of sortedMatches) {
        const home = match.homeTeam;
        const away = match.awayTeam;
        const teamInMatch = home?.id === team.id || away?.id === team.id;
        if (!teamInMatch) continue;

        const resultType = getKnockoutResultType(match, team.id);
        items.push({
            key: `knockout-${match.id}`,
            stage: getRoundLabel(match.round),
            round: match.round,
            homeName: home?.name || 'TBD',
            awayName: away?.name || 'TBD',
            scoreLabel: match.score ? formatFullKnockoutScore(match.score) : 'TBD',
            venue: match.location,
            resultType,
            resultLabel: getPathResultLabel(resultType)
        });

        if (resultType === 'loss') break;
    }

    return items;
}

function findTeamGroupId(groups, teamId) {
    return Object.entries(groups || {}).find(([, teams]) => teams.some(team => team.id === teamId))?.[0] || null;
}

function getKnockoutResultType(match, teamId) {
    if (!match.winner?.id) return 'pending';
    return match.winner.id === teamId ? 'win' : 'loss';
}

function getPathResultLabel(resultType) {
    if (resultType === 'win') return 'Win';
    if (resultType === 'loss') return 'Loss';
    if (resultType === 'draw') return 'Draw';
    return 'Pending';
}

function getRoundLabel(round) {
    if (round === 32) return 'Round of 32';
    if (round === 16) return 'Round of 16';
    if (round === 8) return 'Quarterfinal';
    if (round === 4) return 'Semifinal';
    if (round === 2) return 'Final';
    if (round === 3) return 'Bronze match';
    return `Round ${round}`;
}

function formatFullKnockoutScore(score) {
    if (score.note === 'PEN' && score.homePens !== null && score.homePens !== undefined && score.awayPens !== null && score.awayPens !== undefined) {
        return `${score.home} (${score.homePens}) - ${score.away} (${score.awayPens})`;
    }

    const suffix = score.note && score.note !== 'TBD' ? ` ${score.note}` : '';
    return `${score.home} - ${score.away}${suffix}`;
}

function formatOrdinal(value) {
    if (!value) return 'TBD';
    const suffix = value === 1 ? 'st' : value === 2 ? 'nd' : value === 3 ? 'rd' : 'th';
    return `${value}${suffix}`;
}

function formatGoalDifference(value) {
    if (!Number.isFinite(value)) return '0';
    return value > 0 ? `+${value}` : `${value}`;
}

function MatchCard({ match, dispatch, actions, pickedId, onUSAWin, compactMode, liveScoresEnabled }) {
    const isDecided = !!match.winner;
    const home = match.homeTeam;
    const away = match.awayTeam;
    const score = match.score;
    const scoreNote = getScoreNoteLabel(score);
    const metaTitle = `Match ${match.id}: ${formatMatchDate(match.day)} at ${match.location}`;
    const homeMarket = getMarketOddsProfile(home?.id);
    const awayMarket = getMarketOddsProfile(away?.id);
    const isBayAreaVenue = match.location === 'San Francisco Bay Area Stadium';
    const isKansasCityVenue = match.location === 'Kansas City Stadium';
    const hasVenueIcon = isBayAreaVenue || isKansasCityVenue;
    const liveStatus = getLiveScoreStatus(score);
    const picksLocked = liveScoresEnabled && score?.source === 'live';
    const venueSetting = VENUE_SETTINGS[match.stadium] || 'outdoor';

    // Handler
    const pick = (team) => {
        if (picksLocked) return;
        if (!team || team.isPlaceholder) return;

        // Trigger celebration if USA
        if (team.id === 'USA') {
            if (onUSAWin) onUSAWin();
        }

        dispatch({
            type: actions.PICK_WINNER,
            matchId: match.id,
            winnerId: team.id
        });
    };

    return (
        <Squircle
            cornerRadius={compactMode ? 12 : 16}
            cornerSmoothing={1}
            borderColor={isDecided ? '#bdc3c7' : '#eff2f5'}
            borderWidth={isDecided ? 2 : 1}
            shadow={compactMode ? "none" : "0 2px 12px rgba(0,0,0,0.04)"}
            className={`match-card-wrapper ${compactMode ? 'compact-match-card' : ''}`}
            clip={false}
        >
            <div className={`match-card-content ${isDecided ? 'decided' : ''}`}>
                <div className="match-info">
                    <span className="match-id">M{match.id}</span>
                    <span className="match-date">{match.day.slice(5)}</span>
                    <span className="match-meta-popover">
                        <button type="button" className="match-meta-trigger" aria-label={metaTitle} title={metaTitle}>
                            <Info size={12} strokeWidth={2.4} />
                        </button>
                        <span className="match-meta-panel" role="tooltip">
                            <span className="meta-heading">Match {match.id}</span>
                            <span className="meta-row"><strong>Date</strong><span>{formatMatchDate(match.day)}</span></span>
                            <span className="meta-row">
                                <strong>Venue</strong>
                                <span className={[
                                    'venue-value',
                                    isBayAreaVenue ? 'bay-area-venue' : '',
                                    isKansasCityVenue ? 'kansas-city-venue' : ''
                                ].filter(Boolean).join(' ')}>
                                    {match.location}
                                    {isBayAreaVenue && <GoldenGateBridgeIcon />}
                                    {isKansasCityVenue && <BbqSmokerIcon />}
                                </span>
                            </span>
                            <span className="meta-row">
                                <strong>Setting</strong>
                                <span className={`venue-setting ${venueSetting}`}>
                                    {venueSetting === 'indoor' ? <IndoorVenueIcon /> : <OutdoorVenueIcon />}
                                    {venueSetting === 'indoor' ? 'Indoor' : 'Outdoor'}
                                </span>
                            </span>
                            {scoreNote && <span className="meta-row"><strong>Result</strong><span>{scoreNote}</span></span>}
                            {(home && !home.isPlaceholder) || (away && !away.isPlaceholder) ? (
                                <span className="meta-row">
                                    <strong>Ratings</strong>
                                    <span>
                                        {home && !home.isPlaceholder ? `${home.name}: ${home.rating}` : 'TBD'}
                                        {' / '}
                                        {away && !away.isPlaceholder ? `${away.name}: ${away.rating}` : 'TBD'}
                                    </span>
                                </span>
                            ) : null}
                            {(homeMarket || awayMarket) && (
                                <span className="meta-row">
                                    <strong>Market</strong>
                                    <span>
                                        {homeMarket ? `${home.name}: ${homeMarket.formattedOdds}` : 'TBD'}
                                        {' / '}
                                        {awayMarket ? `${away.name}: ${awayMarket.formattedOdds}` : 'TBD'}
                                    </span>
                                </span>
                            )}
                        </span>
                    </span>
                    {hasVenueIcon && (
                        <span className="main-card-venue-icon" title={match.location}>
                            {isBayAreaVenue && <GoldenGateBridgeIcon />}
                            {isKansasCityVenue && <BbqSmokerIcon />}
                        </span>
                    )}
                </div>
                <div className={[
                    'match-location',
                    isBayAreaVenue ? 'bay-area-venue' : '',
                    isKansasCityVenue ? 'kansas-city-venue' : ''
                ].filter(Boolean).join(' ')}>
                    <span>{match.location}</span>
                    {isBayAreaVenue && <GoldenGateBridgeIcon />}
                    {isKansasCityVenue && <BbqSmokerIcon />}
                </div>
                {score?.note && score.note !== 'TBD' && (
                    <div className="score-note">{score.note === 'PEN' ? 'Decided by penalties' : 'After extra time'}</div>
                )}
                {liveStatus && (
                    <div className={`live-score-note ${score.completed ? 'final' : 'live'}`} title={liveStatus.title}>
                        {liveStatus.label}
                    </div>
                )}

                <button
                    type="button"
                    className={`team-slot ${pickedId === home?.id ? 'winner' : ''} ${!home || home.isPlaceholder ? 'placeholder' : ''}`}
                    disabled={!home || home.isPlaceholder || picksLocked}
                    onClick={() => pick(home)}
                >
                    <span className="team-name">{home ? home.name : 'Waiting...'}</span>
                    <span className="team-meta">
                        {score && <span className="match-score">{formatKnockoutScore(score, 'home')}</span>}
                        {home && !home.isPlaceholder && <span className="rating">{home.rating}</span>}
                    </span>
                </button>

                <button
                    type="button"
                    className={`team-slot ${pickedId === away?.id ? 'winner' : ''} ${!away || away.isPlaceholder ? 'placeholder' : ''}`}
                    disabled={!away || away.isPlaceholder || picksLocked}
                    onClick={() => pick(away)}
                >
                    <span className="team-name">{away ? away.name : 'Waiting...'}</span>
                    <span className="team-meta">
                        {score && <span className="match-score">{formatKnockoutScore(score, 'away')}</span>}
                        {away && !away.isPlaceholder && <span className="rating">{away.rating}</span>}
                    </span>
                </button>
            </div>

            <style>{`
	           .match-card-wrapper { transition: transform var(--motion-duration-micro) var(--motion-ease-standard); }
	           .match-card-wrapper:focus-within { z-index: 80; }
	           @media (hover: hover) {
	               .match-card-wrapper:hover { transform: translateY(calc(-1 * var(--motion-distance-1))); z-index: 80; }
	           }

           .match-card-content { 
               padding: var(--space-3); 
               font-size: 0.9rem; display: flex; flex-direction: column; gap: 8px; 
               height: 100%;
           }
           
           .match-info { font-size: 0.7rem; color: var(--text-muted); display: flex; align-items: center; gap: var(--space-1); margin-bottom: 2px; font-weight: 500; }
           .match-date { margin-left: auto; }
           .match-meta-popover { position: relative; display: inline-flex; align-items: center; flex-shrink: 0; }
           .match-meta-trigger {
               width: 24px;
               height: 24px;
               padding: 0;
               display: inline-flex;
               align-items: center;
               justify-content: center;
               border: 1px solid var(--border-subtle);
               border-radius: var(--radius-pill);
               background: var(--surface);
               color: var(--text-muted);
               cursor: help;
               transition: background var(--motion-duration-micro) var(--motion-ease-standard), color var(--motion-duration-micro) var(--motion-ease-standard), border-color var(--motion-duration-micro) var(--motion-ease-standard);
           }
           @media (hover: hover) {
               .match-meta-trigger:hover { background: var(--surface-muted); border-color: var(--border-strong); color: var(--text-main); }
           }
           .match-meta-trigger:focus-visible {
               outline: 2px solid rgba(37, 99, 235, 0.4);
               outline-offset: 2px;
           }
           .match-meta-panel {
               position: absolute;
               top: calc(100% + 6px);
               right: 0;
               z-index: 60;
               width: min(240px, calc(100vw - 48px));
               display: grid;
               gap: 7px;
               padding: var(--space-3);
               border: 1px solid var(--border-strong);
               border-radius: var(--radius-md);
               background: rgba(255, 255, 255, 0.98);
               color: var(--text-main);
               box-shadow: var(--shadow-lg);
               opacity: 0;
               pointer-events: none;
               transform: translateY(-2px);
               transition: opacity var(--motion-duration-micro) var(--motion-ease-standard), transform var(--motion-duration-micro) var(--motion-ease-standard);
           }
           .match-meta-popover:hover .match-meta-panel,
           .match-meta-popover:focus-within .match-meta-panel {
               opacity: 1;
               pointer-events: auto;
               transform: translateY(0);
           }
           .meta-heading { font-size: 0.74rem; font-weight: 900; color: var(--text-main); text-transform: uppercase; letter-spacing: 0; }
           .meta-row { display: grid; gap: 2px; font-size: 0.72rem; line-height: 1.25; }
           .meta-row strong { color: var(--text-muted); font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0; }
           .meta-row span { overflow-wrap: anywhere; }
           .venue-value { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
           .bay-area-venue { color: #9a3412; font-weight: 800; }
           .kansas-city-venue { color: #7f1d1d; font-weight: 800; }
           .golden-gate-icon,
           .bbq-smoker-icon {
               width: 22px;
               height: 22px;
               flex: 0 0 auto;
               stroke-width: 1.5;
               vector-effect: non-scaling-stroke;
           }
           .golden-gate-icon {
               color: #c2410c;
           }
           .bbq-smoker-icon {
               color: #b91c1c;
           }
           .venue-setting {
               display: inline-flex;
               align-items: center;
               gap: 6px;
               width: fit-content;
               border-radius: var(--radius-pill);
               padding: 2px 7px;
               font-size: 0.68rem;
               font-weight: 850;
               line-height: 1.1;
           }
           .venue-setting.indoor {
               color: #075985;
               background: #e0f2fe;
               border: 1px solid #bae6fd;
           }
           .venue-setting.outdoor {
               color: #854d0e;
               background: #fef9c3;
               border: 1px solid #fde68a;
           }
           .venue-setting-icon {
               width: 15px;
               height: 15px;
               flex: 0 0 auto;
               stroke-width: 1.7;
           }
           .main-card-venue-icon {
               display: inline-flex;
               align-items: center;
               justify-content: center;
               width: 24px;
               height: 24px;
               margin-left: auto;
               border-radius: 999px;
               background: #fff7ed;
               border: 1px solid #fed7aa;
           }
           .main-card-venue-icon .golden-gate-icon,
           .main-card-venue-icon .bbq-smoker-icon {
               width: 18px;
               height: 18px;
               stroke-width: 1.35;
           }
           .match-location {
               display: flex;
               align-items: center;
               justify-content: flex-end;
               gap: 6px;
               font-size: 0.65rem;
               color: #7f8c8d;
               font-style: normal;
               margin-bottom: var(--space-2);
               text-align: right;
               font-weight: 600;
           }
           .match-location .golden-gate-icon,
           .match-location .bbq-smoker-icon {
               width: 18px;
               height: 18px;
               stroke-width: 1.35;
           }
           .score-note { margin-top: -4px; margin-bottom: 2px; text-align: right; font-size: 0.62rem; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 0; }
           .live-score-note {
               margin-top: -4px;
               margin-bottom: 2px;
               align-self: flex-end;
               max-width: 100%;
               border-radius: var(--radius-pill);
               padding: 2px 7px;
               font-size: 0.62rem;
               font-weight: 850;
               line-height: 1.15;
               text-align: right;
           }
           .live-score-note.live {
               color: #075985;
               background: #e0f2fe;
               border: 1px solid #7dd3fc;
           }
           .live-score-note.final {
               color: #334155;
               background: #e2e8f0;
               border: 1px solid #cbd5e1;
           }
           
           .team-slot { 
               width: 100%;
               min-height: 48px;
               padding: var(--space-2) var(--space-4); border-radius: var(--radius-md); cursor: pointer; 
               display: flex; justify-content: space-between; align-items: center; 
               gap: var(--space-2);
               transition: background var(--motion-duration-micro) var(--motion-ease-standard), border-color var(--motion-duration-micro) var(--motion-ease-standard), color var(--motion-duration-micro) var(--motion-ease-standard), transform var(--motion-duration-micro) var(--motion-ease-standard);
               border: 1px solid var(--border-subtle);
               background: var(--surface-muted);
               color: var(--text-main);
               font-family: inherit;
               font-size: inherit;
               text-align: left;
           }
           @media (hover: hover) {
               .team-slot:hover:not(:disabled) { background: #eef2f7; border-color: var(--border-strong); }
           }
           .team-slot:active:not(:disabled) { transform: scale(var(--motion-press-scale)); }
           .team-slot.winner { background: var(--success-bg); font-weight: 800; border: 1px solid var(--success-border); color: var(--success-text); }
           .team-slot.placeholder { color: #64748b; cursor: default; background: #fff; border: 1px dashed var(--border-subtle); }
           .team-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
           .team-meta { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
           .match-score { min-width: 22px; text-align: center; font-weight: 900; color: var(--text-main); }
           .team-slot.winner .match-score { color: var(--success-text); }
           .rating { font-size: 0.7rem; color: #475569; background: #e2e8f0; padding: 2px 6px; border-radius: var(--radius-sm); font-weight: 800; }
           
           /* Compact Mode overrides */
           .compact-match-card .match-card-content {
               padding: 4px var(--space-2) !important;
               gap: 4px !important;
           }
           .compact-match-card .match-info {
               font-size: 0.6rem !important;
               margin-bottom: 0 !important;
           }
           .compact-match-card .match-meta-trigger {
               width: 22px;
               height: 22px;
           }
           .compact-match-card .match-location,
           .compact-match-card .score-note {
               display: none !important;
           }
           .compact-match-card .team-slot {
               min-height: 22px !important;
               padding: 2px 6px !important;
               border-radius: var(--radius-sm) !important;
               font-size: 0.76rem !important;
               gap: 4px !important;
           }
           .compact-match-card .rating {
               display: none !important;
           }

           @media (prefers-reduced-motion: reduce) {
               .match-card-wrapper:hover,
               .team-slot:active:not(:disabled) { transform: none; }
               .match-meta-panel { transition: none; }
           }

           @media (max-width: 640px) {
               .match-meta-trigger {
                   width: 32px;
                   height: 32px;
               }
               .match-meta-panel {
                   right: -6px;
                   width: min(260px, calc(100vw - 40px));
               }
               .compact-match-card .match-meta-trigger {
                   width: 32px;
                   height: 32px;
               }
           }
        `}</style>
        </Squircle>
    );
}

function formatMatchDate(day) {
    if (!day) return 'TBD';
    const [year, month, date] = day.split('-');
    return `${month}/${date}/${year}`;
}

function getScoreNoteLabel(score) {
    if (!score?.note || score.note === 'TBD') return null;
    if (score.note === 'PEN') return 'Decided by penalties';
    if (score.note === 'AET') return 'After extra time';
    return score.note;
}

function formatKnockoutScore(score, side) {
    const goals = score[side];
    const pens = side === 'home' ? score.homePens : score.awayPens;

    if (score.note === 'PEN' && pens !== null && pens !== undefined) {
        return `${goals} (${pens})`;
    }

    return goals;
}

function getLiveScoreStatus(score) {
    if (score?.source !== 'live') return null;
    if (score.completed) {
        return {
            label: 'FT',
            title: 'This live result is final and cannot be edited while live mode is enabled.'
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

function GoldenGateBridgeIcon() {
    return (
        <svg
            className="golden-gate-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-label="Golden Gate Bridge"
            role="img"
        >
            <path d="M3 18h18" />
            <path d="M5 14.5c4.5-4.2 9.5-4.2 14 0" />
            <path d="M7 18V8" />
            <path d="M17 18V8" />
            <path d="M6 8h3" />
            <path d="M15 8h3" />
            <path d="M12 18v-4.5" />
        </svg>
    );
}

function BbqSmokerIcon() {
    return (
        <svg
            className="bbq-smoker-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-label="BBQ smoker"
            role="img"
        >
            <path d="M5 15h11.5a4.5 4.5 0 0 0-9 0" />
            <path d="M5 15h12" />
            <path d="M6.5 15v3" />
            <path d="M15.5 15v3" />
            <path d="M8.5 18h5" />
            <path d="M17 13h2.5" />
            <path d="M19.5 11.5v3" />
            <path d="M8 12h4" />
            <path d="M10 8c-.7-.6-.7-1.25 0-1.9" />
            <path d="M14 8c-.7-.6-.7-1.25 0-1.9" />
            <circle cx="7" cy="19" r=".8" />
            <circle cx="16" cy="19" r=".8" />
        </svg>
    );
}

function IndoorVenueIcon() {
    return (
        <svg
            className="venue-setting-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-label="Indoor stadium"
            role="img"
        >
            <path d="M4 12.5 12 6l8 6.5" />
            <path d="M6.5 11v7h11v-7" />
            <path d="M9 18v-4h6v4" />
        </svg>
    );
}

function OutdoorVenueIcon() {
    return (
        <svg
            className="venue-setting-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-label="Outdoor stadium"
            role="img"
        >
            <circle cx="12" cy="12" r="3.2" />
            <path d="M12 3.5v2" />
            <path d="M12 18.5v2" />
            <path d="M3.5 12h2" />
            <path d="M18.5 12h2" />
            <path d="m6 6 1.4 1.4" />
            <path d="m16.6 16.6 1.4 1.4" />
            <path d="m18 6-1.4 1.4" />
            <path d="m7.4 16.6-1.4 1.4" />
        </svg>
    );
}

function KnockoutStageStats({ superSimStats, groups, compactMode }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [opponentQuery, setOpponentQuery] = useState(readSavedOpponentHeatmapQuery);
    const [opponentSuggestionsOpen, setOpponentSuggestionsOpen] = useState(false);
    const trials = superSimStats.trials;
    const safeTrials = Math.max(1, trials || 0);
    const knockoutReach = superSimStats.knockoutReach;
    const opponentMatrix = superSimStats.opponentMatrix || {};

    const formatTeamId = (id) => {
        if (!id || id.length <= 3) return id;
        if (id.startsWith('PO_UEFA_')) return 'UE' + id.slice(-1);
        if (id.startsWith('PO_IC_')) return 'IC' + id.slice(-1);
        return id.slice(0, 3);
    };

    const getUnicodeBar = (percentage, maxBarLength = 20) => {
        const fullBlocks = Math.floor((percentage / 100) * maxBarLength);
        const remainder = ((percentage / 100) * maxBarLength) - fullBlocks;
        const partials = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'];
        const index = Math.floor(remainder * 8);
        return '█'.repeat(fullBlocks) + partials[index];
    };

    const allTeams = Object.values(groups || {}).flat();
    const teamById = Object.fromEntries(allTeams.map(team => [team.id, team]));
    const sortedByChamp = [...allTeams].sort((a, b) => {
        const aChamp = knockoutReach[a.id]?.Champion || 0;
        const bChamp = knockoutReach[b.id]?.Champion || 0;
        if (bChamp !== aChamp) return bChamp - aChamp;
        const aFinal = knockoutReach[a.id]?.Final || 0;
        const bFinal = knockoutReach[b.id]?.Final || 0;
        if (bFinal !== aFinal) return bFinal - aFinal;
        return b.rating - a.rating;
    });

    const top10 = sortedByChamp.slice(0, 10);
    const mostLikelyWinner = sortedByChamp[0];
    const winnerProb = mostLikelyWinner ? ((knockoutReach[mostLikelyWinner.id]?.Champion || 0) / safeTrials * 100).toFixed(1) : '0';

    const filteredTeams = sortedByChamp.filter(team =>
        team.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const trimmedOpponentQuery = opponentQuery.trim();
    const selectedOpponentTeam = findTeamForQuery(allTeams, opponentQuery)
        || (!trimmedOpponentQuery ? allTeams.find(team => team.id === 'USA') : null)
        || (!trimmedOpponentQuery ? sortedByChamp[0] : null)
        || null;
    const opponentSuggestions = getTeamSuggestions(allTeams, opponentQuery).slice(0, 8);
    const opponentRoundRows = selectedOpponentTeam
        ? buildOpponentHeatmapRows({
            selectedTeam: selectedOpponentTeam,
            opponentMatrix,
            teamById,
            trials
        })
        : [];

    return (
        <Squircle
            cornerRadius={compactMode ? 12 : 16}
            cornerSmoothing={1}
            shadow={compactMode ? "0 2px 8px rgba(0,0,0,0.02)" : "0 4px 20px rgba(0,0,0,0.03)"}
            borderColor="#e5e7eb"
            className={`knockout-stats-card ${compactMode ? 'compact-stats' : ''}`}
            clip={false}
        >
            <div className="stats-container">
                <div className="stats-header">
                    <h2>Monte Carlo Knockout Stage Analysis</h2>
                    <p className="stats-subtitle">Based on {trials.toLocaleString()} tournament trials</p>
                </div>

                <div className="stats-grid">
                    <div id="knockout-title-odds" className="stats-box leaderboard-box">
                        <h3>Championship Probability (Top 10)</h3>
                        <p className="stats-note">Frequencies of winning the World Cup final match:</p>
                        
                        <pre className="ascii-chart">
{top10.map(team => {
    const count = knockoutReach[team.id]?.Champion || 0;
    const pct = ((count / safeTrials) * 100).toFixed(1);
    const bar = getUnicodeBar(parseFloat(pct), 18);
    const paddedName = team.name.slice(0, 12).padEnd(12, ' ');
    const pctText = `${pct}%`.padStart(6, ' ');
    return `${paddedName} │ ${pctText} │ ${bar}`;
}).join('\n')}
                        </pre>

                        {mostLikelyWinner && (
                            <div className="insight-card">
                                <span className="insight-icon">🏆</span>
                                <div className="insight-text">
                                    <strong>Championship Favorite</strong>: <strong>{mostLikelyWinner.name}</strong> is the most simulated champion, winning in <strong>{winnerProb}%</strong> of the tournament runs.
                                </div>
                            </div>
                        )}
                    </div>

                    <div id="knockout-reach-odds" className="stats-box knockout-probs-box">
                        <div className="knockout-probs-header">
                            <h3>Advancement Probability Heatmap</h3>
                            <div className="search-bar">
                                <input
                                    id="knockout-advancement-search"
                                    name="knockout-advancement-search"
                                    type="text"
                                    aria-label="Search teams in advancement probability heatmap"
                                    placeholder="Search team..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="search-input"
                                />
                            </div>
                        </div>

                        <div className="probs-table-wrapper select-none">
                            <table className="probs-table">
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'left' }}>Team</th>
                                        <th>R32</th>
                                        <th>R16</th>
                                        <th>QF</th>
                                        <th>SF</th>
                                        <th>Final</th>
                                        <th className="th-champ">Champ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTeams.map(team => {
                                        const reach = knockoutReach[team.id] || { R32: 0, R16: 0, QF: 0, SF: 0, Final: 0, Champion: 0 };
                                        
                                        const r32Ratio = reach.R32 / safeTrials;
                                        const r16Ratio = reach.R16 / safeTrials;
                                        const qfRatio = reach.QF / safeTrials;
                                        const sfRatio = reach.SF / safeTrials;
                                        const fRatio = reach.Final / safeTrials;
                                        const cRatio = reach.Champion / safeTrials;

                                        return (
                                            <tr key={team.id}>
                                                <td className="team-td">
                                                    <span className="flag-mini">{formatTeamId(team.id)}</span>
                                                    <span className="team-name-text">{team.name}</span>
                                                </td>
                                                <td style={{ backgroundColor: `rgba(99, 102, 241, ${r32Ratio * 0.4})`, fontWeight: r32Ratio > 0.4 ? '800' : 'normal' }}>
                                                    {((r32Ratio) * 100).toFixed(1)}%
                                                </td>
                                                <td style={{ backgroundColor: `rgba(79, 70, 229, ${r16Ratio * 0.4})`, fontWeight: r16Ratio > 0.4 ? '800' : 'normal' }}>
                                                    {((r16Ratio) * 100).toFixed(1)}%
                                                </td>
                                                <td style={{ backgroundColor: `rgba(139, 92, 246, ${qfRatio * 0.4})`, fontWeight: qfRatio > 0.4 ? '800' : 'normal' }}>
                                                    {((qfRatio) * 100).toFixed(1)}%
                                                </td>
                                                <td style={{ backgroundColor: `rgba(168, 85, 247, ${sfRatio * 0.4})`, fontWeight: sfRatio > 0.4 ? '800' : 'normal' }}>
                                                    {((sfRatio) * 100).toFixed(1)}%
                                                </td>
                                                <td style={{ backgroundColor: `rgba(217, 70, 239, ${fRatio * 0.4})`, fontWeight: fRatio > 0.4 ? '800' : 'normal' }}>
                                                    {((fRatio) * 100).toFixed(1)}%
                                                </td>
                                                <td className="td-champ" style={{ backgroundColor: `rgba(245, 158, 11, ${cRatio * 0.5})`, fontWeight: cRatio > 0.1 ? '800' : 'normal' }}>
                                                    <strong>{((cRatio) * 100).toFixed(1)}%</strong>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredTeams.length === 0 && (
                                        <tr>
                                            <td colSpan="7" style={{ padding: 'var(--space-6)', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                No teams match "{searchQuery}"
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div id="knockout-opponents" className="stats-box opponent-heatmap-box">
                        <div className="opponent-heatmap-header">
                            <div>
                                <h3>Most Likely Opponents Heatmap</h3>
                                <p className="stats-note">
                                    Who the selected team is most likely to face, round by round. Rows are sorted by exact matchup chance.
                                </p>
                            </div>
                            <div className="opponent-search">
                                <label htmlFor="opponent-heatmap-search">Search team</label>
                                <input
                                    id="opponent-heatmap-search"
                                    name="opponent-heatmap-search"
                                    type="search"
                                    aria-label="Search team for most likely opponents heatmap"
                                    placeholder="USA"
                                    value={opponentQuery}
                                    onChange={(event) => updateOpponentHeatmapQuery(event.target.value, setOpponentQuery)}
                                    onFocus={() => setOpponentSuggestionsOpen(true)}
                                    onBlur={() => window.setTimeout(() => setOpponentSuggestionsOpen(false), 120)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Escape') setOpponentSuggestionsOpen(false);
                                    }}
                                    autoComplete="off"
                                />
                                {opponentSuggestionsOpen && opponentSuggestions.length > 0 && (
                                    <div className="opponent-suggestions" role="listbox" aria-label="Opponent heatmap team suggestions">
                                        {opponentSuggestions.map(team => (
                                            <button
                                                key={team.id}
                                                type="button"
                                                role="option"
                                                className="opponent-suggestion"
                                                onMouseDown={(event) => {
                                                    event.preventDefault();
                                                    updateOpponentHeatmapQuery(team.name, setOpponentQuery);
                                                    setOpponentSuggestionsOpen(false);
                                                }}
                                            >
                                                <span>{team.name}</span>
                                                <strong>{team.id}</strong>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {selectedOpponentTeam ? (
                            <div className="opponent-heatmap-content">
                                <div className="opponent-context-strip">
                                    <div className="opponent-context-card selected">
                                        <span className="context-label">Selected team</span>
                                        <strong>
                                            <span className="flag-mini" aria-hidden="true">{formatTeamId(selectedOpponentTeam.id)}</span>
                                            {selectedOpponentTeam.name}
                                        </strong>
                                        <span>{trials.toLocaleString()} Monte Carlo trials</span>
                                    </div>
                                    <div className="opponent-context-card">
                                        <span className="context-label">How to read it</span>
                                        <strong>Route % compares opponents after {selectedOpponentTeam.name} reaches that round.</strong>
                                        <span>Exact chance shows the matchup probability as a plain percentage plus American odds.</span>
                                    </div>
                                </div>
                                <div className="opponent-round-grid">
                                    {opponentRoundRows.map(round => (
                                        <section className="opponent-round-card" key={round.key}>
                                            <header>
                                                <span>{round.label}</span>
                                                <small>{round.appearanceCount ? `Reach chance ${round.appearancePct.toFixed(1)}%` : 'No simulated appearances'}</small>
                                            </header>
                                            {round.opponents.length > 0 ? (
                                                <div className="opponent-list">
                                                    {round.opponents.map(opponent => (
                                                        <div
                                                            key={opponent.team.id}
                                                            className={`opponent-row ${opponent.likelihood.tone}`}
                                                            style={{
                                                                '--matchup-width': `${Math.min(100, opponent.matchupPct)}%`
                                                            }}
                                                            title={`${selectedOpponentTeam.name} vs ${opponent.team.name}: ${opponent.conditionalPct.toFixed(1)}% route share if ${selectedOpponentTeam.name} reaches ${round.label}; exact matchup chance ${opponent.matchupPct.toFixed(1)}% (${opponent.matchupOdds})`}
                                                        >
                                                            <span className="opponent-row-top">
                                                                <span className="opponent-name">
                                                                    <span className="flag-mini" aria-hidden="true">{formatTeamId(opponent.team.id)}</span>
                                                                    <span className="opponent-name-stack">
                                                                        <strong>{opponent.team.name}</strong>
                                                                        <em>{opponent.likelihood.label}</em>
                                                                    </span>
                                                                </span>
                                                                <span className="opponent-route-pct">
                                                                    <span>Route</span>
                                                                    <strong>{opponent.conditionalPct.toFixed(1)}%</strong>
                                                                </span>
                                                            </span>
                                                            <span className="opponent-matchup-line" aria-label={`Exact matchup chance ${opponent.matchupPct.toFixed(1)} percent, American odds ${opponent.matchupOdds}`}>
                                                                <span>Exact chance</span>
                                                                <span className="opponent-matchup-bar" aria-hidden="true">
                                                                    <span />
                                                                </span>
                                                                <strong>
                                                                    {opponent.matchupPct.toFixed(1)}%
                                                                    <em>{opponent.matchupOdds}</em>
                                                                </strong>
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="opponent-empty">No simulated appearances</div>
                                            )}
                                        </section>
                                    ))}
                                </div>
                                <div className="opponent-route-legend" aria-label="Route likelihood legend">
                                    {[
                                        ['Clear route', '60%+', `60% or more of ${selectedOpponentTeam.name}'s appearances in that round are against this opponent.`],
                                        ['Majority route', '50-59.9%', `50% to 59.9% of ${selectedOpponentTeam.name}'s appearances in that round are against this opponent.`],
                                        ['Common route', '30-49.9%', `30% to 49.9% of ${selectedOpponentTeam.name}'s appearances in that round are against this opponent.`],
                                        ['Notable route', '8-29.9%', `8% to 29.9% of ${selectedOpponentTeam.name}'s appearances in that round are against this opponent.`],
                                        ['Uncommon route', '2-7.9%', `2% to 7.9% of ${selectedOpponentTeam.name}'s appearances in that round are against this opponent.`],
                                        ['Rare route', '<2%', `Less than 2% of ${selectedOpponentTeam.name}'s appearances in that round are against this opponent.`]
                                    ].map(([label, range, tooltip]) => (
                                        <span
                                            key={label}
                                            className="opponent-route-legend-item"
                                            tabIndex="0"
                                            data-tooltip={tooltip}
                                            aria-label={`${label}: ${tooltip}`}
                                        >
                                            <strong>{label}</strong>
                                            <em>{range}</em>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="opponent-empty large">No team matches "{opponentQuery}".</div>
                        )}
                    </div>
                </div>
            </div>
            
            <style>{`
                .knockout-stats-card { margin-top: var(--space-6); background: transparent; max-width: 1200px; margin-left: auto; margin-right: auto; padding: 0 var(--space-4) var(--space-8); }
                .stats-container { padding: var(--space-6); }
                .stats-header { margin-bottom: var(--space-5); }
                .stats-header h2 { margin: 0; font-size: var(--font-xl); color: var(--text-main); }
                .stats-subtitle { margin: var(--space-1) 0 0; color: var(--text-muted); font-size: var(--font-sm); font-weight: 500; }
                
                .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-6); }
                @media (max-width: 900px) {
                    .stats-grid { grid-template-columns: 1fr; gap: var(--space-5); }
                }

                .stats-box { background: rgba(255, 255, 255, 0.45); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: var(--space-5); backdrop-filter: blur(8px); }
                .stats-box h3 { margin: 0 0 var(--space-3); font-size: var(--font-md); font-weight: 700; color: var(--text-main); }
                .stats-note { margin: 0 0 var(--space-3); font-size: var(--font-xs); color: var(--text-muted); }
                .opponent-heatmap-box { grid-column: 1 / -1; }

                /* ASCII / Unicode chart styles */
                .ascii-chart {
                    font-family: var(--font-mono, monospace);
                    font-size: 0.76rem;
                    line-height: 1.5;
                    background: #0f172a;
                    color: #e2e8f0;
                    padding: var(--space-4);
                    border-radius: var(--radius-md);
                    overflow-x: auto;
                    margin: 0 0 var(--space-4);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
                }

                /* Insight card */
                .insight-card { display: flex; gap: var(--space-3); background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: var(--radius-md); padding: var(--space-3) var(--space-4); align-items: flex-start; }
                .insight-icon { font-size: 1.1rem; }
                .insight-text { font-size: 0.82rem; color: #92400e; line-height: 1.4; }

                /* Knockout Probabilities */
                .knockout-probs-header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); margin-bottom: var(--space-4); }
                .knockout-probs-header h3 { margin: 0; }
                .search-bar { position: relative; }
                .search-input {
                    padding: 4px 10px;
                    border: 1px solid var(--border-subtle);
                    background: var(--surface);
                    color: var(--text-main);
                    font-size: var(--font-xs);
                    border-radius: 4px;
                    width: 140px;
                    outline: none;
                    transition: border-color 0.15s ease;
                }
                .search-input:focus { border-color: var(--text-main); }

                /* Heatmap Table */
                .probs-table-wrapper { overflow: visible; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); background: var(--surface); }
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
                .probs-table td.td-champ, .probs-table th.th-champ { border-left: 2px solid var(--border-subtle); }
                .probs-table td.td-champ { font-weight: 800; color: #92400e; }

                .opponent-heatmap-header {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: var(--space-4);
                    margin-bottom: var(--space-4);
                }
                .opponent-heatmap-header h3 { margin-bottom: var(--space-1); }
                .opponent-search {
                    position: relative;
                    display: grid;
                    gap: 4px;
                    min-width: 190px;
                }
                .opponent-search label {
                    color: var(--text-muted);
                    font-size: 0.64rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0;
                }
                .opponent-search input {
                    width: 100%;
                    min-height: 34px;
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-sm);
                    background: var(--surface);
                    color: var(--text-main);
                    font: inherit;
                    font-size: var(--font-xs);
                    font-weight: 700;
                    padding: 6px 10px;
                    outline: none;
                }
                .opponent-search input:focus {
                    border-color: var(--text-main);
                    box-shadow: 0 0 0 2px rgba(15, 23, 42, 0.08);
                }
                .opponent-suggestions {
                    position: absolute;
                    top: calc(100% + 4px);
                    left: 0;
                    right: 0;
                    z-index: 70;
                    display: grid;
                    gap: 2px;
                    padding: 4px;
                    border: 1px solid rgba(15, 23, 42, 0.18);
                    border-radius: var(--radius-md);
                    background: #0f172a;
                    box-shadow: var(--shadow-lg);
                }
                .opponent-suggestion {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: var(--space-2);
                    border: 0;
                    border-radius: var(--radius-sm);
                    background: transparent;
                    color: #e2e8f0;
                    font: inherit;
                    font-size: var(--font-xs);
                    font-weight: 700;
                    padding: 7px 8px;
                    cursor: pointer;
                    text-align: left;
                }
                .opponent-suggestion strong { color: #93c5fd; font-size: 0.66rem; }
                .opponent-suggestion:hover,
                .opponent-suggestion:focus {
                    background: rgba(148, 163, 184, 0.18);
                    outline: none;
                }
                .opponent-heatmap-content { display: grid; gap: var(--space-3); }
                .opponent-context-strip {
                    display: grid;
                    grid-template-columns: minmax(180px, 0.82fr) minmax(260px, 1.4fr);
                    gap: var(--space-3);
                }
                .opponent-context-card {
                    display: grid;
                    gap: 3px;
                    border: 1px solid rgba(203, 213, 225, 0.82);
                    border-radius: var(--radius-md);
                    background: rgba(255, 255, 255, 0.72);
                    padding: 10px 12px;
                    min-width: 0;
                }
                .opponent-context-card.selected {
                    background: rgba(248, 250, 252, 0.88);
                    border-color: rgba(148, 163, 184, 0.72);
                }
                .context-label {
                    color: var(--text-muted);
                    font-size: 0.62rem;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 0;
                }
                .opponent-context-card strong {
                    display: flex;
                    align-items: center;
                    gap: var(--space-2);
                    min-width: 0;
                    color: var(--text-main);
                    font-size: 0.82rem;
                    line-height: 1.25;
                }
                .opponent-context-card strong .flag-mini {
                    flex: 0 0 auto;
                }
                .opponent-context-card span:last-child {
                    color: var(--text-muted);
                    font-size: 0.72rem;
                    font-weight: 750;
                    line-height: 1.3;
                }
                .opponent-round-grid {
                    display: grid;
                    grid-template-columns: repeat(5, minmax(0, 1fr));
                    gap: var(--space-3);
                }
                .opponent-round-card {
                    min-width: 0;
                    border: 1px solid rgba(203, 213, 225, 0.86);
                    border-radius: var(--radius-md);
                    background: rgba(255, 255, 255, 0.82);
                    overflow: hidden;
                    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
                }
                .opponent-round-card header {
                    display: flex;
                    align-items: baseline;
                    justify-content: space-between;
                    gap: var(--space-2);
                    padding: 10px 12px;
                    background: rgba(248, 250, 252, 0.92);
                    border-bottom: 1px solid var(--border-subtle);
                }
                .opponent-round-card header span {
                    color: var(--text-main);
                    font-size: 0.8rem;
                    font-weight: 900;
                    text-transform: uppercase;
                }
                .opponent-round-card header small {
                    color: var(--text-muted);
                    font-size: 0.66rem;
                    font-weight: 800;
                    text-align: right;
                }
                .opponent-list { display: grid; padding: 0; }
                .opponent-row {
                    display: grid;
                    gap: 6px;
                    min-height: 58px;
                    padding: 9px 12px 10px;
                    border-radius: 0;
                    border-bottom: 1px solid rgba(226, 232, 240, 0.78);
                    background: transparent;
                    color: #0f172a;
                }
                .opponent-row:last-child { border-bottom: 0; }
                @media (hover: hover) {
                    .opponent-row:hover { background: rgba(248, 250, 252, 0.92); }
                }
                .opponent-name {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    min-width: 0;
                }
                .opponent-row-top {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: var(--space-2);
                    min-width: 0;
                }
                .opponent-name-stack {
                    display: grid;
                    min-width: 0;
                    gap: 1px;
                }
                .opponent-name-stack strong {
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    font-size: 0.76rem;
                    font-weight: 850;
                }
                .opponent-name-stack em {
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    color: #64748b;
                    font-size: 0.62rem;
                    font-style: normal;
                    font-weight: 760;
                }
                .opponent-route-pct {
                    display: grid;
                    justify-items: end;
                    flex: 0 0 auto;
                    gap: 1px;
                    text-align: right;
                }
                .opponent-route-pct span {
                    color: #64748b;
                    font-size: 0.56rem;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 0;
                }
                .opponent-route-pct strong {
                    font-size: 0.92rem;
                    font-weight: 900;
                    color: #0f172a;
                    font-variant-numeric: tabular-nums;
                }
                .opponent-matchup-line {
                    display: grid;
                    grid-template-columns: auto minmax(30px, 1fr) auto;
                    align-items: center;
                    gap: 6px;
                    color: #64748b;
                    font-size: 0.62rem;
                    font-weight: 820;
                    white-space: nowrap;
                }
                .opponent-matchup-bar {
                    position: relative;
                    height: 4px;
                    border-radius: var(--radius-pill);
                    background: rgba(203, 213, 225, 0.68);
                    overflow: hidden;
                }
                .opponent-matchup-bar span {
                    position: absolute;
                    inset: 0 auto 0 0;
                    width: var(--matchup-width);
                    border-radius: inherit;
                    background: #334155;
                }
                .opponent-matchup-line strong {
                    display: inline-flex;
                    align-items: baseline;
                    justify-content: flex-end;
                    gap: 5px;
                    color: #475569;
                    font-size: 0.66rem;
                    font-variant-numeric: tabular-nums;
                }
                .opponent-matchup-line strong em {
                    color: #0f172a;
                    font-size: 0.66rem;
                    font-style: normal;
                    font-weight: 900;
                }
                .opponent-route-legend {
                    display: flex;
                    flex-wrap: wrap;
                    gap: var(--space-2);
                    align-items: center;
                    padding-top: var(--space-1);
                    color: var(--text-muted);
                    font-size: 0.68rem;
                }
                .opponent-route-legend-item {
                    position: relative;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    min-height: 30px;
                    padding: 4px 8px;
                    border: 1px solid rgba(203, 213, 225, 0.86);
                    border-radius: var(--radius-pill);
                    background: rgba(255, 255, 255, 0.66);
                    color: #475569;
                    cursor: help;
                    outline: none;
                }
                .opponent-route-legend-item strong {
                    color: #0f172a;
                    font-weight: 850;
                }
                .opponent-route-legend-item em {
                    color: #64748b;
                    font-style: normal;
                    font-weight: 760;
                }
                .opponent-route-legend-item::after {
                    content: attr(data-tooltip);
                    position: absolute;
                    left: 0;
                    bottom: calc(100% + 8px);
                    z-index: 75;
                    width: min(280px, calc(100vw - 48px));
                    padding: 8px 10px;
                    border: 1px solid rgba(15, 23, 42, 0.16);
                    border-radius: var(--radius-md);
                    background: #0f172a;
                    color: #f8fafc;
                    box-shadow: var(--shadow-lg);
                    font-size: 0.68rem;
                    font-weight: 700;
                    line-height: 1.35;
                    white-space: normal;
                    opacity: 0;
                    pointer-events: none;
                    transform: translateY(2px);
                    transition: opacity var(--motion-duration-micro) var(--motion-ease-standard), transform var(--motion-duration-micro) var(--motion-ease-standard);
                }
                .opponent-route-legend-item:hover::after,
                .opponent-route-legend-item:focus-visible::after {
                    opacity: 1;
                    transform: translateY(0);
                }
                .opponent-route-legend-item:focus-visible {
                    border-color: #64748b;
                    box-shadow: 0 0 0 2px rgba(100, 116, 139, 0.16);
                }
                .opponent-empty {
                    padding: var(--space-3);
                    color: var(--text-muted);
                    font-size: var(--font-xs);
                    font-weight: 700;
                    font-style: italic;
                }
                .opponent-empty.large {
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-md);
                    background: rgba(255,255,255,0.62);
                }
                @media (max-width: 1080px) {
                    .opponent-round-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                }
                @media (max-width: 680px) {
                    .opponent-heatmap-header {
                        display: grid;
                    }
                    .opponent-search {
                        min-width: 0;
                        width: 100%;
                    }
                    .opponent-context-strip {
                        grid-template-columns: 1fr;
                    }
                    .opponent-round-grid { grid-template-columns: 1fr; }
                    .opponent-suggestion {
                        min-height: 44px;
                    }
                }

                /* Compact Mode Stats Styles */
                .compact-stats .stats-container { padding: var(--space-3) var(--space-4) !important; }
                .compact-stats .stats-header { margin-bottom: var(--space-3) !important; }
                .compact-stats .stats-grid { gap: var(--space-4) !important; }
                .compact-stats .stats-box { padding: var(--space-3) var(--space-4) !important; }
                .compact-stats .ascii-chart { font-size: 0.7rem !important; padding: var(--space-3) !important; margin-bottom: var(--space-3) !important; }
                .compact-stats .insight-card { padding: var(--space-2) var(--space-3) !important; }
                .compact-stats .insight-text { font-size: 0.76rem !important; }
                .compact-stats .probs-table th, .compact-stats .probs-table td { padding: 4px 6px !important; font-size: 0.74rem !important; }
                .compact-stats .flag-mini { padding: 1px 3px !important; font-size: 0.6rem !important; }
                .compact-stats .opponent-round-card header { padding: 8px 10px !important; }
                .compact-stats .opponent-row { min-height: 54px !important; padding: 8px 10px !important; }
            `}</style>
        </Squircle>
    );
}
