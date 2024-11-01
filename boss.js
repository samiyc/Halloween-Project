
// Boss Class
export class Boss {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;

        this.lives = 3;
        this.x = (Math.random() * 0.4 + 0.3) * canvas.width; // Position between 30% and 70%
        this.y = 0; // Start at the top
        this.size = 100; // Boss is 2x bigger
        this.baseColor = "#FF4500"; // Normal color
        this.invincibleColor = "#888"; // Color during invincible state (gold)
        this.color = this.baseColor; // Initial color
        this.speed = 0.25; // 75% slower than normal enemies
        this.invincible = false; // Invincible state flag
        this.sequence = this.generateSequence(); // Sequence to be matched
    }

    // Generate a random sequence of symbols using "_", "|", "V", and "Ʌ"
    generateSequence() {
        const symbols = ["_", "|", "V", "Ʌ"];
        return Array.from({ length: 6 + this.lives * 2 }, () => symbols[Math.floor(Math.random() * symbols.length)]).join("");
    }

    draw() {
        this.ctx.fillStyle = this.color;
        this.ctx.fillRect(this.x, this.y, this.size, this.size);

        // Draw the sequence and lives above the boss
        this.ctx.fillStyle = "white";
        this.ctx.font = "16px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText(this.sequence, this.x + this.size / 2, this.y - 10);
        this.ctx.font = "12px Arial";
        this.ctx.fillText(`Angry boss`, this.x + this.size / 2, this.y + this.size + 15);
    }

    update() {
        // Adjust movement based on whether the boss is invincible
        if (this.invincible) {
            // Move upward until the boss reaches the top
            this.y -= 1.5;
            if (this.y <= 0) {
                // Reset invincible state at the top and regenerate sequence
                this.invincible = false;
                this.sequence = this.generateSequence();
                this.color = this.baseColor; // Revert to base color
                this.size -= 15;
            }
        } else {
            // Normal downward movement
            this.y += this.speed;
        }
    }

    decrementSequence(strokeOrientation) {
        if (
            (strokeOrientation === "horizontal" && this.sequence.startsWith("_")) ||
            (strokeOrientation === "vertical" && this.sequence.startsWith("|")) ||
            (strokeOrientation === "V" && this.sequence.startsWith("V")) ||
            (strokeOrientation === "Ʌ" && this.sequence.startsWith("Ʌ"))
        ) {
            this.sequence = this.sequence.slice(1); // Remove the first symbol if it matches
        }
    }

    // Reset boss position with invincible state or handle defeat
    resetOrDefeat() {
        if (!this.invincible && this.sequence.length === 0) {
            this.lives--;
            this.invincible = true; // Activate invincible state
            this.color = this.invincibleColor; // Change color to indicate invincibility
            this.speed += 0.25;
        }
    }

    // Check if the boss has been defeated
    isDefeated() {
        return !this.invincible && this.lives < 1;
    }
}
