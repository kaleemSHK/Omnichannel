declare module 'actioncable' {
  export interface Channel {
    received(data: unknown): void;
    connected?(): void;
    disconnected?(): void;
  }

  export interface Subscription {
    unsubscribe(): void;
  }

  export interface Cable {
    subscriptions: {
      create(
        params: Record<string, unknown>,
        callbacks: Channel,
      ): Subscription;
    };
    disconnect(): void;
  }

  export function createConsumer(url: string): Cable;
}

declare namespace ActionCable {
  type Cable = import('actioncable').Cable;
  type Subscription = import('actioncable').Subscription;
}
