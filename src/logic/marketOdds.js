import vegasOddsData from '../data/vegasOdds.json';

const FIELD_TITLE_PROBABILITY = 1 / (vegasOddsData.baselineFieldSize || 48);
const MARKET_STRENGTH_SCALE = 45;

export function americanOddsToProbability(americanOdds) {
    if (!Number.isFinite(americanOdds) || americanOdds === 0) return null;
    if (americanOdds > 0) return 100 / (americanOdds + 100);
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
}

export function probabilityToAmericanOdds(probability) {
    if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) return null;
    if (probability > 0.5) return -Math.round((probability / (1 - probability)) * 100);
    return Math.round(((1 - probability) / probability) * 100);
}

export function formatAmericanOdds(americanOdds) {
    if (!Number.isFinite(americanOdds)) return 'N/A';
    return americanOdds > 0 ? `+${americanOdds}` : `${americanOdds}`;
}

export function getMarketOddsProfile(teamId) {
    const profile = vegasOddsData.teams[teamId];
    if (!profile) return null;

    const impliedProbability = americanOddsToProbability(profile.americanOdds);
    return {
        ...profile,
        impliedProbability,
        formattedOdds: formatAmericanOdds(profile.americanOdds),
        asOf: vegasOddsData.asOf
    };
}

export function getMarketStrengthAdjustment(team, context = {}) {
    if (!team?.id) return 0;

    const profile = getMarketOddsProfile(team.id);
    if (!profile?.impliedProbability) return 0;

    const titleSignal = Math.log(profile.impliedProbability / FIELD_TITLE_PROBABILITY) * MARKET_STRENGTH_SCALE;
    const boundedSignal = clamp(titleSignal, -25, 100);
    const phaseMultiplier = context.phase === 'group'
        ? 0.32
        : 0.72 + (context.roundDepth || 0) * 0.1;

    return boundedSignal * phaseMultiplier;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
