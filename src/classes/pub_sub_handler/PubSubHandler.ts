import { PubSubHandlerError } from "./PubSubHandlerError";
import EventEmitter from 'events';

export enum PubSubStates {
    UNSUBSCRIBED = -1,
    DISCONNECTED = 0,
    CONNECTED = 1,
    SUBSCRIBED = 2
}

export enum PubSubModes {
    SUB = 0,
    PUB = 1,
    DUAL = 2
}

export enum PubSubEvents {
    CONNECTED = 'connected',
    DISCONNECTED = 'disconnected',
    MESSAGE = 'message',
    SUBSCRIBED = 'subscribed',
    UNSUBSCRIBED = 'unsubscribed',
    PUBLISHED = 'published'
}

export abstract class PubSubHandler<T> {
    static _validateMode(mode: unknown): boolean {
        if(typeof mode == "number" && mode in PubSubStates) {
            return true;
        } else {
            return false;
        }
    }

    #mode: PubSubModes; #state: PubSubStates; #events: EventEmitter;
    protected client: T;

    constructor(client: T, mode: PubSubModes) {
        if(this.constructor === PubSubHandler) throw new PubSubHandlerError('PubSubHandler is an abstract class');
        if(!PubSubHandler._validateMode(mode)) throw new PubSubHandlerError('Invalid Mode');
        this.#state = PubSubStates.DISCONNECTED;
        this.client = client;
        this.#mode = mode;
        this.#events = new EventEmitter();
    }

    get state() { return this.#state }
    get mode() { return this.#mode }
    get isSubscribed() { return this.#state === PubSubStates.SUBSCRIBED }
    get isConnected() { return this.#state >= PubSubStates.CONNECTED }
    get canSubscribe() { return this.#mode === PubSubModes.SUB || this.#mode === PubSubModes.DUAL }
    get canPublish() { return this.#mode === PubSubModes.PUB || this.#mode === PubSubModes.DUAL }

    connectionCheck() { if(!this.isConnected) throw new PubSubHandlerError('Not Connected') }
    subModeCheck() { if(!this.canSubscribe) throw new PubSubHandlerError('Can Not Subscribe') }
    pubModeCheck() { if(!this.canPublish) throw new PubSubHandlerError('Can Not Publish') }

    protected abstract _connect(): Promise<void>
    protected abstract _disconnect(): Promise<void>
    protected abstract _subscribe(channel: string): Promise<void>
    protected abstract _unsubscribe(channel: string): Promise<void>
    protected abstract _publish(channel: string, message: string): Promise<void>

    async connect() {
        if(this.isConnected) return;
        await this._connect();
        this.#state = PubSubStates.CONNECTED;
    }

    async disconnect() {
        if(!this.isConnected) return;
        await this._disconnect();
        this.#state = PubSubStates.DISCONNECTED;
    }

    async subscribe(channel: string) {
        this.connectionCheck();
        this.subModeCheck();
        await this._subscribe(channel);
        this.#state = PubSubStates.SUBSCRIBED;
    }

    async unsubscribe(channel: string) {
        this.connectionCheck();
        this.subModeCheck();
        await this._unsubscribe(channel);
        this.#state = PubSubStates.DISCONNECTED;
    }

    async publish(channel: string, message: string) {
        this.connectionCheck();
        this.pubModeCheck();
        await this._publish(channel, message);
    }

    on(event: PubSubEvents, listener: (...args: any[]) => void) { this.#events.on(event, listener); } // eslint-disable-line @typescript-eslint/no-explicit-any
    once(event: PubSubEvents, listener: (...args: any[]) => void) { this.#events.once(event, listener); } // eslint-disable-line @typescript-eslint/no-explicit-any
    removeListener(event: PubSubEvents, listener: (...args: any[]) => void) { this.#events.removeListener(event, listener); } // eslint-disable-line @typescript-eslint/no-explicit-any
    emit(event: PubSubEvents, ...args: any[]) { this.#events.emit(event, ...args); } // eslint-disable-line @typescript-eslint/no-explicit-any
}