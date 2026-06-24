export function completedLiveFinalsChanged(currentState = {}, incomingPayload = {}) {
    return getCompletedLiveFinalSignature({
        groupScores: currentState.groupScores,
        knockoutScores: currentState.knockoutScores,
        knockoutPicks: currentState.knockoutPicks
    }) !== getCompletedLiveFinalSignature({
        groupScores: incomingPayload.groupScores,
        knockoutScores: incomingPayload.knockoutScores,
        knockoutPicks: incomingPayload.knockoutPicks
    });
}

export function getCompletedLiveFinalSignature({ groupScores = {}, knockoutScores = {}, knockoutPicks = {} } = {}) {
    return [
        ...getCompletedScoreParts('G', groupScores),
        ...getCompletedScoreParts('K', knockoutScores, knockoutPicks)
    ].sort().join('|');
}

export function mergeIncomingLiveScores(existingScores = {}, incomingScores = {}) {
    return {
        ...Object.fromEntries(
            Object.entries(existingScores).filter(([, score]) => score?.source !== 'live')
        ),
        ...incomingScores
    };
}

export function hasSimulationResults(state = {}) {
    return Boolean(state.simulationCount || state.superSimStats);
}

function getCompletedScoreParts(prefix, scores = {}, picks = {}) {
    return Object.entries(scores)
        .filter(([, score]) => score?.source === 'live' && score.completed === true)
        .map(([matchId, score]) => [
            prefix,
            matchId,
            score.home,
            score.away,
            score.homePens ?? '',
            score.awayPens ?? '',
            picks[matchId] || ''
        ].join(':'));
}
