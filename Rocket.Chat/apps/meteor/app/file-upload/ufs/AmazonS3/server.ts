import stream from 'stream';

import { check } from 'meteor/check';
import { Random } from '@rocket.chat/random';
import _ from 'underscore';
import S3 from 'aws-sdk/clients/s3';
import type { OptionalId } from 'mongodb';

import { UploadFS } from '../../../../server/ufs';
import { SystemLogger } from '../../../../server/lib/logger/system';
import type { IFile } from '../../../../server/ufs/definition';
import type { StoreOptions } from '../../../../server/ufs/ufs-store';

export type S3Options = StoreOptions & {
	connection: {
		accessKeyId?: string;
		secretAccessKey?: string;
		endpoint?: string;
		signatureVersion: string;
		s3ForcePathStyle?: boolean;
		params: {
			Bucket: string;
			ACL: string;
		};
		region: string;
	};
	URLExpiryTimeSpan: number;
	getPath: (file: OptionalId<IFile>) => string;
};

class AmazonS3Store extends UploadFS.Store {
	protected getPath: (file: IFile) => string;

	constructor(options: S3Options) {
		// Default options
		// options.secretAccessKey,
		// options.accessKeyId,
		// options.region,
		// options.sslEnabled // optional

		options = _.extend(
			{
				httpOptions: {
					timeout: 6000,
					agent: false,
				},
			},
			options,
		);

		super(options);

		const classOptions = options;

		const s3 = new S3(options.connection);

		options.getPath =
			options.getPath ||
			function (file) {
				return file._id;
			};

		this.getPath = function (file) {
			if (file.AmazonS3) {
				return file.AmazonS3.path;
			}
			// Compatibility
			// TODO: Migration
			if (file.s3) {
				return file.s3.path + file._id;
			}

			return file._id;
		};

		this.getRedirectURL = async (file, forceDownload = false) => {
			const params = {
				Key: this.getPath(file),
				Expires: classOptions.URLExpiryTimeSpan,
				ResponseContentDisposition: `${forceDownload ? 'attachment' : 'inline'}; filename="${encodeURI(file.name || '')}"`,
			};

			return s3.getSignedUrl('getObject', params);
		};

		/**
		 * Creates the file in the collection
		 * @param file
		 * @param callback
		 * @return {string}
		 */
		this.create = (file, callback) => {
			check(file, Object);

			if (file._id == null) {
				file._id = Random.id();
			}

			file.AmazonS3 = {
				path: classOptions.getPath(file),
			};

			file.store = this.options.name; // assign store to file
			return this.getCollection().insert(file, callback);
		};

		/**
		 * Removes the file
		 * @param fileId
		 * @param callback
		 */
		this.delete = function (fileId, callback) {
			const file = this.getCollection().findOne({ _id: fileId });
			if (!file) {
				callback?.(new Error('File not found'));
				return;
			}
			const params = {
				Key: this.getPath(file),
				Bucket: classOptions.connection.params.Bucket,
			};

			s3.deleteObject(params, (err, data) => {
				if (err) {
					SystemLogger.error(err);
				}

				callback?.(err, data);
			});
		};

		/**
		 * Returns the file read stream
		 * @param fileId
		 * @param file
		 * @param options
		 * @return {*}
		 */
		this.getReadStream = function (_fileId, file, options = {}) {
			const params: {
				Key: string;
				Bucket: string;
				Range?: string;
			} = {
				Key: this.getPath(file),
				Bucket: classOptions.connection.params.Bucket,
			};

			if (options.start && options.end) {
				params.Range = `${options.start} - ${options.end}`;
			}

			return s3.getObject(params).createReadStream();
		};

		/**
		 * Returns the file write stream
		 * @param fileId
		 * @param file
		 * @param options
		 * @return {*}
		 */
		this.getWriteStream = function (_fileId, file /* , options*/) {
			const writeStream = new stream.PassThrough();
			// TODO: Check if is necessary, type does not allow;
			// writeStream.length = file.size;

			writeStream.on('newListener', (event, listener) => {
				if (event === 'finish') {
					process.nextTick(() => {
						writeStream.removeListener(event, listener);
						writeStream.on('real_finish', listener);
					});
				}
			});

			s3.putObject(
				{
					Key: this.getPath(file),
					Body: writeStream,
					ContentType: file.type,
					Bucket: classOptions.connection.params.Bucket,
				},
				(error) => {
					if (error) {
						SystemLogger.error(error);
					}

					writeStream.emit('real_finish');
				},
			);

			return writeStream;
		};
	}
}

// Add store to UFS namespace
UploadFS.store.AmazonS3 = AmazonS3Store;
