import wrtc from "@roamhq/wrtc";
import { BasicAuthCreds, TransportStatus } from "./types";
import { makeBasicAuthHeader } from "./utils";

export class ClientTransport implements UnderlyingSource {
  private dataChannel: wrtc.RTCDataChannel | undefined;

  constructor(private host: string, private basicAuthCreds: BasicAuthCreds) {}

  public send(data: Buffer) {
    if (!this.dataChannel) {
      return;
    }

    console.log(data);

    this.dataChannel.send(data);
  }

  onDataChannel(dataChannel, controller: ReadableStreamController<Uint8Array>) {
    console.log("ON DATA CHANNEL");
    console.log(dataChannel.label);

    if (dataChannel.label !== "datachannel-buffer-limits") {
      return;
    }

    const onMessage = ({ data }: { data: Uint8Array }) => {
      controller.enqueue(data);
    };

    this.dataChannel = dataChannel;
    controller.enqueue(new TextEncoder().encode(TransportStatus.OK));

    setTimeout(() => {
      dataChannel.addEventListener("message", (event) => onMessage(event));
    }, 200);
  }

  async start(controller: ReadableStreamController<Uint8Array>) {
    console.log("__START__");

    const response1 = await fetch(`${this.host}/client/connect`, {
      headers: {
        authorization: makeBasicAuthHeader(this.basicAuthCreds),
      },
      method: "GET",
    });

    const remotePeerConnection = await response1.json();
    const { id } = remotePeerConnection;

    const localPeerConnection = new wrtc.RTCPeerConnection({
      sdpSemantics: "unified-plan",
      //   portRange: { min: 50000, max: 50002 },
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

      localPeerConnection.addEventListener("datachannel", ({ channel }) =>
        this.onDataChannel(channel, controller)
      );

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

      await fetch(`${this.host}/client/apply-answer/${id}`, {
        method: "POST",
        body: JSON.stringify(localPeerConnection.localDescription),
        headers: {
          "Content-Type": "application/json",
          authorization: makeBasicAuthHeader(this.basicAuthCreds),
        },
      });

      console.log("SET REMOTE DESCRIPTION");

      return localPeerConnection;
    } catch (error) {
      close();
      throw error;
    }
  }
}
