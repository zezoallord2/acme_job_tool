import { describe, it, expect, beforeEach, afterEach } from "vitest";
import net from "node:net";
import { SMTPMailProvider, DevelopmentMailProvider } from "@/lib/mail";
import { passwordResetEmail } from "@/lib/email-templates";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * A minimal SMTP server good enough for one transaction, speaking enough of
 * RFC 5321 for nodemailer. It deliberately advertises no STARTTLS, which is
 * what makes the encryption test meaningful.
 */
interface Captured {
  from: string;
  recipients: string[];
  data: string;
}

function createFakeSmtp(options: { advertiseStartTls: boolean }) {
  const captured: Captured[] = [];
  const sockets = new Set<net.Socket>();

  const server = net.createServer((socket) => {
    sockets.add(socket);
    let buffer = "";
    let inData = false;
    let current: Captured = { from: "", recipients: [], data: "" };
    const commands: string[] = [];

    const write = (line: string) => socket.write(`${line}\r\n`);
    write("220 fake.smtp ESMTP ready");

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let index: number;
      while ((index = buffer.indexOf("\r\n")) !== -1) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);

        if (inData) {
          if (line === ".") {
            inData = false;
            captured.push(current);
            current = { from: "", recipients: [], data: "" };
            write("250 2.0.0 Ok: queued");
            continue;
          }
          // Dot-stuffing: a leading ".." means a literal ".".
          current.data += `${line.startsWith("..") ? line.slice(1) : line}\n`;
          continue;
        }

        commands.push(line.toUpperCase());
        if (line.toUpperCase().startsWith("EHLO")) {
          write("250-fake.smtp greets you");
          if (options.advertiseStartTls) write("250-STARTTLS");
          write("250 8BITMIME");
        } else if (line.toUpperCase().startsWith("HELO")) {
          write("250 fake.smtp");
        } else if (line.toUpperCase().startsWith("MAIL FROM")) {
          current.from = line
            .slice(line.indexOf(":") + 1)
            .trim()
            .replace(/[<>]/g, "");
          write("250 2.1.0 Ok");
        } else if (line.toUpperCase().startsWith("RCPT TO")) {
          current.recipients.push(
            line
              .slice(line.indexOf(":") + 1)
              .trim()
              .replace(/[<>]/g, ""),
          );
          write("250 2.1.5 Ok");
        } else if (line.toUpperCase().startsWith("DATA")) {
          inData = true;
          write("354 End data with <CR><LF>.<CR><LF>");
        } else if (line.toUpperCase().startsWith("STARTTLS")) {
          // Refuse cleanly. Answering 250 here would make the client start a TLS
          // handshake on a plaintext socket and hang, which is not the scenario
          // under test.
          write("454 4.7.0 TLS not available");
        } else if (line.toUpperCase().startsWith("QUIT")) {
          write("221 2.0.0 Bye");
          socket.end();
        } else if (line.toUpperCase().startsWith("RSET")) {
          write("250 2.0.0 Ok");
        } else {
          write("250 2.0.0 Ok");
        }
      }
    });

    socket.on("error", () => {
      /* the client hanging up mid-test is expected in the failure cases */
    });
    socket.on("close", () => sockets.delete(socket));
  });

  return {
    captured,
    listen: () =>
      new Promise<number>((resolve) => {
        server.listen(0, "127.0.0.1", () => {
          const address = server.address();
          resolve(typeof address === "object" && address ? address.port : 0);
        });
      }),
    close: () =>
      new Promise<void>((resolve) => {
        for (const s of sockets) s.destroy();
        server.close(() => resolve());
      }),
  };
}

describe("SMTPMailProvider", () => {
  let server: ReturnType<typeof createFakeSmtp>;
  let port: number;

  beforeEach(async () => {
    server = createFakeSmtp({ advertiseStartTls: false });
    port = await server.listen();
  });

  afterEach(async () => {
    await server.close();
  });

  function provider(port: number, requireSTARTTLS?: boolean) {
    return new SMTPMailProvider({
      host: "127.0.0.1",
      port,
      secure: false,
      requireSTARTTLS,
      from: "no-reply@acmejobs.example",
      fromName: "Acme Jobs",
    });
  }

  it("delivers a message over the wire", async () => {
    const mail = provider(port, false);
    const rendered = passwordResetEmail({
      name: "Sam",
      resetUrl: "https://acmejobs.example/reset-password?token=abc123",
      expiresInMinutes: 60,
    });

    const result = await mail.send({
      to: "buyer@example.test",
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    expect(result.accepted).toBe(true);
    expect(result.driver).toBe("smtp");
    expect(server.captured).toHaveLength(1);

    const message = server.captured[0]!;
    expect(message.from).toBe("no-reply@acmejobs.example");
    expect(message.recipients).toEqual(["buyer@example.test"]);
    expect(message.data).toContain("Subject:");
    expect(message.data).toContain("reset-password?token=abc123");
    // Machine-generated, so it is not filed as a reply to a support thread.
    expect(message.data).toMatch(/Auto-Submitted:\s*auto-generated/i);
  });

  it("refuses to send unencrypted by default", async () => {
    const mail = provider(port); // requireSTARTTLS unset -> must default to strict

    await expect(
      mail.send({
        to: "buyer@example.test",
        subject: "hello",
        html: "<p>hello</p>",
        text: "hello",
      }),
    ).rejects.toThrow();

    // The important part: nothing was transmitted.
    expect(server.captured).toHaveLength(0);
  });

  it("reports not-ready rather than throwing on an empty config", async () => {
    const empty = new SMTPMailProvider({
      host: "",
      port: 587,
      secure: false,
      from: "",
      fromName: "",
    });
    expect(empty.isReady()).toBe(false);
    await expect(
      empty.send({
        to: "x@example.test",
        subject: "s",
        html: "<p>s</p>",
        text: "t",
      }),
    ).rejects.toThrow();
  });
});

describe("DevelopmentMailProvider", () => {
  let dir: string;

  beforeEach(() => {
    dir = join(tmpdir(), `acme-mail-${Math.random().toString(36).slice(2)}`);
  });

  afterEach(async () => {
    await rm(dir, { force: true, recursive: true });
  });

  it("records the message so a local reset is retrievable", async () => {
    const mail = new DevelopmentMailProvider(dir);
    expect(mail.isReady()).toBe(true);

    const result = await mail.send({
      to: "dev@example.test",
      subject: "Reset your password",
      html: "<p>hi</p>",
      text: "hi",
    });

    expect(result.accepted).toBe(true);
    expect(result.driver).toBe("development");
  });
});
