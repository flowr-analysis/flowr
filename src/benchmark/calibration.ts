/**
 * A small, fixed, and purely synthetic workload used to calibrate the benchmark results.
 *
 * Publishing its runtime alongside the real measurements allows a viewer to normalize the other numbers by it,
 * and hence to cancel out how fast or how loaded the machine was that produced them.
 * The workload must therefore stay deterministic (no file system, no R session, no randomness)
 * and cheap (well below a second).
 * @module
 */

/** How often the {@link calibrationRound} is timed within one {@link runCalibration} call. */
export const CalibrationReps = 6;
/** How many elements a single {@link calibrationRound} works on. */
export const CalibrationSize = 4096;

/** the checksums land here, so that no engine can decide the workload has no effect and drop it */
let sink = 0;

/** xorshift32 with a fixed seed so that every round does the exact same work */
function nextRandom(state: number): number {
	state ^= state << 13;
	state ^= state >>> 17;
	state ^= state << 5;
	return state | 0;
}

/**
 * One round of the calibration workload, mixing integer arithmetic, array sorting, string handling,
 * short-lived objects, and map lookups to cover the operations that dominate the analysis itself.
 *
 * Every round does the very same work, which is what allows {@link runCalibration} to compare its repetitions.
 * @returns a checksum, only returned so that the work cannot be optimized away
 */
function calibrationRound(): number {
	let state = 0x1337;
	const numbers = new Array<number>(CalibrationSize);
	for(let i = 0; i < CalibrationSize; i++) {
		state = nextRandom(state);
		numbers[i] = state % 100_000;
	}
	numbers.sort((a, b) => a - b);

	/* the analysis spends most of its time on small objects that die young, so the workload allocates some too */
	const nodes: { id: string, value: number, next: number }[] = [];
	const map = new Map<string, number>();
	const seen = new Set<string>();
	for(let i = 0; i < CalibrationSize; i++) {
		const key = `k${numbers[i] % 512}`;
		nodes.push({ id: key, value: numbers[i], next: i + 1 });
		map.set(key, (map.get(key) ?? 0) + i);
		seen.add(key);
	}

	let checksum = seen.size;
	for(const [key, value] of map) {
		checksum = (checksum + key.length * value) | 0;
	}
	for(const node of nodes) {
		checksum = (checksum + node.id.length + (node.value & 0xff) + node.next) | 0;
	}
	for(let i = 0; i < CalibrationSize; i++) {
		checksum = (checksum + Math.floor(Math.sqrt(numbers[i] + 1))) | 0;
	}
	return checksum;
}

/**
 * Times {@link calibrationRound} {@link CalibrationReps} times and reports the fastest of them.
 *
 * The first round is thrown away: it pays for compiling the workload and would describe the engine
 * rather than the machine. Of the rounds that follow, only the fastest counts, because every
 * disturbance a shared runner can add (another job, a scheduler switch, a collection) can only ever
 * make a round slower. That makes the number a statement about the machine, not about its bad luck.
 * @returns the nanoseconds the fastest round took
 */
export function runCalibration(): bigint {
	sink = calibrationRound();
	let best: bigint | undefined = undefined;
	for(let rep = 0; rep < CalibrationReps; rep++) {
		const start = process.hrtime.bigint();
		sink = (sink + calibrationRound()) | 0;
		const took = process.hrtime.bigint() - start;
		if(best === undefined || took < best) {
			best = took;
		}
	}
	return best ?? 0n;
}

/** the checksum of the rounds run so far, only exposed so that the workload has an observable effect */
export function calibrationChecksum(): number {
	return sink;
}
