import { Random } from '@rocket.chat/random';

import { Config } from './ufs-config';
import { Filter } from './ufs-filter';
import { MIME } from './ufs-mime';
import { Store } from './ufs-store';
import { StorePermissions } from './ufs-store-permissions';
import { Tokens } from './ufs-tokens';

const stores: Record<string, Store> = {};
const store: Record<string, typeof Store> = {};

export const UploadFS = {
	config: new Config(),

	store,

	tokens: Tokens,

	addStore(store: Store) {
		if (!(store instanceof Store)) {
			throw new TypeError('ufs: store is not an instance of UploadFS.Store.');
		}
		stores[store.getName()] = store;
	},

	generateEtag() {
		return Random.id();
	},

	getMimeType(extension: string) {
		extension = extension.toLowerCase();
		return MIME[extension];
	},

	getMimeTypes() {
		return MIME;
	},

	getStore(name: string) {
		return stores[name];
	},

	getStores() {
		return stores;
	},

	getTempFilePath(fileId: string) {
		return `${this.config.tmpDir}/${fileId}`;
	},

	Config,
	Filter,
	Store,
	StorePermissions,
};

await import('./ufs-methods');
await import('./ufs-server');
await import('./ufs-gridfs');
await import('./ufs-local');
