export class DragonError extends Error {
    constructor(code, originalError = null) {
        super(originalError?.message || 'An unexpected error occurred');
        this.name = 'DragonError';
        this.code = code;
        this.timestamp = new Date().toISOString();
        this.component = 'DragonError';
        this.metadata = {
            originalError: originalError ? {
                message: originalError.message,
                name: originalError.name,
                stack: originalError.stack
            } : {}
        };
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            timestamp: this.timestamp,
            metadata: this.metadata
        };
    }
}
