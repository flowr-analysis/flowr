import { describe } from 'vitest';
import { testPentagonDomain, UpperBoundsTests } from './pentagon';
import { DomainMatchingType, IntervalTests } from '../interval/interval';

describe('Interim Presentation Example', () => {
	testPentagonDomain(`
			ifelse(c, a <- -Inf, a <- Inf)
			a <- a + 1
			ifelse(c, b <- -Inf, b <- Inf)
			b <- b + 1
			
			x <- a ^ 2 + 1
			y <- b ^ 2 + 1
			
			if (x < 1 || y < 1) {
				print(x, y)
			}
			
			if (x <= y) {
				z <- y - x
			} else {
				z <- x - y
			}
			
			if (z < 0) {
				print(z)
			}
			print(z)
		`, {
		'6@a':  { interval: IntervalTests.interval(-Infinity, Infinity), upperBounds: UpperBoundsTests.top() },
		'6@x':  { interval: IntervalTests.interval(1, Infinity), intervalMatching: DomainMatchingType.Overapproximation, upperBounds: UpperBoundsTests.top() },
		'7@b':  { interval: IntervalTests.interval(-Infinity, Infinity), upperBounds: UpperBoundsTests.top() },
		'7@y':  { interval: IntervalTests.interval(1, Infinity), intervalMatching: DomainMatchingType.Overapproximation, upperBounds: UpperBoundsTests.top() },
		'10@x': { interval: IntervalTests.bottom(), intervalMatching: DomainMatchingType.Overapproximation, upperBounds: UpperBoundsTests.bottom() },
		'10@y': { interval: IntervalTests.bottom(), intervalMatching: DomainMatchingType.Overapproximation, upperBounds: UpperBoundsTests.bottom() },
	});
});