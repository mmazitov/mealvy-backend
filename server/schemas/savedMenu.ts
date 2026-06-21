import { gql } from 'graphql-tag';

export const savedMenuTypeDefs = gql`
	type SavedMenuDish {
		id: ID!
		name: String!
		imageUrl: String
		category: String
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
		isFavorite: Boolean!
		createdAt: String!
		updatedAt: String!
		items: [SavedMenuItem!]!
		# Populated only for menus owned by someone else (Shared tab / detail view).
		ownerId: ID
		ownerName: String
		ownerEmail: String
	}

	extend type Query {
		savedMenus: [SavedMenu!]!
		sharedMenus: [SavedMenu!]!
		savedMenu(id: ID!): SavedMenu
	}

	extend type Mutation {
		saveMenuPlan(
			name: String!
			startDate: String!
			endDate: String!
			weekNumber: Int!
		): SavedMenu!
		updateSavedMenu(
			id: ID!
			name: String!
			startDate: String!
			endDate: String!
		): SavedMenu!
		deleteSavedMenu(id: ID!): SavedMenu!
		duplicateSavedMenu(id: ID!): SavedMenu!
		applyTemplateToPlanner(savedMenuId: ID!, targetStartDate: String!): Boolean!
	}
`;
