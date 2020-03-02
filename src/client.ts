// polyfill promisify for node.js 5
import FrontSystemSettings from './SystemSettings/FrontSystemSettings';

require('util').promisify = require('util.promisify');

import { EventEmitter } from 'events';
import * as AsyncLock from 'async-lock';
import BridgeClient from './Bridge/BridgeClient';
import FrontDriver from './Driver/FrontDriver';
import front from '@signageos/front-display/es6/Front/front';
import { createSocketSynchronizer } from '@signageos/front-display/es6/Front/Applet/Sync/synchronizerFactory';
import * as Raven from 'raven-js';
delete window.fetch;
import "whatwg-fetch";
import { useRavenLogging } from '@signageos/front-display/es6/Logging/logger';
import ISocket from '@signageos/lib/dist/WebSocket/Client/ISocket';
import { MINUTE_IN_MS } from '@signageos/lib/dist/DateTime/millisecondConstants';
import { createWebWorkerFactory } from '@signageos/front-display/es6/WebWorker/masterWebWorkerFactory';
import { createAutoReconnectingSocket } from '@signageos/lib/dist/WebSocket/Client/WS/createWSSocket';
import { notifyClientAlive } from './Application/clientStatus';
import { getAutoVerification } from './helper';
import FrontManagementDriver from './Driver/FrontManagementDriver';
const parameters = require('../config/parameters');
const frontAppletPrefix = parameters.frontApplet.prefix;

if (parameters.raven.enabled) {
	Raven.config(parameters.raven.dsn, parameters.raven.config).install();
	useRavenLogging(window);
}

(async () => {
	const socketEventEmitter = new EventEmitter();
	const socketClient = await new Promise((resolve: (socket: ISocket) => void) => {
		const socket = createAutoReconnectingSocket(
			parameters.server.bridge_url,
			() => {
				socketEventEmitter.emit('connected');
				resolve(socket);
			},
			() => console.log('Bridge socket disconnected'),
			(error: any) => console.error(error),
		);
	});
	const bridge = new BridgeClient(parameters.server.bridge_url, socketClient);
	const systemSettings = new FrontSystemSettings(bridge);
	const nativeDriver = new FrontDriver(
		window,
		frontAppletPrefix,
		bridge,
		systemSettings,
		socketClient,
		parameters.server.file_system_url,
		parameters.video.max_count,
	);
	await nativeDriver.initialize(parameters.url.staticBaseUrl);
	const managementNativeDriver = new FrontManagementDriver(
		bridge,
		systemSettings,
		socketClient,
		parameters.server.file_system_url,
		() => new Promise<void>((resolve: () => void) => {
			socketEventEmitter.once('connected', resolve);
		}),
	);
	await managementNativeDriver.initialize(parameters.url.staticBaseUrl);

	const synchronizer = createSocketSynchronizer(
		parameters.url.synchronizerServerUrl,
		() => nativeDriver,
	);

	try {
		const deviceUid = await nativeDriver.getDeviceUid();
		Raven.setUserContext({
			id: deviceUid,
		});
	} catch (error) {
		console.error(error);
	}

	const offlineStorageLock = new AsyncLock({
		timeout: 2 * MINUTE_IN_MS,
	});

	const webWorkerFactory = createWebWorkerFactory(parameters.app.version);
	const autoVerification = getAutoVerification();

	await front(
		window,
		parameters.url.baseUrl,
		parameters.url.socketUri,
		parameters.url.staticBaseUrl,
		parameters.url.uploadBaseUrl,
		parameters.app.sessionIdKey,
		frontAppletPrefix,
		parameters.frontDisplay.version,
		parameters.url.weinreServerUrl,
		nativeDriver,
		managementNativeDriver,
		synchronizer,
		offlineStorageLock,
		webWorkerFactory,
		parameters.app.version,
		parameters.bundledApplet === null ? null : {
			version: parameters.bundledApplet.version,
			frontAppletVersion: parameters.bundledApplet.frontAppletVersion,
			checksum: parameters.bundledApplet.checksum,
			binaryFile: parameters.bundledApplet.binaryFile,
			frontAppletBinaryFile: parameters.bundledApplet.frontAppletBinaryFile,
		},
		autoVerification,
	);

	notifyClientAlive(socketClient);
})().catch((error: any) => console.error(error));
