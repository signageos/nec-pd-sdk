import * as moment from 'moment-timezone';
import * as AsyncLock from 'async-lock';
import IDriver, { Hardware } from '@signageos/front-display/es6/NativeDevice/IDriver';
import Orientation from '@signageos/front-display/es6/NativeDevice/Orientation';
import Resolution from '@signageos/front-display/es6/NativeDevice/Resolution';
import IFileSystemFile from '@signageos/front-display/es6/NativeDevice/IFileSystemFile';
import IKeyUpEvent from '@signageos/front-display/es6/NativeDevice/Input/IKeyUpEvent';
import TimerType from '@signageos/front-display/es6/NativeDevice/Timer/TimerType';
import TimerWeekday from '@signageos/front-display/es6/NativeDevice/Timer/TimerWeekday';
import TimerLevel from '@signageos/front-display/es6/NativeDevice/Timer/TimerLevel';
import IBrightness from '@signageos/front-display/es6/NativeDevice/IBrightness';
import ProprietaryCache from '@signageos/front-display/es6/Cache/ProprietaryCache';
import ICache from '@signageos/front-display/es6/Cache/ICache';
import ProprietaryVideoPlayer from '@signageos/front-display/es6/Video/ProprietaryVideoPlayer';
import ProprietaryResourceManager from '@signageos/front-display/es6/Video/ProprietaryResourceManager';
import ISignature from '@signageos/front-display/es6/NativeDevice/ISignature';
import VideoOrientation from "@signageos/front-display/es6/Video/Orientation";
import ICacheDriver from '@signageos/front-display/es6/NativeDevice/ICacheDriver';
import ICacheStorageInfo from '@signageos/front-display/es6/NativeDevice/ICacheStorageInfo';
import ProprietaryStreamPlayer from '@signageos/front-display/es6/Stream/ProprietaryStreamPlayer';
import { APPLICATION_TYPE } from './constants';

export default class FrontDriver implements IDriver, ICacheDriver {

	public readonly hardware: Hardware = {
		led: {
			async setColor(_color: string) {
				console.warn(new Error('Not implemented hardware led set color'));
			},
		},
	};

	public readonly resourceManager: ProprietaryResourceManager;
	public readonly video: ProprietaryVideoPlayer;
	public readonly stream: ProprietaryStreamPlayer;

	private lock: AsyncLock;
	private cache: ICache;

	constructor(private window: Window) {
		const DEFAULT_TOTAL_SIZE_BYTES = 5 * 1024 * 1024; // Default quota of localStorage in browsers
		this.lock = new AsyncLock({
			timeout: 5000,
		});
		this.cache = new ProprietaryCache(this.window.localStorage, DEFAULT_TOTAL_SIZE_BYTES);
		this.resourceManager = this.createResourceManager();
		this.video = this.createVideoPlayer();
		this.stream = this.createStreamPlayer();
	}

	public async getConfigurationBaseUrl(): Promise<string | null> {
		return null; // use default
	}

	public getApplicationType() {
		return APPLICATION_TYPE;
	}

	public async getModel(): Promise<string> {
		throw new Error("Not implemented"); // TODO : implement
	}

	public async onLoad(callback: () => void) {
		callback();
	}

	public isDetected() {
		return true;
	}

	public async appReboot(): Promise<void> {
		throw new Error("Not implemented"); // TODO : implement
	}

	public appRestart() {
		throw new Error("Not implemented"); // TODO : implement
	}

	public async appUpgrade(_baseUrl: string, _version: string): Promise<void> {
		throw new Error("Not implemented"); // TODO : implement
	}

	public async packageInstall(_baseUrl: string, _packageName: string, _version: string, _build: string | null): Promise<void> {
		throw new Error("Not implemented"); // TODO : implement
	}

	public async getApplicationVersion(): Promise<string> {
		throw new Error("Not implemented"); // TODO : implement
	}

	public start() {
		console.info('Started Linux front driver');
	}

	public stop() {
		console.info('Stopped Linux front driver');
	}

	public async getCurrentTimeWithTimezone(): Promise<{
		currentDate: Date;
		timezone?: string;
	}> {
		throw new Error("Not implemented"); // TODO : implement
	}

	public async setCurrentTime(_currentMoment: moment.Moment): Promise<void> {
		throw new Error("Not implemented"); // TODO : implement
	}

	public async setCurrentTimeWithTimezone(_currentDate: moment.Moment, _timezone: string): Promise<boolean> {
		throw new Error("Not implemented"); // TODO : implement
	}

	public async displayIsPowerOn(): Promise<boolean> {
		throw new Error("Not implemented"); // TODO : implement
	}

	public async displayPowerOn(): Promise<void> {
		throw new Error("Not implemented"); // TODO : implement
	}

	public async displayPowerOff(): Promise<void> {
		throw new Error("Not implemented"); // TODO : implement
	}

	public bindKeyUp(_keyUpListener: (keyUpEvent: IKeyUpEvent) => void) {
		throw new Error("Not implemented"); // TODO : implement
	}

	public fileSystemCleanup() {
		// do nothing on startup cleanup
	}

	public async fileSystemGetFileUids(): Promise<string[]> {
		throw new Error("Not implemented"); // TODO : implement
	}

	public async fileSystemGetFiles(): Promise<{ [uid: string]: IFileSystemFile }> {
		throw new Error("Not implemented"); // TODO : implement
	}

	public async fileSystemGetFile(_uid: string): Promise<IFileSystemFile> {
		throw new Error("Not implemented"); // TODO : implement
	}

	public fileSystemDeleteFile(_uid: string): Promise<void> {
		throw new Error("Not implemented"); // TODO : implement
	}

	public async fileSystemSaveFile(_uid: string, _uri: string, _headers?: { [key: string]: string }): Promise<void> {
		throw new Error("Not implemented"); // TODO : implement
	}

	public cacheGetUids() {
		return this.cache.fetchAllUids();
	}

	public cacheGetAll() {
		return this.cache.fetchAll();
	}

	public cacheGet(uid: string) {
		return this.cache.fetchOne(uid);
	}

	public cacheDelete(uid: string) {
		return this.cache.deleteOne(uid);
	}

	public cacheSave(uid: string, content: string) {
		return this.cache.saveOne(uid, content);
	}

	public cacheGetStorageInfo(): Promise<ICacheStorageInfo> {
		return this.cache.getStorageInfo();
	}

	public async firmwareUpgrade(_baseUrl: string, _version: string, _onProgress: (progress: number) => void): Promise<void> {
		throw new Error("Not implemented"); // TODO : implement
	}

	public async firmwareGetVersion(): Promise<string> {
		throw new Error("Not implemented"); // TODO : implement
	}

	public async getDeviceUid(): Promise<string> {
		throw new Error("Not implemented"); // TODO : implement
	}

	public async isConnected(): Promise<boolean> {
		throw new Error("Not implemented"); // TODO : implement
	}

	public async screenResize(
		_baseUrl: string,
		_orientation: Orientation,
		_resolution: Resolution,
		_videoOrientation?: VideoOrientation,
	): Promise<void> {
		throw new Error("Not implemented"); // TODO : implement
	}

	public async getSessionId(sessionIdKey: string) {
		return this.window.localStorage.getItem(sessionIdKey);
	}

	public async setSessionId(sessionIdKey: string, sessionId: string) {
		this.window.localStorage.setItem(sessionIdKey, sessionId);
	}

	public async restoreDisplayArea() {
		await this.video.clearAll();
		await this.stream.clearAll();
		this.resourceManager.clearAll();
	}

	public areTimersSupported(_powerTimerLevel: TimerLevel) {
		return false; // TODO : implement
	}

	public async setTimer(
		_type: TimerType,
		_timeOn: string | null,
		_timeOff: string | null,
		_weekdays: TimerWeekday[],
		_volume: number,
	): Promise<void> {
		throw new Error("Not implemented"); // TODO : implement
	}

	public async timerSetOnOffTimeHoliday(_type: TimerType, _onAtHoliday: boolean, _offAtHoliday: boolean): Promise<void> {
		throw new Error("Not implemented"); // TODO : implement
	}

	public async screenSetBrightness(_timeFrom1: string, _brightness1: number, _timeFrom2: string, _brightness2: number): Promise<void> {
		throw new Error("Not implemented"); // TODO : implement
	}

	public async screenGetBrightness(): Promise<IBrightness> {
		throw new Error("Not implemented"); // TODO : implement
	}

	public screenSupportsBrightnessSchedule() {
		return false; // TODO : implement
	}

	public async remoteControleSetEnabled(_enabled: boolean): Promise<void> {
		throw new Error("Not implemented"); // TODO : implement
	}

	public async remoteControleIsEnabled(): Promise<boolean> {
		throw new Error("Not implemented"); // TODO : implement
	}

	public async controlSetPin(_pin: string): Promise<void> {
		throw new Error("Not implemented"); // TODO : implement
	}

	public async browserOpenLink(_uri: string): Promise<void> {
		console.warn(new Error('Not implemented browser openLink'));
	}

	public async setDebug(_enabled: boolean): Promise<void> {
		throw new Error("Not implemented"); // TODO : implement
	}

	public async getCurrentSignature(): Promise<ISignature | null> {
		return null;
	}

	public async getVolume(): Promise<number> {
		throw new Error("Not implemented"); // TODO : implement
	}

	public async setVolume(_volume: number): Promise<void> {
		throw new Error("Not implemented"); // TODO : implement
	}

	protected createResourceManager() {
		return new ProprietaryResourceManager(1);
	}

	protected createVideoPlayer() {
		return new ProprietaryVideoPlayer(this.resourceManager, this.window, this.lock);
	}

	protected createStreamPlayer() {
		return new ProprietaryStreamPlayer(this.video);
	}
}
