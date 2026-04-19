import { gql } from 'graphql-tag';

export const savedMenuTypeDefs = gql`
	type SavedMenuDish {
		id: ID!
		name: String!
		imageUrl: String
		calories: Int
		protein: Float
		fat: Float
		carbs: Float
	}

	type SavedMenuItem {
		id: ID!
		dishId: ID!
		date: String!
		mealTime: MealTime!
		dish: SavedMenuDish!
	}

	type SavedMenu {
		id: ID!
		name: String!
		startDate: String!
		endDate: String!
		weekNumber: Int!
		totalDishes: Int!
		totalCalories: Int!
		totalProtein: Float!
		totalFat: Float!
		totalCarbs: Float!
		createdAt: String!
		updatedAt: String!
		items: [SavedMenuItem!]!
	}

	extend type Query {
		savedMenus: [SavedMenu!]!
		savedMenu(id: ID!): SavedMenu
	}

	extend type Mutation {
		saveMenuPlan(
			name: String!
			startDate: String!
			endDate: String!
			weekNumber: Int!
		): SavedMenu!
		deleteSavedMenu(id: ID!): SavedMenu!
		duplicateSavedMenu(id: ID!): SavedMenu!
		applyTemplateToPlanner(savedMenuId: ID!, targetStartDate: String!): Boolean!
	}
`;
