async function setupAssistant(name, tokenUrl, audioElement) {
  const tokenResponse = await fetch(tokenUrl);
  const data = await tokenResponse.json();
  const EPHEMERAL_KEY = data.client_secret.value;

  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });

  pc.ontrack = (event) => {
    console.log(`${name} received track:`, event.streams[0]);
    audioElement.srcObject = event.streams[0];
    audioElement.play().catch((error) => console.error(`${name} failed to play:`, error));
  };

  const offer = await pc.createOffer({ offerToReceiveAudio: true });
  await pc.setLocalDescription(offer);

  const baseUrl = "https://api.openai.com/v1/realtime";
  const model = "gpt-4o-mini-realtime-preview-2024-12-17";
  const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
    method: "POST",
    body: offer.sdp,
    headers: {
      Authorization: `Bearer ${EPHEMERAL_KEY}`,
      "Content-Type": "application/sdp",
    },
  });

  const answer = { type: "answer", sdp: await sdpResponse.text() };
  await pc.setRemoteDescription(answer);
  return { pc, audioElement };
}

async function connectAssistants() {
  const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  console.log("Microphone Tracks:", micStream.getTracks());

  const assistant1Audio = document.getElementById("assistant1-audio");
  const assistant2Audio = document.getElementById("assistant2-audio");

  const assistant1 = await setupAssistant("Assistant 1", "/session1", assistant1Audio);
  const assistant2 = await setupAssistant("Assistant 2", "/session2", assistant2Audio);

  micStream.getTracks().forEach((track) => {
    assistant1.pc.addTrack(track, micStream);
    assistant2.pc.addTrack(track, micStream);
    console.log("Added microphone track to assistants:", track);
  });

  const stream1 = assistant1.audioElement.captureStream();
  stream1.getTracks().forEach((track) => assistant2.pc.addTrack(track, stream1));
  console.log("Assistant 1 audio routed to Assistant 2:", stream1);

  const stream2 = assistant2.audioElement.captureStream();
  stream2.getTracks().forEach((track) => assistant1.pc.addTrack(track, stream2));
  console.log("Assistant 2 audio routed to Assistant 1:", stream2);
}


document.getElementById("start-communication").addEventListener("click", connectAssistants);
