import Benchmark from 'benchmark'

/**
 * This file contains the artificial benchmarks used for each step without external 'real-world' files.
 */
const suite = new Benchmark.Suite('artificial')


suite
	.add('dummy', () => {
	/o/.test('Hello World!')
})

suite
	.on('cycle', (event: Benchmark.Event) => {
		console.log(String(event.target));
	})
	// run async
	.run({ 'async': true });
