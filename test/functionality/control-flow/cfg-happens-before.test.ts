import { describe } from 'vitest';
import { withShell } from '../_helper/shell';
import { Ternary } from '../../../src/util/logic';
import { assertHappensBefore } from '../_helper/controlflow/happens-before';

describe.sequential('Happens Before', withShell(shell => {
	assertHappensBefore(shell, 'x <- 1\ny <- 2', '1@<-', '2@<-', Ternary.Always);
	assertHappensBefore(shell, 'x <- 1\nprint(x)\ny <- 2\nprint(y)', '1@<-', '3@<-', Ternary.Always);
	for(const criteria of ['1@x', '1@<-', '1@4'] as const) {
		assertHappensBefore(shell, 'x <- 4\nrepeat { print(x) }', criteria, '2@print', Ternary.Always);
	}
	for(const [a, b, t] of [['1@x', '2@x', Ternary.Always], ['1@x', '3@<-', Ternary.Maybe], ['2@x', '3@x', Ternary.Maybe], ['2@<', '3@<-', Ternary.Maybe]] as const) {
		assertHappensBefore(shell, 'x <- 4\nwhile(x < 1)\nx <- 5', a, b, t);
	}
	for(const [a, b, t] of [['1@x', '2@x', Ternary.Maybe], ['1@x', '2@u', Ternary.Always], ['2@x', '3@x', Ternary.Always], ['1@x', '3@x', Ternary.Always]] as const) {
		assertHappensBefore(shell, 'x<-1\nif(u) x <- 2\nx <- 3', a, b, t);
	}
	assertHappensBefore(shell, 'x<-1\nif(u) x <- 2 else x <- 3\nx <- 4', '1@x', '3@x', Ternary.Always);
}));
