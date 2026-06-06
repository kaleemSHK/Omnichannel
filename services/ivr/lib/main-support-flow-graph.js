/**
 * Main Support IVR — matches demo call-flow diagram (language → main menu → queues).
 * Backend-native graph (ARI flow-executor): play + collectDigits + transfer/enqueue.
 */
export const MAIN_SUPPORT_IVR_GRAPH = {
  entry: 'lang_menu',
  nodes: [
    {
      id: 'lang_menu',
      type: 'play',
      text: 'Welcome to BlinkOne support. Press 1 for English. Press 2 for Urdu.',
      media: 'sound:hello-world',
      collectDigits: true,
      timeoutSec: 8,
      defaultDigit: '1',
      routes: { '1': 'main_menu', '2': 'main_menu', '3': 'main_menu' },
    },
    {
      id: 'main_menu',
      type: 'play',
      text: 'Press 1 Sales, 2 Technical Support, 3 Billing, 4 Ticket status, 5 Speak with an agent.',
      collectDigits: true,
      timeoutSec: 10,
      defaultDigit: '5',
      routes: {
        '1': 'q_sales',
        '2': 'q_tech',
        '3': 'q_billing',
        '4': 'ticket_stub',
        '5': 'q_support',
        '0': 'main_menu',
      },
    },
    {
      id: 'ticket_stub',
      type: 'play',
      text: 'Please enter your ticket number on the mobile app or website. Returning to menu.',
      next: 'main_menu',
    },
    {
      id: 'q_sales',
      type: 'transfer',
      queue: 'sales',
      config: { queueKey: 'sales' },
    },
    {
      id: 'q_tech',
      type: 'transfer',
      queue: 'support',
      config: { queueKey: 'support', skillRequirements: [{ skill: 'support', required: true }] },
    },
    {
      id: 'q_billing',
      type: 'transfer',
      queue: 'support',
      config: { queueKey: 'support' },
    },
    {
      id: 'q_support',
      type: 'transfer',
      queue: 'support',
      config: { queueKey: 'support', skillRequirements: [{ skill: 'support', required: true }] },
    },
    { id: 'hangup', type: 'hangup' },
  ],
};
