import TimerWeekday from '@signageos/front-display/es6/NativeDevice/Timer/TimerWeekday';
import DisplayCapability from './DisplayCapability';
import ITimer from '@signageos/front-display/es6/NativeDevice/Timer/ITimer';
import TimerType from '@signageos/front-display/es6/NativeDevice/Timer/TimerType';

interface IDisplay {
	supports(capability: DisplayCapability): boolean;
	isPowerOn(): Promise<boolean>;
	powerOff(): Promise<void>;
	powerOn(): Promise<void>;
	getBrightness(): Promise<number>;
	setBrightness(brightness: number): Promise<void>;
	getVolume(): Promise<number>;
	setVolume(volume: number): Promise<void>;
	getTimers(): Promise<ITimer[]>;
	setTimer(type: TimerType, timeOn: string | null, timeOff: string | null, weekdays: TimerWeekday[]): Promise<void>;
}

export default IDisplay;