#!/usr/bin/env node
/**
 * Patches Chatwoot CE v4.13 — calling UI (Respond.io-style, Chatwoot-native).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const ROOT = process.env.CHATWOOT_ROOT || '/app';
const MARK = 'BLINKONE_CALLING';

function patchFile(path, transform, label, { force } = {}) {
  if (!existsSync(path)) {
    console.warn(`${label}: ${path} not found — skip`);
    return;
  }
  let src = readFileSync(path, 'utf8');
  const broken = src.includes('data-blinkone-chat-list-body <!--');
  if (src.includes(MARK) && !broken && !force) {
    console.log(`${label} already patched`);
    return;
  }
  src = transform(src);
  writeFileSync(path, src);
  console.log(broken ? `repaired ${label}` : `patched ${label}`);
}

function addScriptImport(src, importLine) {
  if (src.includes(importLine)) return src;
  if (src.includes('<script setup>')) {
    return src.replace('<script setup>', `<script setup>\n${importLine}`);
  }
  if (src.includes('<script>')) {
    return src.replace('<script>', `<script>\n${importLine}\n`);
  }
  return src.replace(/<script(?=[\s>])/, match => `${match}\n${importLine}\n`);
}

/** Repair a prior bad patch that injected an HTML comment into the root div tag. */
function repairChatListRootDiv(src) {
  return src
    .replace(/ data-blinkone-chat-list-body <!-- BLINKONE_CALLING -->/g, '')
    .replace(
      /class="flex flex-col flex-shrink-0 conversations-list-wrap bg-n-surface-1"\s+:class="/,
      'class="flex flex-col flex-shrink-0 conversations-list-wrap bg-n-surface-1"\n    :class="',
    );
}

const CONVO_BOX = `${ROOT}/app/javascript/dashboard/components/widgets/conversation/ConversationBox.vue`;
const importBanner = `import ConversationCallBanner from 'dashboard/blinkone_components/Calling/ConversationCallBanner.vue'; // ${MARK}`;
const importLimits = `import LimitsUpgradeBanner from 'dashboard/blinkone_components/LimitsUpgradeBanner.vue'; // ${MARK}`;
const importTabs = `import CallsInboxTabs from 'dashboard/blinkone_components/Calling/CallsInboxTabs.vue'; // ${MARK}`;

patchFile(
  CONVO_BOX,
  src => {
    if (src.includes('ConversationCallBanner') && src.includes('LimitsUpgradeBanner')) return repairChatListRootDiv(src);
    let next = src.includes('ConversationCallBanner')
      ? src
      : addScriptImport(
          src.replace(
            /<\/script>\s*\n<template>\s*\n/,
            match => `${match}  <ConversationCallBanner />\n`,
          ),
          importBanner,
        );
    if (!next.includes('LimitsUpgradeBanner')) {
      next = addScriptImport(
        next.replace(
          /<\/script>\s*\n<template>\s*\n/,
          match => `${match}  <LimitsUpgradeBanner />\n`,
        ),
        importLimits,
      );
    }
    return next;
  },
  'ConversationBox.vue',
  { force: true },
);

patchFile(
  `${ROOT}/app/javascript/dashboard/components/ChatList.vue`,
  src => {
    let s = repairChatListRootDiv(src);
    if (!s.includes('CallsInboxTabs')) {
      s = addScriptImport(
        s.replace(
          /<template>\s*\n\s*<div\s*\n\s*class="flex flex-col flex-shrink-0 conversations-list-wrap bg-n-surface-1"/,
          `<template>
  <CallsInboxTabs />
  <div
    class="flex flex-col flex-shrink-0 conversations-list-wrap bg-n-surface-1"`,
        ),
        importTabs,
      );
    } else if (!s.includes(importTabs)) {
      s = addScriptImport(s, importTabs);
    }
    return s;
  },
  'ChatList.vue',
  { force: true },
);

patchFile(
  `${ROOT}/app/javascript/dashboard/routes/dashboard/conversation/ContactPanel.vue`,
  src => {
    let s = addScriptImport(
      src,
      `import CallActivitiesSection from 'dashboard/blinkone_components/Calling/CallActivitiesSection.vue'; // ${MARK}`,
    );
    if (!s.includes('blinkone_call_activities')) {
      s = s.replace(
        'conversationSidebarItems.value = conversationSidebarItemsOrder.value;',
        `conversationSidebarItems.value = conversationSidebarItemsOrder.value;
  if (!conversationSidebarItems.value.some(i => i.name === 'blinkone_call_activities')) {
    conversationSidebarItems.value.push({ name: 'blinkone_call_activities' });
  }`,
      );
      s = s.replace(
        `<div v-else-if="element.name === 'contact_notes'">`,
        `<div v-else-if="element.name === 'blinkone_call_activities'"><!-- ${MARK} -->
            <CallActivitiesSection :conversation-id="conversationId" />
          </div>
          <div v-else-if="element.name === 'contact_notes'">`,
      );
    }
    s = s.replace(
      /<div class="border-t border-n-weak mt-2">\s*<p class="px-3 py-2 text-xs font-medium text-n-slate-11">Call<\/p>\s*<CallActivitiesPanel[^]*?<\/div>\s*(?=<\/template>)/,
      '',
    );
    return s;
  },
  'ContactPanel.vue',
);

patchFile(
  `${ROOT}/app/javascript/dashboard/components/widgets/conversation/ReplyBox.vue`,
  src => {
    if (src.includes('ChannelCallPicker')) return src;
    return addScriptImport(
      src.replace(
        '<ArticleSearchPopover',
        `<ChannelCallPicker />\n    <ArticleSearchPopover`,
      ),
      `import ChannelCallPicker from 'dashboard/blinkone_components/Calling/ChannelCallPicker.vue'; // ${MARK}`,
    );
  },
  'ReplyBox.vue',
);

patchFile(
  `${ROOT}/package.json`,
  src => {
    if (src.includes('"jssip"')) return src;
    return src.replace('"dependencies": {', '"dependencies": {\n    "jssip": "^3.10.1",');
  },
  'package.json',
);

console.log('BlinkOne calling inbox patch complete');
