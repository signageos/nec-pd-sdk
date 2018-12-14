import { resolve4 as resolveDns } from 'dns';
import { networkInterfaces as osGetNetworkInterfaces } from 'os';
import { execApiCommand } from './apiCommand';

export enum NetworkInterfaceType {
	WIFI,
	ETHERNET,
}

export interface INetworkInterface {
	type: NetworkInterfaceType;
	name: string;
	ip: string;
	mac: string;
	netmask: string;
}

export async function getEthernet(): Promise<INetworkInterface | null> {
	const networkInterfaces = osGetNetworkInterfaces();

	for (let name of Object.keys(networkInterfaces)) {
		const networkInterface = networkInterfaces[name][0];
		if (name.startsWith('eth')) {
			return {
				type: NetworkInterfaceType.ETHERNET,
				name,
				ip: networkInterface.address,
				mac: networkInterface.mac,
				netmask: networkInterface.netmask,
			};
		}
	}

	return null;
}

export async function getWifi(): Promise<INetworkInterface | null> {
	const networkInterfaces = osGetNetworkInterfaces();

	for (let name of Object.keys(networkInterfaces)) {
		const networkInterface = networkInterfaces[name][0];
		if (name.startsWith('wlan')) {
			return {
				type: NetworkInterfaceType.WIFI,
				name,
				ip: networkInterface.address,
				mac: networkInterface.mac,
				netmask: networkInterface.netmask,
			};
		}
	}

	return null;
}

export function isConnectedToInternet(domainToContact: string) {
	return new Promise<boolean>((resolve: (isConnected: boolean) => void) => {
		resolveDns(domainToContact, (error: Error) => {
			if (error) {
				resolve(false);
			} else {
				resolve(true);
			}
		});
	});
}

export async function getDefaultGateway() {
	return await execApiCommand('network', 'gateway');
}

export async function getDNSSettings() {
	const dnsSettings = await execApiCommand('network', 'dns');
	return dnsSettings.split("\n");
}
