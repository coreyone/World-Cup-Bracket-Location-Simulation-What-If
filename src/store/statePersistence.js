const PERSISTED_RECORD_KEYS = [
    'groupScores',
    'groupOverrides',
    'knockoutPicks',
    'knockoutScores',
    'groupFixtureMeta'
];

export function mergeSavedState(baseState, savedState = {}) {
    const savedUserState = isRecord(savedState) ? savedState : {};
    const persistedRecords = Object.fromEntries(PERSISTED_RECORD_KEYS.map(key => [
        key,
        isRecord(savedUserState[key]) ? savedUserState[key] : baseState[key]
    ]));

    return {
        ...baseState,
        ...persistedRecords,
        manualThirdPlaceGroups: isStringArrayOrNull(savedUserState.manualThirdPlaceGroups)
            ? savedUserState.manualThirdPlaceGroups
            : baseState.manualThirdPlaceGroups,
        simulationCount: safeSimulationCount(savedUserState.simulationCount, baseState.simulationCount),
        compactMode: true,
        liveScoresEnabled: false,
        liveSimulationEnabled: true,
        liveScoreMeta: baseState.liveScoreMeta,
        preLiveState: null
    };
}

function isRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isStringArrayOrNull(value) {
    return value === null || (Array.isArray(value) && value.every(item => typeof item === 'string'));
}

function safeSimulationCount(value, fallback) {
    if (!Number.isInteger(value) || value < 0 || value > 1_000_000) return fallback;
    return value;
}
