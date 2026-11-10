import { type CloneTree, leafText } from '../clone-ast';
import { DefaultMap } from '../../util/collections/defaultmap';

/** A subtree: the file (index into the trees) and its preorder index. */
export interface SubtreeRef {
	readonly file: number;
	readonly node: number;
}

export interface BaxterConfig {
	/** the minimal number of nodes (mass) of a subtree */
	readonly massThreshold:       number;
	/** pairs need a similarity strictly above this value */
	readonly similarityThreshold: number;
}

/** Baxter's similarity `2S / (2S + L + R)` of two subtrees, with S the shared nodes: children match by position, leaves by lexeme. */
export function treeSimilarity(a: CloneTree, i: number, b: CloneTree, j: number): number {
	const shared = (i: number, j: number): number => {
		if(a.shape[i] !== b.shape[j]) {
			return 0;
		}
		let s = leafText(a.nodes[i]) === leafText(b.nodes[j]) ? 1 : 0;
		for(let ci = i + 1, cj = j + 1; ci < i + a.size[i] && cj < j + b.size[j]; ci += a.size[ci], cj += b.size[cj]) {
			s += shared(ci, cj);
		}
		return s;
	};
	return 2 * shared(i, j) / (a.size[i] + b.size[j]);
}

/**
 * The basic algorithm of Baxter et al., "Clone Detection Using Abstract Syntax Trees" (ICSM 1998): subtrees of at
 * least `massThreshold` nodes are bucketed by their shape (ignoring the lexemes of leaves) and compared within their bucket.
 * Buckets are processed by decreasing mass, so a pair is skipped if a member lies within a member of a pair accepted
 * before (the paper removes such pairs afterwards). Roots of files and pairs of a subtree with its ancestor are skipped.
 * @example
 * ```ts
 * const { pairs } = baxterClones(index.files.map(f => cloneTree(f, index.perspective)), { massThreshold: 30, similarityThreshold: 0.9 });
 * ```
 */
export function baxterClones(trees: readonly CloneTree[], config: BaxterConfig): { readonly pairs: { a: SubtreeRef, b: SubtreeRef, similarity: number }[], readonly subtrees: number, readonly comparisons: number } {
	const shapes: DefaultMap<string, number> = new DefaultMap(() => shapes.size());
	const buckets = new DefaultMap<number, SubtreeRef[]>(() => []);
	let subtrees = 0, comparisons = 0;
	trees.forEach((tree, file) => {
		const key: number[] = [];
		for(let i = tree.nodes.length - 1; i >= 0; i--) {
			let s = tree.shape[i];
			for(let c = i + 1; c < i + tree.size[i]; c += tree.size[c]) {
				s += ` ${key[c]}`;
			}
			key[i] = shapes.get(s);
			if(i > 0 && tree.size[i] >= config.massThreshold) {
				subtrees++;
				buckets.get(key[i]).push({ file, node: i });
			}
		}
	});
	const mass = (r: SubtreeRef) => trees[r.file].size[r.node];
	const within = (inner: SubtreeRef, outer: SubtreeRef) => inner.file === outer.file && inner.node >= outer.node && inner.node < outer.node + mass(outer);
	const covered = trees.map(t => new Uint8Array(t.nodes.length));
	const pairs: { a: SubtreeRef, b: SubtreeRef, similarity: number }[] = [];
	for(const bucket of [...buckets.values()].filter(b => b.length > 1).sort((x, y) => mass(y[0]) - mass(x[0]))) {
		const before = pairs.length;
		bucket.forEach((i, x) => bucket.slice(x + 1).forEach(j => {
			if(!covered[i.file][i.node] && !covered[j.file][j.node] && !within(i, j) && !within(j, i)) {
				comparisons++;
				const similarity = treeSimilarity(trees[i.file], i.node, trees[j.file], j.node);
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
