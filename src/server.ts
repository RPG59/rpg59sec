import { ReadableStream } from "node:stream/web";
import { basicAuth } from "hono/basic-auth";
import { serve } from "@hono/node-server";
import { randomUUID } from "node:crypto";
import { Tun } from "tuntap2";
import { Hono } from "hono";

import { ServerTransport, ServerTransportFactory } from "./serverTransport";
import { BasicAuthCreds, TransportStatus } from "./types";

class Client {
  transportStream: ReadableStream<string | ArrayBufferView>;
  hasStart = false;

  constructor(private tunDevice: Tun, public transport: ServerTransport) {
    this.transportStream = new ReadableStream(transport);
  }

  async start() {
    this.tunDevice.on("data", (data: Buffer) => {
      if (this.hasStart) {
        this.transport.send(new Uint8Array(data));
      }
    });

    for await (const message of this.transportStream) {
      if (!this.hasStart) {
        this.hasStart = message === TransportStatus.START;
      } else {
        if (typeof message !== "string") {
          this.tunDevice.write(new Uint8Array(message));
        }
      }
    }
  }

  destroy() {}
}

const CLIENTS: Record<string, Client> = {};

export async function server(
  port: number,
  address: string,
  basicAuthCreds: BasicAuthCreds
) {
  const tunDevice = new Tun();
  const app = new Hono();

  app.use("/client/*", basicAuth(basicAuthCreds));

  app.get("/health", (c) => c.text("Ok"));

  app.get("client/connect", async (connection) => {
    const id = randomUUID();
    const transport = await ServerTransportFactory();
    const client = new Client(tunDevice, transport);

    CLIENTS[id] = client;

    return connection.json({ id, ...transport.peerConnection });
  });

  app.post("client/apply-answer/:id", async (connection) => {
    const id = connection.req.param("id");
    const client = CLIENTS[id];

    if (!client) {
      return connection.status(404);
    }

    const body = await connection.req.json();
    console.log(body);

    await client.transport.applyAnswer(body);
    client.start();

    return connection.status(200);
  });

  app.delete("/connec/:id", async (connection) => {
    const id = connection.req.param("id");
    const client = CLIENTS[id];

    if (!client) {
      return connection.status(404);
    }

    client.destroy();
    delete CLIENTS[id];

    return connection.status(202);
  });

  console.log(`Server is running on http://localhost:${port}`);

  serve({
    fetch: app.fetch,
    port,
  });

  tunDevice.ipv4 = address;
  tunDevice.isUp = true;
}
