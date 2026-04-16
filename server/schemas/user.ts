import { gql } from 'graphql-tag';

export const userTypeDefs = gql`
  type User {
    id: ID!
    role: String
    email: String
    name: String
    avatar: String
    phone: String
    diet: String
    allergy: [String!]!
    dislike: [String!]!
    createdAt: String!
    updatedAt: String!
    favoriteProducts: [Product!]!
    favoriteDishes: [Dish!]!
    dishesCount: Int!
    productsCount: Int!
  }

  # Tokens set as httpOnly cookies — only user is returned in response body
  type AuthPayload {
    user: User!
  }

  extend type Query {
    me: User
    favoriteProducts: [Product!]!
    favoriteDishes: [Dish!]!
  }

  extend type Mutation {
    register(email: String!, password: String!, name: String): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    logout: Boolean!
    updateProfile(
      name: String
      phone: String
      avatar: String
      diet: String
      allergy: [String!]
      dislike: [String!]
    ): User!
    changePassword(currentPassword: String!, newPassword: String!): Boolean!
    addToFavoritesProduct(productId: ID!): User!
    removeFromFavoritesProduct(productId: ID!): User!
    addToFavoritesDish(dishId: ID!): User!
    removeFromFavoritesDish(dishId: ID!): User!
  }
`;
