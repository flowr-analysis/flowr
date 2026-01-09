import { Domain, Lift, Top, Value } from "../domain";
import { Node, NodeId } from "../graph";

const sprintf = require('sprintf-js').sprintf;

export interface Presuffix extends Value<'presuffix'> {
  prefix: string,
  suffix: string,
  exact: boolean,
}

export const PresuffixDomain: Domain<Presuffix> = {
  infer: function(node: Node, deps: ReadonlyMap<NodeId, Lift<Presuffix>>): Lift<Presuffix> {
  	switch (node.type) {
  		case "const": {
				return { kind: "presuffix", prefix: node.value, suffix: node.value, exact: true }
			}

			case "alias": {
				return deps.get(node.to) ?? Top
			}

			case "concat": {
				if (node.params.length === 0) return Top
				let values = node.params.map(nid => deps.get(nid) ?? Top)
				if (values.length === 1) return values[0]
				const separator = deps.get(node.separator) ?? Top

				values = values.flatMap((it, i) => {
					if (i === 0) return [it]
					else return [separator, it]
				})

				if (values.every(it => it.kind === "presuffix" && it.exact === true)) {
					const value = values.map(it => (it as Presuffix).prefix).join("")
					return { kind: "presuffix", prefix: value, suffix: value, exact: true }
				}

				let nonTopPrefixes = takeWhile(values, it => it.kind === "presuffix") as Presuffix[]
				let exactPrefixes = takeWhile(nonTopPrefixes, it => it.exact === true)
				let prefix = ""
				for (const value of exactPrefixes) {
					prefix += value.prefix
				}
				prefix += nonTopPrefixes.at(exactPrefixes.length)?.prefix ?? ""

				let nonTopSuffixes = takeWhile(values.toReversed(), it => it.kind === "presuffix") as Presuffix[]
				let exactSuffixes = takeWhile(nonTopSuffixes, it => it.exact === true)
				let suffix = ""
				for (const value of exactSuffixes) {
					suffix = value.suffix + suffix
				}
				suffix = (nonTopSuffixes.at(exactSuffixes.length)?.suffix ?? "") + suffix

				if (prefix === "" && suffix === "") return Top
				else return { kind: "presuffix", prefix, suffix, exact: false }
			}

			case "join": {
				if (node.params.length === 0) return Top
				const values = node.params.map(nid => deps.get(nid) ?? Top)
				if (!values.every(v => v.kind === "presuffix")) return Top
				const result = values.reduce((l, r) => {
					let prefix = longestCommonPrefix(l.prefix, r.prefix)
					let suffix = longestCommonSuffix(l.suffix, r.suffix)
					let exact = l.exact && r.exact && l.prefix === r.prefix
					return { kind: "presuffix", prefix, suffix, exact }
				})
				if (result.prefix === "" && result.suffix === "" && !result.exact) return Top
				else return result
			}

			case "casing": {
				let value = deps.get(node.value) ?? Top
				if (value.kind !== "presuffix") return value
				let result: Presuffix = { ...value }
				if (node.to === "upper") {
				  result.prefix = result.prefix.toLowerCase()
				  result.suffix = result.suffix.toLowerCase()
				} else if (node.to === "lower") {
				  result.prefix = result.prefix.toLowerCase()
				  result.suffix = result.suffix.toLowerCase()
				} else throw "unreachable"
				return result
			}

			case "function": {
				switch (node.name) {
					case "sprintf": {
  					if (node.named.length !== 0) return Top
  					if (node.positional.length < 1) return Top
  					const positional = node.positional.map(it => deps.get(it) ?? Top)
  					if (!positional.every(it => it.kind === "presuffix" && it.exact)) return Top
  					const fmt = positional[0] as Presuffix
  					const args = positional.slice(1) as Presuffix[]
  					const value = sprintf(fmt.prefix, args.map(it => it.prefix))
				  	return { kind: "presuffix", prefix: value, suffix: value, exact: true  }
					}

					default:
						return Top
				}
			}

			case "implicit-conversion": {
				if (node.value.length === 1) {
					return { kind: "presuffix", prefix: node.value[0], suffix: node.value[0], exact: true }
				} else if (node.value.length > 1) {
					const result = node.value
						.map(it => ({
							kind: "presuffix",
							prefix: it,
							suffix: it,
							exact: true,
						} as Presuffix))
						.reduce((l, r) => {
							let prefix = longestCommonPrefix(l.prefix, r.prefix)
							let suffix = longestCommonSuffix(l.suffix, r.suffix)
							let exact = l.exact && r.exact && l.prefix === r.prefix
							return { kind: "presuffix", prefix, suffix, exact }
						})

					if (result.prefix === "" && result.suffix === "" && !result.exact) return Top
					else return result
				} else {
					return Top
				} 
			}

			case "unknown": {
				return Top
			}
  	}
  },

  widen: function(node: Node, deps: ReadonlyMap<NodeId, Lift<Presuffix>>): Lift<Presuffix> {
		return Top
  },

  equals: function(l: Lift<Presuffix>, r: Lift<Presuffix>): boolean {
    if (l.kind === "presuffix" && r.kind === "presuffix") return l.prefix === r.prefix && l.suffix === r.suffix && l.exact === r.exact
    else return l.kind === r.kind
  },

  represents: function(str: string, value: Lift<Presuffix>): boolean {
	  if (value.kind === "top") return true
	  else if (value.kind === "bottom") return false
	  else if (value.exact === true) return str === value.prefix
	  else return str.startsWith(value.prefix) && str.endsWith(value.suffix)
  }
}

function takeWhile<T>(array: T[], predicate: (value: T, i: number) => boolean) {
	let result: T[] = []
	for (let i = 0; i < array.length; i++) {
		const value = array[i]
		if (predicate(value, i)) result.push(value)
		else break
	}
	return result
}

export function longestCommonPrefix(a: string, b: string): string {
	let min = Math.min(a.length, b.length)
	let prefix = ""

	for (let i = 0; i < min; i++) {
		if (a[i] === b[i]) prefix += a[i]
		else break
	}
	
	return prefix
}

export function longestCommonSuffix(a: string, b: string): string {
	let min = Math.min(a.length, b.length)
	let suffix = ""

	for (let i = 1; i <= min; i++) {
		if (a[a.length - i] === b[b.length - i]) suffix = a[a.length - i] + suffix
		else break
	}
	
	return suffix
}
