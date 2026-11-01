/**
 * A small, fixed, and purely synthetic workload used to calibrate the benchmark results.
 *
 * Publishing its runtime alongside the real measurements allows a viewer to normalize the other numbers by it,
 * and hence to cancel out how fast or how loaded the machine was that produced them.
 * The workload must therefore stay deterministic (no file system, no R session, no randomness).
 *
 * Changing the work or the round count puts every future run on a new scale. Whoever changes it has to
 * back-correct the published history by the shift, or say so in the name of the measurement.
 * @module
 */

/** How many {@link calibrationBatch}es may be timed within one {@link runCalibration} call. */
export const CalibrationMaxReps = 24;
/** How many batches in a row may fail to beat the best one before it is taken as the machine's time. */
export const CalibrationSettle = 4;
/** How much closer than the best a batch has to be to count as an improvement rather than as noise. */
export const CalibrationImprovement = 0.005;
/** How many files of a suite carry the calibration, which describes the machine and not the file. */
export const CalibrationSamples = 8;
/** How many {@link calibrationRound}s make up one timed batch. */
export const CalibrationRounds = 256;
/** How many elements a single {@link calibrationRound} works on. */
export const CalibrationSize = 4096;

let sink = 0;

function nextRandom(state: number): number {
	state ^= state << 13;
	state ^= state >>> 17;
	state ^= state << 5;
	return state | 0;
}

function calibrationRound(round: number): number {
	let state = 0x1337 + round;
	const numbers = new Array<number>(CalibrationSize);
	for(let i = 0; i < CalibrationSize; i++) {
		state = nextRandom(state);
		numbers[i] = state % 100_000;
	}
	numbers.sort((a, b) => a - b);

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

function calibrationBatch(): number {
	let checksum = 0;
	for(let round = 0; round < CalibrationRounds; round++) {
		checksum = (checksum + calibrationRound(round)) | 0;
	}
	return checksum;
}

/**
 * Times {@link calibrationBatch} until the fastest batch stops improving and reports it. A fixed count of
 * repetitions ends before the workload is fully compiled, and then reports how far that got rather than how
 * fast the machine is: eight fresh processes on one idle machine spread 39% that way and 7% this way.
 * @returns the nanoseconds the fastest batch took
 */
export function runCalibration(): bigint {
	sink = calibrationRound(0);
	let best: bigint | undefined = undefined;
	let since = 0;
	for(let rep = 0; rep < CalibrationMaxReps && since < CalibrationSettle; rep++) {
		const start = process.hrtime.bigint();
		sink = (sink + calibrationBatch()) | 0;
		const took = process.hrtime.bigint() - start;
		if(best === undefined || took < best) {
			/* a batch that is barely better is the same batch, only the noise moved */
			since = best !== undefined && Number(best - took) < Number(best) * CalibrationImprovement ? since + 1 : 0;
			best = took;
		} else {
			since++;
		}
	}
	return best ?? 0n;
}

