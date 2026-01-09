import { Top, type Domain, type Lift } from '../domain';
import type { NodeId , Node } from '../graph';
import { sprintf } from 'sprintf-js';

export type Const = {
	kind:  'const',
	value: string,
}

export const ConstDomain: Domain<Const> = {
	infer(node: Node, deps: ReadonlyMap<NodeId, Lift<Const>>): Lift<Const> {
		switch(node.type) {
			case 'const': {
				return { kind: 'const', value: node.value };
			}

			case 'alias': {
				return deps.get(node.to) ?? Top;
			}

			case 'concat': {
				if(node.params.length === 0) {
					return Top;
				}
				const values = node.params.map(nid => deps.get(nid) ?? Top);
				if(values.length === 1) {
					return values[0];
				}
				const separator = deps.get(node.separator) ?? Top;
				if(separator.kind !== 'const') {
					return Top;
				}
				if(!values.every(it => it.kind === 'const')) {
					return Top;
				}
				return { kind: 'const', value: values.map(it => it.value).join(separator.value) };
			}

			case 'join': {
				if(node.params.length === 0) {
					return Top;
				}
				const values = node.params.map(nid => deps.get(nid) ?? Top);
				if(values.every(v => this.equals(v, values[0]))) {
					return values[0];
				} else {
					return Top;
				}
			}

			case 'casing': {
				const value = deps.get(node.value) ?? Top;
				if(value.kind !== 'const') {
					return value;
				}
				let result;
				if(node.to === 'upper') {
					result = value.value.toUpperCase();
				} else if(node.to === 'lower') {
					result = value.value.toLowerCase();
				} else {
					throw new Error('unreachable');
				}
				return { kind: 'const', value: result };
			}

			case 'function': {
				switch(node.name) {
					case 'sprintf': {
						if(node.named.length !== 0) {
							return Top;
						}
						if(node.positional.length < 1) {
							return Top;
						}
						const positional = node.positional.map(it => deps.get(it) ?? Top);
						if(!positional.every(it => it.kind === 'const')) {
							return Top;
						}
						const fmt = positional[0];
						const args = positional.slice(1);
						return { kind: 'const', value: sprintf(fmt.value, ...args.map(it => it.value)) };
					}

					default:
						return Top;
				}
			}

			case 'implicit-conversion': {
				if(node.value.length === 1) {
					return { kind: 'const', value: node.value[0] };
				} else {
					return Top;
				}
			}

			case 'unknown': {
				return Top;
			}
		}
	},

	widen(/* node, deps */) {
		return Top;
	},

	equals(l: Lift<Const>, r: Lift<Const>): boolean {
		if(l.kind === 'const' && r.kind === 'const') {
			return l.value === r.value;
		} else {
			return l.kind === r.kind;
		}
	},

	represents(str, value): boolean {
		if(value.kind === 'top') {
			return true;
		} else if(value.kind === 'bottom') {
			return false;
		} else {
			return value.value === str;
		}
	},

	leq(l, r): boolean {
		if(l.kind === 'bottom' || r.kind === 'top') {
			return true;
		} else if(l.kind === 'top' || r.kind === 'bottom') {
			return false;
		} else {
			return l.value === r.value;
		}
	},
};
