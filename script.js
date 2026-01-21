// Ant Colony Simulator Game Logic

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.resources = {
            coins: 1000,
            food: 500,
            water: 100,
            ants: 1,
            dirt: 0
        };
        this.colony = new Colony();
        this.map = new Map(50, 50); // 50x50 grid
        this.enemies = [];
        this.particles = [];
        this.gameLoop = null;
        this.isPaused = false;
        this.level = 1;
        this.enemiesKilled = 0;
        this.totalCoinsEarned = 0;
        this.gameTime = 0;
        this.upgrades = {
            antSpeed: 0,
            antHealth: 0,
            antDamage: 0,
            colonySize: 0,
            gatherEfficiency: 0,
            waterEfficiency: 0
        };
        this.maxTunnels = 50;
        this.tunnelsDug = 0;
        this.achievements = {};
        this.settings = {
            soundEnabled: true,
            particlesEnabled: true,
            autoSave: true
        };
        this.loadGame();
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.startGameLoop();
        this.updateUI();
        this.logMessage("Welcome to Ant Colony Simulator! Start by digging tunnels and gathering food.");
    }

    setupEventListeners() {
        document.getElementById('dig-button').addEventListener('click', () => this.digTunnel());
        document.getElementById('gather-button').addEventListener('click', () => this.gatherFood());
        document.getElementById('gather-water-button').addEventListener('click', () => this.gatherWater());
        document.getElementById('spawn-ant-button').addEventListener('click', () => this.spawnAnt());
        document.getElementById('upgrade-button').addEventListener('click', () => this.showUpgrades());
        document.getElementById('pause-button').addEventListener('click', () => this.togglePause());
        document.getElementById('save-button').addEventListener('click', () => this.saveGame());
        document.getElementById('reset-button').addEventListener('click', () => this.resetGame());
        document.getElementById('guide-button').addEventListener('click', () => this.showGuide());

        // Keyboard controls
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));

        // Mouse controls
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
    }

    handleKeyPress(e) {
        const moveSpeed = 5;
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
            this.colony.ants[0].targetY -= moveSpeed;
        } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
            this.colony.ants[0].targetY += moveSpeed;
        } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
            this.colony.ants[0].targetX -= moveSpeed;
        } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
            this.colony.ants[0].targetX += moveSpeed;
        } else if (e.key === ' ') {
            e.preventDefault();
            this.gatherFood();
        }
    }

    handleCanvasClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check if clicked on an enemy
        let clickedEnemy = null;
        for (let enemy of this.enemies) {
            if (this.isColliding({x: x, y: y}, enemy)) {
                clickedEnemy = enemy;
                break;
            }
        }

        if (clickedEnemy) {
            // Set all ants to attack this enemy
            this.colony.ants.forEach(ant => {
                ant.targetX = clickedEnemy.x;
                ant.targetY = clickedEnemy.y;
                ant.targetEnemy = clickedEnemy;
            });
        } else {
            // Default behavior: move first ant to clicked position
            this.colony.ants[0].targetX = x;
            this.colony.ants[0].targetY = y;
            this.colony.ants[0].targetEnemy = null;
        }
    }

    startGameLoop() {
        this.gameLoop = setInterval(() => {
            this.update();
            this.draw();
        }, 1000 / 60); // 60 FPS
    }

    update() {
        if (!this.isPaused) {
            this.gameTime += 1/60; // Increment game time
            this.colony.update();
            // Water depletion: each ant consumes 0.1 water per second
            const waterDepletion = this.resources.ants * 0.1 / 60; // Per frame
            this.resources.water = Math.max(0, this.resources.water - waterDepletion);
            this.updateEnemies();
            this.updateParticles();
            this.checkCollisions();
            this.checkAchievements();
            this.autoSave();
        }
        this.updateUI();
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.map.draw(this.ctx);
        this.colony.draw(this.ctx);
        this.drawEnemies();
        this.drawParticles();
        this.drawUI();
    }

    digTunnel() {
        if (this.tunnelsDug >= this.maxTunnels) {
            this.logMessage(`Maximum tunnel limit reached! (${this.maxTunnels} tunnels max)`);
            return;
        }
        if (this.resources.dirt >= 10) {
            this.resources.dirt -= 10;
            this.map.digRandomTunnel();
            this.tunnelsDug++;
            this.logMessage(`Tunnel dug! Colony expanded. (${this.tunnelsDug}/${this.maxTunnels} tunnels)`);
        } else {
            this.logMessage("Not enough dirt to dig a tunnel.");
        }
    }

    gatherFood() {
        // Base 30% success rate, boosted by gatherEfficiency upgrade
        const baseChance = 0.3;
        const efficiencyBonus = this.upgrades.gatherEfficiency * 0.1; // 10% bonus per level
        const successChance = Math.min(0.95, baseChance + efficiencyBonus); // Cap at 95%

        if (Math.random() < successChance) {
            // Gather more food with higher efficiency
            const foodAmount = 1 + Math.floor(this.upgrades.gatherEfficiency * 0.5); // +0.5 food per level
            this.resources.food += foodAmount;
            this.logMessage(`Food gathered! (+${foodAmount})`);
        } else {
            this.logMessage("No food found this time.");
        }
    }

    gatherWater() {
        // Always successful for better gameplay
        const waterAmount = 10 + Math.floor(this.upgrades.waterEfficiency * 2.5); // Base 10, +2.5 water per level
        this.resources.water += waterAmount;
        this.logMessage(`Water gathered! (+${waterAmount})`);
    }

    getMaxAnts() {
        const baseMaxAnts = 5 + Math.floor(this.level * 2); // Level 1: 7 max, Level 2: 9 max, etc.
        const upgradeBonus = Math.floor(this.upgrades.colonySize * 3); // +3 ants per colony size level
        return baseMaxAnts + upgradeBonus;
    }

    spawnAnt() {
        // Now requires food instead of coins for spawning ants
        const foodCost = 10;
        // Maximum ants increases with level (base 5 + level bonus) + colony size upgrade bonus
        const maxAnts = this.getMaxAnts();

        if (this.resources.ants >= maxAnts) {
            this.logMessage(`Maximum ant limit reached for level ${this.level}! (${maxAnts} ants max)`);
            return;
        }

        if (this.resources.food >= foodCost) {
            this.resources.food -= foodCost;
            this.resources.ants++;
            const newAnt = this.colony.addAnt();
            this.logMessage(`New ${newAnt.rarity} ant spawned for ${foodCost} food! (${this.resources.ants}/${maxAnts} ants)`);
        } else {
            this.logMessage(`Not enough food to spawn an ant. Need ${foodCost} food.`);
        }
    }

    updateEnemies() {
        // Base spawn rates increase with level for progressive difficulty, but slower at high levels
        const baseEnemyChance = 0.005 * Math.log(this.level + 1); // Slower growth: level 20 = ~0.04 (4% chance)
        const smallBossChance = 0.0008 * Math.sqrt(this.level); // Increased base rate for more formidable encounters
        const largeBossChance = 0.00015 * Math.log(this.level + 1); // Increased base rate for more formidable encounters

        if (Math.random() < baseEnemyChance) { // Chance increases logarithmically
            const rarity = this.getRandomEnemyRarity();
            const enemy = new Enemy(Math.random() * this.canvas.width, 0, rarity);
            this.enemies.push(enemy);
        } else if (Math.random() < smallBossChance) { // Chance increases with sqrt(level)
            const boss = new Boss(Math.random() * this.canvas.width, 0, 'small');
            this.enemies.push(boss);
        } else if (Math.random() < largeBossChance) { // Chance increases very slowly
            const boss = new Boss(Math.random() * this.canvas.width, 0, 'large');
            this.enemies.push(boss);
        }
        this.enemies.forEach(enemy => enemy.update());
        this.enemies = this.enemies.filter(enemy => enemy.y < this.canvas.height);
    }

    drawEnemies() {
        this.enemies.forEach(enemy => enemy.draw(this.ctx));
    }

    checkCollisions() {
        // Simple collision detection between ants and enemies
        this.colony.ants.forEach(ant => {
            this.enemies.forEach(enemy => {
                if (this.isColliding(ant, enemy)) {
                    const antDamage = ant.specialty === 'Warrior' ? ant.damage * 1.5 : ant.damage; // Warriors deal more damage

                    // CHEATER BONUS: Enemy damage reduction based on antDamage upgrades
                    const damageReduction = Math.min(0.8, this.upgrades.antDamage * 0.1); // Up to 80% damage reduction
                    const reducedEnemyDamage = enemy.damage * (1 - damageReduction);

                    if (!ant.isInvincible) {
                        ant.health -= reducedEnemyDamage;
                    }
                    enemy.health -= antDamage;
                    if (ant.health <= 0) {
                        this.resources.ants--;
                        this.colony.removeAnt(ant);
                    }
                    if (enemy.health <= 0) {
                        this.enemies.splice(this.enemies.indexOf(enemy), 1);
                        this.resources.food += 2; // Reduced food reward
                        this.resources.dirt += 3; // Add dirt for tunneling
                        this.enemiesKilled++;

                        // Coin rewards based on enemy rarity and ant rarity
                        let baseCoins = 0;
                        switch(enemy.rarity) {
                            case 'common': baseCoins = 5; break;
                            case 'rare': baseCoins = 10; break;
                            case 'epic': baseCoins = 20; break;
                            case 'legendary': baseCoins = 50; break;
                            case 'mythic': baseCoins = 100; break;
                        }

                        // If it's a boss, give extra coins
                        if (enemy instanceof Boss) {
                            baseCoins = enemy.size === 'small' ? 200 : 500;
                        }

                        // Rarer ants get more coins
                        let antMultiplier = 1;
                        switch(ant.rarity) {
                            case 'common': antMultiplier = 1; break;
                            case 'rare': antMultiplier = 1.5; break;
                            case 'epic': antMultiplier = 2; break;
                            case 'legendary': antMultiplier = 3; break;
                            case 'mythic': antMultiplier = 5; break;
                        }

                        // CHEATER BONUS: Extra coin multiplier from speed upgrades
                        const speedCoinBonus = 1 + (this.upgrades.antSpeed * 0.2); // 20% more coins per speed level
                        const coinsEarned = Math.floor(baseCoins * antMultiplier * speedCoinBonus);

                        this.resources.coins += coinsEarned;
                        this.totalCoinsEarned += coinsEarned;
                        this.createParticle(enemy.x, enemy.y, '#FFD700', 'coin'); // Gold coin particle
                        this.logMessage(`Earned ${coinsEarned} coins from defeating ${enemy.rarity} enemy!`);

                        // Level up every 10 kills
                        if (this.enemiesKilled % 10 === 0) {
                            this.level++;
                            this.logMessage(`Level up! Now level ${this.level}!`);
                        }
                    }
                }
            });
        });

        // Dehydration damage: ants take damage when water is depleted
        if (this.resources.water <= 0) {
            this.colony.ants.forEach(ant => {
                if (!ant.isInvincible) {
                    ant.health -= 1; // 1 damage per frame from dehydration
                    if (ant.health <= 0) {
                        this.resources.ants--;
                        this.colony.removeAnt(ant);
                        this.logMessage("An ant died from dehydration!");
                    }
                }
            });
        }
    }

    isColliding(obj1, obj2) {
        return Math.abs(obj1.x - obj2.x) < 20 && Math.abs(obj1.y - obj2.y) < 20;
    }

    updateUI() {
        document.getElementById('coins-count').textContent = this.resources.coins;
        document.getElementById('food-count').textContent = this.resources.food;
        document.getElementById('water-count').textContent = this.resources.water;
        document.getElementById('ant-count').textContent = this.resources.ants;
        document.getElementById('dirt-count').textContent = this.resources.dirt;
    }

    getRandomEnemyRarity() {
        const levelShift = Math.floor((this.level - 1) / 10); // Increases every 10 levels
        const mythicThreshold = Math.min(10, 1 + levelShift * 2); // Max 10%
        const legendaryThreshold = Math.min(20, 5 + levelShift * 3); // Max 20%
        const epicThreshold = Math.min(40, 20 + levelShift * 5); // Max 40%
        const rareThreshold = Math.min(70, 50 + levelShift * 5); // Max 70%
        // Common gets the rest

        const rand = Math.floor(Math.random() * 100);
        if (rand < mythicThreshold) return 'mythic';
        if (rand < legendaryThreshold) return 'legendary';
        if (rand < epicThreshold) return 'epic';
        if (rand < rareThreshold) return 'rare';
        return 'common';
    }

    loadGame() {
        const savedGame = localStorage.getItem('antColonySave');
        if (savedGame) {
            const data = JSON.parse(savedGame);
            this.resources = data.resources || this.resources;
            this.upgrades = data.upgrades || this.upgrades;
            this.achievements = data.achievements || this.achievements;
            this.level = data.level || this.level;
            this.enemiesKilled = data.enemiesKilled || this.enemiesKilled;
            this.totalCoinsEarned = data.totalCoinsEarned || this.totalCoinsEarned;
            this.gameTime = data.gameTime || this.gameTime;
            // Ensure minimum starting food
            this.resources.food = Math.max(this.resources.food, 500);
            this.logMessage("Game loaded successfully!");
        }
    }

    saveGame() {
        const saveData = {
            resources: this.resources,
            upgrades: this.upgrades,
            achievements: this.achievements,
            level: this.level,
            enemiesKilled: this.enemiesKilled,
            totalCoinsEarned: this.totalCoinsEarned,
            gameTime: this.gameTime,
            timestamp: Date.now()
        };
        localStorage.setItem('antColonySave', JSON.stringify(saveData));
    }

    resetGame() {
        // Clear saved game data
        localStorage.removeItem('antColonySave');

        // Reset all game state to initial values
        this.resources = {
            coins: 1000,
            food: 500,
            water: 100,
            ants: 1,
            dirt: 0
        };
        this.colony = new Colony();
        this.map = new Map(50, 50);
        this.enemies = [];
        this.particles = [];
        this.isPaused = false;
        this.level = 1;
        this.enemiesKilled = 0;
        this.totalCoinsEarned = 0;
        this.gameTime = 0;
        this.upgrades = {
            antSpeed: 0,
            antHealth: 0,
            antDamage: 0,
            colonySize: 0,
            gatherEfficiency: 0
        };
        this.achievements = {};

        // Update UI and log message
        this.updateUI();
        this.logMessage("Game reset! Starting fresh.");
    }

    autoSave() {
        if (this.settings.autoSave && Math.floor(this.gameTime) % 60 === 0) { // Auto-save every minute
            this.saveGame();
        }
    }

    updateParticles() {
        this.particles.forEach(particle => particle.update());
        this.particles = this.particles.filter(particle => particle.life > 0);
    }

    drawParticles() {
        if (this.settings.particlesEnabled) {
            this.particles.forEach(particle => particle.draw(this.ctx));
        }
    }

    drawUI() {
        // Draw level and stats on canvas
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '16px Arial';
        this.ctx.fillText(`Level: ${this.level}`, 10, 30);
        this.ctx.fillText(`Enemies Killed: ${this.enemiesKilled}`, 10, 50);
        this.ctx.fillText(`Time: ${Math.floor(this.gameTime)}s`, 10, 70);

        // Draw pause overlay if paused
        if (this.isPaused) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = '48px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('PAUSED', this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.textAlign = 'left';
        }
    }

    checkAchievements() {
        // First Kill
        if (this.enemiesKilled >= 1 && !this.achievements.firstKill) {
            this.achievements.firstKill = true;
            this.logMessage("Achievement Unlocked: First Blood! +100 coins");
            this.resources.coins += 100;
        }

        // 100 Kills
        if (this.enemiesKilled >= 100 && !this.achievements.centurion) {
            this.achievements.centurion = true;
            this.logMessage("Achievement Unlocked: Centurion! +500 coins");
            this.resources.coins += 500;
        }

        // Millionaire
        if (this.totalCoinsEarned >= 1000000 && !this.achievements.millionaire) {
            this.achievements.millionaire = true;
            this.logMessage("Achievement Unlocked: Millionaire! +10000 coins");
            this.resources.coins += 10000;
        }

        // Hydrated Colony: Maintain water for 5 minutes
        if (this.gameTime >= 300 && !this.achievements.hydratedColony) { // 5 minutes = 300 seconds
            this.achievements.hydratedColony = true;
            this.logMessage("Achievement Unlocked: Hydrated Colony! +2000 coins");
            this.resources.coins += 2000;
        }

        // Time-based achievements
        if (this.gameTime >= 3600 && !this.achievements.hourPlayed) { // 1 hour
            this.achievements.hourPlayed = true;
            this.logMessage("Achievement Unlocked: Dedicated Player! +1000 coins");
            this.resources.coins += 1000;
        }
    }

    createParticle(x, y, color, type = 'coin') {
        if (this.settings.particlesEnabled) {
            this.particles.push(new Particle(x, y, color, type));
        }
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        document.getElementById('pause-button').textContent = this.isPaused ? 'Resume' : 'Pause';
        this.logMessage(this.isPaused ? 'Game paused' : 'Game resumed');
    }

    showUpgrades() {
        const upgradeList = Object.keys(this.upgrades).map(key => {
            const cost = Math.floor(100 * Math.pow(1.5, this.upgrades[key]));
            return `${key}: Level ${this.upgrades[key]} (Cost: ${cost} coins)`;
        }).join('\n');
        alert(`Available Upgrades:\n${upgradeList}\n\nClick OK to purchase all affordable upgrades.`);
        // Simple upgrade purchase logic
        Object.keys(this.upgrades).forEach(key => {
            const cost = Math.floor(100 * Math.pow(1.5, this.upgrades[key]));
            if (this.resources.coins >= cost) {
                this.resources.coins -= cost;
                this.upgrades[key]++;
                this.applyUpgrades();
                this.logMessage(`${key} upgraded to level ${this.upgrades[key]}!`);
            }
        });
    }

    applyUpgrades() {
        // Apply CHEATER-LEVEL upgrade effects to ants and game mechanics
        this.colony.ants.forEach(ant => {
            // Exponential growth for stats - much more powerful, but capped to prevent bugs
            ant.speed = ant.baseSpeed * Math.min(100, Math.pow(1.25, this.upgrades.antSpeed)); // 25% bonus per level, max 100x
            ant.health = ant.baseHealth * Math.min(100, Math.pow(1.3, this.upgrades.antHealth)); // 30% bonus per level, max 100x
            ant.damage = ant.baseDamage * Math.min(100, Math.pow(1.35, this.upgrades.antDamage)); // 35% bonus per level, max 100x

            // CHEATER BONUS: Health regeneration
            if (this.upgrades.antHealth > 0) {
                ant.health = Math.min(ant.maxHealth, ant.health + this.upgrades.antHealth * 0.5); // Regenerate 0.5 HP per health upgrade level per frame
            }
        });

        // CHEATER BONUS: Auto-gathering food
        if (this.upgrades.gatherEfficiency > 0 && Math.random() < 0.01 * this.upgrades.gatherEfficiency) {
            this.resources.food += Math.floor(this.upgrades.gatherEfficiency * 0.2); // Auto-gather food occasionally
        }

        // CHEATER BONUS: Auto-spawning ants
        if (this.upgrades.colonySize > 0 && Math.random() < 0.005 * this.upgrades.colonySize && this.resources.food >= 5) {
            this.resources.food -= 5; // Reduced cost for auto-spawn
            this.resources.ants++;
            const newAnt = this.colony.addAnt();
            this.logMessage(`Auto-spawned ${newAnt.rarity} ant! (${this.resources.ants} total)`);
        }

        // CHEATER BONUS: Enemy damage reduction
        if (this.upgrades.antDamage > 0) {
            // This is applied in checkCollisions method - enemies deal less damage
        }

        // CHEATER BONUS: Extra coin multiplier
        if (this.upgrades.antSpeed > 0) {
            // Speed upgrades also give coin bonuses (applied in checkCollisions)
        }
    }

    showGuide() {
        this.isPaused = true;
        document.getElementById('pause-button').textContent = 'Resume';
        const guideDiv = document.getElementById('guide');
        guideDiv.style.display = 'block';
        guideDiv.style.position = 'fixed';
        guideDiv.style.top = '50%';
        guideDiv.style.left = '50%';
        guideDiv.style.transform = 'translate(-50%, -50%)';
        guideDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        guideDiv.style.color = '#f4e4bc';
        guideDiv.style.padding = '20px';
        guideDiv.style.borderRadius = '10px';
        guideDiv.style.zIndex = '1000';
        guideDiv.style.maxWidth = '700px';
        guideDiv.style.maxHeight = '80vh';
        guideDiv.style.overflowY = 'auto';
        guideDiv.style.textAlign = 'left';
        guideDiv.innerHTML = `
            <h3 style="text-align: center; color: #d4af37;">Ant Colony Simulator - Complete Guide</h3>

            <h4 style="color: #d4af37;">Objective</h4>
            <p>Build and manage a thriving ant colony! Gather resources, expand your tunnels, spawn specialized ants, upgrade your colony, and defend against increasingly difficult enemies and bosses. Survive as long as possible and unlock achievements.</p>

            <h4 style="color: #d4af37;">Resources</h4>
            <ul>
                <li><strong>Coins:</strong> Earned by defeating enemies. Used for upgrades.</li>
                <li><strong>Food:</strong> Required to spawn new ants. Gathered manually or by Gatherer ants.</li>
                <li><strong>Water:</strong> Required for ant survival. Ants consume water over time and die from dehydration if depleted.</li>
                <li><strong>Ants:</strong> Your colony members. Each has unique abilities based on rarity.</li>
                <li><strong>Dirt:</strong> Earned by defeating enemies. Required to dig tunnels.</li>
            </ul>

            <h4 style="color: #d4af37;">Controls</h4>
            <ul>
                <li><strong>Arrow keys or WASD:</strong> Move the main ant</li>
                <li><strong>Spacebar:</strong> Gather food</li>
                <li><strong>Mouse click on canvas:</strong> Move ant to position or attack clicked enemy</li>
                <li><strong>Buttons:</strong> Dig tunnels, gather food, spawn ants, view upgrades, pause/resume, save/load, reset game</li>
            </ul>

            <h4 style="color: #d4af37;">Ants and Rarities</h4>
            <p>Ants come in different rarities with unique stats and abilities:</p>
            <ul>
                <li><strong>Common (Black):</strong> Basic worker ants</li>
                <li><strong>Rare (Silver):</strong> Faster Gatherers that find extra food</li>
                <li><strong>Epic (Violet):</strong> Warriors with increased damage</li>
                <li><strong>Legendary (Gold):</strong> Queens with superior stats</li>
                <li><strong>Mythic (Red):</strong> Ultimate ants with all abilities</li>
            </ul>
            <p>Ants automatically target nearby enemies and gain damage buffs when entering tunnels.</p>

            <h4 style="color: #d4af37;">Enemies and Bosses</h4>
            <p>Enemies spawn from the top and move downward. Rarity affects their stats:</p>
            <ul>
                <li><strong>Common (Red):</strong> Basic enemies</li>
                <li><strong>Rare (Orange):</strong> Stronger enemies</li>
                <li><strong>Epic (Yellow):</strong> Very tough enemies</li>
                <li><strong>Legendary (Green):</strong> Elite enemies</li>
                <li><strong>Mythic (Blue):</strong> Powerful enemies</li>
            </ul>
            <p><strong>Bosses:</strong> Special mythic enemies that appear rarely:</p>
            <ul>
                <li><strong>Small Boss (Purple):</strong> 500 HP, slow but damaging</li>
                <li><strong>Large Boss (Black):</strong> 1000 HP, very slow but extremely damaging</li>
            </ul>

            <h4 style="color: #d4af37;">Tunnels</h4>
            <p>Dig tunnels to expand your colony. Each tunnel costs 10 dirt.</p>
            <ul>
                <li>Maximum of 50 tunnels per game</li>
                <li>Ants stop for 2 seconds when entering tunnels, then gain x2 damage for 60 seconds</li>
                <li>Tunnels are visible as dug areas on the map</li>
            </ul>

            <h4 style="color: #d4af37;">Upgrades</h4>
            <p>Use coins to upgrade various aspects of your colony:</p>
            <ul>
                <li><strong>Ant Speed:</strong> Increases movement speed and coin rewards</li>
                <li><strong>Ant Health:</strong> Boosts HP and adds regeneration</li>
                <li><strong>Ant Damage:</strong> Increases attack power and reduces enemy damage</li>
                <li><strong>Colony Size:</strong> Allows more ants and auto-spawning</li>
                <li><strong>Gather Efficiency:</strong> Improves food gathering success and auto-gathering</li>
            </ul>

            <h4 style="color: #d4af37;">Levels and Progression</h4>
            <ul>
                <li>Gain levels by defeating enemies (every 10 kills)</li>
                <li>Higher levels increase enemy spawn rates and rarities</li>
                <li>Maximum ants increase with level</li>
            </ul>

            <h4 style="color: #d4af37;">Achievements</h4>
            <ul>
                <li><strong>First Blood:</strong> Defeat your first enemy (+100 coins)</li>
                <li><strong>Centurion:</strong> Defeat 100 enemies (+500 coins)</li>
                <li><strong>Millionaire:</strong> Earn 1,000,000 total coins (+10,000 coins)</li>
                <li><strong>Dedicated Player:</strong> Play for 1 hour (+1,000 coins)</li>
            </ul>

            <h4 style="color: #d4af37;">Game Mechanics</h4>
            <ul>
                <li><strong>Auto-Save:</strong> Game saves automatically every minute</li>
                <li><strong>Particles:</strong> Visual effects for coins and other events</li>
                <li><strong>Auto-Targeting:</strong> Ants automatically attack nearby enemies</li>
                <li><strong>Specialty Effects:</strong> Different ant types have unique abilities</li>
            </ul>

            <h4 style="color: #d4af37;">Tips for Success</h4>
            <ul>
                <li>Focus on gathering food early to build your colony</li>
                <li>Dig tunnels strategically to create safe zones</li>
                <li>Upgrade damage and health to survive higher levels</li>
                <li>Use mouse clicks to quickly target threats</li>
                <li>Save regularly and manage your resources wisely</li>
            </ul>

            <h4 style="color: #d4af37;">Codes</h4>
            <p>Enter a code to redeem special rewards:</p>
            <input type="text" id="code-input" style="width: 100%; padding: 5px; margin-bottom: 10px; border-radius: 5px; border: none; background-color: #f4e4bc; color: #2c1810;" placeholder="Enter code here">
            <button id="redeem-code-button" style="padding: 10px 20px; background-color: #8b4513; color: #f4e4bc; border: none; border-radius: 5px; cursor: pointer;">Redeem Code</button>

            <div style="text-align: center; margin-top: 20px;">
                <button id="close-guide-button" style="padding: 10px 20px; background-color: #8b4513; color: #f4e4bc; border: none; border-radius: 5px; cursor: pointer;">Close Guide</button>
            </div>
        `;
        document.getElementById('close-guide-button').addEventListener('click', () => {
            guideDiv.style.display = 'none';
            this.isPaused = false;
            document.getElementById('pause-button').textContent = 'Pause';
        });
        document.getElementById('redeem-code-button').addEventListener('click', () => this.redeemCode());
        this.logMessage("Game paused to show guide");
    }

    redeemCode() {
        const code = document.getElementById('code-input').value.trim().toLowerCase();
        let redeemed = false;
        switch(code) {
            case 'pink':
                const specialAnt = new Ant(400, 300, 'common');
                specialAnt.color = '#FF1493'; // Bright pink
                specialAnt.isInvisible = false;
                specialAnt.isInvincible = true;
                specialAnt.isShiny = true;
                this.colony.ants.push(specialAnt);
                this.resources.ants++;
                this.logMessage("Code redeemed! Special bright pink invincible ant spawned!");
                redeemed = true;
                break;
            case 'bonuscoins':
                this.resources.coins += 1000;
                this.logMessage("Code redeemed! +1000 coins!");
                redeemed = true;
                break;
            case 'foodboost':
                this.resources.food += 100;
                this.logMessage("Code redeemed! +100 food!");
                redeemed = true;
                break;
            case 'waterwell':
                this.resources.water += 50;
                this.logMessage("Code redeemed! +50 water!");
                redeemed = true;
                break;
            case 'antarmy':
                for (let i = 0; i < 5; i++) {
                    this.resources.ants++;
                    const newAnt = this.colony.addAnt();
                    this.logMessage(`Code redeemed! ${newAnt.rarity} ant spawned!`);
                }
                redeemed = true;
                break;
            case 'dirtbag':
                this.resources.dirt += 50;
                this.logMessage("Code redeemed! +50 dirt!");
                redeemed = true;
                break;
            case 'speedup':
                this.upgrades.antSpeed++;
                this.applyUpgrades();
                this.logMessage("Code redeemed! Ant speed upgraded!");
                redeemed = true;
                break;
            case 'healthboost':
                this.upgrades.antHealth++;
                this.applyUpgrades();
                this.logMessage("Code redeemed! Ant health upgraded!");
                redeemed = true;
                break;
            case 'damageup':
                this.upgrades.antDamage++;
                this.applyUpgrades();
                this.logMessage("Code redeemed! Ant damage upgraded!");
                redeemed = true;
                break;
            case 'mythicant':
                const mythicAnt = new Ant(400, 300, 'mythic');
                this.colony.ants.push(mythicAnt);
                this.resources.ants++;
                this.logMessage("Code redeemed! Mythic ant spawned!");
                redeemed = true;
                break;
            case 'bosskiller':
                this.resources.coins += 1000;
                this.logMessage("Code redeemed! +1000 coins for being a boss killer!");
                redeemed = true;
                break;
            case 'colonyboost':
                this.upgrades.colonySize++;
                this.applyUpgrades();
                this.logMessage("Code redeemed! Colony size upgraded!");
                redeemed = true;
                break;
            case 'gatherefficiency':
                this.upgrades.gatherEfficiency++;
                this.applyUpgrades();
                this.logMessage("Code redeemed! Gather efficiency upgraded!");
                redeemed = true;
                break;
            case 'waterboost':
                this.upgrades.waterEfficiency++;
                this.applyUpgrades();
                this.logMessage("Code redeemed! Water efficiency upgraded!");
                redeemed = true;
                break;
            case 'legendaryspawn':
                const legendaryAnt = new Ant(400, 300, 'legendary');
                this.colony.ants.push(legendaryAnt);
                this.resources.ants++;
                this.logMessage("Code redeemed! Legendary ant spawned!");
                redeemed = true;
                break;
            case 'maxresources':
                this.resources.coins += 5000;
                this.resources.food += 500;
                this.resources.water += 200;
                this.resources.dirt += 100;
                this.logMessage("Code redeemed! Maximum resources boost!");
                redeemed = true;
                break;
            case 'invinciblearmy':
                this.colony.ants.forEach(ant => {
                    ant.isInvincible = true;
                });
                this.logMessage("Code redeemed! All ants are now invincible!");
                redeemed = true;
                break;
            case 'levelup':
                this.level += 5;
                this.logMessage("Code redeemed! Level increased by 5!");
                redeemed = true;
                break;
            case 'achievementhunter':
                this.resources.coins += 5000;
                this.achievements.achievementHunter = true;
                this.logMessage("Code redeemed! Achievement Hunter unlocked! +5000 coins!");
                redeemed = true;
                break;
            case 'ultimatecode':
                this.resources.coins += 10000;
                this.resources.food += 1000;
                this.resources.water += 500;
                this.resources.dirt += 200;
                this.upgrades.antSpeed += 2;
                this.upgrades.antHealth += 2;
                this.upgrades.antDamage += 2;
                this.upgrades.colonySize += 2;
                this.upgrades.gatherEfficiency += 2;
                this.upgrades.waterEfficiency += 2;
                this.applyUpgrades();
                this.logMessage("Code redeemed! Ultimate reward: Max resources and upgrades!");
                redeemed = true;
                break;
        }
        if (redeemed) {
            document.getElementById('code-input').value = ''; // Clear input
        } else {
            this.logMessage("Invalid code. Try again!");
        }
    }

    logMessage(message) {
        const messagesDiv = document.getElementById('messages');
        const messageElement = document.createElement('p');
        messageElement.textContent = message;
        messagesDiv.appendChild(messageElement);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
}

class Colony {
    constructor() {
        this.ants = [new Ant(400, 300)]; // Start with one ant in center
    }

    update() {
        this.ants.forEach(ant => ant.update());
    }

    draw(ctx) {
        this.ants.forEach(ant => ant.draw(ctx));
    }

    addAnt() {
        const centerX = 400;
        const centerY = 300;
        const rarity = this.getRandomRarity();
        const newAnt = new Ant(centerX + (Math.random() - 0.5) * 100, centerY + (Math.random() - 0.5) * 100, rarity);
        this.ants.push(newAnt);
        return newAnt;
    }

    getRandomRarity() {
        const rand = Math.floor(Math.random() * 100); // 0 to 99
        if (rand < 1) return 'mythic'; // 1%
        if (rand < 5) return 'legendary'; // 4%
        if (rand < 20) return 'epic'; // 15%
        if (rand < 50) return 'rare'; // 30%
        return 'common'; // 50%
    }

    removeAnt(ant) {
        this.ants.splice(this.ants.indexOf(ant), 1);
    }
}

class Ant {
    constructor(x, y, rarity = 'common') {
        this.x = x;
        this.y = y;
        this.health = 100;
        this.targetX = x;
        this.targetY = y;
        this.speed = 1;
        this.rarity = rarity;
        this.setRarityStats();
        this.baseSpeed = this.speed;
        this.baseHealth = this.health;
        this.baseDamage = 10; // Base damage for ants
        this.damage = this.baseDamage;
        this.tunnelStopTimer = 0; // Frames to stop when entering tunnel
        this.damageBuffTimer = 0; // Frames for x2 damage buff
        this.hasTunnelBuff = false; // Flag to track if buff has been applied after tunnel
        this.isInvisible = false; // For special ants
        this.isInvincible = false; // For special ants
        this.isShiny = false; // For extra bright glow
    }

    setRarityStats() {
        switch(this.rarity) {
            case 'common':
                this.color = '#000000'; // Black
                this.speed = 1;
                this.health = 100;
                this.specialty = 'Worker';
                break;
            case 'rare':
                this.color = '#C0C0C0'; // Silver
                this.speed = 1.5;
                this.health = 150;
                this.specialty = 'Gatherer';
                break;
            case 'epic':
                this.color = '#8A2BE2'; // Violet
                this.speed = 2;
                this.health = 200;
                this.specialty = 'Warrior';
                break;
            case 'legendary':
                this.color = '#FFD700'; // Gold
                this.speed = 2.5;
                this.health = 300;
                this.specialty = 'Queen';
                break;
            case 'mythic':
                this.color = '#FF0000'; // Bright red
                this.speed = 3;
                this.health = 500;
                this.specialty = 'Mythic';
                break;
        }
        this.maxHealth = this.health;
    }

    update() {
        // Decrement timers
        if (this.tunnelStopTimer > 0) {
            this.tunnelStopTimer--;
        }
        if (this.damageBuffTimer > 0) {
            this.damageBuffTimer--;
        }

        // Check if on tunnel
        const gridX = Math.floor(this.x / game.map.cellSize);
        const gridY = Math.floor(this.y / game.map.cellSize);
        if (gridX >= 0 && gridX < game.map.width && gridY >= 0 && gridY < game.map.height && game.map.grid[gridY][gridX] === 0) {
            // On tunnel
            if (this.tunnelStopTimer === 0 && this.damageBuffTimer === 0 && !this.hasTunnelBuff) {
                // Start stopping
                this.tunnelStopTimer = 120; // 2 seconds at 60 FPS
                this.hasTunnelBuff = true;
            }
        }

        // If stopping, don't move
        if (this.tunnelStopTimer > 0) {
            return;
        }

        // If just finished stopping, apply buff
        if (this.tunnelStopTimer === 0 && this.damageBuffTimer === 0 && this.hasTunnelBuff) {
            // Start buff
            this.damageBuffTimer = 3600; // 60 seconds at 60 FPS
            this.damage = this.baseDamage * 2;
            // Keep hasTunnelBuff true while buffed to prevent re-triggering
        }

        // If buff timer just ended, reset damage
        if (this.damageBuffTimer === 0 && this.tunnelStopTimer === 0 && this.hasTunnelBuff) {
            // Buff ended, reset damage
            this.damage = this.baseDamage;
            this.hasTunnelBuff = false; // Now reset flag
        }

        // Specialty effects
        if (this.specialty === 'Gatherer' && Math.random() < 0.02) {
            // Gatherers occasionally find extra food
            game.resources.food += 1;
        } else if (this.specialty === 'Warrior') {
            // Warriors have increased damage (handled in collision)
        } else if (this.specialty === 'Mythic') {
            // Mythic ants have all abilities
            if (Math.random() < 0.02) game.resources.food += 1;
        }

        // AUTO-TARGETING: Move towards nearest enemy if no specific target
        let nearestEnemy = null;
        let nearestDistance = Infinity;
        for (let enemy of game.enemies) {
            const dx = enemy.x - this.x;
            const dy = enemy.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestEnemy = enemy;
            }
        }

        // If there's a nearby enemy, target it
        if (nearestEnemy && nearestDistance < 150) { // Detection range
            this.targetX = nearestEnemy.x;
            this.targetY = nearestEnemy.y;
            this.targetEnemy = nearestEnemy;
        }

        // Move towards target if set (from mouse click, keyboard, or auto-targeting)
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 5) {
            // Cap movement per frame to prevent overshooting with high speed upgrades
            const maxStep = Math.min(this.speed, distance);
            this.x += (dx / distance) * maxStep;
            this.y += (dy / distance) * maxStep;
        } else {
            // If close to target, set a new random target occasionally
            if (Math.random() < 0.01) {
                this.targetX = this.x + (Math.random() - 0.5) * 200;
                this.targetY = this.y + (Math.random() - 0.5) * 200;
            }
        }

        // Keep ants within canvas bounds
        this.x = Math.max(5, Math.min(game.canvas.width - 5, this.x));
        this.y = Math.max(5, Math.min(game.canvas.height - 5, this.y));
    }

    draw(ctx) {
        if (this.isInvisible) return; // Don't draw invisible ants

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
        ctx.fill();

        // Add glow effect for rare and above
        if (this.rarity !== 'common') {
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0; // Reset shadow
        }

        // Extra bright glow for shiny ants
        if (this.isShiny) {
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0; // Reset shadow
        }

        // Draw HP bar
        const barWidth = 20;
        const barHeight = 3;
        const barX = this.x - barWidth / 2;
        const barY = this.y - 15;
        ctx.fillStyle = '#FF0000'; // Red background
        ctx.fillRect(barX, barY, barWidth, barHeight);
        ctx.fillStyle = '#00FF00'; // Green foreground
        ctx.fillRect(barX, barY, barWidth * (this.health / this.maxHealth), barHeight);
    }
}



class Map {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.grid = Array(height).fill().map(() => Array(width).fill(1)); // 1 = dirt, 0 = tunnel
        this.cellSize = 16;
    }

    digRandomTunnel() {
        const startX = Math.floor(Math.random() * this.width);
        const startY = Math.floor(Math.random() * this.height);
        this.digTunnel(startX, startY, 5); // Dig a 5-cell tunnel
    }

    digTunnel(x, y, length) {
        for (let i = 0; i < length; i++) {
            if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
                this.grid[y][x] = 0;
                x += Math.floor(Math.random() * 3) - 1; // Random direction
                y += Math.floor(Math.random() * 3) - 1;
            }
        }
    }

    draw(ctx) {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.grid[y][x] === 1) {
                    ctx.fillStyle = '#8B4513'; // Brown dirt
                    ctx.fillRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
                }
            }
        }
    }
}

class Enemy {
    constructor(x, y, rarity = 'common') {
        this.x = x;
        this.y = y;
        this.rarity = rarity;
        this.setRarityStats();
    }

    setRarityStats() {
        switch(this.rarity) {
            case 'common':
                this.health = 50;
                this.speed = 0.5;
                this.damage = 10;
                this.color = '#FF0000'; // Red
                break;
            case 'rare':
                this.health = 75;
                this.speed = 0.7;
                this.damage = 15;
                this.color = '#FFA500'; // Orange
                break;
            case 'epic':
                this.health = 100;
                this.speed = 0.9;
                this.damage = 20;
                this.color = '#FFFF00'; // Yellow
                break;
            case 'legendary':
                this.health = 150;
                this.speed = 1.1;
                this.damage = 30;
                this.color = '#00FF00'; // Green
                break;
            case 'mythic':
                this.health = 250;
                this.speed = 1.5;
                this.damage = 50;
                this.color = '#0000FF'; // Blue
                break;
        }
        this.maxHealth = this.health;
    }

    update() {
        this.y += this.speed;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 8, 0, Math.PI * 2);
        ctx.fill();

        // Draw HP bar
        const barWidth = 20;
        const barHeight = 3;
        const barX = this.x - barWidth / 2;
        const barY = this.y - 15;
        ctx.fillStyle = '#FF0000'; // Red background
        ctx.fillRect(barX, barY, barWidth, barHeight);
        ctx.fillStyle = '#00FF00'; // Green foreground
        ctx.fillRect(barX, barY, barWidth * (this.health / this.maxHealth), barHeight);
    }
}

class Boss extends Enemy {
    constructor(x, y, size) {
        super(x, y, 'mythic'); // Bosses are always mythic rarity
        this.size = size;
        this.setBossStats();
    }

    setBossStats() {
        if (this.size === 'small') {
            this.health = 500;
            this.speed = 0.3;
            this.damage = 40;
            this.color = '#800080'; // Purple
            this.radius = 12;
        } else if (this.size === 'large') {
            this.health = 1000;
            this.speed = 0.2;
            this.damage = 80;
            this.color = '#000000'; // Black
            this.radius = 16;
        }
        this.maxHealth = this.health;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Add red glow for large bosses
        if (this.size === 'large') {
            ctx.shadowColor = '#FF0000';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // Draw HP bar
        const barWidth = 30;
        const barHeight = 4;
        const barX = this.x - barWidth / 2;
        const barY = this.y - 20;
        ctx.fillStyle = '#FF0000'; // Red background
        ctx.fillRect(barX, barY, barWidth, barHeight);
        ctx.fillStyle = '#00FF00'; // Green foreground
        ctx.fillRect(barX, barY, barWidth * (this.health / this.maxHealth), barHeight);
    }
}

// Particle system for visual effects
class Particle {
    constructor(x, y, color, type = 'coin') {
        this.x = x;
        this.y = y;
        this.color = color;
        this.type = type;
        this.life = 60; // Frames to live
        this.vx = (Math.random() - 0.5) * 4; // Random velocity
        this.vy = (Math.random() - 0.5) * 4;
        this.size = type === 'coin' ? 3 : 2;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.1; // Gravity
        this.life--;
        this.size *= 0.98; // Shrink over time
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Initialize the game when the page loads
window.addEventListener('load', () => {
    game = new Game();
});
