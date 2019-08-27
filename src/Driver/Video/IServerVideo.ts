import IVideoEvent from '@signageos/front-display/es6/Video/IVideoEvent';
import { IVideoArguments } from './ServerVideo';

interface IServerVideo {
	getVideoArguments(): IVideoArguments | null;
	initialize(): Promise<void>;
	close(): Promise<void>;
	prepare(uri: string, x: number, y: number, width: number, height: number, isStream: boolean): Promise<void>;
	play(): Promise<void>;
	stop(): Promise<void>;
	isIdle(): boolean;
	isPlaying(): boolean;
	isPaused(): boolean;
	addEventListener(eventName: string, listener: (event: IVideoEvent) => void): void;
}

export default IServerVideo;
