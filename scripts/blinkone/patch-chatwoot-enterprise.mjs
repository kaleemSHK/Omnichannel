#!/usr/bin/env node
/**
 * Mount BlinkOne enterprise UI: Agent Assist sidebar, SLA conversation badge.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const ROOT = process.env.CHATWOOT_ROOT || '/app';
const MARK = 'BLINKONE_ENTERPRISE';

function patchConversationSidebar() {
  const path = `${ROOT}/app/javascript/dashboard/routes/dashboard/conversation/ConversationPanel.vue`;
  if (!existsSync(path)) {
    console.warn('ConversationPanel.vue not found — skip agent assist patch');
    return;
  }
  let src = readFileSync(path, 'utf8');
  if (src.includes(MARK)) {
    console.log('ConversationPanel already patched');
    return;
  }
  if (!src.includes('ContactPanel')) {
    console.warn('ContactPanel not found in ConversationPanel');
    return;
  }
  const importLine = `import AgentAssistPanel from 'dashboard/blinkone_components/AgentAssist/AgentAssistPanel.vue'; // ${MARK}`;
  if (!src.includes('AgentAssistPanel')) {
    src = src.replace(
      /(<script[^>]*>)/,
      `$1\n${importLine}`,
    );
  }
  const insert = `
    <AgentAssistPanel v-if="currentChat" :conversation-id="currentChat.id" /> <!-- ${MARK} -->`;
  if (!src.includes('AgentAssistPanel')) {
    src = src.replace('</ContactPanel>', `</ContactPanel>${insert}`);
  }
  writeFileSync(path, src);
  console.log('patched ConversationPanel.vue');
}

function patchConversationHeader() {
  const candidates = [
    `${ROOT}/app/javascript/dashboard/components/widgets/conversation/ConversationHeader.vue`,
    `${ROOT}/app/javascript/dashboard/components/widgets/conversation/ConversationBox.vue`,
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    let src = readFileSync(path, 'utf8');
    if (src.includes(MARK)) continue;
    const importLine = `import SlaConversationBadge from 'dashboard/blinkone_components/sla/SlaConversationBadge.vue'; // ${MARK}`;
    if (!src.includes('SlaConversationBadge')) {
      src = src.replace(/(<script[^>]*>)/, `$1\n${importLine}`);
    }
    const badge = `\n    <SlaConversationBadge :conversation-id="currentChat?.id" class="ml-2" /> <!-- ${MARK} -->`;
    if (src.includes('<template>') && !src.includes('SlaConversationBadge')) {
      src = src.replace('<template>', `<template>${badge}`);
      writeFileSync(path, src);
      console.log(`patched ${path}`);
      return;
    }
  }
  console.warn('conversation header patch target not found');
}

patchConversationSidebar();
patchConversationHeader();
