/**
 * This is a bit questionable, but necessary as this file needs to be written in javascript
 * as this way it is natively supported by piscina.
 *
 * This should (hopefully) always work, if the path to the worker is correct.
 * If there is a better to way to do this, please tell me.
 */


/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

const { workerData } = require('worker_threads');

if(workerData.fullPath.endsWith('.ts')) {
	require('ts-node').register();
}

module.exports = require(workerData.fullPath);
