import { Domain, Lift, Top } from '../domain'
import { NodeId, type Node } from "../graph"

const sprintf = require('sprintf-js').sprintf;

export type ConstSet = {
  kind:  'const-set',
  value: string[],
}

export const MAX_VARIANTS = 1_000

export const ConstSetDomain: Domain<ConstSet> = {
  infer: function(node: Node, deps: ReadonlyMap<NodeId, Lift<ConstSet>>): Lift<ConstSet> {
  	switch (node.type) {
  		case "const": {
  			return { kind: "const-set", value: [node.value] }
  		}

			case "alias": {
				return deps.get(node.to) ?? Top
			}

  		case "concat": {
				if (node.params.length === 0) return Top
				const values = node.params.map(nid => deps.get(nid) ?? Top)
				if (values.length === 1) return values[0]
				const separator = deps.get(node.separator) ?? Top
				if (separator.kind !== "const-set") return Top
				if (!values.every(it => it.kind === "const-set")) return Top
				const variants = separator.value.length * values
					.map(it => it.value.length)
					.reduce((l, r) => l * r);
				if(variants > MAX_VARIANTS) return Top
				return {
					kind: "const-set",
					value: values.slice(1).reduce(
						(l, r) => l
							.flatMap(l => separator.value.map(s => l + s))
							.flatMap(l => r.value.map(r => l + r)),
						values[0].value
					)
				}
  		}

  		case "join": {
				if (node.params.length === 0) return Top
				const values = node.params.map(nid => deps.get(nid) ?? Top)
				if (!values.every(v => v.kind === "const-set")) return Top
				const variants = values.reduce((acc, val) => acc + val.value.length, 0);
				// includes duplicates
				if(variants > MAX_VARIANTS) return Top
				// deduplicated
				const value = [...new Set(values.flatMap(it => it.value))];
				return { kind: "const-set", value }
  		}

  		case "casing": {
				let value = deps.get(node.value) ?? Top
				if (value.kind !== "const-set") return value
				let result
				if (node.to === "upper") result = value.value.map(it => it.toUpperCase())
				else if (node.to === "lower") result = value.value.map(it => it.toLowerCase())
				else throw new Error("unreachable")
				return { kind: "const-set", value: result }
  		}

  		case "function": {
  			switch (node.name) {
  				case "sprintf": {
  					if (node.named.length !== 0) return Top
  					if (node.positional.length < 1) return Top
  					const positional = node.positional.map(it => deps.get(it) ?? Top)
  					if (!positional.every(it => it.kind === "const-set")) return Top
  					const fmt = positional[0]
  					const args = positional.slice(1)
						const variants = fmt.value.length * args
							.map(it => it.value.length)
							.reduce((l, r) => l * r);

						if(variants > MAX_VARIANTS) return Top
						const values = args.reduce(
							(l, r) => l
								.flatMap(l => r.value.map(r => [...l, r])),
							fmt.value.map(it => [it])
						);

						const results = values.map(args => sprintf(...args) as string);
						return { kind: "const-set", value: results }
  				}

  				default:
  					return Top
  			}
  		}

			case "implicit-conversion": {
				return { kind: "const-set", value: node.value }
			}

			case "unknown": {
				return Top
			}
  	}
  },

  widen(/* node, deps */) {
  		return Top
  },

  equals: function(l: Lift<ConstSet>, r: Lift<ConstSet>): boolean {
  	if (l.kind === "const-set" && r.kind === "const-set") return arrayEquals([...l.value], [...r.value])
		if (l.kind === r.kind) return true
		else return false 
  },

  represents: function(str: string, value: Lift<ConstSet>): boolean {
	  if (value.kind === "top") return true
	  else if (value.kind === "bottom") return false
	  else return value.value.some(it => it === str)
  }
}

function arrayEquals<T>(left: T[], right: T[]): boolean {
  if (left.length !== right.length) return false;

  while (left.length > 0) {
    const value = left.pop()!;
    const index = right.findIndex(it => it === value);
    if (index === -1) return false;
    else right.splice(index, 1)
  }

  return true;
}
