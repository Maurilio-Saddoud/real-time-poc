async function initAgents() {
  const respA = await fetch("/session1");
  const sessionA = await respA.json();
  const EPHEMERAL_KEY_A = sessionA.client_secret.value;

  const respB = await fetch("/session2");
  const sessionB = await respB.json();
  const EPHEMERAL_KEY_B = sessionB.client_secret.value;

  const baseUrl = "https://api.openai.com/v1/realtime";
  const model = "gpt-4o-mini-realtime-preview-2024-12-17";

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  // ============ AGENT A ============
  const pcA = new RTCPeerConnection();
  const micStreamA = await navigator.mediaDevices.getUserMedia({ audio: true });
  const micSourceA = audioCtx.createMediaStreamSource(micStreamA);

  const outputToB = audioCtx.createMediaStreamDestination(); // Merged output for B
  const gainNodeA = audioCtx.createGain(); // Normalize/boost A's output volume

  pcA.ontrack = (event) => {
    // Immediately play A's remote TTS
    document.getElementById("audioA").srcObject = event.streams[0];

    // Merge A's TTS output with microphone input for Session B
    const remoteSourceA = audioCtx.createMediaStreamSource(event.streams[0]);
    remoteSourceA.connect(gainNodeA).connect(outputToB); // Normalize A's output
    micSourceA.connect(outputToB);

    // Send merged output to Session B
    sendMergedStream(pcB, outputToB.stream, EPHEMERAL_KEY_B);
  };

  micStreamA.getTracks().forEach((track) => pcA.addTrack(track, micStreamA));

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
  const micSourceB = audioCtx.createMediaStreamSource(micStreamB);

  const outputToA = audioCtx.createMediaStreamDestination(); // Merged output for A
  const gainNodeB = audioCtx.createGain(); // Normalize/boost B's output volume

  pcB.ontrack = (event) => {
    // Immediately play B's remote TTS
    document.getElementById("audioB").srcObject = event.streams[0];

    // Merge B's TTS output with microphone input for Session A
    const remoteSourceB = audioCtx.createMediaStreamSource(event.streams[0]);
    remoteSourceB.connect(gainNodeB).connect(outputToA); // Normalize B's output
    micSourceB.connect(outputToA);

    // Send merged output to Session A
    sendMergedStream(pcA, outputToA.stream, EPHEMERAL_KEY_A);
  };

  micStreamB.getTracks().forEach((track) => pcB.addTrack(track, micStreamB));

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

  // ============ Merging and Sending Function ============
  async function sendMergedStream(targetPc, mergedStream, ephemeralKey) {
    // Add new tracks to the target PC
    mergedStream.getTracks().forEach((track) => targetPc.addTrack(track, mergedStream));

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
  }

  console.log("Agents A and B initialized with merged audio streams.");
}

initAgents().catch(console.error);
