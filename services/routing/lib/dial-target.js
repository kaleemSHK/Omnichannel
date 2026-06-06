/** SIP user to dial for browser desk after ACD assign (Kamailio usrloc). */
export function agentDeskDialTarget(agentId) {
  const desk = (process.env.AGENT_DESK_SIP_USER || 'blinkone').trim();
  if (!desk) return String(agentId);
  return desk;
}
