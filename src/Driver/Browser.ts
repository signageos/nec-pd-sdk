import { locked } from '@signageos/front-display/es6/Lock/lockedDecorator';
import { IOpenLinkOptions } from '@signageos/front-display/es6/NativeDevice/IBrowser';
import BridgeClient, { MessageType } from '../Bridge/BridgeClient';
import { BrowserSetACLWhitelist, BrowserSetACLBlacklist, BrowserClearACL } from '../Bridge/bridgeBrowserMessages';
import ProprietaryBrowser from '@signageos/front-display/es6/Browser/ProprietaryBrowser';

export default class Browser extends ProprietaryBrowser {

	constructor(
		window: Window,
		private bridge: BridgeClient,
	) {
		super(window);
	}

	@locked('browser')
	public async open(uri: string, options?: IOpenLinkOptions): Promise<void> {
		if (options && options.aclDomains) {
			await this.setACL(options.aclDomains, options.aclMode);
		} else {
			await this.clearACL();
		}
		await super.open(uri, options);
	}

	@locked('browser')
	public async close(): Promise<void> {
		await super.close();
		await this.clearACL();
	}

	private async setACL(acl: string[], mode: 'blacklist' | 'whitelist' = 'blacklist') {
		if (mode === 'whitelist') {
			await this.bridge.invoke<BrowserSetACLWhitelist, {}>(
				{ type: BrowserSetACLWhitelist, acl },
				MessageType.BROWSER,
			);
		} else {
			await this.bridge.invoke<BrowserSetACLBlacklist, {}>(
				{ type: BrowserSetACLBlacklist, acl },
				MessageType.BROWSER,
			);
		}
	}

	private async clearACL() {
		await this.bridge.invoke<BrowserClearACL, {}>({ type: BrowserClearACL }, MessageType.BROWSER);
	}
}
