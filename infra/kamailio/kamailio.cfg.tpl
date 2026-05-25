#!KAMailio
# BlinkOne SBC — step 1: route inbound to Asterisk; outbound to Asterisk trunk peer
# DID → tenant mapping: /etc/kamailio/did-map.yaml (step 2+)

####### Global parameters #########
debug=2
log_stderror=yes
memdbg=5
memlog=5
children=4
fork=yes
auto_aliases=no
listen=udp:0.0.0.0:5060
listen=tcp:0.0.0.0:5060

####### Modules #########
loadmodule "tm.so"
loadmodule "sl.so"
loadmodule "rr.so"
loadmodule "pv.so"
loadmodule "maxfwd.so"
loadmodule "textops.so"
loadmodule "siputils.so"
loadmodule "xlog.so"
loadmodule "sanity.so"
loadmodule "rtpengine.so"
loadmodule "pike.so"

modparam("rtpengine", "rtpengine_sock", "${KAM_RTPENGINE_SOCK}")
modparam("pike", "sampling_time_unit", 2)
modparam("pike", "reqs_density_per_unit", 30)
modparam("pike", "remove_latency", 4)

####### Routing #########
request_route {
  if (!mf_process_maxfwd_header("10")) {
    sl_send_reply("483", "Too Many Hops");
    exit;
  }
  if (!sanity_check("1511", "7")) {
    xlog("L_WARN", "Malformed SIP from $si:$sp\n");
    exit;
  }

  if (is_method("OPTIONS")) {
    sl_send_reply("200", "OK");
    exit;
  }

  if (!pike_check_req()) {
    sl_send_reply("403", "Rate Limited");
    exit;
  }

  if (has_totag()) {
    if (loose_route()) {
      if (is_method("INVITE|UPDATE")) {
        rtpengine_manage("replace-origin replace-session-connection");
      }
      t_relay();
      exit;
    }
    sl_send_reply("404", "Not here");
    exit;
  }

  record_route();

  if (is_method("INVITE|SUBSCRIBE|REGISTER")) {
    if (is_method("INVITE")) {
      rtpengine_manage("replace-origin replace-session-connection");
    }
  }

  # Inbound from Twilio / trusted carriers (IP ranges — Prompt 16)
  if ($rp == 5060 && !($si == "${KAM_AST_HOST}" || $si =~ "blinkone-asterisk")) {
    if (!($si =~ "^54\\.172\\." || $si =~ "^54\\.244\\." || $si =~ "^54\\.171\\.127" || $si =~ "^35\\.156\\.191" || $si =~ "^54\\.65\\.63" || $si =~ "^54\\.169\\.127" || $si =~ "^54\\.252\\.254" || $si =~ "^177\\.71\\.206" || $si == "127.0.0.1" || $si =~ "^172\\." || $si =~ "^192\\.168\\.")) {
      xlog("L_WARN", "Rejected untrusted SIP source $si:$sp\n");
      sl_send_reply("403", "Forbidden");
      exit;
    }
  }

  # Inbound from carrier / softphone → Asterisk
  if ($rp == 5060 && $fd != "${KAM_SIP_DOMAIN}") {
    $ru = "sip:" + $rU + "@" + "${KAM_AST_HOST}" + ":" + "${KAM_AST_PORT}";
    $du = "sip:" + "${KAM_AST_HOST}" + ":" + "${KAM_AST_PORT}";
    t_relay();
    exit;
  }

  # Outbound from Asterisk → external (topology hiding via RR)
  if ($si == "${KAM_AST_HOST}" || $si =~ "blinkone-asterisk") {
    if (is_method("INVITE")) {
      rtpengine_manage("replace-origin replace-session-connection");
    }
    t_relay();
    exit;
  }

  # Default: send to Asterisk
  $ru = "sip:" + $rU + "@" + "${KAM_AST_HOST}" + ":" + "${KAM_AST_PORT}";
  $du = "sip:" + "${KAM_AST_HOST}" + ":" + "${KAM_AST_PORT}";
  t_relay();
}

reply_route {
  if (has_body("application/sdp")) {
    rtpengine_manage("replace-origin replace-session-connection");
  }
}
