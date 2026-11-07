/*
 * AST-based clone detection after Baxter, Yahin, Moura, Sant'Anna, and Bier.
 * "Clone Detection Using Abstract Syntax Trees", ICSM 1998 (the CloneDR basic algorithm):
 * ```
 * 1. Clones = {}
 * 2. For each subtree i:
 *      If mass(i) >= MassThreshold Then hash i to bucket
 * 3. For each subtree i and j in the same bucket
 *      If CompareTree(i,j) > SimilarityThreshold Then {
 *        For each subtree s of i: If IsMember(Clones,s) Then RemoveClonePair(Clones,s)
 *        For each subtree s of j: If IsMember(Clones,s) Then RemoveClonePair(Clones,s)
 *        AddClonePair(Clones,i,j)
 *      }
 * ```
 * with `Similarity = 2*S / (2*S + L + R)`, where S is the number of shared nodes and L and R the number of nodes
 * only in the first and only in the second tree. The hash function ignores identifier names (here: all leaf lexemes),
 * so that near-miss clones which differ only in identifiers or constants land in the same bucket.
 */
import { type CloneAst, CloneNodeKind, cloneLabel, hashString, mixHash } from '../clone-ast';

/** A subtree: the file (index into the ASTs) and its preorder index. */
export interface SubtreeRef {
	readonly file: number;
	readonly node: number;
}

export interface BaxterPair {
	readonly a:          SubtreeRef;
	readonly b:          SubtreeRef;
	readonly similarity: number;
}

export interface BaxterConfig {
	/** minimal number of AST nodes (mass) of a subtree to be considered */
	readonly massThreshold:       number;
	/** pairs need a similarity strictly above this value (the paper uses `>`) */
	readonly similarityThreshold: number;
}

function isLeafKind(k: number): boolean {
	return k === CloneNodeKind.Symbol || k === CloneNodeKind.Number || k === CloneNodeKind.String || k === CloneNodeKind.Logical
		|| k === CloneNodeKind.Parameter || k === CloneNodeKind.Argument;
}

/** The structural hash of every subtree, ignoring leaf lexemes, computed bottom-up. */
export function structuralHashes(ast: CloneAst): Int32Array {
	const n = ast.kind.length;
	const h = new Int32Array(n);
	const labels = new Map<string, number>();
	for(let i = n - 1; i >= 0; i--) {
		const label = cloneLabel(ast, i);
		let v = labels.get(label);
		if(v === undefined) {
			v = hashString(label);
			labels.set(label, v);
		}
		const end = i + ast.size[i];
		let arity = 0;
		for(let c = i + 1; c < end; c += ast.size[c]) {
			v = mixHash(v, h[c]);
			arity++;
		}
		h[i] = mixHash(v, arity);
	}
	return h;
}

/**
 * CompareTree: walks both trees in parallel, matching children by position. Nodes with equal labels are shared
 * (leaves additionally need equal lexemes); a label mismatch makes both whole subtrees unshared.
 * Returns the number of shared nodes S.
 */
export function sharedNodes(a: CloneAst, i: number, b: CloneAst, j: number): number {
	if(a.kind[i] !== b.kind[j] || a.op[i] !== b.op[j]) {
		return 0;
	}
	let shared = isLeafKind(a.kind[i]) && a.lex[i] !== b.lex[j] ? 0 : 1;
	const ae = i + a.size[i], be = j + b.size[j];
	let ci = i + 1, cj = j + 1;
	while(ci < ae && cj < be) {
		shared += sharedNodes(a, ci, b, cj);
		ci += a.size[ci];
		cj += b.size[cj];
	}
	return shared;
}

/**
 * Baxter's similarity `2S / (2S + L + R)` of two subtrees, 1 for subtrees equal in structure and leaves.
 * @example
 * ```ts
 * treeSimilarity(ast, ast.functions[0].node, ast, ast.functions[1].node); // two function definitions of one file
 * ```
 */
export function treeSimilarity(a: CloneAst, i: number, b: CloneAst, j: number): number {
	const s = sharedNodes(a, i, b, j);
	const l = a.size[i] - s, r = b.size[j] - s;
	return 2 * s / (2 * s + l + r);
}

/** whether `inner` lies within the subtree of `outer` (both in the same file) */
function within(asts: readonly CloneAst[], inner: SubtreeRef, outer: SubtreeRef): boolean {
	return inner.file === outer.file && inner.node >= outer.node && inner.node < outer.node + asts[outer.file].size[outer.node];
}

/**
 * Runs the basic algorithm over all subtrees of all `asts`. The paper removes every pair one of whose members is a
 * subtree of a member of a pair it adds. Processing the buckets in order of decreasing mass makes that a filter: a
 * pair is skipped if one of its members lies strictly within a member of a pair added before (the pairs added before
 * are at least as large, so with any order the final set is the same). Pairs of a subtree with its own ancestor are
 * skipped, as they are no clones but containment.
 * This works on any list of files, so unlike the token-based detectors it finds clones of all sizes at once, and it
 * only reports a pair if both subtrees have the same structure hash (so a clone needs the same shape, differing in leaves only).
 * Raise `massThreshold` to ignore small subtrees, which otherwise dominate the results.
 * @example
 * ```ts
 * const { pairs } = baxterClones(index.files, { massThreshold: 30, similarityThreshold: 0.9 });
 * for(const { a, b, similarity } of pairs) {
 *   console.log(index.files[a.file].file, a.node, index.files[b.file].file, b.node, similarity);
 * }
 * ```
 */
export function baxterClones(asts: readonly CloneAst[], config: BaxterConfig): { readonly pairs: BaxterPair[], readonly subtrees: number, readonly comparisons: number } {
	const buckets = new Map<number, SubtreeRef[]>();
	let subtrees = 0;
	let comparisons = 0;
	for(let f = 0; f < asts.length; f++) {
		const ast = asts[f];
		const hashes = structuralHashes(ast);
		for(let i = 0; i < ast.kind.length; i++) {
			if(ast.size[i] < config.massThreshold || ast.kind[i] === CloneNodeKind.ExpressionList && ast.parent[i] < 0) {
				continue;
			}
			subtrees++;
			let b = buckets.get(hashes[i]);
			if(b === undefined) {
				b = [];
				buckets.set(hashes[i], b);
			}
			b.push({ file: f, node: i });
		}
	}
	const ordered = [...buckets.values()].filter(b => b.length > 1);
	const massOf = (b: readonly SubtreeRef[]) => asts[b[0].file].size[b[0].node];
	ordered.sort((x, y) => massOf(y) - massOf(x));

	const covered = asts.map(a => new Uint8Array(a.kind.length));
	const cover = (r: SubtreeRef) => covered[r.file].fill(1, r.node + 1, r.node + asts[r.file].size[r.node]);
	const accepted: BaxterPair[] = [];
	for(const bucket of ordered) {
		const before = accepted.length;
		for(let x = 0; x < bucket.length; x++) {
			const i = bucket[x];
			for(let y = x + 1; y < bucket.length; y++) {
				const j = bucket[y];
				if(covered[i.file][i.node] || covered[j.file][j.node] || within(asts, i, j) || within(asts, j, i)) {
					continue;
				}
				comparisons++;
				const similarity = treeSimilarity(asts[i.file], i.node, asts[j.file], j.node);
				if(similarity > config.similarityThreshold) {
					accepted.push({ a: i, b: j, similarity });
				}
			}
		}
		/* the pairs of one bucket all have the same mass, so none of them lies within another */
		for(const p of accepted.slice(before)) {
			cover(p.a);
			cover(p.b);
		}
	}
	return { pairs: accepted, subtrees, comparisons };
}
