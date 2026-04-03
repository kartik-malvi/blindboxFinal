export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class OutOfStockError extends AppError {
  constructor(blindBoxId?: string) {
    super(
      blindBoxId
        ? `Blind box "${blindBoxId}" has no items in stock`
        : 'No items in stock for this blind box',
      400
    );
    this.name = 'OutOfStockError';
  }
}

export class InvalidProbabilityError extends AppError {
  constructor(sum: number) {
    super(
      `Item probabilities must sum to 1.0 (±0.001). Current sum: ${sum.toFixed(4)}`,
      422
    );
    this.name = 'InvalidProbabilityError';
  }
}

export class WebhookVerificationError extends AppError {
  constructor() {
    super('Webhook HMAC signature verification failed', 401);
    this.name = 'WebhookVerificationError';
  }
}

export class ShoplineApiError extends AppError {
  constructor(message: string, originalError?: unknown) {
    super(`Shopline API error: ${message}`, 502);
    this.name = 'ShoplineApiError';
    if (originalError instanceof Error) {
      this.stack = originalError.stack;
    }
  }
}

export class OrderNotFoundError extends AppError {
  constructor(orderId: string) {
    super(`Order "${orderId}" not found`, 404);
    this.name = 'OrderNotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}
