export class DragonError extends Error {
    constructor(message) {
        super(message);
        this.name = "DragonError";
    }
}
