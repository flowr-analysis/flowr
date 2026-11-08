/** Compares two R version strings as R's `numeric_version` does: split on `.` and `-`, numerically, padded with zeros (`0.4-9 < 0.4.10 < 1.0`). */
export function compareRVersions(a: string | undefined, b: string | undefined): number {
	// an absent version sorts below any concrete one (so ascending order puts `undefined` first, descending last)
	if(a === undefined || b === undefined) {
		return a === b ? 0 : a === undefined ? -1 : 1;
	}
	const pa = a.split(/[.-]/), pb = b.split(/[.-]/);
	for(let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const x = Number(pa[i] ?? 0) || 0, y = Number(pb[i] ?? 0) || 0;
		if(x !== y) {
			return x - y;
		}
	}
	return 0;
}
