import { gql } from 'graphql-tag';

export const plannerTypeDefs = gql`
	type PlannerItem {
		id: ID!
		userId: ID!
		dishId: ID!
		dish: Dish!
		day: String!
		mealTime: String!
		weekStart: String!
		createdAt: String!
	}

	input PlannerItemInput {
		dishId: ID!
		day: String!
		mealTime: String!
		weekStart: String!
	}

	extend type Query {
		getPlannerItems(weekStart: String!): [PlannerItem!]!
	}

	extend type Mutation {
		savePlanner(items: [PlannerItemInput!]!, weekStart: String!): Boolean!
	}
`;
