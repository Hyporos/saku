const MAX_LEVEL = 100;

// Create an array of 100 levels with increasing EXP requirements
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

// This module exports a function to get the required EXP for a given level
module.exports = {
    getRequiredExp: (level) => LEVELS[level - 1]?.requiredExp ?? Infinity,
};
