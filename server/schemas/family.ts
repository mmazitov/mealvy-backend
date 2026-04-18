import { gql } from 'graphql-tag';

export const familyTypeDefs = gql`
  enum FamilyMemberStatus {
    OWNER
    MEMBER
    PENDING
  }

  type FamilyMember {
    id: ID!
    email: String!
    name: String
    status: FamilyMemberStatus!
    sharedMenusCount: Int
    invitedAt: String
  }

  extend type Query {
    familyMembers: [FamilyMember!]!
  }

  extend type Mutation {
    inviteFamilyMember(email: String!): FamilyMember!
    acceptFamilyInvitation(invitationId: ID!): FamilyMember!
    removeFamilyMember(memberId: ID!): FamilyMember!
    cancelFamilyInvitation(invitationId: ID!): FamilyMember!
  }
`;
