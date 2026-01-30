
/**
 *      WorkerPool Messages
 */

import type { TaskName } from './task-registry';
import type { workerStats } from './worker';
import type { MessagePort } from 'node:worker_threads';

export interface RegisterPortMessage {
	type:     'register-port';
	workerId: number;
	port:     MessagePort;
}

export interface TaskReceivedMessage {
    type:        'task';
    taskName:    TaskName;
    taskPayload: unknown;
}

export interface SubtaskReceivedMessage{
	type:        'subtask';
	id:          number;
	taskName:    TaskName;
	taskPayload: unknown;
}

export interface SubtaskResponseMessage {
	type:    'subtask-response';
	id:      number;
	result?: unknown;
	error?:  string;
}

export interface PortRegisteredMessage {
    type: 'port-registered';
}

export interface WorkerStatsRequestMessage {
    type: 'worker-stats-request';
}

export interface WorkerFinalStatMessage {
    type:     'worker-final-stats';
    workerId: number;
    stats:    typeof workerStats;
}

export interface LogCorrelation {
	workerId:   number;
	taskName?:  string;
	taskId?:    number;
	subtaskId?: number;
}


export type WorkerLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface WorkerLogMessage {
	type:  'worker-log';
	level: WorkerLogLevel;

	timestamp: number;
	hrtime:    [number, number];

	message: string;
	data?:   unknown[];
	stack?:  string;

	correlation: LogCorrelation;
}


/**
 *
 *      Message Type Guards
 */

/**
 *
 */
export function isRegisterPortMessage(msg: unknown): msg is RegisterPortMessage {
	return (
		typeof msg === 'object' &&
        msg !== null &&
        (msg as RegisterPortMessage).type === 'register-port' &&
        typeof (msg as RegisterPortMessage).workerId === 'number' &&
        typeof (msg as RegisterPortMessage).port === 'object'
	);
}

/**
 *
 */
export function isSubtaskMessage(msg: unknown): msg is SubtaskReceivedMessage {
	return (
		typeof msg === 'object' &&
        msg !== null &&
        (msg as SubtaskReceivedMessage).type === 'subtask' &&
        typeof (msg as SubtaskReceivedMessage).id === 'number' &&
        typeof (msg as SubtaskReceivedMessage).taskName === 'string'
	);
}

/**
 *
 */
export function isSubtaskResponseMessage(msg: unknown): msg is SubtaskResponseMessage {
	return (
		typeof msg === 'object' &&
        msg !== null &&
        (msg as SubtaskResponseMessage).type === 'subtask-response' &&
        typeof (msg as SubtaskResponseMessage).id === 'number'
	);
}


/**
 *
 */
export function isPortRegisteredMessage(msg: unknown): msg is PortRegisteredMessage {
	return (
		typeof msg === 'object' &&
        msg !== null &&
        (msg as PortRegisteredMessage).type === 'port-registered'
	);
}

/**
 *
 */
export function isWorkerLogMessage(msg: unknown): msg is WorkerLogMessage {
	return (
		typeof msg === 'object' &&
        msg !== null &&
        (msg as WorkerLogMessage).type === 'worker-log'
	);
}

/**
 *
 */
export function isWorkerStatsRequestMessage(msg: unknown): msg is WorkerStatsRequestMessage {
	return (
		typeof msg === 'object' &&
        msg !== null &&
        (msg as WorkerStatsRequestMessage).type === 'worker-stats-request'
	);
}

/**
 *
 */
export function isWorkerFinalStatMessage(msg: unknown): msg is WorkerFinalStatMessage {
	return typeof msg === 'object' &&
        msg !== null &&
        (msg as WorkerFinalStatMessage).type === 'worker-final-stats';
}