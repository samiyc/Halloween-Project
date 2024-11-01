
// Enemy class with square shape and a stroke sequence on top
export class Enemy {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;

        this.size = 25;
        this.x = Math.random() * (canvas.width - this.size);
        this.y = 0; // Start at the top
        this.color = "#AAA"; // Light grey
        this.sequence = this.generateSequence(); // Sequence to be matched
        this.speed = 0.6 + Math.random() * 0.8 - this.sequence.length * 0.1; // Random speed
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
        this.ctx.fillStyle = this.color;
        this.ctx.fillRect(this.x, this.y, this.size, this.size);

        // Draw the sequence above the enemy
        this.ctx.fillStyle = "white";
        this.ctx.font = "16px Arial";
        this.ctx.textAlign = "center";
        this.ctx.fillText(this.sequence, this.x + this.size / 2, this.y - 10);
    }

    update(boss) {
        if (boss.lives > 0) {
            this.y += this.speed; // Move down
        }
        else {
            this.y -= this.speed; // Move up
        }
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
