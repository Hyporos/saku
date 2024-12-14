/**
 * Level progression where each level requires increasingly more XP:
 * Level 1: 75 XP
 * Level 2: 175 XP
 * Level 3: 275 XP
 * Level 4: 375 XP
 * Each level requires 100 more XP than previous
 */

const MAX_LEVEL = 100;

function generateLevels() {
    const levels = [];
    let increment = 75;
    
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

module.exports = {
    getRequiredExp: (level) => LEVELS[level - 1]?.requiredExp ?? Infinity,
};
