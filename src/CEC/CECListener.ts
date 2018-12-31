import * as path from 'path';
import { EventEmitter } from 'events';
import UnixSocketEventListener from '../UnixSocket/UnixSocketEventListener';
import Key from './Key';
import ICECListener from './ICECListener';
import { listenToCECKeypresses } from '../API/SystemAPI';

const SOCKET_FILE_NAME = 'cec.sock';

export default class CECListener implements ICECListener {

	private unixSocketPath: string;
	private unixSocketEventListener: UnixSocketEventListener;
	private eventEmitter: EventEmitter;
	private lastEmittedKey: {
		key: Key,
		timestamp: number,
	} | null = null;

	constructor(socketRootPath: string) {
		this.unixSocketPath = path.join(socketRootPath, SOCKET_FILE_NAME);
		this.unixSocketEventListener = new UnixSocketEventListener(this.unixSocketPath);
		this.eventEmitter = new EventEmitter();
		this.mapIndividualKeyEventsIntoSingleEvent();
	}

	public async listen() {
		await this.unixSocketEventListener.listen();
		this.startCecListenerChildProcess();
	}

	public onKeypress(callback: (key: Key) => void) {
		this.eventEmitter.addListener('keypress', callback);
	}

	public removeListener(callback: (key: Key) => void): void {
		this.eventEmitter.removeListener('keypress', callback);
	}

	private mapIndividualKeyEventsIntoSingleEvent() {
		for (let index of Object.keys(Key)) {
			const key = Key[index as keyof typeof Key];
			if (typeof key === 'number') {
				this.unixSocketEventListener.addListener(key.toString(), () => {
					this.emitKeypressWithDebounce(key);
				});
			}
		}
	}

	private emitKeypressWithDebounce(key: Key) {
		const DEBOUCE_MS = 200;
		const now = new Date().valueOf();
		if (!this.lastEmittedKey || key !== this.lastEmittedKey.key || now - this.lastEmittedKey.timestamp >= DEBOUCE_MS) {
			this.eventEmitter.emit('keypress', key);
		}
		this.lastEmittedKey = { key, timestamp: now };
	}

	private startCecListenerChildProcess() {
		const cecListenerProcess = listenToCECKeypresses(this.unixSocketPath);
		cecListenerProcess.on('close', (code: number, signal: string | null) => {
			console.warn('CEC process closed unexpectedly with code ' + code + (signal ? '; signal: ' + signal : ''));
		});
		cecListenerProcess.on('error', (error: Error) => {
			console.error('CEC listener error', error);
		});
	}
}