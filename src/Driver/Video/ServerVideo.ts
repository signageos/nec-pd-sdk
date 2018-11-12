import { EventEmitter } from "events";
import { ChildProcess } from "child_process";
import wait from '@signageos/lib/dist/Timer/wait';
import Orientation from '@signageos/front-display/es6/NativeDevice/Orientation';
import {
	IVideoAPI,
} from '../../API/VideoAPI';
import IFileSystem from '../../FileSystem/IFileSystem';
import IServerVideo from './IServerVideo';

export enum State {
	IDLE,
	PLAYING,
	PAUSED,
}

export interface IVideoArguments {
	uri: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

export default class ServerVideo implements IServerVideo {

	private state: State = State.IDLE;
	private eventEmitter: EventEmitter;
	private videoArguments: IVideoArguments | null = null;
	private childProcess: ChildProcess | null = null;
	private isStream: boolean = false;
	private finished: boolean = false;

	constructor(
		private fileSystem: IFileSystem,
		private key: string,
		private videoAPI: IVideoAPI,
	) {
		this.eventEmitter = new EventEmitter();
		this.removeAllListeners();
	}

	public getVideoArguments(): IVideoArguments | null {
		return this.videoArguments;
	}

	public async prepare(uri: string, x: number, y: number, width: number, height: number, orientation: Orientation, isStream: boolean) {
		if (this.childProcess) {
			await this.stop();
		}

		this.childProcess = this.prepareVideoChildProcess(uri, x, y, width, height, orientation, isStream);
		this.videoArguments = { uri, x, y, width, height };
		this.isStream = isStream;
		await wait(1e3);
	}

	public async play() {
		if (!this.childProcess) {
			throw new Error('Trying to play video that\'s not prepared, video key: ' + this.key);
		}

		if (this.isStream) {
			await this.videoAPI.playStream(this.childProcess);
		} else {
			await this.videoAPI.playVideo(this.childProcess);
		}
		this.finished = false;
		this.state = State.PLAYING;
	}

	public async stop() {
		if (!this.childProcess) {
			throw new Error('Trying to stop video that\'s not running, video key: ' + this.key);
		}

		if (!this.finished) {
			if (this.isStream) {
				await this.videoAPI.stopStream(this.childProcess);
			} else {
				await this.videoAPI.stopVideo(this.childProcess);
			}
		}

		this.state = State.IDLE;
		this.childProcess = null;
		this.videoArguments = null;
		this.finished = false;
		this.isStream = false;
	}

	public isIdle() {
		return this.state === State.IDLE;
	}

	public isPlaying() {
		return this.state === State.PLAYING;
	}

	public isPaused() {
		return this.state === State.PAUSED;
	}

	public addEventListener(event: string, callback: () => void) {
		this.eventEmitter.on(event, callback);
	}

	public removeAllListeners() {
		this.eventEmitter.removeAllListeners();
		this.eventEmitter.on('error', () => {
			// do nothing, there has to be at least one listener always, otherwise it will throw an error when error is emitted
		});
	}

	private prepareVideoChildProcess(
		uri: string,
		x: number,
		y: number,
		width: number,
		height: number,
		orientation: Orientation,
		isStream: boolean,
	) {
		let videoProcess: ChildProcess;
		if (isStream) {
			videoProcess = this.videoAPI.prepareStream(uri, x, y, width, height, orientation);
		} else {
			const filePath = this.fileSystem.getFullPath(uri);
			videoProcess = this.videoAPI.prepareVideo(filePath, x, y, width, height, orientation);
		}

		videoProcess.once('close', (code: number, signal: string | null) => {
			this.state = State.IDLE;
			this.finished = true;
			const videoEventSrcArgs = { uri, x, y, width, height };
			if (signal !== null) {
				this.eventEmitter.emit('stopped', { type: 'stopped', srcArguments: videoEventSrcArgs });
			} else if (code === 0) {
				this.eventEmitter.emit('ended', { type: 'ended', srcArguments: videoEventSrcArgs });
			} else {
				this.eventEmitter.emit('error', {
					type: 'error',
					srcArguments: videoEventSrcArgs,
					data: {
						message: 'Process finished with exit code ' + code,
					},
				});
			}
		});

		videoProcess.on('error', (error: Error) => {
			console.error('video error', error, { uri, x, y, width, height });
		});

		return videoProcess;
	}
}
