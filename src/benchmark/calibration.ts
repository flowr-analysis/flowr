/**
 * A small, fixed, and purely synthetic workload used to calibrate the benchmark results.
 *
 * Publishing its runtime alongside the real measurements allows a viewer to normalize the other numbers by it,
 * and hence to cancel out how fast or how loaded the machine was that produced them.
 * The workload must therefore stay deterministic (no file system, no R session, no randomness)
 * and cheap (well below a second).
 * @module
 */

/** How often the {@link calibrationRound} is repeated within one {@link runCalibration} call. */
export const CalibrationRounds = 8;
/** How many elements a single {@link calibrationRound} works on. */
export const CalibrationSize = 4096;

/** xorshift32 with a fixed seed so that every round does the exact same work */
function nextRandom(state: number): number {
	state ^= state << 13;
	state ^= state >>> 17;
	state ^= state << 5;
	return state | 0;
}

/**
 * One round of the calibration workload, mixing integer arithmetic, array sorting, string handling, and map lookups
 * to cover the operations that dominate the analysis itself.
 * @returns a checksum, only returned so that the work cannot be optimized away
 */
function calibrationRound(round: number): number {
	let state = 0x1337 + round;
	const numbers = new Array<number>(CalibrationSize);
	for(let i = 0; i < CalibrationSize; i++) {
		state = nextRandom(state);
		numbers[i] = state % 100_000;
	}
	numbers.sort((a, b) => a - b);

	const map = new Map<string, number>();
	for(let i = 0; i < CalibrationSize; i++) {
		const key = `k${numbers[i] % 512}`;
		map.set(key, (map.get(key) ?? 0) + i);
	}

	let checksum = 0;
	for(const [key, value] of map) {
		checksum = (checksum + key.length * value) | 0;
	}
	for(let i = 0; i < CalibrationSize; i++) {
		checksum = (checksum + Math.floor(Math.sqrt(numbers[i] + 1))) | 0;
	}
	return checksum;
}

/**
 * Runs the calibration workload {@link CalibrationRounds} times.
 * @returns a checksum, only returned so that the work cannot be optimized away
 */
export function runCalibration(): number {
	let checksum = 0;
	for(let round = 0; round < CalibrationRounds; round++) {
		checksum = (checksum + calibrationRound(round)) | 0;
	}
	return checksum;
}
