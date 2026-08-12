import { Environment } from '../dataflow/environments/environment';
import type { BuiltIn } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { ReferenceType } from '../dataflow/environments/identifier';
import type { FlowrAnalyzerContext } from '../project/context/flowr-analyzer-context';
import { guard } from './assert';
import { BiMap } from './collections/bimap';
import { DataflowGraph } from '../dataflow/graph/graph';
import { ControlFlowGraph } from '../control-flow/control-flow-graph';
import { KnownStaticCallbacks } from '../dataflow/environments/default-builtin-config';
import { jsonBigIntRetriever } from './json';

export interface BuiltinRefMarker {
	readonly __builtinRef: BuiltIn;
}

export interface KnownFunctionRefMarker {
	readonly __knownFnRef: string;
}

const knownFunctionIds = new Map<(...args: never[]) => unknown, string>(
	Object.entries(KnownStaticCallbacks).map(([id, fn]) => [fn, id])
);

export interface InProcessFunctionRefMarker {
	readonly __inProcFnRef: number;
}

const inProcessFunctions = new Map<number, (...args: never[]) => unknown>();
const inProcessFunctionIds = new WeakMap<(...args: never[]) => unknown, number>();
let nextInProcessFnId = 0;

function idForInProcessFunction(fn: (...args: never[]) => unknown): number {
	let id = inProcessFunctionIds.get(fn);
	if(id === undefined) {
		id = nextInProcessFnId++;
		inProcessFunctionIds.set(fn, id);
		inProcessFunctions.set(id, fn);
	}
	return id;
}

const NonSingletonBuiltinRefs = new Set<BuiltIn>([NodeId.toBuiltIn(':=-table')]);

function isBuiltinDefinition(value: unknown): value is { definedAt: BuiltIn } {
	if(typeof value !== 'object' || value === null || !('type' in value) || !('definedAt' in value)) {
		return false;
	}
	if(NonSingletonBuiltinRefs.has(value.definedAt as BuiltIn)) {
		return false;
	}
	return value.type === ReferenceType.BuiltInFunction || value.type === ReferenceType.BuiltInConstant;
}

function isPlainObjectOrArray(value: object): boolean {
	if(Array.isArray(value)) {
		return true;
	}
	const prototype = Object.getPrototypeOf(value) as object | null;
	return prototype === Object.prototype || prototype === null;
}

/** Marks a property/element that was `undefined` in the original value. */
const UndefinedMarker = { __undef: true } as const;

function isUndefinedMarker(value: unknown): boolean {
	return typeof value === 'object' && value !== null && '__undef' in value;
}

function countReferenceOccurrencesInArray(ctx: FlowrAnalyzerContext, array: readonly unknown[], counts: WeakMap<object, number>): void {
	for(const element of array) {
		countReferenceOccurrences(ctx, element, counts);
	}
}

function countReferenceOccurrencesInIterable(ctx: FlowrAnalyzerContext, iterable: Iterable<unknown>, counts: WeakMap<object, number>): void {
	for(const entry of iterable) {
		countReferenceOccurrences(ctx, entry, counts);
	}
}

function countReferenceOccurrencesInObject(ctx: FlowrAnalyzerContext, object: object, counts: WeakMap<object, number>): void {
	for(const value of Object.values(object)) {
		countReferenceOccurrences(ctx, value, counts);
	}
}

function countReferenceOccurrencesInChildren(ctx: FlowrAnalyzerContext, original: object, counts: WeakMap<object, number>): void {
	if(original instanceof RegExp) {
		return;
	}
	if(!isPlainObjectOrArray(original) && typeof (original as { [Symbol.iterator]?: unknown })[Symbol.iterator] === 'function') {
		countReferenceOccurrencesInIterable(ctx, original as Iterable<unknown>, counts);
		return;
	}
	countReferenceOccurrencesInObject(ctx, original, counts);
}

/**
 * Counts how many distinct references there are.
 * Objects seen only once never need a `__id`/`__ref`, so that space is saved in the persisted dfg.
 * This significantly decreases the size of the persisted dfg in comparison to adding an id or ref to each property,
 * at the cost of not too much time.
 */
function countReferenceOccurrences(ctx: FlowrAnalyzerContext, original: unknown, counts: WeakMap<object, number>): void {
	if(original === ctx.env.builtInEnvironment || original === ctx.env.emptyBuiltInEnvironment || isBuiltinDefinition(original)) {
		return;
	} else if(typeof original !== 'object' || original === null) {
		return;
	} else if(Array.isArray(original)) {
		countReferenceOccurrencesInArray(ctx, original, counts);
		return;
	}

	const alreadySeen = counts.has(original);
	counts.set(original, (counts.get(original) ?? 0) + 1);
	if(alreadySeen) {
		return;
	}

	countReferenceOccurrencesInChildren(ctx, original, counts);
}

/**
 * Creates the JSON.stringify replacer used to persist a dataflow graph.
 */
export function createPersistenceReplacer(ctx: FlowrAnalyzerContext, root: unknown): (this: unknown, key: unknown, value: unknown) => unknown {
	const refCounts = new WeakMap<object, number>();
	countReferenceOccurrences(ctx, root, refCounts);

	const refIds = new WeakMap<object, number>();
	let nextId = 0;

	return function persistenceReplacer(this: unknown, key: unknown, value: unknown): unknown {
		const holder = this as Record<string, unknown> | undefined;
		const original = typeof key === 'string' && holder ? holder[key] : value;

		if(original === undefined) {
			return UndefinedMarker;
		} else if(original === ctx.env.builtInEnvironment) {
			return '<BuiltInEnvironment>';
		} else if(original === ctx.env.emptyBuiltInEnvironment) {
			return '<EmptyBuiltInEnvironment>';
		} else if(isBuiltinDefinition(original)) {
			return { __builtinRef: original.definedAt };
		} else if(typeof original === 'bigint') {
			return `${original.toString()}n`;
		} else if(typeof original === 'number' && !Number.isFinite(original)) {
			return { __nonFinNum: Number.isNaN(original) ? 'NaN' : original > 0 ? 'Infinity' : '-Infinity' };
		} else if(typeof original === 'function' && knownFunctionIds.has(original as (...args: never[]) => unknown)) {
			return { __knownFnRef: knownFunctionIds.get(original as (...args: never[]) => unknown) };
		} else if(typeof original === 'function') {
			return { __inProcFnRef: idForInProcessFunction(original as (...args: never[]) => unknown) };
		} else if(typeof original !== 'object' || original === null || Array.isArray(original)) {
			return value;
		}

		const seenId = refIds.get(original);
		if(seenId !== undefined) {
			return { __ref: seenId };
		}

		const isShared = (refCounts.get(original) ?? 0) > 1;
		let id: number | undefined;
		if(isShared) {
			id = nextId++;
			refIds.set(original, id);
		}

		let replacement: Record<string, unknown>;
		if(original instanceof RegExp) {
			replacement = { __type: 'RegExp', source: original.source, flags: original.flags };
		} else if(!isPlainObjectOrArray(original)) {
			const constructorName = original.constructor?.name ?? 'Unknown';
			replacement = typeof (original as { [Symbol.iterator]?: unknown })[Symbol.iterator] === 'function'
				? { __type: constructorName, entries: [...(original as Iterable<unknown>)] }
				: { __type: constructorName, fields: { ...original } };
		} else {
			replacement = { ...original };
		}
		if(id !== undefined) {
			replacement.__id = id;
		}
		return replacement;
	};
}

const IterableTypes: Record<string, new (entries: never) => unknown> = { Map, Set, BiMap };
const PlainClassTypes: Record<string, { prototype: object }> = { Environment, DataflowGraph, ControlFlowGraph };

interface TaggedValue {
	__type:   string
	entries?: unknown[]
	fields?:  object
	source?:  string
	flags?:   string
}

function reviveTaggedValue(tagged: TaggedValue): unknown {
	if(tagged.__type === 'RegExp') {
		return new RegExp(tagged.source ?? '', tagged.flags ?? '');
	}
	if(tagged.__type in IterableTypes) {
		return new IterableTypes[tagged.__type](tagged.entries as never);
	}
	if(tagged.__type in PlainClassTypes) {
		return Object.assign(Object.create(PlainClassTypes[tagged.__type].prototype), tagged.fields);
	}
	guard(false, () => `Unknown __type marker during revival: ${tagged.__type}`);
}

function reviveNonFiniteNumber(value: { __nonFinNum: string }): number {
	const tag = value.__nonFinNum;
	if(tag === 'NaN') {
		return Number.NaN;
	}
	return tag === 'Infinity' ? Infinity : -Infinity;
}

function reviveReferenceById(value: { __ref: number }, revivedById: Map<number, unknown>): unknown {
	const ref = value.__ref;
	guard(revivedById.has(ref), () => `Unknown reference id: ${ref}`);
	return revivedById.get(ref);
}

function reviveBuiltinRef(value: BuiltinRefMarker, ctx: FlowrAnalyzerContext): unknown {
	const ref = value.__builtinRef;
	const name = NodeId.fromBuiltIn(ref);
	const defs = ctx.env.builtInEnvironment.memory.get(name);
	const found = defs?.find(d => d.definedAt === ref);
	guard(found !== undefined, () => `Unknown builtin ref: ${ref}`);
	return found;
}

function reviveKnownFnRef(value: KnownFunctionRefMarker): unknown {
	const ref = value.__knownFnRef;
	const found = KnownStaticCallbacks[ref];
	guard(found !== undefined, () => `Unknown known-function ref: ${ref}`);
	return found;
}

function reviveInProcessFnRef(value: InProcessFunctionRefMarker): unknown {
	const ref = value.__inProcFnRef;
	const found = inProcessFunctions.get(ref);
	guard(found !== undefined, () => `Unknown in-process function ref: ${ref}`);
	return found;
}

function reviveTypeTag(value: TaggedValue & { __id?: number }, revivedById: Map<number, unknown>): unknown {
	const revived = reviveTaggedValue(value);
	if(value.__id !== undefined) {
		revivedById.set(value.__id, revived);
	}
	return revived;
}

function reviveIdTag(value: { __id: number, [key: string]: unknown }, revivedById: Map<number, unknown>): unknown {
	const { __id: id, ...rest } = value;
	revivedById.set(id, rest);
	return rest;
}

function patchUndefinedMarkers(container: object): void {
	if(Array.isArray(container)) {
		for(let i = 0; i < container.length; i++) {
			if(isUndefinedMarker(container[i])) {
				container[i] = undefined;
			}
		}
	} else {
		const record = container as Record<string, unknown>;
		for(const key of Object.keys(record)) {
			if(isUndefinedMarker(record[key])) {
				record[key] = undefined;
			}
		}
	}
}

/**
 * Builds the `JSON.parse` reviver that undoes {@link createPersistenceReplacer}.
 */
export function makeJsonReviver(ctx: FlowrAnalyzerContext) {
	const revivedById = new Map<number, unknown>();

	return function jsonReviver(key: string, value: unknown): unknown {
		if(value === '<BuiltInEnvironment>') {
			return ctx.env.builtInEnvironment;
		}
		if(value === '<EmptyBuiltInEnvironment>') {
			return ctx.env.emptyBuiltInEnvironment;
		}
		if(!value || typeof value !== 'object') {
			return jsonBigIntRetriever(key, value);
		}

		patchUndefinedMarkers(value);

		if('__nonFinNum' in value) {
			return reviveNonFiniteNumber(value as { __nonFinNum: string });
		}
		if('__ref' in value) {
			return reviveReferenceById(value as { __ref: number }, revivedById);
		}
		if('__builtinRef' in value) {
			return reviveBuiltinRef(value as BuiltinRefMarker, ctx);
		}
		if('__knownFnRef' in value) {
			return reviveKnownFnRef(value as KnownFunctionRefMarker);
		}
		if('__inProcFnRef' in value) {
			return reviveInProcessFnRef(value as InProcessFunctionRefMarker);
		}
		if('__type' in value) {
			return reviveTypeTag(value as TaggedValue & { __id?: number }, revivedById);
		}
		if('__id' in value) {
			return reviveIdTag(value as { __id: number, [key: string]: unknown }, revivedById);
		}
		return jsonBigIntRetriever(key, value);
	};
}

/**
 * Wrapper around `JSON.parse` with {@link makeJsonReviver}.
 */
export function reviveJson<T>(text: string, ctx: FlowrAnalyzerContext): T {
	return JSON.parse(text, makeJsonReviver(ctx)) as T;
}