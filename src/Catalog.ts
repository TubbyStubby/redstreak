import { insertionIndex, bSearch } from "./utils";
import { deepFreeze, DeepFrozen } from "constconst";

export interface Item {
    id: number;
}

export interface Catalog<T extends Item> {
    findById(id: T["id"]): DeepFrozen<T> | undefined;
    fetchAll(): DeepFrozen<T>[];
    remove(id: T["id"]): void;
    insert(item: T): void;
    update(item: T): void;
    assertId(id: unknown): asserts id is T["id"];
    get size(): number;
}

export class InMemoryCatalog<TItem extends Item> implements Catalog<TItem> {
    #items: DeepFrozen<TItem>[];

    #itemIdComparator(a: Item, b: Item): number {
        return a.id - b.id;
    }

    #findIndex(x: Item["id"] | Item) {
        let value;
        if(typeof x == 'number') {
            value = { id: x };
        } else {
            value = x;
        }
        return bSearch(this.#items, this.#itemIdComparator, value);
    }

    constructor(items?: TItem[]) {
        this.#items = [];
        if(items != undefined) {
            for(const item of items) this.insert(item);
        }
    }

    insert(item: TItem): void {
        this.assertId(item.id);
        const frozenClone = deepFreeze(structuredClone(item));
        const pos = insertionIndex(this.#items, (a, b) => a.id - b.id, frozenClone);
        const itemAtPos = this.#items[pos];
        if(itemAtPos == undefined || itemAtPos.id !== item.id) {
            this.#items.splice(pos, 0, frozenClone);
        } else {
            throw InMemoryCatalogError.DUPLICATE_INSERT_ERROR(item.id);
        }
    }

    update(item: TItem): void {
        this.assertId(item.id);
        const index = this.#findIndex(item);
        if(index > -1) {
            const frozenClone = deepFreeze(structuredClone(item));
            this.#items[index] = frozenClone;
        } else {
            throw InMemoryCatalogError.INDEX_ERROR(item.id);
        }
    }

    findById(id: TItem["id"]): DeepFrozen<TItem> | undefined {
        this.assertId(id);
        const index = this.#findIndex(id);
        if(index > -1) {
            return this.#items[index];
        }
    }

    fetchAll(): DeepFrozen<TItem>[] {
        const copyArray: DeepFrozen<TItem>[] = [];
        for(const item of this.#items) copyArray.push(item);
        return copyArray;
    }

    remove(id: TItem["id"]): void {
        this.assertId(id);
        const index = this.#findIndex(id);
        if(index > -1) {
            this.#items.splice(index, 1);
        }
    }
    
    assertId(id: unknown): asserts id is TItem["id"] {
        if(typeof id != "number" || isNaN(id) || id < 1) throw InMemoryCatalogError.INVALID_ID(id);
    }

    get size(): number { return this.#items.length; }
}

export class InMemoryCatalogError extends Error {
    static INVALID_ID(id: unknown): InMemoryCatalogError {
        return new InMemoryCatalogError(`INVALID_ID_ERROR: Expected type number found ${typeof id}`);
    }

    static INDEX_ERROR(id: Item["id"]): InMemoryCatalogError {
        return new InMemoryCatalogError(`INDEX_ERROR: No item found for id ${id}`);
    }

    static DUPLICATE_INSERT_ERROR(id: Item["id"]): InMemoryCatalogError {
        return new InMemoryCatalogError(`DUPLICATE_INSERT_ERROR: Item with id-${id} already exists`);
    }

    constructor(message?: string) {
        super(message);
        this.name = this.constructor.name;
    }
}