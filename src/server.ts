import { randomUUID } from "node:crypto";
import { ReadableStream } from "node:stream/web";
import { Tun } from "tuntap2";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";

import { ServerTransport, ServerTransportFactory } from "./serverTransport";
import { BasicAuthCreds } from "./types";

class Client {
  transportStream: ReadableStream;

  constructor(private tunDevice: Tun, public transport: ServerTransport) {
    this.transportStream = new ReadableStream(transport);
    this.start();
  }

  async start() {
    for await (const message of this.transportStream) {
      console.log(message);
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
    const client = new Client({} as any, transport);

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
