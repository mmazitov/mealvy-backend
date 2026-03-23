import { gql } from 'graphql-tag';

export const plannerTypeDefs = gql`
	enum MealTime {
		BREAKFAST
		LUNCH
		DINNER
		SNACK
	}

	type PlannerItem {
		id: ID!
		userId: ID!
		dishId: ID!
		dish: Dish!
		date: String!
		mealTime: MealTime!
		createdAt: String!
	}

	input PlannerItemInput {
		id: ID
		dishId: ID!
		date: String!
		mealTime: MealTime!
	}

	extend type Query {
		getPlannerItems(startDate: String!, endDate: String!): [PlannerItem!]!
	}

	extend type Mutation {
		savePlanner(items: [PlannerItemInput!]!, startDate: String!, endDate: String!): Boolean!
	}
`;
