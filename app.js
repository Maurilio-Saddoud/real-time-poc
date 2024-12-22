async function initAgents() {
  const respA = await fetch("/session1");
  const sessionA = await respA.json();
  const EPHEMERAL_KEY_A = sessionA.client_secret.value;

  const respB = await fetch("/session2");
  const sessionB = await respB.json();
  const EPHEMERAL_KEY_B = sessionB.client_secret.value;

  const baseUrl = "https://api.openai.com/v1/realtime";
  const model   = "gpt-4o-mini-realtime-preview-2024-12-17";

  // ============ AGENT A ============
  const pcA = new RTCPeerConnection();
  const micStreamA = await navigator.mediaDevices.getUserMedia({ audio: true });
  micStreamA.getTracks().forEach(track => pcA.addTrack(track, micStreamA));

  pcA.ontrack = (event) => {
    // Immediately play A's remote TTS
    document.getElementById("audioA").srcObject = event.streams[0];

    // Immediately bridge A → B (so B hears A as soon as possible)
    // No delay for bridging A -> B
    bridgeAudio(pcB, event.streams[0], EPHEMERAL_KEY_B, 0);
  };

  const offerA = await pcA.createOffer();
  await pcA.setLocalDescription(offerA);

  const resA = await fetch(`${baseUrl}?model=${model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${EPHEMERAL_KEY_A}`,
      "Content-Type": "application/sdp",
    },
    body: offerA.sdp,
  });
  const answerA = { type: "answer", sdp: await resA.text() };
  await pcA.setRemoteDescription(answerA);

  // ============ AGENT B ============
  const pcB = new RTCPeerConnection();
  const micStreamB = await navigator.mediaDevices.getUserMedia({ audio: true });
  micStreamB.getTracks().forEach(track => pcB.addTrack(track, micStreamB));

  pcB.ontrack = (event) => {
    // Immediately play B's remote TTS
    document.getElementById("audioB").srcObject = event.streams[0];

    // BUT: Delay bridging B → A for 15 seconds
    // So if B starts talking, A won't hear B for 15 seconds
    // (or, from B's perspective, B won't "send" TTS to A until 15s pass)
    bridgeAudio(pcA, event.streams[0], EPHEMERAL_KEY_A, 10_000);
  };

  const offerB = await pcB.createOffer();
  await pcB.setLocalDescription(offerB);

  const resB = await fetch(`${baseUrl}?model=${model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${EPHEMERAL_KEY_B}`,
      "Content-Type": "application/sdp",
    },
    body: offerB.sdp,
  });
  const answerB = { type: "answer", sdp: await resB.text() };
  await pcB.setRemoteDescription(answerB);

  // ============ Bridging Function ============
  async function bridgeAudio(targetPc, remoteStream, ephemeralKey, delayMs) {
    // If we have used this bridging path before, skip
    const uniqueKey = `_bridged_${ephemeralKey}_${delayMs}`; 
    if (targetPc[uniqueKey]) return;
    targetPc[uniqueKey] = true;

    // We'll do the bridging after delayMs
    setTimeout(async () => {
      console.log(
        `Starting bridging to ${ephemeralKey} after ${delayMs}ms delay...`
      );

      // Create an AudioContext to capture the remote audio
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source   = audioCtx.createMediaStreamSource(remoteStream);
      const dest     = audioCtx.createMediaStreamDestination();
      source.connect(dest);

      // Add new track(s) to targetPc
      dest.stream.getTracks().forEach(track => {
        targetPc.addTrack(track, dest.stream);
      });

      // Renegotiate
      const newOffer = await targetPc.createOffer();
      await targetPc.setLocalDescription(newOffer);

      const renegResp = await fetch(`${baseUrl}?model=${model}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          "Content-Type": "application/sdp",
        },
        body: newOffer.sdp,
      });
      if (!renegResp.ok) {
        console.error("Renegotiation error", await renegResp.text());
        return;
      }
      const newAnswer = { type: "answer", sdp: await renegResp.text() };
      await targetPc.setRemoteDescription(newAnswer);
      console.log(`Renegotiation complete for ${ephemeralKey}`);

    }, delayMs); // <-- This is the actual 15-second delay
  }

  console.log("Agents A and B initialized with delayed bridging for B → A.");
}

initAgents().catch(console.error);
