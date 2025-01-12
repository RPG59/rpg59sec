import wrtc from "@roamhq/wrtc";

async function waitUntilIceGatheringStateComplete(peerConnection, options) {
  if (peerConnection.iceGatheringState === "complete") {
    return;
  }

  const { timeToHostCandidates } = options;

  const deferred = {};
  deferred.promise = new Promise((resolve, reject) => {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });

  const timeout = options.setTimeout(() => {
    peerConnection.removeEventListener("icecandidate", onIceCandidate);
    deferred.reject(new Error("Timed out waiting for host candidates"));
  }, timeToHostCandidates);

  function onIceCandidate({ candidate }) {
    if (!candidate) {
      options.clearTimeout(timeout);
      peerConnection.removeEventListener("icecandidate", onIceCandidate);
      deferred.resolve();
    }
  }

  peerConnection.addEventListener("icecandidate", onIceCandidate);

  await deferred.promise;
}

export class ServerTransport implements UnderlyingSource {
  constructor(
    public peerConnection: wrtc.RTCPeerConnection,
    private dataChannel: wrtc.RTCDataChannel
  ) {}

  async start(controller: ReadableStreamController<ArrayBuffer>) {
    const onMessage = ({ data }: { data: ArrayBuffer | string }) => {
      controller.enqueue(data);
    };

    this.dataChannel.addEventListener("message", onMessage);
  }

  async applyAnswer(answer: Record<string, any>) {
    await this.peerConnection.setRemoteDescription(answer);
  }

  send(data: Uint8Array | string) {
    this.dataChannel.send(data);
  }
}

export async function ServerTransportFactory() {
  const peerConnection = new wrtc.RTCPeerConnection({
    sdpSemantics: "unified-plan",
  });

  const dataChannel = peerConnection.createDataChannel(
    "datachannel-buffer-limits"
  );

  const serverTransport = new ServerTransport(peerConnection, dataChannel);

  // FIXME
  //   peerConnection.addEventListener("connectionstatechange", () => {
  //     if (
  //       ["disconnected", "failed", "closed"].includes(
  //         peerConnection.connectionState
  //       )
  //     ) {
  //       dataChannel.removeEventListener("message", onMessage);
  //       dataChannel.close();
  //     }
  //   });

  peerConnection.addEventListener("iceconnectionstatechange", () => {
    console.log("iceconnectionstatechange EVENT");
  });

  const offer = await peerConnection.createOffer();

  await peerConnection.setLocalDescription(offer);

  try {
    await waitUntilIceGatheringStateComplete(peerConnection, {
      timeToHostCandidates: 5000,
      setTimeout,
      clearTimeout,
    });
  } catch (e) {
    throw e;
  }

  return serverTransport;
}
