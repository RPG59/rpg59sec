import wrtc from "@roamhq/wrtc";
import { BasicAuthCreds, TransportStatus } from "./types";
import { makeBasicAuthHeader } from "./utils";

export class ClientTransport implements UnderlyingSource {
  constructor(
    public peerConnection: wrtc.RTCPeerConnection,
    private dataChannel: wrtc.RTCDataChannel
  ) {}

  send(data: Uint8Array | string) {
    this.dataChannel.send(data);
  }

  async start(controller: ReadableStreamController<Uint8Array>) {
    console.log("DataChannel label: ", this.dataChannel.label);

    if (this.dataChannel.label !== "datachannel-buffer-limits") {
      // FIXME
      return;
    }

    const onMessage = ({ data }: { data: ArrayBuffer }) => {
      controller.enqueue(new Uint8Array(data));
    };

    setTimeout(() => {
      this.dataChannel.addEventListener("message", (event) => onMessage(event));
    }, 200);
  }
}

export async function ClientTransportFactory(
  host: string,
  basicAuthCreds: BasicAuthCreds
) {
  const response1 = await fetch(`${host}/client/connect`, {
    headers: {
      authorization: makeBasicAuthHeader(basicAuthCreds),
    },
    method: "GET",
  });

  const remotePeerConnection = await response1.json();
  const { id } = remotePeerConnection;

  const localPeerConnection = new wrtc.RTCPeerConnection({
    sdpSemantics: "unified-plan",
    // FIXME
    // portRange: { min: 50000, max: 50002 },
  });

  try {
    console.log("GET DESCRIPTION", remotePeerConnection.localDescription);

    await localPeerConnection.setRemoteDescription(
      remotePeerConnection.localDescription
    );

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

    const clitenTransportPromise = new Promise<ClientTransport>((res) => {
      localPeerConnection.addEventListener(
        "datachannel",
        ({ channel }) => res(new ClientTransport(localPeerConnection, channel)),
        { once: true }
      );
    });

    const answer = await localPeerConnection.createAnswer();

    if (!answer.sdp) {
      throw new Error("Failed to create answer");
    }

    await localPeerConnection.setLocalDescription(
      new wrtc.RTCSessionDescription({
        type: "answer",
        sdp: answer.sdp,
      })
    );

    await fetch(`${host}/client/apply-answer/${id}`, {
      method: "POST",
      body: JSON.stringify(localPeerConnection.localDescription),
      headers: {
        "Content-Type": "application/json",
        authorization: makeBasicAuthHeader(basicAuthCreds),
      },
    });

    return clitenTransportPromise;
  } catch (error) {
    close();
    throw error;
  }
}
