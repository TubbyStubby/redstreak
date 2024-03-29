import { fakeDeepFreeze, DeepFrozen } from "constconst";

export enum CONFIG_STATUS {
    INACTIVE,
    ACTIVE
}

export interface Config {
    version: number;
    status: CONFIG_STATUS;
}

function isActive(c: Config) {
    return c.status == CONFIG_STATUS.ACTIVE;
}

export interface ConfigManager<T extends Config> {
    get(): DeepFrozen<T> | undefined;
    get(version: T["version"]): DeepFrozen<T> | undefined;
    getAll(): DeepFrozen<T>[];
    remove(version: T["version"]): void;
    add(config: T): void;
    update(updatedConfig: T): void;
    activate(version: T["version"]): void;
    assertVersion(version: unknown): asserts version is T["version"];
    assertStatus(status: unknown): asserts status is T["status"];
    get size(): number;
    get activeVersion(): Config["version"] | undefined;
    activeConfig: DeepFrozen<T> | undefined;
}

export class InMemoryConfigManager<TConfig extends Config> implements ConfigManager<TConfig> {
    private configs: Map<Config["version"], TConfig>;
    private fakeConfigs: Map<Config["version"], DeepFrozen<TConfig>>;
    activeConfig: DeepFrozen<TConfig> | undefined;

    constructor(configs?: TConfig[]) {
        this.configs = new Map();
        this.fakeConfigs = new Map();
        if(configs != undefined) {
            for(const config of configs) this.add(config);
        }
    }

    get activeVersion(): number | undefined { return this.activeConfig?.version; }

    get(): DeepFrozen<TConfig> | undefined;
    get(version: TConfig["version"]): DeepFrozen<TConfig> | undefined;
    get(version?: unknown): DeepFrozen<TConfig> | undefined {
        if(version) {
            this.assertVersion(version);
            return this.fakeConfigs.get(version);
        } else {
            if(this.activeConfig)
                return this.fakeConfigs.get(this.activeConfig.version);
        }
    }

    getAll(): DeepFrozen<TConfig>[] {
        return [...this.fakeConfigs.values()];
    }

    add(config: TConfig): void {
        this.assertVersion(config.version);
        this.assertStatus(config.status);
        if(config.status == CONFIG_STATUS.ACTIVE && this.activeConfig != undefined) {
            throw InMemoryConfigManagerError.ACTIVE_OVERWRITE();
        }
        if(!this.configs.has(config.version)) {
            const clone = structuredClone(config);
            const fakeClone = fakeDeepFreeze(clone);
            this.configs.set(config.version, clone);
            this.fakeConfigs.set(config.version, fakeClone);
            if(config.status == CONFIG_STATUS.ACTIVE) this.activate(config.version);
        } else {
            throw InMemoryConfigManagerError.DUPLICATE_VERSION(config.version);
        }
    }
    
    update(updatedConfig: TConfig): void {
        this.assertVersion(updatedConfig.version);
        this.assertStatus(updatedConfig.status);
        const config = this.configs.get(updatedConfig.version);
        if(!config) return;
        if(updatedConfig.status != config.status) {
            throw InMemoryConfigManagerError.IMMUTABLE_FIELD_UPDATE("status");
        }
        const clone = structuredClone(updatedConfig);
        const fakeClone = fakeDeepFreeze(clone);
        this.configs.set(updatedConfig.version, clone);
        this.fakeConfigs.set(updatedConfig.version, fakeClone);
    }

    remove(version: TConfig["version"]): void {
        this.assertVersion(version);
        const config = this.configs.get(version);
        if(config == undefined) return;
        if(isActive(config)) {
            throw InMemoryConfigManagerError.REMOVING_ACTIVE_CONFIG(version);
        } else {
            this.configs.delete(version);
            this.fakeConfigs.delete(version);
        }
    }

    activate(version: TConfig["version"]): void {
        this.assertVersion(version);
        const config = this.configs.get(version);
        if(config == undefined) throw InMemoryConfigManagerError.NO_CONFIG(version);
        const activeVersion = this.activeVersion;
        const activeConfig = activeVersion != undefined ? this.configs.get(activeVersion) : undefined;
        if(activeConfig == config) return;
        if(activeConfig != undefined) {
            [activeConfig.status, config.status] = [CONFIG_STATUS.INACTIVE, CONFIG_STATUS.ACTIVE];
        } else {
            config.status = CONFIG_STATUS.ACTIVE;
        }
        this.activeConfig = this.fakeConfigs.get(config.version);
    }

    assertVersion(version: unknown): asserts version is TConfig["version"] {
        if(typeof version != 'number' || isNaN(version) || version < 0) throw InMemoryConfigManagerError.INVALID_VERSION(version);
    }
    
    assertStatus(status: unknown): asserts status is TConfig["status"] {
        if(typeof status != 'number' || isNaN(status)) throw InMemoryConfigManagerError.INVALID_STATUS(status);
        if(status != CONFIG_STATUS.INACTIVE && status != CONFIG_STATUS.ACTIVE) throw InMemoryConfigManagerError.INVALID_STATUS(status);
    }

    get size(): number { return this.configs.size }
}

type ErroMetadata = { [x: string]: unknown };

export class InMemoryConfigManagerError extends Error {
    static INVALID_VERSION(version: unknown): InMemoryConfigManagerError {
        return new InMemoryConfigManagerError(`INVALID_VERSION: Expected version of type number got ${typeof version}`);
    }
    
    static INVALID_STATUS(status: unknown): InMemoryConfigManagerError {
        return new InMemoryConfigManagerError(`INVALID_STATUS: Expected status can be ${CONFIG_STATUS.INACTIVE} or ${CONFIG_STATUS.ACTIVE} got ${status}`);
    }
    
    static REMOVING_ACTIVE_CONFIG(version: Config["version"]): InMemoryConfigManagerError {
        return new InMemoryConfigManagerError(`REMOVING_ACTIVE_CONFIG: Cannot remove an active config. Removing version ${typeof version}`);
    }
    
    static NO_CONFIG(version: Config["version"]): InMemoryConfigManagerError {
        return new InMemoryConfigManagerError(`NO_CONFIG: No config found for version ${typeof version}`);
    }
    
    static ACTIVE_OVERWRITE(): InMemoryConfigManagerError {
        return new InMemoryConfigManagerError(`ACTIVE_OVERWRITE: Can not add active config when one is already present`);
    }
    
    static DUPLICATE_VERSION(version: Config["version"]): InMemoryConfigManagerError {
        return new InMemoryConfigManagerError(`DUPLICATE_VERSION: Config with version ${version} already present`);
    }
    
    static IMMUTABLE_FIELD_UPDATE(field: string): InMemoryConfigManagerError {
        return new InMemoryConfigManagerError(`IMMUTABLE_FIELD_UPDATE: Cannot update field ${field}`);
    }

    metadata: ErroMetadata;

    constructor(message: string, metadata?: ErroMetadata) {
        super(message);
        this.name = this.constructor.name;
        this.metadata = metadata ?? {};
    }
}