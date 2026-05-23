; BlinkOne PJSIP — rendered at container start (envsubst)
; Tenant-specific trunks: infra/asterisk/tenants.yaml (Prompt 5 step 2+)

[global]
type=global
user_agent=BlinkOne-Asterisk
max_forwards=70
default_outbound_endpoint=kamailio-trunk

[system]
type=system
timer_t1=500
timer_b=32000

; ── Transports ────────────────────────────────────────────────────────────────
[transport-udp]
type=transport
protocol=udp
bind=0.0.0.0:5060
external_media_address=${AST_EXTERNAL_IP}
external_signaling_address=${AST_EXTERNAL_IP}
local_net=${AST_LOCAL_NET}

[transport-wss]
type=transport
protocol=wss
bind=0.0.0.0:8089
external_media_address=${AST_EXTERNAL_IP}
external_signaling_address=${AST_EXTERNAL_IP}
local_net=${AST_LOCAL_NET}

; ── Kamailio SBC (inbound/outbound SIP) ─────────────────────────────────────
[kamailio-trunk]
type=endpoint
context=from-trunk
disallow=all
allow=alaw,ulaw,opus
auth=kamailio-trunk-auth
aors=kamailio-trunk-aor
direct_media=no
rtp_symmetric=yes
force_rport=yes
rewrite_contact=yes

[kamailio-trunk-auth]
type=auth
auth_type=userpass
username=kamailio
password=${AST_TRUNK_SIP_PASS}

[kamailio-trunk-aor]
type=aor
contact=sip:blinkone-kamailio:5060
qualify_frequency=60

[kamailio-identify]
type=identify
endpoint=kamailio-trunk
match=blinkone-kamailio

; ── Dev softphone (direct UDP, bypass Kamailio for step-1 tests) ─────────────
[dev-phone]
type=endpoint
context=from-internal
disallow=all
allow=alaw,ulaw,opus
auth=dev-phone-auth
aors=dev-phone-aor
direct_media=no
rtp_symmetric=yes
force_rport=yes
rewrite_contact=yes

[dev-phone-auth]
type=auth
auth_type=userpass
username=1000
password=${AST_AGENT_SIP_PASS}

[dev-phone-aor]
type=aor
max_contacts=5
remove_existing=yes

; ── Agent WebRTC (JsSIP → WSS, Prompt 5 step 9) ─────────────────────────────
[agent-webrtc]
type=endpoint
context=from-agent
transport=transport-wss
disallow=all
allow=opus,alaw,ulaw
auth=agent-webrtc-auth
aors=agent-webrtc-aor
webrtc=yes
dtls_auto_generate_cert=no
dtls_cert_file=/var/lib/asterisk/certs/asterisk.pem
dtls_private_key=/var/lib/asterisk/certs/asterisk.key
media_encryption=dtls
direct_media=no
rtp_symmetric=yes
force_rport=yes
rewrite_contact=yes
ice_support=yes

[agent-webrtc-auth]
type=auth
auth_type=userpass
username=agent
password=${AST_AGENT_SIP_PASS}

[agent-webrtc-aor]
type=aor
max_contacts=10
remove_existing=yes
