import * as sinon from 'sinon';
import BridgeServer from '../../../src/Bridge/BridgeServer';
import BridgeClient from '../../../src/Bridge/BridgeClient';

const params = require('../../../config/parameters');

export function createBridgeAndItsDependencies() {
	const fileSystem = {};
	const fileDetailsProvider = {};
	const nativeDriver = {};
	const display = {};
	const systemSettings = {};
	const videoPlayer = {
		initialize: sinon.stub().resolves(),
		close: sinon.stub().resolves(),
		addEventListener: sinon.spy(),
	};
	const overlayRenderer = {};
	const cecListener = {
		listen: sinon.stub().resolves(),
		close: sinon.stub().resolves(),
	};
	const bridgeServer = new BridgeServer(
		params.server.bridge_url,
		fileSystem as any,
		fileDetailsProvider as any,
		nativeDriver as any,
		display as any,
		videoPlayer as any,
		overlayRenderer as any,
		cecListener as any,
	);
	const bridgeClient = new BridgeClient(params.server.bridge_url);
	return {
		fileSystem,
		fileDetailsProvider,
		nativeDriver,
		display,
		systemSettings,
		videoPlayer,
		overlayRenderer,
		cecListener,
		bridgeServer,
		bridgeClient,
	};
}
