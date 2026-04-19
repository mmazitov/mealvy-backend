import { mergeResolvers } from '@graphql-tools/merge';

import { dishResolvers } from './dish.js';
import { familyResolvers } from './family.js';
import { plannerResolvers } from './planner.js';
import { productResolvers } from './product.js';
import { savedMenuResolvers } from './savedMenu.js';
import { userResolvers } from './user.js';

export const resolvers = mergeResolvers([
	userResolvers,
	productResolvers,
	dishResolvers,
	plannerResolvers,
	savedMenuResolvers,
	familyResolvers,
]);