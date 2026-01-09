import type { NodeId as AstNodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { Domain, Lift, Value } from './domain';
import { Top } from './domain';
import { MultiMap } from './multi-map';
import { NoDupQueue } from './no-dup-queue';

export type NodeId = AstNodeId;

export type Node = ConstNode | AliasNode | ConcatNode | JoinNode | CasingNode | FunctionNode | ImplicitConversionNode | UnknownNode

export type UnknownNode = {
  readonly type: 'unknown',
}

export type ConstNode = {
  readonly type:  'const'
  readonly value: string
}

export type AliasNode = {
  readonly type: 'alias'
  readonly to:   NodeId,
}

export type ConcatNode = {
  readonly type:      'concat'
  readonly params:    readonly NodeId[],
  readonly separator: NodeId,
}

export type JoinNode = {
  readonly type:   'join',
  readonly params: readonly NodeId[],
}

export type CasingNode = {
  readonly type:  'casing',
  readonly to:    'upper' | 'lower',
  readonly value: NodeId,
}

export type FunctionNode = {
  readonly type:       'function',
  readonly name:       string,
  readonly positional: readonly NodeId[],
  readonly named:      readonly [string, NodeId][],
}

export type ImplicitConversionNode = {
  readonly type:  'implicit-conversion',
  // origin of the converted value
  readonly of:    NodeId,
  // The values returned by resolveIdToValue
  readonly value: string[],
}

function depsOfNode(node: Node): readonly NodeId[] {
	switch(node.type) {
		case 'const':
			return [];

		case 'alias':
			return [node.to];

		case 'concat':
			return [...node.params, node.separator];

		case 'join':
			return node.params;

		case 'casing':
			return [node.value];

		case 'function':
			return [...node.positional, ...node.named.map(it => it[1])];

		case 'implicit-conversion':
			return [node.of];

		case 'unknown':
			return [];
	}
}

export class Graph {
	private _nodes:       Map<NodeId, Node> = new Map();
	private _deps:        MultiMap<NodeId, NodeId> = new MultiMap();
	private _reverseDeps: MultiMap<NodeId, NodeId> = new MultiMap();

	nodes(): ReadonlyMap<NodeId, Node> {
		return this._nodes;
	}

	depsOf(nid: NodeId): ReadonlySet<NodeId> {
		return this._deps.get(nid);
	}

	havingDep(nid: NodeId): ReadonlySet<NodeId> {
		return this._reverseDeps.get(nid);
	}

	hasNode(nid: NodeId) {
		return this._nodes.has(nid);
	}
  
	getNode(nid: NodeId) {
		return this._nodes.get(nid);
	}

	insertNode(nid: NodeId, node: Node): NodeId {
		const deps = depsOfNode(node);

		this._nodes.set(nid, node);
		this._deps.insert(nid, ...deps);
		deps.forEach(dep => this._reverseDeps.insert(dep, nid));
		return nid;
	}

	removeNode(nid: NodeId) {
		if(this._nodes.has(nid)) {
			this._nodes.delete(nid);
			const deps = this._deps.remove(nid);
			deps.forEach(dep => this._reverseDeps.remove(dep, nid));
		}
	}

	insertIfMissing(nid: NodeId, node: Node): NodeId {
		if(this._nodes.has(nid)) {
			return nid;
		} else {
			return this.insertNode(nid, node);
		}
	}

	inferValues<T extends Value>(domain: Domain<T>, max_updates: number = 100): Map<NodeId, Lift<T>> {
		const values = new Map<NodeId, Lift<T>>(this._nodes.keys().map(nid => [nid, Top]));
		const dirty = new NoDupQueue<NodeId>(...this._nodes.keys());
		const updates = new Map<NodeId, number>(this._nodes.keys().map(nid => [nid, 0]));

		let nid;
		while((nid = dirty.pop()) !== undefined) {
			const update = updates.get(nid)!;
			if(update > max_updates) {
				continue;
			}
      
			const node = this._nodes.get(nid)!;
			const previousValue = values.get(nid)!;
			const value = update >= max_updates ? domain.widen(node, values) : domain.infer(node, values);

			if(!domain.equals(previousValue, value)) {
				values.set(nid, value);
				dirty.push(...this._reverseDeps.get(nid).values());
				updates.set(nid, update + 1);
			}
		}

		return values;
	}
}
