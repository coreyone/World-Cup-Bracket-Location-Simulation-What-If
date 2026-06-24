
import { compareThirdPlaceTeams } from './engine';
import thirdPlaceTable from '../data/thirdPlaceTable.json';

// This logic aims to map the set of 8 qualifying groups to the 8 bracket slots.
// Slots: 74, 77, 79, 80, 81, 82, 85, 87 (based on schedule.json)

const SLOTS = [
    { id: 74, options: ["A", "B", "C", "D", "F"] },
    { id: 77, options: ["C", "D", "F", "G", "H"] },
    { id: 79, options: ["C", "E", "F", "H", "I"] },
    { id: 80, options: ["E", "H", "I", "J", "K"] },
    { id: 81, options: ["B", "E", "F", "I", "J"] },
    { id: 82, options: ["A", "E", "H", "I", "J"] },
    { id: 85, options: ["E", "F", "G", "I", "J"] },
    { id: 87, options: ["D", "E", "I", "J", "L"] }
];

/**
 * Assigns qualifying 3rd place teams to slots.
 * @param {Array} qualifiedTeams - Array of 8 team objects (must include .group)
 * @returns {Object} Map of matchId -> team
 */
export function assignThirdPlaceSpots(qualifiedTeams) {
    if (!qualifiedTeams || qualifiedTeams.length !== 8) return {};
    const rankedQualifiedTeams = sortThirdPlaceTeams(qualifiedTeams);

    // 1. Sort groups alphabetically to form a key (e.g., "ABCDEFGH")
    const groups = rankedQualifiedTeams.map(t => t.group).sort();
    const key = groups.join("");

    // 2. Check if 'thirdPlaceTable.json' has this key
    const mapping = thirdPlaceTable[key];
    if (mapping) {
        const assignment = {};
        Object.entries(mapping).forEach(([matchId, groupLetter]) => {
            const team = rankedQualifiedTeams.find(t => t.group === groupLetter);
            if (team) {
                assignment[matchId] = team;
            }
        });
        return assignment;
    }

    // Fallback: backtracking solver to find a valid assignment if not found in table
    const assignment = {};
    const usedGroups = new Set();

    // We need to match 8 teams to 8 slots such that every team fits their slot's options.

    function solve(slotIndex) {
        if (slotIndex >= SLOTS.length) return true; // All assigned

        const slot = SLOTS[slotIndex];

        // Try each qualified team that hasn't been used
        for (let team of rankedQualifiedTeams) {
            if (!usedGroups.has(team.group)) {
                if (slot.options.includes(team.group)) {
                    // Try assigning
                    assignment[slot.id] = team;
                    usedGroups.add(team.group);

                    if (solve(slotIndex + 1)) return true;

                    // Backtrack
                    delete assignment[slot.id];
                    usedGroups.delete(team.group);
                }
            }
        }
        return false;
    }

    if (solve(0)) {
        return assignment;
    } else {
        console.warn("Could not find valid 3rd place assignment for:", key);
        // Fallback: Assign purely by order (invalid but keeps app running)
        const fallback = {};
        SLOTS.forEach((s, i) => {
            fallback[s.id] = rankedQualifiedTeams[i];
        });
        return fallback;
    }
}

function sortThirdPlaceTeams(teams) {
    return [...teams].sort(compareThirdPlaceTeams);
}
