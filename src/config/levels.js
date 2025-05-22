/**
 * Level progression where each level requires increasingly more EXP:
 * Level 1: 75 EXP
 * Level 2: 175 EXP
 * Level 3: 275 EXP
 * Level 4: 375 EXP
 * Each level requires 100 more EXP than previous
 */

const MAX_LEVEL = 100;

function generateLevels() {
    const levels = [];
    let increment = 75; // Starting EXP for level 1
    
    for (let i = 0; i < MAX_LEVEL; i++) {
        levels.push({
            level: i + 1,
            requiredExp: increment
        });
        
        increment += 100;
    }
    
    return levels;
}

const LEVELS = generateLevels();

// ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ //

module.exports = {
    getRequiredExp: (level) => LEVELS[level - 1]?.requiredExp ?? Infinity,
};
