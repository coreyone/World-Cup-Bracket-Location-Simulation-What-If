import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { BracketContext } from '../store/BracketContext';
import GroupStage from './GroupStage';
import KnockoutBracket from './KnockoutBracket';
import { simulateTournament, runSuperSimulation } from '../logic/simulator';
import { fetchWorldCupLiveScores, isLiveScoresAvailable } from '../logic/liveScores';
import { Play, RotateCcw, Zap, Radio, RefreshCw } from 'lucide-react';

const SUPER_SIM_TRIALS = 10000;

export default function MainLayout() {
    const { actions, dispatch, state, knockoutMatches } = useContext(BracketContext);
    const [view, setView] = useState('groups'); // 'groups' or 'bracket'
    const [isSuperSimulating, setIsSuperSimulating] = useState(false);
    const liveScoresAvailable = isLiveScoresAvailable();
    const liveScoresSyncing = state.liveScoreMeta.status === 'syncing';
    const liveSimulationInputs = getCompletedLiveSimulationInputs(state);
    const liveContextRef = useRef({ groups: state.groups, knockoutMatches });
    const liveSyncInFlightRef = useRef(false);

    useEffect(() => {
        liveContextRef.current = { groups: state.groups, knockoutMatches };
    }, [state.groups, knockoutMatches]);

    const syncLiveScores = useCallback(async () => {
        if (!liveScoresAvailable || liveSyncInFlightRef.current) return;

        liveSyncInFlightRef.current = true;
        dispatch({ type: actions.LIVE_SCORES_LOADING });

        try {
            const payload = await fetchWorldCupLiveScores(liveContextRef.current);
            dispatch({ type: actions.APPLY_LIVE_SCORES, payload });
        } catch (error) {
            dispatch({
                type: actions.LIVE_SCORES_ERROR,
                error: error?.message || 'Unable to sync live scores'
            });
        } finally {
            liveSyncInFlightRef.current = false;
        }
    }, [actions, dispatch, liveScoresAvailable]);

    useEffect(() => {
        if (!state.liveScoresEnabled || !liveScoresAvailable) return undefined;

        syncLiveScores();
        const pollId = window.setInterval(syncLiveScores, 60000);
        return () => window.clearInterval(pollId);
    }, [liveScoresAvailable, state.liveScoresEnabled, syncLiveScores]);

    const handleSimulate = () => {
        const simulationOptions = state.liveScoresEnabled && state.liveSimulationEnabled
            ? liveSimulationInputs.options
            : {};

        dispatch({
            type: actions.SIMULATE_TOURNAMENT,
            payload: simulateTournament(state.groups, state.schedule, simulationOptions)
        });
    };

    const handleSuperSimulate = () => {
        setIsSuperSimulating(true);
        setTimeout(() => {
            try {
                const simulationOptions = state.liveScoresEnabled && state.liveSimulationEnabled
                    ? liveSimulationInputs.options
                    : {};
                const stats = runSuperSimulation(state.groups, state.schedule, SUPER_SIM_TRIALS, simulationOptions);
                const singleRun = simulateTournament(state.groups, state.schedule, simulationOptions);
                dispatch({
                    type: actions.SUPER_SIMULATION,
                    payload: {
                        ...singleRun,
                        superSimStats: stats
                    }
                });
            } finally {
                setIsSuperSimulating(false);
            }
        }, 30);
    };

    const handleLiveScoresToggle = () => {
        if (state.liveScoresEnabled) {
            dispatch({ type: actions.DISABLE_LIVE_SCORES });
            return;
        }

        if (!liveScoresAvailable) return;
        dispatch({ type: actions.ENABLE_LIVE_SCORES });
    };

    const handleLiveSimulationToggle = () => {
        if (!state.liveScoresEnabled) return;
        dispatch({ type: actions.TOGGLE_LIVE_SIMULATION });
    };

    const liveButtonTitle = state.liveScoresEnabled
        ? 'Turn Live Scores Off'
        : liveScoresAvailable
            ? 'Turn Live Scores On'
            : 'Live scores available June 11, 2026';

    return (
        <div className="app-container compact-mode">
            <header className="main-header">
                <div className="header-title-group">
                    <h1 aria-label="World Cup 2026" className="title-space-italic" style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontWeight: '700',
                        letterSpacing: '-0.03em',
                        textTransform: 'uppercase',
                        fontStyle: 'italic',
                        fontSize: 'clamp(1.3rem, 2.6vw, 2.0rem)',
                        lineHeight: 1,
                        margin: 0,
                        display: 'inline-block',
                        paddingRight: '0.15em'
                    }}>
                        <span className="title-fill-layer" style={{
                            background: 'linear-gradient(135deg, #ef4444 10%, #3b82f6 90%)',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            color: 'transparent',
                            WebkitTextFillColor: 'transparent',
                            display: 'inline-block',
                            paddingRight: '0.15em'
                        }}>World Cup 2026</span>
                    </h1>
                    <svg
                        viewBox="0 0 952.432 952.432"
                        aria-hidden="true"
                        style={{
                            width: '2.1em',
                            height: '2.1em',
                            verticalAlign: 'middle',
                            display: 'inline-block',
                            flexShrink: 0
                        }}
                    >
                        <defs>
                            <linearGradient id="soccerBallGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#ff2a5f" />
                                <stop offset="100%" stopColor="#0052ff" />
                            </linearGradient>
                        </defs>
                        <g fill="url(#soccerBallGradient)">
                            <path d="M370.175,486.788c0-167.9,136.1-304,304-304c11.5,0,22.8,0.7,34,1.899c-2.3-2.5-11.6-7.8-14.8-9.3c-168.601-80.6-324.9,32.7-406.8,105.2c-14.2,12.6-11.8,35,4.399,44.9c36.8,22.5,0.7,124.399-63.6,93.8c-4-1.9-10.2-5.801-14.3-7.7c-91.7-43.5-219.8,62.7-212.8,74.1c9.6,15.601,86.8-74.6,285.4,157.3c134.9,157.301,270.5,168.9,353,159.4c8.2-0.9,29-6.1,33.3-11.7C505.075,789.487,370.175,653.888,370.175,486.788z"/>
                            <path d="M927.175,371.288c-15-32.8-35.8-62-62-86.7c-27.1-25.6-58.6-45.2-93.8-58.3c-17.5-6.5-35.5-11.3-53.7-14.2c-5-0.8-10.1-1.5-15.1-2c-5.101-0.5-10.2-0.9-15.301-1.2c-5.1-0.2-10.199-0.3-15.199-0.3s-10,0.2-14.9,0.5c-5,0.3-9.9,0.8-14.9,1.3c-4.899,0.601-9.899,1.3-14.8,2.101c-4.899,0.8-9.8,1.8-14.7,2.899c-4.899,1.101-9.699,2.3-14.5,3.7c-2.199,0.6-4.3,1.3-6.5,1.9c-26.5,8.199-51.5,20.3-74.5,36c-47.6,32.5-83.5,78.199-103.699,132.399c-13.101,35.2-19,71.8-17.4,109.1c1.5,35.9,9.9,70.801,24.9,103.601s35.8,62,62,86.7c27.1,25.6,58.6,45.199,93.8,58.3c31.3,11.7,64.1,17.6,97.2,17.6c0.8,0,1.5,0,2.3,0c27.2-0.2,54.1-4.399,80.2-12.5c26.5-8.2,51.5-20.3,74.5-36c47.6-32.5,83.5-78.2,103.699-132.399c13.101-35.2,19-71.9,17.4-109.101C950.475,438.987,942.075,404.188,927.175,371.288z M674.175,230.588c0.2,0,0.4,0,0.5,0c-25.5,5.3-50.5,14.9-74,28.7c-1.4,0.8-2.8,1.7-4.2,2.5c-14.6-1.4-35.7-0.3-61.1,9.7C576.375,245.088,624.575,230.588,674.175,230.588z M428.575,559.288c-15.2-51.4-14.5-108,5.699-162.101c8.2-21.899,19.101-42.1,32.101-60.199c0.2,8.6,2.399,19.5,8.899,38.199c-16.6,32-25.8,68.5-26.8,107c-0.5,20.7,1.4,37.7,3.2,48.601C442.975,541.188,433.575,552.987,428.575,559.288z M479.975,536.987c-10.3-28.199-8-61.399-2.8-90c1.9-10.8,4.6-21.399,8.2-31.8c1.899-5.7,4.1-11.399,6.6-16.899c1.4-3.101,4.9-14.5,7.9-15.9l72-32.8l104.6,89.7l-17.1,101.199l-125.101,54.7c-2.1,0.7-11.3-7.2-13.199-8.5c-4.2-3-8.101-6.2-12-9.399c-7.5-6.301-14.2-13.2-19.601-21.4C485.475,549.788,482.375,543.487,479.975,536.987z M619.375,736.888c-11.7-2.6-23.3-6-34.8-10.3c-35.4-13.2-66.2-33.5-91.301-58.601c13.4,6.601,28,11.5,40.101,15c30.899,29.301,65.3,45,92.2,53.301C623.175,736.688,621.175,736.788,619.375,736.888z M748.274,699.888c-19.899,12.2-42,20.4-62.5,26c-6.8-0.4-17.5-1.4-30.5-4c-5-1-10.3-2.2-15.899-3.8c-24-6.601-57-19.9-86.9-46.601c-6-19.5-6.6-40.699-6.2-54.5l122.7-53.6l19.2,9.3l63.5,30.7L748.274,699.888z M722.475,416.888l-28.2,4.6l-105.1-89.999l22-49.2c27-16.2,117.6-34,117.6-34c50.9,26.399,74.2,50.7,83.2,62.2l-26.2,96.199L722.475,416.888z M893.375,619.088c-22.2,36.8-52.8,66.6-88.4,87.7c-0.399-0.4-1.2-0.7-2.3-0.9c-8.9-1.4-20.5-5.2-29.3-8.4l3.5-98.8l69.2-72l63.5,7.601C912.475,558.188,899.375,601.188,893.375,619.088z M911.075,509.288l-62.5-7.5l-40.101-83.4l26.3-96.5c14.4,3.9,33.2,9.101,45.101,12.4c19.1,25.8,33.2,55.1,41.5,86.1C923.875,452.388,916.274,489.188,911.075,509.288z"/>
                        </g>
                    </svg>
                </div>
                <nav>
                    <button 
                        disabled={isSuperSimulating} 
                        onClick={() => setView('groups')} 
                        className={view === 'groups' ? 'active' : ''} 
                        aria-pressed={view === 'groups'}
                    >
                        Group Stage
                    </button>
                    <button 
                        disabled={isSuperSimulating} 
                        onClick={() => setView('bracket')} 
                        className={view === 'bracket' ? 'active' : ''} 
                        aria-pressed={view === 'bracket'}
                    >
                        Knockout Bracket
                    </button>
                    <button
                        onClick={handleLiveScoresToggle}
                        className={`live-toggle-btn ${state.liveScoresEnabled ? 'active live-on' : ''}`}
                        aria-pressed={state.liveScoresEnabled}
                        disabled={isSuperSimulating || (!state.liveScoresEnabled && !liveScoresAvailable)}
                        title={liveButtonTitle}
                        aria-label={liveButtonTitle}
                    >
                        <Radio size={16} />
                        <span>{state.liveScoresEnabled ? 'Live On' : liveScoresAvailable ? 'Live Scores' : 'Live Jun 11'}</span>
                    </button>
                    <button 
                        onClick={handleSimulate} 
                        className="simulate-btn"
                        disabled={isSuperSimulating}
                        title="Run one tournament path"
                        aria-label="Run one tournament path"
                    >
                        <Play size={18} fill="currentColor" />
                    </button>
                    <button 
                        onClick={handleSuperSimulate} 
                        className={`supersim-btn ${isSuperSimulating ? 'loading' : ''}`}
                        disabled={isSuperSimulating}
                        title="Monte Carlo: 10,000 paths for reach chances and likely opponents"
                        aria-label="Monte Carlo: 10,000 paths for reach chances and likely opponents"
                    >
                        {isSuperSimulating ? (
                            <span className="spinner" />
                        ) : (
                            <Zap size={18} fill="currentColor" />
                        )}
                    </button>
                    <button 
                        onClick={() => dispatch({ type: actions.CLEAR_RESULTS })} 
                        className="reset-btn"
                        disabled={isSuperSimulating || state.liveScoresEnabled}
                        title={state.liveScoresEnabled ? 'Turn live scores off before clearing results' : 'Clear Results'}
                        aria-label={state.liveScoresEnabled ? 'Turn live scores off before clearing results' : 'Clear Results'}
                    >
                        <RotateCcw size={18} />
                    </button>

                </nav>
            </header>

            {state.liveScoresEnabled && (
                <div className="live-score-banner-slot">
                    <div className={`live-score-banner ${state.liveScoreMeta.status}`}>
                        <div>
                            <strong>Live on</strong>
                            <span>Every minute · {liveSimulationInputs.totalCompleted} finals locked</span>
                            {state.liveSimulationEnabled && (
                                <span>Finals drive paths + opponent odds</span>
                            )}
                            {state.liveScoreMeta.lastUpdated && (
                                <span>Updated {formatLiveTimestamp(state.liveScoreMeta.lastUpdated)}</span>
                            )}
                            {state.liveScoreMeta.error && (
                                <span className="live-error">{state.liveScoreMeta.error}</span>
                            )}
                            {state.liveScoreMeta.simulationResetNotice && (
                                <span className="live-warning">{state.liveScoreMeta.simulationResetNotice}</span>
                            )}
                        </div>
                        <div className="live-score-banner-actions">
                            <button
                                type="button"
                                onClick={handleLiveSimulationToggle}
                                className={`live-sim-impact-toggle ${state.liveSimulationEnabled ? 'active' : ''}`}
                                role="switch"
                                aria-checked={state.liveSimulationEnabled}
                                title="Use completed live results as fixed inputs for simulations and the likely-opponents heatmap"
                            >
                                <span className="live-sim-switch-track" aria-hidden="true">
                                    <span className="live-sim-switch-thumb" />
                                </span>
                                <span>Finals affect sims</span>
                            </button>
                            <button type="button" onClick={syncLiveScores} disabled={liveScoresSyncing}>
                                <RefreshCw size={15} className={liveScoresSyncing ? 'spinning' : ''} />
                                <span>{liveScoresSyncing ? 'Syncing' : 'Refresh'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <main className="view-panel" key={view}>
                {view === 'groups' ? <GroupStage /> : <KnockoutBracket />}
            </main>

            <footer className="app-footer">
                <span>Enjoying the simulator?</span>
                <a
                    className="tip-jar-link"
                    href="https://ko-fi.com/coreyone/5"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Tip Jar — opens Ko-fi in a new tab"
                >
                    Tip Jar <span aria-hidden="true">↗</span>
                </a>
                <span className="footer-separator" aria-hidden="true">·</span>
                <a
                    className="footer-site-link"
                    href="https://coreyone.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Corey O’Neal — opens personal site in a new tab"
                >
                    Corey O’Neal
                </a>
                <span className="footer-separator" aria-hidden="true">·</span>
                <span className="footer-made-in-sf">
                    <GoldenGateBridgeMark />
                    Made in SF
                </span>
            </footer>

            <style>{`
        .app-container { max-width: 1440px; margin: 0 auto; padding: var(--space-6); font-family: var(--font-family); color: var(--text-main); }
        @media (max-width: 640px) {
            .app-container { padding: var(--space-4); }
        }

        .main-header { 
            display: flex; justify-content: space-between; align-items: center; 
            padding: var(--space-3) var(--space-4); margin-bottom: var(--space-8);
            position: sticky; top: var(--space-4); z-index: 100;
            background: var(--glass-bg); backdrop-filter: var(--blur-md); -webkit-backdrop-filter: var(--blur-md);
            border: var(--glass-border); border-radius: var(--radius-lg);
            box-shadow: var(--shadow-lg);
             flex-wrap: wrap; gap: var(--space-4);
        }
        .header-title-group {
            display: inline-flex;
            align-items: center;
            gap: var(--space-2);
        }
        @media (max-width: 640px) {
            .header-title-group {
                width: 100%;
                justify-content: center;
            }
            .main-header { 
                position: static;
                flex-direction: column; align-items: flex-start; gap: var(--space-3);
                padding: var(--space-4); margin-bottom: var(--space-4);
                border-radius: var(--radius-lg);
            }
            .main-header h1 { 
                font-size: clamp(1.2rem, 5vw, 1.45rem);
            }
            .main-header nav {
                width: 100%;
                justify-content: center;
                flex-wrap: wrap;
                overflow-x: visible;
                row-gap: var(--space-2);
                padding-bottom: 0;
            }
        }
 
        .main-header h1 { 
            --title-outline: rgba(15, 23, 42, 0.84);
            --title-red: #dc2626;
            --title-blue: #2563eb;
            --title-light: #f8fafc;
            position: relative;
            margin: 0; 
            font-size: clamp(1.38rem, 2.35vw, 1.78rem); 
            line-height: 1;
            letter-spacing: 0.095em; 
            white-space: normal;
            font-weight: 900;
            text-transform: uppercase;
            font-optical-sizing: auto;
            text-rendering: geometricPrecision;
            text-wrap: balance;
            -webkit-font-smoothing: antialiased;
            display: inline-block;
            cursor: default;
            user-select: none;
            -webkit-user-select: none;
        }

        .main-header .title-fill-layer,
        .main-header .title-outline-layer {
            display: inline-block;
        }

        .main-header .title-fill-layer {
            position: relative;
            z-index: 2;
            background: linear-gradient(100deg, var(--title-red) 0%, var(--title-blue) 42%, var(--title-light) 55%, var(--title-red) 72%, var(--title-blue) 100%);
            background-clip: text;
            -webkit-background-clip: text;
            color: transparent;
            -webkit-text-fill-color: transparent;
        }

        .main-header .title-outline-layer {
            position: absolute;
            inset: 0;
            z-index: 1;
            color: transparent;
            -webkit-text-fill-color: transparent;
            -webkit-text-stroke: 1px var(--title-outline);
            text-stroke: 1px var(--title-outline);
            pointer-events: none;
        }

        @supports (color: oklch(60% 0.2 30)) {
            .main-header h1 {
                --title-outline: oklch(21% 0.035 255 / 0.88);
                --title-red: oklch(58% 0.22 25);
                --title-blue: oklch(55% 0.18 255);
                --title-light: oklch(95% 0.018 250);
            }
        }

        @supports (background: linear-gradient(in oklch, red, blue)) {
            .main-header .title-fill-layer {
                background-image: linear-gradient(100deg in oklch, var(--title-red) 0%, var(--title-blue) 42%, var(--title-light) 55%, var(--title-red) 72%, var(--title-blue) 100%);
            }
        }

        @supports not ((background-clip: text) or (-webkit-background-clip: text)) {
            .main-header .title-fill-layer {
                color: #2563eb;
                -webkit-text-fill-color: #2563eb;
            }
        }
	        .main-header nav {
	            display: flex; align-items: center; gap: var(--space-2); 
	            flex-wrap: nowrap; flex-shrink: 0;
	            scrollbar-width: none; /* Firefox */
	        }
	        .main-header nav::-webkit-scrollbar { display: none; }
            @media (max-width: 640px) {
                .main-header nav {
                    flex-wrap: wrap;
                    overflow-x: visible;
                    justify-content: center;
                    row-gap: var(--space-2);
                    padding-bottom: 0;
                }
            }
	        
	        .main-header nav button { 
            min-height: 44px;
            padding: var(--space-2) var(--space-4); 
            border: 1px solid var(--border-subtle); background: var(--surface); 
            cursor: pointer; border-radius: var(--radius-pill); 
            transition: background var(--motion-duration-micro) var(--motion-ease-standard), border-color var(--motion-duration-micro) var(--motion-ease-standard), color var(--motion-duration-micro) var(--motion-ease-standard), transform var(--motion-duration-micro) var(--motion-ease-standard), box-shadow var(--motion-duration-micro) var(--motion-ease-standard); 
            font-weight: 700; font-size: var(--font-sm); color: var(--text-muted);
            white-space: nowrap;
            flex-shrink: 0;
        }
        @media (max-width: 640px) {
            .main-header nav button { padding: var(--space-2) var(--space-3); font-size: var(--font-xs); }
        }

		        .main-header nav button.simulate-btn,
		        .main-header nav button.supersim-btn,
	        .main-header nav button.reset-btn {
            width: 44px;
            height: 44px;
            padding: 0;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: var(--radius-pill);
            color: var(--text-main);
            border-color: var(--border-strong);
            flex-shrink: 0;
	        }

	        .main-header nav button.live-toggle-btn {
	            display: inline-flex;
	            align-items: center;
	            gap: 7px;
	            color: #075985;
	            background: #e0f2fe;
	            border-color: #bae6fd;
	            padding-left: 14px;
	        }

	        .main-header nav button.live-toggle-btn.live-on {
	            color: #ffffff;
	            background: #0284c7;
	            border-color: #0284c7;
	            box-shadow: var(--shadow-sm);
	        }

	        @media (max-width: 640px) {
	            .main-header nav button.simulate-btn,
	            .main-header nav button.supersim-btn,
            .main-header nav button.reset-btn {
                width: 44px;
                height: 44px;
                min-height: 44px;
            }
            .main-header nav button.live-toggle-btn {
                padding-left: 10px;
            }
        }

	        .main-header nav button.simulate-btn {
            color: var(--success-text);
            background: var(--success-bg);
            border-color: var(--success-border);
        }

        .main-header nav button.supersim-btn {
            color: #b45309;
            background: #fef3c7;
            border-color: #fde68a;
        }

        .main-header nav button.reset-btn {
            color: var(--danger-text);
            background: var(--danger-bg);
            border-color: var(--danger-border);
        }

	        @media (hover: hover) {
	            .main-header nav button:hover { background: var(--surface-muted); border-color: var(--border-strong); transform: translateY(calc(-1 * var(--motion-distance-1))); box-shadow: var(--shadow-sm); color: var(--text-main); }

		            .main-header nav button.live-toggle-btn:hover:not(:disabled) { background: #bae6fd; border-color: #7dd3fc; color: #0c4a6e; }
	            .main-header nav button.live-toggle-btn.live-on:hover:not(:disabled) { background: #0369a1; border-color: #0369a1; color: #ffffff; }
	            .main-header nav button.simulate-btn:hover { background: #dcfce7; border-color: #86efac; color: #052e16; }
	            .main-header nav button.supersim-btn:hover:not(:disabled) { background: #fef08a; border-color: #fcd34d; color: #78350f; }
	            .main-header nav button.reset-btn:hover { background: #ffe4e6; border-color: #fecdd3; color: #be123c; transform: translateY(calc(-1 * var(--motion-distance-1))); }
	        }
        .main-header nav button:active { transform: scale(var(--motion-press-scale)); }
        .main-header nav button.active { background: var(--text-main); color: white; border-color: var(--text-main); box-shadow: var(--shadow-lg); }
        .main-header nav button:disabled { opacity: 0.6; cursor: not-allowed; transform: none !important; box-shadow: none !important; }

        /* Spinner Style */
        .spinner {
            display: inline-block;
            width: 18px;
            height: 18px;
            border: 2.5px solid rgba(120, 53, 15, 0.2);
            border-radius: 50%;
            border-top-color: #78350f;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        /* Compact Mode Global Layout Rules */
        .app-container.compact-mode {
            padding-top: var(--space-2);
            padding-bottom: var(--space-2);
            max-width: 1560px;
        }
	        .compact-mode .main-header {
	            padding-top: var(--space-2);
	            padding-bottom: var(--space-2);
	            margin-bottom: var(--space-4);
	        }

	        .live-score-banner-slot {
	            padding: var(--space-2) 0 var(--space-4);
	        }
	        .live-score-banner {
	            display: flex;
	            align-items: center;
	            justify-content: space-between;
	            gap: var(--space-3);
	            margin: 0;
	            padding: var(--space-3) var(--space-4);
	            border: 1px solid #bae6fd;
	            border-radius: var(--radius-lg);
	            background: #f0f9ff;
	            color: #075985;
	            box-shadow: var(--shadow-sm);
	        }

	        .live-score-banner > div {
	            display: flex;
	            flex-wrap: wrap;
	            align-items: center;
	            gap: var(--space-2);
	            font-size: var(--font-sm);
	        }

	        .live-score-banner strong {
	            font-weight: 850;
	        }

	        .live-score-banner span {
	            font-weight: 650;
	        }

	        .live-score-banner .live-error {
	            color: var(--danger-text);
	        }

	        .live-score-banner .live-warning {
	            flex-basis: 100%;
	            color: #92400e;
	            background: #fffbeb;
	            border: 1px solid #fde68a;
	            border-radius: var(--radius-md);
	            padding: 4px 8px;
	        }

	        .live-score-banner button {
	            min-height: 36px;
	            display: inline-flex;
	            align-items: center;
	            gap: 6px;
	            padding: 0 var(--space-3) 0 10px;
	            border-radius: var(--radius-pill);
	            border: 1px solid #7dd3fc;
	            background: #ffffff;
	            color: #075985;
	            font-weight: 800;
	            cursor: pointer;
	        }

	        .live-score-banner button:disabled {
	            opacity: 0.7;
	            cursor: wait;
	        }

	        .live-score-banner-actions {
	            display: flex;
	            align-items: center;
	            justify-content: flex-end;
	            gap: var(--space-2);
	            flex-wrap: wrap;
	        }

	        .live-score-banner .live-sim-impact-toggle {
	            gap: 8px;
	            border-color: #bae6fd;
	            background: #f8fafc;
	            color: #075985;
	        }

	        .live-score-banner .live-sim-impact-toggle.active {
	            border-color: #38bdf8;
	            background: #eff6ff;
	            color: #075985;
	        }

	        .live-sim-switch-track {
	            position: relative;
	            display: inline-flex;
	            width: 34px;
	            height: 20px;
	            flex: 0 0 auto;
	            align-items: center;
	            border-radius: var(--radius-pill);
	            background: #cbd5e1;
	            box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08);
	            transition: background var(--motion-duration-micro) var(--motion-ease-standard);
	        }

	        .live-sim-switch-thumb {
	            position: absolute;
	            left: 3px;
	            width: 14px;
	            height: 14px;
	            border-radius: 999px;
	            background: #ffffff;
	            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.22);
	            transition: transform var(--motion-duration-micro) var(--motion-ease-standard);
	        }

	        .live-sim-impact-toggle.active .live-sim-switch-track {
	            background: #0284c7;
	        }

	        .live-sim-impact-toggle.active .live-sim-switch-thumb {
	            transform: translateX(14px);
	        }

	        .spinning {
	            animation: spin 1s linear infinite;
	        }

	        @media (max-width: 640px) {
	            .live-score-banner-slot { padding-top: 0; }
	            .live-score-banner {
	                align-items: stretch;
	                flex-direction: column;
	            }
	            .live-score-banner button {
	                justify-content: center;
	            }
	            .live-score-banner-actions {
	                justify-content: stretch;
	            }
	            .live-score-banner-actions button {
	                flex: 1 1 180px;
	            }
	        }

	        .view-panel {
	            animation: viewEnter var(--motion-duration-ui) var(--motion-ease-standard);
	        }
	        .app-footer {
	            display: flex;
	            justify-content: center;
	            align-items: center;
	            gap: var(--space-2);
	            flex-wrap: wrap;
	            margin-top: var(--space-8);
	            padding: var(--space-6) 0 var(--space-2);
	            border-top: 1px solid var(--border-subtle);
	            color: var(--text-muted);
	            font-size: var(--font-sm);
	            font-weight: 650;
	        }
	        .app-footer .tip-jar-link {
	            display: inline-flex;
	            align-items: center;
	            gap: 3px;
	            padding: 5px 9px;
	            border: 1px solid #fecaca;
	            border-radius: var(--radius-pill);
	            background: #fff7f7;
	            color: #b91c1c;
	            font-weight: 850;
	            text-decoration: none;
	        }
	        .app-footer .tip-jar-link:hover,
	        .app-footer .tip-jar-link:focus-visible {
	            border-color: #f87171;
	            background: #fee2e2;
	            outline: none;
	        }
	        .footer-separator { color: var(--border-strong); }
	        .app-footer .footer-site-link {
	            color: var(--text-muted);
	            font-weight: 750;
	            text-decoration: none;
	        }
	        .app-footer .footer-site-link:hover,
	        .app-footer .footer-site-link:focus-visible {
	            color: var(--text-main);
	            text-decoration: underline;
	            outline: none;
	        }
	        .footer-made-in-sf {
	            display: inline-flex;
	            align-items: center;
	            gap: 4px;
	            color: var(--text-muted);
	            font-weight: 750;
	            white-space: nowrap;
	        }
	        .footer-golden-gate {
	            width: 20px;
	            height: 20px;
	            flex: 0 0 auto;
	        }
	        @media (max-width: 640px) {
	            .app-footer { margin-top: var(--space-8); }
	        }
        @keyframes viewEnter {
            from { opacity: 0; transform: translateY(var(--motion-distance-2)); }
            to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
            .view-panel { animation: none; }
            .main-header nav button:hover,
            .main-header nav button:active,
            .main-header nav button.reset-btn:hover { transform: none; }
        }


      `}</style>
        </div>
    );
}

function formatLiveTimestamp(isoTimestamp) {
    return new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit'
    }).format(new Date(isoTimestamp));
}

function GoldenGateBridgeMark() {
    return (
        <svg className="footer-golden-gate" viewBox="0 0 512 512" aria-hidden="true">
            {/* CC0 Golden Gate Bridge vector: SVG Repo, asset 91828. */}
            <path fill="#F15A24" d="M482.966 181.263c-52.018 0-94.339-42.32-94.339-94.339 0-10.402-8.433-18.835-18.835-18.835-.104 0-.205.014-.309.015-.104-.002-.205-.015-.309-.015-10.402 0-18.835 8.433-18.835 18.835 0 52.019-42.321 94.339-94.339 94.339S161.662 139.943 161.662 86.924c0-10.402-8.433-18.835-18.835-18.835-.104 0-.205.014-.309.015-.104-.002-.205-.015-.309-.015-10.402 0-18.835 8.433-18.835 18.835 0 52.019-42.321 94.339-94.339 94.339-10.404 0-18.837 8.433-18.837 18.836s8.433 18.835 18.835 18.835c48.197 0 90.437-25.968 113.482-64.644 23.045 38.675 65.285 64.644 113.482 64.644s90.437-25.968 113.482-64.644c23.045 38.675 65.285 64.644 113.482 64.644 10.402 0 18.835-8.433 18.835-18.835.001-10.402-8.43-18.836-18.832-18.836z" />
            <path fill="#F15A24" d="M478.7 325.632H33.3c-12.758 0-23.101-10.343-23.101-23.101S20.542 279.43 33.3 279.43h445.4c12.758 0 23.101 10.343 23.101 23.101s-10.343 23.101-23.101 23.101z" />
            <path fill="#FBB03B" d="M155.585 443.912h-26.489c-5.443 0-9.857-4.413-9.857-9.857V325.632h46.203v108.424c0 5.443-4.413 9.856-9.857 9.856z" />
            <path fill="#FBB03B" d="M382.905 443.912h-26.489c-5.443 0-9.857-4.413-9.857-9.857V325.632h46.203v108.424c0 5.443-4.413 9.856-9.857 9.856z" />
        </svg>
    );
}

function getCompletedLiveSimulationInputs(state) {
    const fixedGroupScores = pickCompletedLiveScores(state.groupScores);
    const fixedKnockoutScores = pickCompletedLiveScores(state.knockoutScores);
    const fixedKnockoutPicks = {};

    Object.keys(fixedKnockoutScores).forEach(matchId => {
        const winnerId = state.knockoutPicks[matchId];
        if (winnerId) fixedKnockoutPicks[matchId] = winnerId;
    });

    return {
        totalCompleted: Object.keys(fixedGroupScores).length + Object.keys(fixedKnockoutScores).length,
        options: {
            fixedGroupScores,
            fixedKnockoutScores,
            fixedKnockoutPicks
        }
    };
}

function pickCompletedLiveScores(scores = {}) {
    return Object.fromEntries(
        Object.entries(scores).filter(([, score]) =>
            score?.source === 'live'
            && score.completed === true
            && Number.isFinite(score.home)
            && Number.isFinite(score.away)
        )
    );
}
