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
		menuPlanId: ID
		createdAt: String!
	}

	type MenuPlan {
		id: ID!
		userId: ID!
		date: String!
		week: Int
		day: String
		items: [PlannerItem!]!
		createdAt: String!
		updatedAt: String!
	}

	input PlannerItemInput {
		id: ID
		dishId: ID!
		date: String!
		mealTime: MealTime!
	}

	extend type Query {
		getPlannerItems(startDate: String!, endDate: String!): [PlannerItem!]!
		getMenuPlans(startDate: String!, endDate: String!): [MenuPlan!]!
	}

	extend type Mutation {
		savePlanner(items: [PlannerItemInput!]!, startDate: String!, endDate: String!): Boolean!
	}
`;
