import IMonitors, { IMonitor } from '@signageos/front-display/es6/NativeDevice/IMonitors';
import { INECAPI } from '../../API/NECAPI';

export default class NECMonitors implements IMonitors {

	constructor(
		private necAPI: INECAPI,
	) {}

	public async getList(): Promise<IMonitor[]> {
		const manufacturer = 'NEC';
		const [model, serial] = await Promise.all([
			this.necAPI.getModel(),
			this.necAPI.getSerialNumber(),
		]);
		return [{ manufacturer, model, serial }];
	}
}