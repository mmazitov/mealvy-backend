import { gql } from 'graphql-tag';

export const productTypeDefs = gql`
	type Product {
		id: ID!
		name: String!
		category: String
		imageUrl: String
		calories: Int
		fat: Float
		carbs: Float
		protein: Float
		description: String
		createdAt: String!
		updatedAt: String!
		userId: ID!
		isFavorite: Boolean
	}

	extend type Query {
		product(id: ID!): Product
		productByName(name: String!): Product
		products(
			category: String
			search: String
			limit: Int
			offset: Int
		): [Product!]!
	}

	extend type Mutation {
		createProduct(
			name: String!
			category: String
			imageUrl: String
			calories: Int
			fat: Float
			carbs: Float
			protein: Float
			description: String
		): Product!
		updateProduct(
			id: ID!
			name: String
			category: String
			imageUrl: String
			calories: Int
			fat: Float
			carbs: Float
			protein: Float
			description: String
		): Product!
		deleteProduct(id: ID!): Product!
	}
`;