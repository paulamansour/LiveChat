import { Meteor } from 'meteor/meteor';
import { EmojiCustom } from '@rocket.chat/models';
import { api } from '@rocket.chat/core-services';
import type { ServerMethods } from '@rocket.chat/ui-contexts';
import type { ICustomEmojiDescriptor } from '@rocket.chat/core-typings';

import { hasPermissionAsync } from '../../../authorization/server/functions/hasPermission';
import { RocketChatFileEmojiCustomInstance } from '../startup/emoji-custom';

declare module '@rocket.chat/ui-contexts' {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	interface ServerMethods {
		deleteEmojiCustom(emojiID: ICustomEmojiDescriptor['_id']): boolean;
	}
}

Meteor.methods<ServerMethods>({
	async deleteEmojiCustom(emojiID) {
		if (!this.userId || !(await hasPermissionAsync(this.userId, 'manage-emoji'))) {
			throw new Meteor.Error('not_authorized');
		}

		const emoji = await EmojiCustom.findOneById(emojiID);
		if (emoji == null) {
			throw new Meteor.Error('Custom_Emoji_Error_Invalid_Emoji', 'Invalid emoji', {
				method: 'deleteEmojiCustom',
			});
		}

		RocketChatFileEmojiCustomInstance.deleteFile(encodeURIComponent(`${emoji.name}.${emoji.extension}`));
		await EmojiCustom.removeById(emojiID);
		void api.broadcast('emoji.deleteCustom', emoji);

		return true;
	},
});
