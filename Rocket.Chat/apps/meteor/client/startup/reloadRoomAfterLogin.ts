import { FlowRouter } from 'meteor/kadira:flow-router';
import { Meteor } from 'meteor/meteor';
import { Tracker } from 'meteor/tracker';

import { LegacyRoomManager } from '../../app/ui-utils/client';
import { roomCoordinator } from '../lib/rooms/roomCoordinator';

Meteor.startup(() => {
	// Reload rooms after login
	let currentUsername: string | undefined = undefined;
	Tracker.autorun(async () => {
		const user = await Meteor.userAsync();
		if (currentUsername === undefined && (user ? user.username : undefined)) {
			currentUsername = user?.username;
			LegacyRoomManager.closeAllRooms();
			// Reload only if the current route is a channel route
			const routeName = FlowRouter.current().route?.name;
			if (!routeName) {
				return;
			}
			const roomType = roomCoordinator.getRouteNameIdentifier(routeName);
			if (roomType) {
				FlowRouter.reload();
			}
		}
	});
});
