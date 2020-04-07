// polyfill promisify for node.js 5
require('util').promisify = require('util.promisify');
import { EventEmitter } from 'events';
import * as AsyncLock from 'async-lock';
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
import { createFrontDrivers } from './Driver/frontDriverFactory';
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
				console.log('Bridge socket connected');
				socketEventEmitter.emit('connected');
				resolve(socket);
			},
			() => console.log('Bridge socket disconnected'),
			(error: any) => console.error(error),
		);
	});

	const { frontDriver, managementDriver } = createFrontDrivers(
		window,
		parameters.server.bridge_url,
		parameters.server.file_system_url,
		parameters.frontApplet.prefix,
		parameters.video.max_count,
		socketClient,
		() => new Promise<void>((resolve: () => void) => {
			socketEventEmitter.once('connected', resolve);
		}),
	);

	await frontDriver.initialize(parameters.url.staticBaseUrl);
	await managementDriver.initialize(parameters.url.staticBaseUrl);

	const synchronizer = createSocketSynchronizer(
		parameters.url.synchronizerServerUrl,
		() => frontDriver,
	);

	try {
		const deviceUid = await frontDriver.getDeviceUid();
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
		frontDriver,
		managementDriver,
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
