import { gql } from 'graphql-tag';

export const dishTypeDefs = gql`
	type Ingredient {
		name: String!
		amount: String!
		productId: ID
	}

	input IngredientInput {
		name: String!
		amount: String!
		productId: ID
	}

	type Dish {
		id: ID!
		name: String!
		category: String
		imageUrl: String
		ingredients: [Ingredient!]!
		instructions: [String!]!
		prepTime: Int
		servings: Int
		calories: Int
		protein: Float
		fat: Float
		carbs: Float
		description: String
		createdAt: String!
		updatedAt: String!
		userId: ID!
		isFavorite: Boolean
	}

	extend type Query {
		dish(id: ID!): Dish
		dishByName(name: String!): Dish
		dishes(
			category: String
			search: String
			limit: Int
			offset: Int
		): [Dish!]!
		favoriteDishes: [Dish!]!
	}

	extend type Mutation {
		createDish(
			name: String!
			category: String
			imageUrl: String
			ingredients: [IngredientInput!]!
			instructions: [String!]!
			prepTime: Int
			servings: Int
			calories: Int
			protein: Float
			fat: Float
			carbs: Float
			description: String
		): Dish!
		updateDish(
			id: ID!
			name: String
			category: String
			imageUrl: String
			ingredients: [IngredientInput!]
			instructions: [String!]
			prepTime: Int
			servings: Int
			calories: Int
			protein: Float
			fat: Float
			carbs: Float
			description: String
		): Dish!
		addToFavoritesDish(dishId: ID!): User!
		removeFromFavoritesDish(dishId: ID!): User!
		deleteDish(id: ID!): Dish!
	}
`;