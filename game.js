// game.js

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let isDrawing = false;
let strokePath = [];
let enemies = [];
let enemiesDefeated = 0;
let gameRunning = true;
const maxEnemiesDefeated = 30;
const enemySize = 25;
const minStrokeLength = 50;

// Enemy class with square shape and a stroke sequence on top
class Enemy {
    constructor() {
        this.x = Math.random() * (canvas.width - enemySize);
        this.y = 0; // Start at the top
        this.size = enemySize;
        this.color = "#AAA"; // Light grey
        this.speed = 0.5 + Math.random() * 1.5; // Random speed
        this.sequence = this.generateSequence(); // Sequence to be matched
    }

    // Generate a random sequence of 1 to 5 symbols using "_", "|", "V", and "Ʌ"
    generateSequence() {
        const symbols = ["_", "|", "V", "Ʌ"];
        const length = Math.floor(Math.random() * 5) + 1;
        return Array.from(
            { length },
            () => symbols[Math.floor(Math.random() * symbols.length)]
        ).join("");
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);

        // Draw the sequence above the enemy
        ctx.fillStyle = "white";
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        ctx.fillText(this.sequence, this.x + this.size / 2, this.y - 10);
    }

    update() {
        this.y += this.speed; // Move down
    }

    // Check if stroke matches the required type and decrement sequence if so
    decrementSequence(strokeOrientation) {
        // Check the first symbol of the sequence against the stroke type
        if (
            (strokeOrientation === "horizontal" && this.sequence.startsWith("_")) ||
            (strokeOrientation === "vertical" && this.sequence.startsWith("|")) ||
            (strokeOrientation === "V" && this.sequence.startsWith("V")) ||
            (strokeOrientation === "Ʌ" && this.sequence.startsWith("Ʌ"))
        ) {
            // Remove the first symbol if it matches
            this.sequence = this.sequence.slice(1);
        }
    }

    // Check if the enemy has been defeated
    isDefeated() {
        return this.sequence.length === 0;
    }
}

// Start drawing on mousedown
canvas.addEventListener("mousedown", (e) => {
    if (!gameRunning) return;
    isDrawing = true;
    strokePath = [];
    strokePath.push(getMousePos(canvas, e));
});

// Track the path of the mouse as it moves
canvas.addEventListener("mousemove", (e) => {
    if (isDrawing) {
        strokePath.push(getMousePos(canvas, e));
        drawPath(strokePath);
    }
});

// Stop drawing and check if the stroke length is valid and matches any enemy's required type
canvas.addEventListener("mouseup", () => {
    if (isDrawing && getStrokeLength(strokePath) >= minStrokeLength) {
        const strokeOrientation = getStrokeOrientation(strokePath);
        checkForHits(strokeOrientation);
    }
    isDrawing = false;
    strokePath = [];
});

// Get mouse position relative to canvas
function getMousePos(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
    };
}

// Calculate the length of the stroke path
function getStrokeLength(path) {
    const dx = path[path.length - 1].x - path[0].x;
    const dy = path[path.length - 1].y - path[0].y;
    return Math.sqrt(dx * dx + dy * dy);
}

// Determine if stroke is horizontal, vertical, "V", or "Ʌ" based on criteria
function getStrokeOrientation(path) {
    const dx = path[path.length - 1].x - path[0].x;
    const dy = path[path.length - 1].y - path[0].y;

    // Check for "V" and "Ʌ" shapes by finding the middle point
    const midpoint = path[Math.floor(path.length / 2)];
    const start = path[0];
    const end = path[path.length - 1];

    // Calculate width and depth of the stroke
    const width = Math.abs(end.x - start.x);
    const midpointDepth = Math.min(midpoint.y - start.y, midpoint.y - end.y);
    const midpointHeight = Math.min(start.y - midpoint.y, end.y - midpoint.y);

    // Check if the midpoint is at least 50% below for "V"
    if (midpointDepth > 0.2 * width) {
        return "V";
    }

    // Check if the midpoint is at least 50% above for "Ʌ"
    if (midpointHeight > 0.2 * width) {
        return "Ʌ";
    }

    // Otherwise, determine if stroke is horizontal or vertical
    const angle = Math.abs(Math.atan2(dy, dx) * (180 / Math.PI));
    if (angle <= 45 || angle >= 135) {
        return "horizontal";
    }
    return "vertical";
}

// Generate random enemies at the top of the screen
function spawnEnemy() {
    enemies.push(new Enemy());
}

// Draw and update enemies, and check for loss condition
function drawEnemies() {
    if (!gameRunning) return;
    for (let enemy of enemies) {
        enemy.draw();
        enemy.update();

        // Check if enemy reached the bottom (lose condition)
        if (enemy.y > canvas.height) {
            gameOver(false);
        }
    }
}

// Check if the stroke orientation matches any enemy's type and remove or update all matching enemies
function checkForHits(strokeOrientation) {
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.decrementSequence(strokeOrientation);

        if (enemy.isDefeated()) {
            enemies.splice(i, 1); // Remove defeated enemy
            enemiesDefeated++;
        }
    }

    // Check for win condition
    if (enemiesDefeated >= maxEnemiesDefeated) gameOver(true);
}

// Handle game over for win/lose conditions
function gameOver(won) {
    gameRunning = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Display win/lose message and score
    ctx.fillStyle = "white";
    ctx.font = "48px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
        won ? "You Win!" : "Game Over",
        canvas.width / 2,
        canvas.height / 2 - 50
    );
    ctx.font = "24px Arial";
    ctx.fillText(
        `${enemiesDefeated}/${maxEnemiesDefeated}`,
        canvas.width / 2,
        canvas.height / 2 - 20
    );

    // Pause before showing restart message
    setTimeout(() => {
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.fillText(
            "- Click to restart game -",
            canvas.width / 2,
            canvas.height / 2 + 10
        );

        // Reload page on click
        canvas.addEventListener("click", restartGame, { once: true });
    }, 1000); // 1 second delay
}

// Restart game by reloading the page
function restartGame() {
    location.reload();
}

// Display defeated enemies counter
function drawCounter() {
    ctx.fillStyle = "white";
    ctx.font = "15px Arial";
    ctx.textAlign = "left";
    ctx.fillText(
        `Ghost Eliminated : ${enemiesDefeated}/${maxEnemiesDefeated}`,
        10,
        canvas.height - 20
    );
}

// Main game loop for animation and enemy spawning
function gameLoop() {
    if (!gameRunning) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawEnemies();
    drawCounter(); // Draw the counter on each frame

    if (Math.random() < 0.02) {
        // Spawn enemies with a small probability
        spawnEnemy();
    }

    requestAnimationFrame(gameLoop);
}

// Start the game loop
gameLoop();
