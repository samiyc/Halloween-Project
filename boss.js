
// Boss Class
export class Boss {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;

        this.lives = 3;
        this.x = (Math.random() * 0.4 + 0.3) * canvas.width; // Position between 30% and 70%
        this.y = 0; // Start at the top
        this.size = 50; // Boss is 2x bigger
        this.color = "#FF4500"; // Distinct color for the boss
        this.speed = 0.25; // 75% slower than normal enemies
        this.sequence = this.generateSequence(); // Sequence to be matched
    }

    // Generate a random sequence of symbols using "_", "|", "V", and "Ʌ"
    generateSequence() {
        const symbols = ["_", "|", "V", "Ʌ"];
        return Array.from({ length: 10 - this.lives }, () => symbols[Math.floor(Math.random() * symbols.length)]).join("");
    }

    draw() {
        this.ctx.fillStyle = this.color;
        this.ctx.fillRect(this.x, this.y, this.size, this.size);

        // Draw the sequence and lives above the boss
        this.ctx.fillStyle = "white";
        this.ctx.font = "16px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText(this.sequence, this.x + this.size / 2, this.y - 10);
        this.ctx.fillText(`Lives: ${this.lives}`, this.x + this.size / 2, this.y + this.size + 20);
    }

    update() {
        this.y += this.speed; // Move down
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

    // Reset boss position and sequence or handle defeat
    resetOrDefeat() {
        if (this.sequence.length === 0) {
            this.lives--;
            if (this.lives > 0) {
                // Reset position and regenerate sequence
                this.y = 0;
                this.sequence = this.generateSequence();
                this.speed += 0.25;
            }
        }
    }

    // Check if the boss has been defeated
    isDefeated() {
        return this.lives < 1;
    }
}
