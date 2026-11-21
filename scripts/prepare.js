const path = require('path');
const { execFileSync } = require('child_process');

/* npm points INIT_CWD at the caller, which is this package only for an install in the checkout itself */
const own = process.env.INIT_CWD !== undefined && path.resolve(process.env.INIT_CWD) === path.resolve(__dirname, '..');
const installing = process.env.npm_command === 'ci' || process.env.npm_command === 'install';

if(own && installing) {
	console.log('prepare: skipped, run `npm run build:dev` to populate dist/');
} else {
	execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build:dev'], { stdio: 'inherit' });
}
