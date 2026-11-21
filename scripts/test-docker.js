const { spawnSync } = require('child_process');

const Dockerfiles = ['scripts/Dockerfile', 'scripts/Dockerfile-NoR'];
const docker = (...args) => spawnSync('docker', args, { stdio: 'inherit' }).status === 0;
/* bridge networking is unavailable on some hosts, so each step retries on the host network */
const withNetwork = (run) => run([]) || (console.log('(retrying with --network=host: bridge networking unavailable)'), run(['--network=host']));

for(const file of Dockerfiles) {
	console.log(`=== building ${file} ===`);
	if(!withNetwork(net => docker('build', ...net, '-t', 'flowr-docker-test', '-f', file, '.'))) {
		process.exit(1);
	}
	console.log(`=== smoke-testing ${file} ===`);
	if(!withNetwork(net => docker('run', '--rm', ...net, 'flowr-docker-test', '--version'))) {
		process.exit(1);
	}
}
