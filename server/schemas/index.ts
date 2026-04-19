import { mergeTypeDefs } from '@graphql-tools/merge';
import { gql } from 'graphql-tag';

import { dishTypeDefs } from './dish.js';
import { familyTypeDefs } from './family.js';
import { plannerTypeDefs } from './planner.js';
import { productTypeDefs } from './product.js';
import { savedMenuTypeDefs } from './savedMenu.js';
import { userTypeDefs } from './user.js';

const baseTypeDefs = gql`
	type Query {
		_empty: String
	}

	type Mutation {
		_empty: String
	}
`;

export const typeDefs = mergeTypeDefs([
	baseTypeDefs,
	userTypeDefs,
	productTypeDefs,
	dishTypeDefs,
	plannerTypeDefs,
	savedMenuTypeDefs,
	familyTypeDefs,
]);