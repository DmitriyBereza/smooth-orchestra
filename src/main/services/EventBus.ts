import { EventEmitter } from 'events';
import { OrchestraEventMap, OrchestraEvent } from '../types';

/**
 * Typed EventEmitter hub — the central nervous system of Orchestra.
 * All inter-service communication flows through this singleton.
 */
class TypedEventBus {
  private emitter = new EventEmitter();

  constructor() {
    // Allow many listeners since multiple services subscribe
    this.emitter.setMaxListeners(50);
  }

  on<E extends OrchestraEvent>(event: E, listener: OrchestraEventMap[E]): this {
    this.emitter.on(event, listener as (...args: any[]) => void);
    return this;
  }

  once<E extends OrchestraEvent>(event: E, listener: OrchestraEventMap[E]): this {
    this.emitter.once(event, listener as (...args: any[]) => void);
    return this;
  }

  off<E extends OrchestraEvent>(event: E, listener: OrchestraEventMap[E]): this {
    this.emitter.off(event, listener as (...args: any[]) => void);
    return this;
  }

  emit<E extends OrchestraEvent>(event: E, ...args: Parameters<OrchestraEventMap[E]>): boolean {
    return this.emitter.emit(event, ...args);
  }

  removeAllListeners(event?: OrchestraEvent): this {
    this.emitter.removeAllListeners(event);
    return this;
  }
}

// Singleton instance
export const eventBus = new TypedEventBus();
