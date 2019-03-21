import Orientation from '../Driver/Orientation';

export const NotifyApplicationAlive = 'Application.NotifyAlive';
export interface NotifyApplicationAlive {
	type: typeof NotifyApplicationAlive;
}

export const ApplicationRestart = 'Application.Restart';
export interface ApplicationRestart {
	type: typeof ApplicationRestart;
}

export const SystemReboot = 'System.Reboot';
export interface SystemReboot {
	type: typeof SystemReboot;
}

export const GetDeviceUid = 'System.GetDeviceUid';
export interface GetDeviceUid {
	type: typeof GetDeviceUid;
}

export const GetModel = 'System.GetModel';
export interface GetModel {
	type: typeof GetModel;
}

export const GetSerialNumber = 'System.GetSerialNumber';
export interface GetSerialNumber {
	type: typeof GetSerialNumber;
}

export const SetNativeDebug = 'System.SetNativeDebug';
export interface SetNativeDebug {
	type: typeof SetNativeDebug;
	isEnabled: boolean;
}

export const NetworkGetInfo = 'Network.GetInfo';
export interface NetworkGetInfo {
	type: typeof NetworkGetInfo;
}

export const ScreenGetOrientation = 'Screen.GetOrientation';
export interface ScreenGetOrientation {
	type: typeof ScreenGetOrientation;
}

export const ScreenSetOrientation = 'Screen.SetOrientation';
export interface ScreenSetOrientation {
	type: typeof ScreenSetOrientation;
	orientation: Orientation;
}

export const ScreenTurnOff = 'Screen.TurnOff';
export interface ScreenTurnOff {
	type: typeof ScreenTurnOff;
}

export const ScreenTurnOn = 'Screen.TurnOn';
export interface ScreenTurnOn {
	type: typeof ScreenTurnOn;
}

export const AudioGetVolume = 'Audio.GetVolume';
export interface AudioGetVolume {
	type: typeof AudioGetVolume;
}

export const AudioSetVolume = 'Audio.SetVolume';
export interface AudioSetVolume {
	type: typeof AudioSetVolume;
	volume: number;
}
