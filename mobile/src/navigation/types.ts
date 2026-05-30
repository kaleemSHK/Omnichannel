import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  SelectRole: undefined;
  Login: undefined;
};

export type AgentTabParamList = {
  Dashboard: undefined;
  Conversations: undefined;
  Calls: undefined;
  Dial: undefined;
  Contacts: undefined;
  Settings: undefined;
};

export type AgentStackParamList = {
  AgentTabs: NavigatorScreenParams<AgentTabParamList>;
  ConversationDetail: { id: string };
};

export type CustomerTabParamList = {
  Home: undefined;
  Chats: undefined;
  Tickets: undefined;
};

export type CustomerStackParamList = {
  CustomerWelcome: undefined;
  CustomerTabs: NavigatorScreenParams<CustomerTabParamList>;
  ChatDetail: { id: string };
  TicketDetail: { id: string };
  NewTicket: undefined;
};

export type RootStackParamList = {
  Bootstrap: undefined;
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Agent: NavigatorScreenParams<AgentStackParamList>;
  Customer: NavigatorScreenParams<CustomerStackParamList>;
  CallActive: undefined;
  NotFound: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
