import { EventEmitter } from 'events';
import * as AsyncLock from 'async-lock';
import IVideoPlayer from '@signageos/front-display/es6/Video/IVideoPlayer';
import IVideo from '@signageos/front-display/es6/Video/IVideo';
import IVideoEvent from '@signageos/front-display/es6/Video/IVideoEvent';
import BridgeClient from '../../Bridge/BridgeClient';
import {
	PrepareVideo,
	PlayVideo,
	StopVideo,
	StopAllVideos,
	VideoPrepared,
	VideoStarted,
	VideoEnded,
	VideoStopped,
	VideoError,
	AllVideosStopped,
} from '../../Bridge/bridgeVideoMessages';
import { checksumString } from '../../../node_modules/@signageos/front-display/es6/Hash/checksum';
import { getLastFramePathFromVideoPath } from './helper';

export default class BridgeVideoPlayer implements IVideoPlayer {

	private preparedVideoIds: string[] = [];
	private playingVideos: {
		[videoId: string]: {
			eventEmitter: EventEmitter;
			lastFrame?: HTMLElement;
		};
	} = {};

	private static getVideoIdentificator(uri: string, x: number, y: number, width: number, height: number) {
		return checksumString(uri) + '_' + x + 'x' + y + '-' + width + 'x' + height;
	}

	constructor(
		private window: Window,
		private fileSystemUrl: string,
		private lock: AsyncLock,
		private bridge: BridgeClient,
	) {
		this.listenToVideoEvents();
	}

	public async prepare(uri: string, x: number, y: number, width: number, height: number): Promise<void> {
		return await this.lock.acquire('video', async () => {
			const uriRelative = this.stripFileSystemRootFromUri(uri);
			const videoId = BridgeVideoPlayer.getVideoIdentificator(uriRelative, x, y, width, height);
			await this.prepareVideo(videoId, uri, x, y, width, height);
		});
	}

	public async play(uri: string, x: number, y: number, width: number, height: number): Promise<IVideo> {
		return await this.lock.acquire('video', async () => {
			const uriRelative = this.stripFileSystemRootFromUri(uri);
			const videoId = BridgeVideoPlayer.getVideoIdentificator(uriRelative, x, y, width, height);
			if (this.playingVideos[videoId]) {
				throw new Error(`Video is already playing: ${uri}, ${x}, ${y}, ${width}, ${height}`);
			}

			await this.prepareVideo(videoId, uri, x, y, width, height);
			const videoEventEmitter = await this.playVideo(videoId, uri, x, y, width, height);
			await this.showLastFrame(videoId, uri, x, y, width, height);

			return videoEventEmitter;
		});
	}

	public async stop(uri: string, x: number, y: number, width: number, height: number): Promise<void> {
		await this.lock.acquire('video', async () => {
			const uriRelative = this.stripFileSystemRootFromUri(uri);
			const videoId = BridgeVideoPlayer.getVideoIdentificator(uriRelative, x, y, width, height);
			if (!this.playingVideos[videoId]) {
				throw new Error(`Video is not playing: ${uri}, ${x}, ${y}, ${width}, ${height}`);
			}

			await this.stopVideo(videoId, uri, x, y, width, height);

			if (this.playingVideos[videoId].lastFrame) {
				this.destroyLastFrame(videoId);
			}

			delete this.playingVideos[videoId];
		});
	}

	public pause(_uri: string, _x: number, _y: number, _width: number, _height: number): Promise<void> {
		throw new Error('Not implemented');
	}

	public resume(_uri: string, _x: number, _y: number, _width: number, _height: number): Promise<void> {
		throw new Error('Not implemented');
	}

	public async clearAll(): Promise<void> {
		await this.lock.acquire('video', async () => {
			for (let videoId of Object.keys(this.playingVideos)) {
				if (this.playingVideos[videoId].lastFrame) {
					this.destroyLastFrame(videoId);
				}
			}

			const resultPromise = new Promise<void>((resolve: () => void) => {
				this.bridge.socketClient.once(AllVideosStopped, resolve);
			});

			this.bridge.socketClient.emit(StopAllVideos, {});
			await resultPromise;
			this.playingVideos = {};
			this.preparedVideoIds = [];
		});
	}

	private async prepareVideo(videoId: string, uri: string, x: number, y: number, width: number, height: number) {
		if (this.preparedVideoIds.indexOf(videoId) >= 0) {
			return;
		}

		const uriRelative = this.stripFileSystemRootFromUri(uri);
		const socketClient = this.bridge.socketClient;

		const resultPromise = new Promise<void>((resolve: () => void, reject: (error: Error) => void) => {
			let successListener: (message: any) => void;
			let errorListener: (message: any) => void;

			successListener = (event: VideoPrepared) => {
				if (event.uri === uriRelative && event.x === x && event.y === y && event.width === width && event.height === height) {
					socketClient.removeListener(VideoPrepared, successListener);
					resolve();
				}
			};

			errorListener = (event: VideoError) => {
				if (event.uri === uriRelative && event.x === x && event.y === y && event.width === width && event.height === height) {
					socketClient.removeListener(VideoError, errorListener);
					reject(new Error('Failed to prepare video'));
				}
			};

			this.bridge.socketClient.on(VideoPrepared, successListener);
			this.bridge.socketClient.on(VideoError, errorListener);
		});

		socketClient.emit(PrepareVideo, { uri: uriRelative, x, y, width, height });
		await resultPromise;

		this.preparedVideoIds.push(videoId);
	}

	private async playVideo(videoId: string, uri: string, x: number, y: number, width: number, height: number) {
		const uriRelative = this.stripFileSystemRootFromUri(uri);
		const videoEmitter = new EventEmitter();
		const resultRacePromise = Promise.race([
			new Promise<void>((resolve: () => void) => {
				videoEmitter.once('started', resolve);
			}),
			new Promise<void>((_resolve: () => void, reject: (error: Error) => void) => {
				videoEmitter.once('error', () => reject(new Error('Failed to play video')));
			}),
		] as Promise<void>[]);

		this.playingVideos[videoId] = { eventEmitter: videoEmitter };
		this.bridge.socketClient.emit(PlayVideo, { uri: uriRelative, x, y, width, height });

		try {
			await resultRacePromise;
		} catch (error) {
			delete this.playingVideos[videoId];
			throw error;
		}

		return videoEmitter;
	}

	private async stopVideo(videoId: string, uri: string, x: number, y: number, width: number, height: number) {
		const uriRelative = this.stripFileSystemRootFromUri(uri);
		const videoEmitter = this.playingVideos[videoId].eventEmitter;
		const resultRacePromise = Promise.race([
			new Promise<void>((resolve: () => void) => videoEmitter.once('stopped', resolve)),
			new Promise<void>((resolve: () => void) => videoEmitter.once('error', resolve)),
		] as Promise<void>[]);

		this.bridge.socketClient.emit(StopVideo, { uri: uriRelative, x, y, width, height });
		await resultRacePromise;
	}

	private showLastFrame(videoId: string, uri: string, x: number, y: number, width: number, height: number) {
		if (!this.playingVideos[videoId]) {
			throw new Error('Show last frame failed because video is not playing');
		}

		const imageSrc = getLastFramePathFromVideoPath(uri);
		const lastFrameElement = this.window.document.createElement('div');
		lastFrameElement.id = videoId;
		lastFrameElement.style.position = 'absolute';
		lastFrameElement.style.left = x + 'px';
		lastFrameElement.style.top = y + 'px';
		lastFrameElement.style.width = width + 'px';
		lastFrameElement.style.height = height + 'px';
		lastFrameElement.style.backgroundImage = `url(${imageSrc})`;
		lastFrameElement.style.backgroundRepeat = 'no-repeat';
		lastFrameElement.style.backgroundSize = 'contain';
		lastFrameElement.style.backgroundPosition = 'center';
		this.window.document.body.appendChild(lastFrameElement);
		this.playingVideos[videoId].lastFrame = lastFrameElement;
	}

	private destroyLastFrame(videoId: string) {
		if (!this.playingVideos[videoId]) {
			throw new Error('Destroy last frame failed because video is not playing');
		}

		if (!this.playingVideos[videoId].lastFrame) {
			throw new Error('Destroy last frame failed because the last frame doesn\'t exist');
		}

		const imageElement = this.playingVideos[videoId].lastFrame as HTMLElement;
		this.window.document.body.removeChild(imageElement);
		delete this.playingVideos[videoId].lastFrame;
	}

	private listenToVideoEvents() {
		const socketClient = this.bridge.socketClient;
		socketClient.on(VideoStarted, async (event: VideoStarted) => {
			await this.emitVideoEvent('started', event);
		});
		socketClient.on(VideoEnded, async (event: VideoEnded) => {
			await this.emitVideoEvent('ended', event);
		});
		socketClient.on(VideoStopped, async (event: VideoStopped) => {
			await this.emitVideoEvent('stopped', event);
		});
		socketClient.on(VideoError, async (event: VideoError) => {
			await this.emitVideoEvent('error', event);
		});
	}

	private async emitVideoEvent(
		type: string,
		event: VideoStarted | VideoEnded | VideoStopped | VideoError,
	) {
		const { uri, x, y, width, height } = event;
		const videoId = BridgeVideoPlayer.getVideoIdentificator(uri, x, y, width, height);
		if (this.playingVideos[videoId]) {
			this.playingVideos[videoId].eventEmitter.emit(
				type,
				{
					type,
					srcArguments: {
						uri: this.fileSystemUrl + '/' + uri,
						x, y, width, height,
					},
					data: (event as any).data,
				} as IVideoEvent,
			);
		}
	}

	private stripFileSystemRootFromUri(uri: string) {
		if (uri.startsWith(this.fileSystemUrl + '/')) {
			const skipChars = (this.fileSystemUrl + '/').length;
			return uri.substring(skipChars);
		}

		throw new Error('Videos can only be played from local storage. Supply full URI.');
	}
}