async function init() {
  // Get an ephemeral key from your server
  const tokenResponse = await fetch("/session");
  const data = await tokenResponse.json();
  const EPHEMERAL_KEY = data.client_secret.value;

  // Create a peer connection
  const pc = new RTCPeerConnection();

  // Set up to play remote audio from the model
  const audioEl = document.createElement("audio");
  audioEl.autoplay = true;
  pc.ontrack = (e) => {
    audioEl.srcObject = e.streams[0];

    // Start audio analysis for image scaling
    const audioStream = e.streams[0];
    startImageScaling(audioStream);
  };

  // Add local audio track for microphone input in the browser
  const ms = await navigator.mediaDevices.getUserMedia({
    audio: true,
  });
  pc.addTrack(ms.getTracks()[0]);

  // Set up data channel for sending and receiving events
  const dc = pc.createDataChannel("oai-events");
  dc.addEventListener("message", (e) => {
    console.log(e); // Realtime server events appear here!
  });

  // Start the session using the Session Description Protocol (SDP)
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  // Add a new instruction before creating the offer
  const newInstruction =
    "You are a motivational coach. Respond with encouragement.";

  // Pass the instruction as part of your initial setup
  const messages = [{ role: "system", content: newInstruction }];

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

  const answer = {
    type: "answer",
    sdp: await sdpResponse.text(),
  };
  await pc.setRemoteDescription(answer);
}

// Function to start scaling the image based on audio
function startImageScaling(audioStream) {
  // Set up audio context and analyzer
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioContext.createMediaStreamSource(audioStream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;

  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  source.connect(analyser);

  // Target image element for scaling
  const imageElement = document.getElementById("animated-image");

  // Animation loop
  function scaleImage() {
    analyser.getByteFrequencyData(dataArray);

    // Calculate the average frequency
    const avgFrequency =
      dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;

    // Map the frequency range (0–255) to a scaling factor (1–3)
    const scaleFactor = 1 + (avgFrequency / 255) * 2;

    // Log scaling factor for debugging
    console.log(`Scale Factor: ${scaleFactor}`);

    // Update the image's transform property
    imageElement.style.transform = `translate(-50%, -50%) scale(${scaleFactor})`;

    // Repeat animation
    requestAnimationFrame(scaleImage);
  }

  // Start the scaling loop
  scaleImage();
}

init();
