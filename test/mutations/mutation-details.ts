import fs from 'fs';
import path from 'path';
import { MutationCategory, MutationPasses } from '../functionality/_helper/mutation/mutation-passes';

/** where every shard of the counterexample checks records what it exercised */
export const MutationShardsDir = 'coverage/flowr-mutation-shards';
/** what all shards exercised together, which the benchmark page traces per release */
const MutationDetailsFile = 'coverage/flowr-mutation-details.json';

export interface MutationShardDetails {
	readonly shards:          number;
	readonly groups:          readonly string[];
	readonly counterexamples: number;
	readonly capabilities:    readonly string[];
	readonly mutants:         number;
}

/** Removes what an earlier run of the shards recorded, so a shard that does not finish leaves no stale record. */
export function setup(): void {
	fs.rmSync(MutationShardsDir, { recursive: true, force: true });
}

/** Merges what the shards recorded once all of them ran in full. */
export function teardown(): void {
	const files = fs.existsSync(MutationShardsDir) ? fs.readdirSync(MutationShardsDir) : [];
	const shards = files.map(f => JSON.parse(fs.readFileSync(path.join(MutationShardsDir, f), 'utf8')) as MutationShardDetails);
	if(shards.length === 0 || shards.length < shards[0].shards) {
		return;
	}
	fs.writeFileSync(MutationDetailsFile, JSON.stringify({
		passes:          MutationPasses.length,
		groups:          new Set(shards.flatMap(s => s.groups)).size,
		counterexamples: shards.reduce((sum, s) => sum + s.counterexamples, 0),
		capabilities:    new Set(shards.flatMap(s => s.capabilities)).size,
		mutants:         shards.reduce((sum, s) => sum + s.mutants, 0),
		categories:      Object.fromEntries(Object.values(MutationCategory).map(c => [c, MutationPasses.filter(p => p.category === c).map(p => p.name)]))
	}));
}
