import { type CloneAst, cloneChildren, mixHash } from '../clone-ast';

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
	/** the minimal number of nodes (mass) of a subtree */
	readonly massThreshold:       number;
	/** pairs need a similarity strictly above this value */
	readonly similarityThreshold: number;
}

/** The structural hash of every subtree, which ignores the lexemes of leaves. */
export function structuralHashes(ast: CloneAst): Int32Array {
	const h = new Int32Array(ast.token.length);
	for(let i = h.length - 1; i >= 0; i--) {
		h[i] = ast.token[i];
		for(const c of cloneChildren(ast, i)) {
			h[i] = mixHash(h[i], h[c]);
		}
	}
	return h;
}

/** Baxter's CompareTree: the number of shared nodes, matching children by position and leaves by lexeme. */
export function sharedNodes(a: CloneAst, i: number, b: CloneAst, j: number): number {
	if(a.token[i] !== b.token[j]) {
		return 0;
	}
	let shared = a.lex[i] === b.lex[j] ? 1 : 0;
	for(let ci = i + 1, cj = j + 1; ci < i + a.size[i] && cj < j + b.size[j]; ci += a.size[ci], cj += b.size[cj]) {
		shared += sharedNodes(a, ci, b, cj);
	}
	return shared;
}

/** Baxter's similarity `2S / (2S + L + R)` of two subtrees. */
export function treeSimilarity(a: CloneAst, i: number, b: CloneAst, j: number): number {
	const s = sharedNodes(a, i, b, j);
	return 2 * s / (a.size[i] + b.size[j]);
}

/**
 * The basic algorithm of Baxter et al., "Clone Detection Using Abstract Syntax Trees" (ICSM 1998): subtrees of at
 * least `massThreshold` nodes are bucketed by {@link structuralHashes} and compared within their bucket. Buckets are
 * processed by decreasing mass, so a pair is skipped if a member lies within a member of a pair accepted before
 * (the paper removes such pairs afterwards). Roots of files and pairs of a subtree with its ancestor are skipped.
 * @example
 * ```ts
 * const { pairs } = baxterClones(index.files, { massThreshold: 30, similarityThreshold: 0.9 });
 * ```
 */
export function baxterClones(asts: readonly CloneAst[], config: BaxterConfig): { readonly pairs: BaxterPair[], readonly subtrees: number, readonly comparisons: number } {
	const buckets = new Map<number, SubtreeRef[]>();
	let subtrees = 0, comparisons = 0;
	asts.forEach((ast, file) => structuralHashes(ast).forEach((h, node) => {
		if(node > 0 && ast.size[node] >= config.massThreshold) {
			subtrees++;
			const bucket = buckets.get(h);
			if(bucket) {
				bucket.push({ file, node });
			} else {
				buckets.set(h, [{ file, node }]);
			}
		}
	}));
	const mass = (r: SubtreeRef) => asts[r.file].size[r.node];
	const within = (inner: SubtreeRef, outer: SubtreeRef) => inner.file === outer.file && inner.node >= outer.node && inner.node < outer.node + mass(outer);
	const covered = asts.map(a => new Uint8Array(a.token.length));
	const pairs: BaxterPair[] = [];
	for(const bucket of [...buckets.values()].filter(b => b.length > 1).sort((x, y) => mass(y[0]) - mass(x[0]))) {
		const before = pairs.length;
		bucket.forEach((i, x) => bucket.slice(x + 1).forEach(j => {
			if(!covered[i.file][i.node] && !covered[j.file][j.node] && !within(i, j) && !within(j, i)) {
				comparisons++;
				const similarity = treeSimilarity(asts[i.file], i.node, asts[j.file], j.node);
				if(similarity > config.similarityThreshold) {
					pairs.push({ a: i, b: j, similarity });
				}
			}
		}));
		for(const r of pairs.slice(before).flatMap(p => [p.a, p.b])) {
			covered[r.file].fill(1, r.node + 1, r.node + mass(r));
		}
	}
	return { pairs, subtrees, comparisons };
}
