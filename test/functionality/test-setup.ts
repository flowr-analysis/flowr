/**
 * We use this file to configure the logging used when running tests
 *
 * @module
 */

import { LogLevel } from '../../src/util/log';
import { setMinLevelOfAllLogs } from './_helper/log';
import { beforeAll } from 'vitest';

export const VERBOSE_TESTS = process.argv.includes('--verbose');
beforeAll(() => setMinLevelOfAllLogs(VERBOSE_TESTS ? LogLevel.Trace : LogLevel.Error, VERBOSE_TESTS));
