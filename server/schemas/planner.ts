import { gql } from 'graphql-tag';

export const plannerTypeDefs = gql`
	type PlannerItem {
		id: ID!
		userId: ID!
		dishId: ID!
		dish: Dish!
		date: String!
		mealTime: String!
		createdAt: String!
	}

	input PlannerItemInput {
		dishId: ID!
		date: String!
		mealTime: String!
	}

	extend type Query {
		getPlannerItems(startDate: String!, endDate: String!): [PlannerItem!]!
	}

	extend type Mutation {
		savePlanner(items: [PlannerItemInput!]!, startDate: String!, endDate: String!): Boolean!
	}
`;
