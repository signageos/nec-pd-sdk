import * as url from 'url';
import * as path from 'path';
import * as moment from 'moment-timezone';
import { checksumString } from '@signageos/lib/dist/Hash/checksum';
import IManagementDriver from '@signageos/front-display/es6/NativeDevice/Management/IManagementDriver';
import ManagementCapability from '@signageos/front-display/es6/NativeDevice/Management/ManagementCapability';
import Capability from '@signageos/front-display/es6/NativeDevice/Management/ManagementCapability';
import IFileSystem from '@signageos/front-display/es6/NativeDevice/IFileSystem';
import IServletRunner from '@signageos/front-display/es6/Servlet/IServletRunner';
import IBatteryStatus from '@signageos/front-display/es6/NativeDevice/Battery/IBatteryStatus';
import { APPLICATION_TYPE } from './constants';
import IBasicDriver from '../../node_modules/@signageos/front-display/es6/NativeDevice/IBasicDriver';
import { IFilePath } from '@signageos/front-display/es6/NativeDevice/fileSystem';
import { ISystemAPI } from '../API/SystemAPI';
import * as NetworkAPI from '../API/NetworkAPI';
import IInternalFileSystem from '../FileSystem/IFileSystem';
import ISystemSettings from '../SystemSettings/ISystemSettings';
import ManagementFileSystem from './ManagementFileSystem';
import IBrightness from '@signageos/front-display/es6/NativeDevice/IBrightness';
import IServerVideoPlayer from './Video/IServerVideoPlayer';
import OverlayRenderer from '../Overlay/OverlayRenderer';
import Orientation from '@signageos/front-display/es6/NativeDevice/Orientation';
import VideoOrientation from '@signageos/front-display/es6/Video/Orientation';
import Resolution from '@signageos/front-display/es6/NativeDevice/Resolution';
import TimerWeekday from '@signageos/front-display/es6/NativeDevice/Timer/TimerWeekday';
import TimerType from '@signageos/front-display/es6/NativeDevice/Timer/TimerType';
import ICacheDriver from '@signageos/front-display/es6/NativeDevice/ICacheDriver';
import ICache from '@signageos/front-display/es6/Cache/ICache';
import ICacheStorageInfo from '@signageos/front-display/es6/Cache/ICacheStorageInfo';
import IFileDetailsProvider from '../FileSystem/IFileDetailsProvider';
import IDisplay from './Display/IDisplay';
import DisplayCapability from './Display/DisplayCapability';
import { resolveCurrentBrightness } from '@signageos/front-display/es6/NativeDevice/Screen/screenHelper';
import { now } from '@signageos/lib/dist/DateTime/dateTimeFactory';
import ISensors, { SensorCapability } from './Sensors/ISensors';
import IMonitors from '@signageos/front-display/es6/NativeDevice/IMonitors';
import INetwork from '@signageos/front-display/es6/NativeDevice/Network/INetwork';

export default class ManagementDriver implements IBasicDriver, IManagementDriver, ICacheDriver {

	public fileSystem: IFileSystem;
	private deviceUid: string;

	constructor(
		private remoteServerUrl: string,
		fileSystemUrl: string,
		private cache: ICache,
		private internalFileSystem: IInternalFileSystem,
		private systemSettings: ISystemSettings,
		private videoPlayer: IServerVideoPlayer,
		private overlayRenderer: OverlayRenderer,
		fileDetailsProvider: IFileDetailsProvider,
		private display: IDisplay,
		public readonly servletRunner: IServletRunner,
		public readonly sensors: ISensors,
		public readonly monitors: IMonitors,
		public readonly network: INetwork,
		private systemAPI: ISystemAPI,
	) {
		this.fileSystem = new ManagementFileSystem(fileSystemUrl, internalFileSystem, fileDetailsProvider);
	}

	public async initialize(_staticBaseUrl: string): Promise<void> {
		// do nothing
	}

	public start() {
		console.info('Started Linux management driver');
	}

	public stop() {
		// do nothing
	}

	public getApplicationType(): string {
		return APPLICATION_TYPE;
	}

	public async getDeviceUid(): Promise<string> {
		if (this.deviceUid) {
			return this.deviceUid;
		}

		const serialNumber = await this.getSerialNumber();
		this.deviceUid = checksumString(serialNumber);
		return this.deviceUid;
	}

	public async appUpgrade(_baseUrl: string, version: string) {
		await this.systemAPI.upgradeApp(version);
		return () => this.systemReboot();
	}

	public async firmwareGetVersion(): Promise<string> {
		return await this.systemAPI.getFirmwareVersion();
	}

	public async firmwareUpgrade(_baseUrl: string, version: string, onProgress: (progress: number) => void) {
		onProgress(0);
		await this.systemAPI.upgradeFirmware(version);
		onProgress(100);
		return () => this.systemReboot();
	}

	public async getModel(): Promise<string> {
		return await this.systemAPI.getModel();
	}

	public async batteryGetStatus(): Promise<IBatteryStatus> {
		throw new Error('batteryGetStatus not implemented');
	}

	public async getCurrentTemperature(): Promise<number> {
		return await this.systemAPI.getCpuTemperature();
	}

	public async getSerialNumber(): Promise<string> {
		return await this.systemAPI.getSerialNumber();
	}

	public async screenshotUpload(uploadBaseUrl: string): Promise<string> {
		const SCREENSHOT_DIR = 'screenshots';
		const screenshotFilename = new Date().valueOf() + 'png';
		const tmpStorageUnit = this.internalFileSystem.getTmpStorageUnit();
		const destinationDir = {
			storageUnit: tmpStorageUnit,
			filePath: SCREENSHOT_DIR,
		} as IFilePath;
		const destinationFile = {
			...destinationDir,
			filePath: path.join(destinationDir.filePath, screenshotFilename),
		};
		await this.internalFileSystem.ensureDirectory(destinationDir);
		const destinationAbsolutePath = this.internalFileSystem.getAbsolutePath(destinationFile);
		await this.systemAPI.takeScreenshot(destinationAbsolutePath);
		const uploadUri = uploadBaseUrl + '/upload/file?prefix=screenshot/';

		try {
			const response = await this.internalFileSystem.uploadFile(destinationFile, 'file', uploadUri);
			const data = JSON.parse(response);
			return data.uri;
		} finally {
			try {
				await this.internalFileSystem.deleteFile(destinationFile);
			} catch (error) {
				console.error('failed to cleanup screenshot after upload');
			}
		}
	}

	public async isConnected(): Promise<boolean> {
		const remoteServerHostname = url.parse(this.remoteServerUrl).hostname!;
		return await NetworkAPI.isConnectedToInternet(remoteServerHostname);
	}

	public async getSessionId(sessionIdKey: string): Promise<string | null> {
		try {
			return await this.cache.fetchOne(sessionIdKey);
		} catch (error) {
			return null;
		}
	}

	public async setSessionId(sessionIdKey: string, sessionId: string): Promise<void> {
		await this.cache.saveOne(sessionIdKey, sessionId);
	}

	public async managementSupports(capability: ManagementCapability) {
		switch (capability) {
			case Capability.MODEL:
			case Capability.SERIAL_NUMBER:
			case Capability.NETWORK_INFO:
			case Capability.STORAGE_UNITS:
			case Capability.TEMPERATURE:
			case Capability.SCREENSHOT_UPLOAD:
			case Capability.TIMERS_PROPRIETARY:
			case Capability.SCREEN_RESIZE:
			case Capability.SET_TIME:
			case Capability.SET_TIMEZONE:
			case Capability.GET_TIMEZONE:
			case Capability.NTP_TIME:
			case Capability.APP_UPGRADE:
			case Capability.FIRMWARE_UPGRADE:
			case Capability.SET_VOLUME:
			case Capability.SET_DEBUG:
			case Capability.SYSTEM_REBOOT:
			case Capability.APP_RESTART:
			case Capability.DISPLAY_POWER:
			case Capability.SERVLET:
				return true;

			case Capability.SET_BRIGHTNESS:
				return this.display.supports(DisplayCapability.BRIGHTNESS);

			case Capability.TIMERS_NATIVE:
				return this.display.supports(DisplayCapability.SCHEDULE);

			case Capability.PROXIMITY_SENSOR:
				return this.sensors.supports(SensorCapability.PROXIMITY);

			default:
				return false;
		}
	}

	public async getConfigurationBaseUrl(): Promise<string | null> {
		return null; // use default
	}

	public getVolume(): Promise<number> {
		return this.display.getVolume();
	}

	public setVolume(volume: number): Promise<void> {
		return this.display.setVolume(volume);
	}

	public async screenGetBrightness(): Promise<IBrightness> {
		const brightness = await this.display.getBrightness();
		return {
			brightness1: brightness,
			brightness2: brightness,
			timeFrom1: '00:00:00',
			timeFrom2: '00:00:00',
		};
	}

	public screenSetBrightness(timeFrom1: string, brightness1: number, timeFrom2: string, brightness2: number): Promise<void> {
		let brightness = brightness1 === brightness2 ?
			brightness1 :
			resolveCurrentBrightness(timeFrom1, brightness1, timeFrom2, brightness2, now().toDate());
		return this.display.setBrightness(brightness);
	}

	public async packageInstall(_baseUrl: string, _packageName: string, _version: string, _build: string | null): Promise<void> {
		throw new Error('Not implemented');
	}

	public async systemReboot(): Promise<void> {
		await this.systemAPI.reboot();
	}

	public async appRestart() {
		await Promise.all([
			this.systemAPI.restartApplication(),
			this.videoPlayer.clearAll(),
			this.overlayRenderer.hideAll(),
		]);
	}

	public displayIsPowerOn(): Promise<boolean> {
		return this.display.isPowerOn();
	}

	public displayPowerOn(): Promise<void> {
		return this.display.powerOn();
	}

	public displayPowerOff(): Promise<void> {
		return this.display.powerOff();
	}

	public async screenResize(
		_baseUrl: string,
		orientation: Orientation,
		_resolution: Resolution,
		_currentVersion: string,
		videoOrientation?: VideoOrientation,
	): Promise<() => Promise<void> | Promise<void>> {
		await Promise.all([
			this.systemSettings.setScreenOrientation(orientation, videoOrientation),
			this.display.setOSDOrientation(orientation).catch((error: Error) => console.error('setOSDOrientation failed', error)),
		]);
		return () => this.appRestart();
	}

	public getTimers() {
		return this.display.getTimers();
	}

	public setTimer(
		type: TimerType,
		timeOn: string | null,
		timeOff: string | null,
		weekdays: TimerWeekday[],
		_volume: number,
	): Promise<void> {
		return this.display.setTimer(type, timeOn, timeOff, weekdays);
	}

	public async remoteControlIsEnabled(): Promise<boolean> {
		throw new Error('Not implemented');
	}

	public async remoteControlSetEnabled(_enabled: boolean): Promise<void> {
		throw new Error('Not implemented');
	}

	public async getCurrentTimeWithTimezone(): Promise<{ currentDate: Date; timezone?: string, ntpServer?: string }> {
		const [currentDateString, timezone] = await Promise.all([
			this.systemAPI.getDatetime(),
			this.systemAPI.getTimezone(),
		]);
		const currentDate = moment.tz(currentDateString, timezone).toDate();
		try {
			const ntpServer = await this.systemAPI.getNTPServer();
			return { currentDate, timezone, ntpServer };
		} catch (error) {
			return { currentDate, timezone };
		}
	}

	public async setManualTime(_datetime: Date): Promise<void> {
		throw new Error('Not implemented');
	}

	public async setManualTimeWithTimezone(timestampMs: number, timezone: string): Promise<void> {
		const datetimeString = moment(timestampMs).format('YYYY-MM-DD HH:mm:ss');
		await this.systemAPI.setDatetime(datetimeString);
		await this.systemAPI.setTimezone(timezone);
		await this.display.syncDatetimeWithSystem();
		setTimeout(() => this.systemAPI.restartServer(), 1e3);
	}

	public async setNTPTimeWithTimezone(ntpServer: string, timezone: string): Promise<void> {
		await this.systemAPI.setNTPServer(ntpServer);
		await this.systemAPI.setTimezone(timezone);
		await this.display.syncDatetimeWithSystem();
		setTimeout(() => this.systemAPI.restartServer(), 1e3);
	}

	public async setDebug(enabled: boolean): Promise<void> {
		if (enabled) {
			await this.systemAPI.enableNativeDebug();
		} else {
			await this.systemAPI.disableNativeDebug();
		}
	}

	public cacheGetAll(): Promise<{ [p: string]: string }> {
		return this.cache.fetchAll();
	}

	public cacheGetUids(): Promise<string[]> {
		return this.cache.fetchAllUids();
	}

	public cacheGet(uid: string): Promise<string> {
		return this.cache.fetchOne(uid);
	}

	public cacheSave(uid: string, content: string): Promise<void> {
		return this.cache.saveOne(uid, content);
	}

	public cacheDelete(uid: string): Promise<void> {
		return this.cache.deleteOne(uid);
	}

	public cacheGetStorageInfo(): Promise<ICacheStorageInfo> {
		return this.cache.getStorageInfo();
	}

	public resetSettings(): Promise<void> {
		return this.display.resetSettings();
	}

	public factoryReset(): Promise<void> {
		return this.systemAPI.factoryReset();
	}
}
